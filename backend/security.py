"""
Protections transverses de l'API Baume.

- Adresse IP réelle du visiteur (derrière le proxy de Render / Cloudflare),
  utilisée par les limites de requêtes.
- Verrouillage temporaire d'un e-mail après trop d'échecs de connexion.
- Champ « pot de miel » contre les robots qui remplissent tous les champs.
- En-têtes de sécurité HTTP.

Aucune de ces protections ne change le comportement pour une utilisatrice normale.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request
from slowapi import Limiter
from starlette.middleware.base import BaseHTTPMiddleware


# ── Adresse IP du visiteur ────────────────────────────────────────────────
def client_ip(request: Request) -> str:
    """
    IP réelle du visiteur. Derrière un proxy, request.client.host est l'adresse
    du proxy : toutes les visiteuses partageraient alors la même limite.
    """
    for header in ("cf-connecting-ip", "true-client-ip"):
        value = (request.headers.get(header) or "").strip()
        if value:
            return value
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "inconnue"


limiter = Limiter(key_func=client_ip)


# ── Verrouillage après échecs de connexion ────────────────────────────────
class LoginGuard:
    """
    Après MAX_FAILURES mots de passe erronés pour un même e-mail en WINDOW secondes,
    cet e-mail est bloqué LOCK secondes. Protège contre le test de mots de passe
    réparti sur plusieurs adresses IP. Une connexion réussie remet le compteur à zéro.
    """

    MAX_FAILURES = 8
    WINDOW = 15 * 60
    LOCK = 15 * 60

    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._locked_until: dict[str, float] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(email: str) -> str:
        return (email or "").strip().lower()

    def check(self, email: str) -> None:
        key = self._key(email)
        now = time.time()
        with self._lock:
            until = self._locked_until.get(key, 0)
            if until > now:
                minutes = max(1, int((until - now) // 60) + 1)
                raise HTTPException(
                    status_code=429,
                    detail=f"Trop de tentatives de connexion. Réessayez dans {minutes} minute{'s' if minutes > 1 else ''}.",
                )
            if until:
                self._locked_until.pop(key, None)

    def failure(self, email: str) -> None:
        key = self._key(email)
        now = time.time()
        with self._lock:
            q = self._failures[key]
            q.append(now)
            while q and q[0] < now - self.WINDOW:
                q.popleft()
            if len(q) >= self.MAX_FAILURES:
                self._locked_until[key] = now + self.LOCK
                q.clear()
            # Nettoyage occasionnel pour ne pas garder des milliers d'entrées.
            if len(self._failures) > 5000:
                for k in [k for k, v in self._failures.items() if not v or v[-1] < now - self.WINDOW]:
                    self._failures.pop(k, None)

    def success(self, email: str) -> None:
        key = self._key(email)
        with self._lock:
            self._failures.pop(key, None)
            self._locked_until.pop(key, None)


login_guard = LoginGuard()


# ── Pot de miel ───────────────────────────────────────────────────────────
def is_honeypot_filled(value: str | None) -> bool:
    """
    Les formulaires du site contiennent un champ « website » invisible pour les humains.
    Un robot qui remplit tous les champs se trahit : on fait semblant d'accepter
    sa demande sans rien enregistrer ni envoyer.
    """
    return bool((value or "").strip())


# ── En-têtes de sécurité ──────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """En-têtes standards pour une API JSON (sans effet sur le site ni les apps)."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response


# ── Mots de passe déjà fuités (HaveIBeenPwned, gratuit) ─────────────────────
PWNED_MESSAGE = "Ce mot de passe est apparu dans une fuite de données, choisissez-en un autre."


async def is_password_pwned(password: str) -> bool:
    """
    Vérifie si un mot de passe figure dans les fuites connues (service gratuit
    Pwned Passwords). Le mot de passe ne quitte jamais le serveur : seuls les
    5 premiers caractères de son empreinte SHA-1 sont envoyés (k-anonymat).
    En cas de panne ou de lenteur du service, renvoie False : on ne bloque jamais
    une inscription légitime à cause d'un service extérieur.
    """
    import hashlib

    import httpx

    if not password:
        return False
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={"Add-Padding": "true", "User-Agent": "Baume-Shop-API"},
            )
        if response.status_code != 200:
            return False
        for line in response.text.splitlines():
            candidate, _, count = line.partition(":")
            if candidate.strip() == suffix and count.strip() not in ("", "0"):
                return True
    except Exception:
        return False
    return False
