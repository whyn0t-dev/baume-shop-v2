from fastapi import Request, HTTPException, Depends, APIRouter
from security import limiter, login_guard, is_honeypot_filled, is_password_pwned, PWNED_MESSAGE
import asyncio
import base64
import json
import time
import httpx
from pydantic import BaseModel, EmailStr
from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Client anon pour l'auth Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Client service role pour les opérations DB (bypass RLS)
supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None
    # Champ invisible du formulaire (pot de miel anti-robots).
    website: str | None = None

class UpdateProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None

@auth_router.post("/login")
@limiter.limit("10/minute;60/hour")
async def login(request: Request, payload: LoginRequest):
    # Trop d'échecs récents pour cet e-mail : blocage temporaire (même depuis d'autres IP).
    login_guard.check(payload.email)
    try:
        result = supabase.auth.sign_in_with_password(
            {
                "email": payload.email,
                "password": payload.password,
            }
        )
    except Exception as e:
        msg = str(e)
        if "Invalid login credentials" in msg:
            login_guard.failure(payload.email)
            raise HTTPException(status_code=401, detail="Invalid login credentials")
        if "Email not confirmed" in msg:
            raise HTTPException(status_code=401, detail="Email not confirmed")
        if "rate limit" in msg.lower():
            raise HTTPException(status_code=429, detail="Email rate limit exceeded")
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    if not result.user or not result.session:
        login_guard.failure(payload.email)
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    login_guard.success(payload.email)

    # Double authentification active : le mot de passe ne suffit pas.
    # On renvoie un « ticket » temporaire (session partielle, sans jeton de renouvellement)
    # à échanger contre la vraie session avec le code à 6 chiffres.
    verified_factor = _first_verified_totp(result.user)
    if verified_factor:
        return {
            "mfa_required": True,
            "mfa_ticket": result.session.access_token,
            "factor_id": verified_factor,
        }

    # Client « service » : le client partagé garde la dernière session ouverte sur le serveur,
    # qui peut être celle d'une autre personne (ou une session partielle avant le code).
    profile_result = (
        supabase_admin.table("profiles")
        .select("*")
        .eq("id", result.user.id)
        .maybe_single()
        .execute()
    )

    profile = (getattr(profile_result, "data", None) if profile_result is not None else None) or {}

    return {
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "first_name": profile.get("first_name"),
            "last_name": profile.get("last_name"),
            "phone": profile.get("phone"),
            "address": profile.get("address"),
            "postal_code": profile.get("postal_code"),
            "city": profile.get("city"),
            "country": profile.get("country"),
            "role": profile.get("role", "customer"),
        },
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
    }


class RefreshRequest(BaseModel):
    refresh_token: str


@auth_router.post("/refresh")
@limiter.limit("30/minute")
async def refresh_session(request: Request, payload: RefreshRequest):
    """
    Renouvelle la session Supabase à partir du refresh token.
    Appel REST direct à GoTrue : le client Supabase partagé
    n'est pas modifié (aucun état global).
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token",
                params={"grant_type": "refresh_token"},
                json={"refresh_token": payload.refresh_token},
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Session expirée")

    data = response.json()

    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
    }


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@auth_router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(request: Request, payload: ForgotPasswordRequest):
    """
    Envoie l'e-mail Supabase de réinitialisation du mot de passe.
    Réponse identique que le compte existe ou non (pas d'énumération des e-mails).
    """
    import httpx

    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    params = {"redirect_to": f"{frontend}/reinitialiser-mot-de-passe"} if frontend else {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/recover",
                params=params,
                json={"email": payload.email},
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Email rate limit exceeded")
    return {"success": True}


@auth_router.post("/reset-password")
@limiter.limit("10/hour")
async def reset_password(request: Request, payload: ResetPasswordRequest):
    """Définit le nouveau mot de passe avec le jeton reçu dans le lien de l'e-mail."""
    import httpx

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères.")
    if not payload.token:
        raise HTTPException(status_code=400, detail="Token has expired or is invalid")
    if await is_password_pwned(payload.password):
        raise HTTPException(status_code=400, detail=PWNED_MESSAGE)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.put(
                f"{SUPABASE_URL}/auth/v1/user",
                json={"password": payload.password},
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {payload.token}",
                    "Content-Type": "application/json",
                },
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")
    if response.status_code == 422:
        raise HTTPException(status_code=400, detail="New password should be different from the old password")
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Token has expired or is invalid")
    return {"success": True}


@auth_router.post("/register")
@limiter.limit("10/hour")
async def register(request: Request, payload: RegisterRequest):
    # Robot : réponse identique à une inscription réussie, sans rien créer.
    if is_honeypot_filled(payload.website):
        return {
            "user": {
                "id": None,
                "email": payload.email,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "role": "customer",
            }
        }

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères.")
    if await is_password_pwned(payload.password):
        raise HTTPException(status_code=400, detail=PWNED_MESSAGE)

    result = supabase.auth.sign_up(
        {
            "email": payload.email,
            "password": payload.password,
        }
    )

    if not result.user:
        raise HTTPException(status_code=400, detail="Inscription impossible")

    user_id = result.user.id

    # Adresse déjà inscrite et confirmée : Supabase renvoie un compte factice sans identité.
    # On répond comme pour une inscription normale (on ne révèle pas quels e-mails existent)
    # mais on ne crée ni ne modifie aucune donnée.
    if getattr(result.user, "identities", None) == []:
        return {
            "user": {
                "id": None,
                "email": payload.email,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "role": "customer",
            }
        }

    # Compte déjà existant (inscription non confirmée relancée) : on ne touche ni à son rôle
    # ni à ses données, et on ne le supprime jamais en cas d'erreur.
    existing_profile = (
        supabase_admin.table("profiles").select("id, role").eq("id", user_id).limit(1).execute()
    ).data
    already_existed = bool(existing_profile)

    try:
        # ── Profil ────────────────────────────────────────────────────────
        if already_existed:
            supabase_admin.table("profiles").update(
                {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                }
            ).eq("id", user_id).execute()
        else:
            supabase_admin.table("profiles").upsert(
                {
                    "id": user_id,
                    "email": result.user.email,
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": "customer",
                }
            ).execute()

        # ── Customer ──────────────────────────────────────────────────────
        existing_customer = (
            supabase_admin.table("customers")
            .select("id")
            .eq("profile_id", user_id)
            .limit(1)
            .execute()
        )

        if not existing_customer.data:
            customer_result = (
                supabase_admin.table("customers")
                .insert(
                    {
                        "profile_id": user_id,
                        "email": result.user.email,
                        "first_name": payload.first_name,
                        "last_name": payload.last_name,
                    }
                )
                .execute()
            )
            customer_id = customer_result.data[0]["id"]
        else:
            customer_id = existing_customer.data[0]["id"]

        # ── Loyalty points ────────────────────────────────────────────────
        existing_points = (
            supabase_admin.table("loyalty_points").select("profile_id").eq("profile_id", user_id).limit(1).execute()
        ).data
        if not existing_points:
            supabase_admin.table("loyalty_points").insert(
                {
                    "profile_id": user_id,
                    "points": 0,
                    "total_earned": 0,
                    "total_spent": 0,
                    "generated_codes": [],
                }
            ).execute()

    except Exception as e:
        print(f"Register setup failed: {e} — rollback")
        if already_existed:
            # Jamais de suppression d'un compte qui existait avant cette demande.
            raise HTTPException(
                status_code=500,
                detail="Erreur lors de la création du compte. Veuillez réessayer.",
            )
        # Supprimer le profil et le user Supabase Auth pour éviter les données orphelines
        try:
            supabase_admin.table("profiles").delete().eq("id", user_id).execute()
        except:
            pass
        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except:
            pass
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la création du compte. Veuillez réessayer.",
        )

    # ── Associer les commandes guest ──────────────────────────────────────
    if customer_id:
        try:
            guest_orders = (
                supabase_admin.table("orders")
                .select("id")
                .eq("email", result.user.email)
                .is_("customer_id", "null")
                .execute()
            )
            for order in guest_orders.data or []:
                try:
                    supabase_admin.table("orders").update(
                        {"customer_id": customer_id}
                    ).eq("id", order["id"]).execute()
                except Exception as e:
                    print(f"Order association failed for {order['id']}: {e}")
                    continue
        except Exception as e:
            print(f"Guest orders lookup failed: {e}")

    return {
        "user": {
            "id": user_id,
            "email": result.user.email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "role": "customer",
        }
    }


def extract_token(request: Request):
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ")[1]
    return None


async def get_current_user(request: Request):
    token = extract_token(request)

    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")

    try:
        user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")

    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Token invalide")

    # Compte protégé par double authentification : une session ouverte avec le seul
    # mot de passe (niveau aal1) n'a accès à rien tant que le code n'est pas validé.
    if _first_verified_totp(user.user) and _token_aal(token) != "aal2":
        raise HTTPException(status_code=401, detail="Code de double authentification requis")

    return user.user


async def get_current_user_any_level(request: Request):
    """Comme get_current_user, mais accepte une session partielle (étape du code)."""
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")
    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Token invalide")
    return user.user


async def get_optional_user(request: Request):
    token = extract_token(request)

    if not token:
        return None

    try:
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            return None
        if _first_verified_totp(user.user) and _token_aal(token) != "aal2":
            return None
        return user.user
    except Exception:
        return None


async def get_current_profile(user=Depends(get_current_user)):
    try:
        # Lecture avec le client « service », filtrée sur l'identité vérifiée de la personne.
        # (Le client partagé garde la dernière session ouverte sur le serveur : il pouvait
        # lire le profil avec la session d'une autre personne, ou une session sans le code.)
        result = (
            supabase_admin.table("profiles")
            .select("*")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Profil inaccessible")

    # Selon la version de la bibliothèque, « aucune ligne » renvoie None ou un résultat vide.
    data = getattr(result, "data", None) if result is not None else None
    if not data:
        raise HTTPException(status_code=404, detail="Profil introuvable")

    return data


async def require_admin(profile=Depends(get_current_profile)):
    if profile.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    return profile

@auth_router.get("/me")
async def get_me(user=Depends(get_current_user)):
    result = (
        supabase_admin.table("profiles")
        .select("*")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    profile = (getattr(result, "data", None) if result is not None else None) or {}
    return {
        "id": user.id,
        "email": user.email,
        **profile,
        "mfa_enabled": bool(_first_verified_totp(user)),
    }


@auth_router.patch("/me")
async def update_me(
    payload: UpdateProfileRequest,
    user=Depends(get_current_user),
):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    result = (
        supabase_admin.table("profiles")
        .update(updates)
        .eq("id", user.id)
        .execute()
    )

    profile = result.data[0] if result.data else {}

    return {
        "id": user.id,
        "email": user.email,
        **profile,
    }


# ══════════════════════════════════════════════════════════════════════════
# Double authentification (code à 6 chiffres, application d'authentification)
#
# Facultative pour tous les comptes. Elle est enregistrée sur le compte Supabase :
# activée une fois, elle s'applique au site, à l'app Baume Shop et à l'app Baume.
# ══════════════════════════════════════════════════════════════════════════

MFA_ISSUER = "Baume"


def _token_aal(token: str) -> str:
    """Niveau de la session dans le jeton (aal1 = mot de passe, aal2 = mot de passe + code)."""
    try:
        part = token.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part)).get("aal") or "aal1"
    except Exception:
        return "aal1"


def _factor_attr(factor, name):
    return factor.get(name) if isinstance(factor, dict) else getattr(factor, name, None)


def _first_verified_totp(user) -> str | None:
    """Identifiant du facteur TOTP vérifié de l'utilisateur, s'il en a un."""
    factors = (user.get("factors") if isinstance(user, dict) else getattr(user, "factors", None)) or []
    for f in factors:
        ftype = str(_factor_attr(f, "factor_type") or "")
        status = str(_factor_attr(f, "status") or "")
        if ftype.endswith("totp") and status.endswith("verified") and not status.endswith("unverified"):
            return str(_factor_attr(f, "id"))
    return None


def _gotrue_headers(token: str) -> dict:
    return {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _gotrue(method: str, path: str, token: str, body: dict | None = None) -> httpx.Response:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            return await client.request(method, f"{SUPABASE_URL}/auth/v1{path}", headers=_gotrue_headers(token), json=body)
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")


async def _list_factors(token: str) -> list[dict]:
    res = await _gotrue("GET", "/user", token)
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")
    return res.json().get("factors") or []


def _clean_code(code: str) -> str:
    digits = "".join(c for c in (code or "") if c.isdigit())
    if len(digits) != 6:
        raise HTTPException(status_code=400, detail="Saisissez le code à 6 chiffres affiché dans votre application.")
    return digits


async def _challenge_and_verify(token: str, factor_id: str, code: str, guard_key: str) -> dict:
    """Vérifie un code à 6 chiffres. Renvoie la nouvelle session (niveau aal2)."""
    login_guard.check(guard_key)
    challenge = await _gotrue("POST", f"/factors/{factor_id}/challenge", token, {})
    if challenge.status_code != 200:
        raise HTTPException(status_code=400, detail="Impossible de vérifier le code. Réessayez.")
    verify = await _gotrue(
        "POST",
        f"/factors/{factor_id}/verify",
        token,
        {"challenge_id": challenge.json().get("id"), "code": code},
    )
    if verify.status_code != 200:
        login_guard.failure(guard_key)
        raise HTTPException(status_code=400, detail="Code incorrect ou expiré. Vérifiez l'heure de votre téléphone et réessayez.")
    login_guard.success(guard_key)
    return verify.json()


def _session_payload(data: dict) -> dict:
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
    }


class MfaCodeRequest(BaseModel):
    code: str


class MfaLoginRequest(BaseModel):
    mfa_ticket: str
    factor_id: str
    code: str


class MfaEnrollVerifyRequest(BaseModel):
    factor_id: str
    code: str


@auth_router.get("/mfa/status")
async def mfa_status(user=Depends(get_current_user)):
    factors = (getattr(user, "factors", None) or [])
    created = None
    for f in factors:
        if str(_factor_attr(f, "id")) == _first_verified_totp(user):
            created = _factor_attr(f, "created_at")
    return {"enabled": bool(_first_verified_totp(user)), "since": str(created) if created else None}


@auth_router.post("/mfa/login")
@limiter.limit("10/minute;40/hour")
async def mfa_login(request: Request, payload: MfaLoginRequest):
    """2e étape de connexion : échange le ticket + le code contre la vraie session."""
    code = _clean_code(payload.code)
    try:
        ticket_user = supabase.auth.get_user(payload.mfa_ticket)
    except Exception:
        raise HTTPException(status_code=401, detail="La connexion a expiré. Saisissez à nouveau votre mot de passe.")
    if not ticket_user or not ticket_user.user:
        raise HTTPException(status_code=401, detail="La connexion a expiré. Saisissez à nouveau votre mot de passe.")
    user = ticket_user.user
    if _first_verified_totp(user) != payload.factor_id:
        raise HTTPException(status_code=400, detail="Double authentification introuvable pour ce compte.")

    session = await _challenge_and_verify(payload.mfa_ticket, payload.factor_id, code, f"mfa:{user.id}")

    profile_res = supabase_admin.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
    profile = (getattr(profile_res, "data", None) if profile_res is not None else None) or {}
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": profile.get("first_name"),
            "last_name": profile.get("last_name"),
            "phone": profile.get("phone"),
            "address": profile.get("address"),
            "postal_code": profile.get("postal_code"),
            "city": profile.get("city"),
            "country": profile.get("country"),
            "role": profile.get("role", "customer"),
        },
        **_session_payload(session),
    }


@auth_router.post("/mfa/enroll")
@limiter.limit("10/hour")
async def mfa_enroll(request: Request, user=Depends(get_current_user)):
    """Démarre l'activation : renvoie le QR code et la clé à saisir dans l'application."""
    token = extract_token(request)
    if _first_verified_totp(user):
        raise HTTPException(status_code=400, detail="La double authentification est déjà activée.")

    # Une activation commencée puis abandonnée laisse un facteur « non vérifié » : on le retire.
    for f in await _list_factors(token):
        if f.get("status") == "unverified":
            await _gotrue("DELETE", f"/factors/{f.get('id')}", token)

    res = await _gotrue(
        "POST",
        "/factors",
        token,
        {
            "factor_type": "totp",
            "issuer": MFA_ISSUER,
            "friendly_name": f"Baume {time.strftime('%Y-%m-%d %H:%M:%S')}",
        },
    )
    if res.status_code != 200:
        raise HTTPException(status_code=400, detail="Activation impossible pour le moment. Réessayez.")
    data = res.json()
    totp = data.get("totp") or {}
    return {
        "factor_id": data.get("id"),
        "qr_code": totp.get("qr_code"),
        "secret": totp.get("secret"),
        "uri": totp.get("uri"),
    }


@auth_router.post("/mfa/enroll/verify")
@limiter.limit("10/minute")
async def mfa_enroll_verify(request: Request, payload: MfaEnrollVerifyRequest, user=Depends(get_current_user)):
    """Termine l'activation avec le premier code. Renvoie la nouvelle session (niveau aal2)."""
    token = extract_token(request)
    code = _clean_code(payload.code)
    session = await _challenge_and_verify(token, payload.factor_id, code, f"mfa:{user.id}")
    return {"enabled": True, **_session_payload(session)}


@auth_router.post("/mfa/disable")
@limiter.limit("10/minute")
async def mfa_disable(request: Request, payload: MfaCodeRequest, user=Depends(get_current_user)):
    """Désactive la double authentification, après saisie d'un code valide."""
    token = extract_token(request)
    factor_id = _first_verified_totp(user)
    if not factor_id:
        return {"enabled": False}
    code = _clean_code(payload.code)
    session = await _challenge_and_verify(token, factor_id, code, f"mfa:{user.id}")
    res = await _gotrue("DELETE", f"/factors/{factor_id}", session.get("access_token") or token)
    if res.status_code not in (200, 204):
        raise HTTPException(status_code=400, detail="Désactivation impossible pour le moment. Réessayez.")
    return {"enabled": False, **_session_payload(session)}


@auth_router.post("/admin/users/{profile_id}/mfa/reset")
async def admin_mfa_reset(profile_id: str, profile=Depends(require_admin)):
    """Administration : retire la double authentification d'une cliente (téléphone perdu)."""
    headers = {"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(f"{SUPABASE_URL}/auth/v1/admin/users/{profile_id}", headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=404, detail="Compte introuvable")
            removed = 0
            for f in res.json().get("factors") or []:
                d = await client.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{profile_id}/factors/{f.get('id')}", headers=headers)
                if d.status_code in (200, 204):
                    removed += 1
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")
    return {"success": True, "removed": removed}


# ── Suppression du compte par la cliente (exigence Apple 5.1.1 / protection des données) ──
class DeleteAccountRequest(BaseModel):
    confirm: str


@auth_router.post("/account/delete")
@limiter.limit("5/hour")
async def delete_my_account(request: Request, payload: DeleteAccountRequest, user=Depends(get_current_user)):
    """Supprime définitivement le compte connecté.

    Les données personnelles sont effacées ou anonymisées par la fonction SQL
    delete_customer_account ; les commandes sont conservées (obligation comptable)
    mais ne sont plus rattachées au compte. Les comptes administrateur sont refusés.
    """
    if (payload.confirm or "").strip().upper() != "SUPPRIMER":
        raise HTTPException(status_code=400, detail="Confirmation manquante.")

    def cleanup():
        return supabase_admin.rpc("delete_customer_account", {"p_user": user.id}).execute()

    try:
        await asyncio.to_thread(cleanup)
    except Exception as e:
        if "not_customer" in str(e):
            raise HTTPException(
                status_code=403,
                detail="Ce compte ne peut pas être supprimé depuis l'application. Contactez l'équipe Baume.",
            )
        raise HTTPException(status_code=503, detail="Suppression impossible pour le moment. Réessayez.")

    headers = {"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{user.id}", headers=headers)
    except Exception:
        raise HTTPException(status_code=503, detail="Suppression impossible pour le moment. Réessayez.")
    if res.status_code not in (200, 204, 404):
        raise HTTPException(status_code=503, detail="Suppression impossible pour le moment. Réessayez.")
    return {"deleted": True}
