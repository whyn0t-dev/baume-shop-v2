"""Transactional email templates for Baume, sent via Resend."""

import os
import asyncio
import logging
import resend
from typing import List

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "contact@baumeshop-v2.weblax.fr")
SENDER_NAME = os.environ.get("SENDER_NAME", "Baume Genève")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "contact@baumeshop-v2.weblax.fr")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://baumeshop-v2.weblax.fr")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _from() -> str:
    return f"{SENDER_NAME} <{SENDER_EMAIL}>"


async def _send(to: List[str], subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.info(
            f"[email skipped — RESEND_API_KEY missing] to={to} subject={subject!r}"
        )
        return False
    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {"from": _from(), "to": to, "subject": subject, "html": html},
        )
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


def _layout(body_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#3D2A2A;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
            <img src="{FRONTEND_URL}/email-logo-ivoire.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#F7F3EE;">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D3B1A0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bien-être féminin · Genève</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;color:#111111;font-size:15px;line-height:26px;">
            {body_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F3EE;padding:24px 40px;border-radius:0 0 16px 16px;border-top:1px solid #E7DDD3;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;">
              Une question ? Écrivez-nous à
              <a href="mailto:contact@baumeshop-v2.weblax.fr" style="color:#3D2A2A;">contact@baumeshop-v2.weblax.fr</a>
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#ccc;">
              Baume Sàrl · Rue du Rhône 15 · 1204 Genève · © {2026}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def send_contact_notification(
    name: str, email: str, subject: str, topic: str, message: str
):
    body = f"""
      <h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 20px;font-size:24px;color:#3D2A2A;font-weight:400;">
        Nouveau message reçu
      </h1>

      <div style="background:#F7F3EE;border:1px solid #E7DDD3;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;width:100px;">De</td>
            <td style="padding:6px 0;font-size:14px;color:#111111;font-weight:600;">{name}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;">Email</td>
            <td style="padding:6px 0;font-size:14px;">
              <a href="mailto:{email}" style="color:#3D2A2A;">{email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;">Motif</td>
            <td style="padding:6px 0;font-size:14px;color:#111111;">{topic or "Non précisé"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;">Sujet</td>
            <td style="padding:6px 0;font-size:14px;color:#111111;">{subject}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#111111;text-transform:uppercase;letter-spacing:1px;">
        Message
      </p>
      <div style="border-left:3px solid #3D2A2A;padding:12px 20px;background:#F7F3EE;border-radius:0 8px 8px 0;font-size:14px;color:#444;line-height:22px;white-space:pre-wrap;">{message}</div>

      <div style="margin-top:28px;text-align:center;">
        <a href="mailto:{email}?subject=Re: {subject}"
           style="display:inline-block;padding:13px 28px;background:#3D2A2A;color:#fff;border-radius:99px;font-size:13px;font-weight:600;text-decoration:none;">
          Répondre à {name} →
        </a>
      </div>
    """
    return await _send(
        [CONTACT_EMAIL],
        f"[Contact Baume] {subject} — {name}",
        _layout(body),
    )


async def send_contact_acknowledgement(to_email: str, name: str):
    body = f"""
      <h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 8px;font-size:28px;color:#3D2A2A;font-weight:400;">
        Merci, {name}.
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#888;">
        Nous avons bien reçu votre message.
      </p>

      <p style="margin:0 0 16px;">
        Notre équipe vous répondra dans les <strong>24 heures ouvrées</strong>,
        avec soin et précision.
      </p>

      <p style="margin:0 0 28px;">
        En attendant, n'hésitez pas à explorer nos guides ou à parcourir notre boutique.
      </p>

      <div style="margin-bottom:32px;display:flex;gap:12px;text-align:center;">
        <a href="{FRONTEND_URL}/guides"
           style="display:inline-block;margin-right:12px;padding:12px 24px;background:#3D2A2A;color:#fff;border-radius:99px;font-size:13px;font-weight:600;text-decoration:none;">
          Nos guides
        </a>
        <a href="{FRONTEND_URL}/shop/produit"
           style="display:inline-block;padding:12px 24px;border:1px solid #E7DDD3;color:#3D2A2A;border-radius:99px;font-size:13px;font-weight:600;text-decoration:none;">
          La boutique
        </a>
      </div>

      <div style="border-top:1px solid #E7DDD3;padding-top:20px;">
        <p style="margin:0;font-size:13px;color:#aaa;">
          À très vite,<br/>
          <span style="color:#3D2A2A;font-weight:600;">L'équipe Baume</span>
        </p>
      </div>
    """
    return await _send(
        [to_email],
        "Nous avons bien reçu votre message · Baume",
        _layout(body),
    )


async def send_order_confirmation(to_email: str, first_name: str, order: dict):
    currency = (order.get("currency") or "CHF").upper()

    items_html = "".join(f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E7DDD3;font-size:14px;color:#111111;">
            {it.get("name") or it.get("product_title") or "Produit"}
            {"<br/><span style='font-size:12px;color:#888;'>" + " · ".join(filter(None, [it.get("size"), it.get("color")])) + "</span>" if it.get("size") or it.get("color") else ""}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #E7DDD3;font-size:14px;color:#888;text-align:center;">
            × {it.get("quantity", 1)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #E7DDD3;font-size:14px;color:#111111;text-align:right;font-weight:600;">
            {float(it.get("subtotal") or it.get("total_price") or 0):.2f} {currency}
          </td>
        </tr>
        """ for it in order.get("items", []))

    order_id = str(order.get("id", ""))
    order_number = f"#{order_id[:8].upper()}" if order_id else "#—"
    total = float(order.get("amount") or order.get("total") or 0)
    shipping = float(order.get("shipping_total") or 0)
    discount = float(order.get("discount_total") or 0)
    discount_code = order.get("discount_code") or ""

    body = f"""
      <h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 8px;font-size:28px;color:#3D2A2A;font-weight:400;">
        Merci, {first_name} ✦
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#888;">
        Commande {order_number} confirmée
      </p>

      <p style="margin:0 0 24px;">
        Votre commande a bien été reçue. Nous la préparons avec soin depuis Genève
        et vous enverrons un email de suivi dès l'expédition.
      </p>

      <!-- Articles -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #E7DDD3;text-transform:uppercase;letter-spacing:1px;">Article</th>
            <th style="text-align:center;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #E7DDD3;text-transform:uppercase;letter-spacing:1px;">Qté</th>
            <th style="text-align:right;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #E7DDD3;text-transform:uppercase;letter-spacing:1px;">Prix</th>
          </tr>
        </thead>
        <tbody>{items_html}</tbody>
      </table>

      <!-- Totaux -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        {f'''<tr>
          <td style="padding:6px 0;font-size:13px;color:#888;">Réduction ({discount_code})</td>
          <td style="padding:6px 0;font-size:13px;color:#16a34a;text-align:right;">−{discount:.2f} {currency}</td>
        </tr>''' if discount > 0 else ""}
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#888;">Livraison</td>
          <td style="padding:6px 0;font-size:13px;color:#888;text-align:right;">
            {"Offerte" if shipping == 0 else f"{shipping:.2f} {currency}"}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:#111111;border-top:2px solid #E7DDD3;">Total</td>
          <td style="padding:12px 0 0;font-size:18px;font-weight:600;color:#111111;text-align:right;border-top:2px solid #E7DDD3;">
            {total:.2f} {currency}
          </td>
        </tr>
      </table>

      <div style="text-align:center;margin-bottom:32px;">
        <a href="{FRONTEND_URL}/commande/suivi/{order_id}"
           style="display:inline-block;padding:14px 32px;background:#3D2A2A;color:#fff;border-radius:99px;font-size:14px;font-weight:600;text-decoration:none;">
          Suivre ma commande →
        </a>
      </div>

      <div style="border-top:1px solid #E7DDD3;padding-top:20px;">
        <p style="margin:0;font-size:13px;color:#aaa;line-height:20px;">
          Délai estimé : 2 à 5 jours ouvrés.<br/>
          Une question ? Répondez à cet email ou contactez-nous sur
          <a href="{FRONTEND_URL}/contact" style="color:#3D2A2A;">baume.ch/contact</a>
        </p>
      </div>
    """
    return await _send(
        [to_email],
        f"Commande confirmée {order_number} · Baume",
        _layout(body),
    )


# ── Caisse : rapport de clôture (rapport Z) ──────────────────────────────────

from html import escape as _esc


def _chf(value) -> str:
    try:
        return f"{float(value or 0):,.2f} CHF".replace(",", "'")
    except (TypeError, ValueError):
        return "0.00 CHF"


def _row(label: str, value: str, strong: bool = False) -> str:
    weight = "700" if strong else "400"
    return f"""
      <tr>
        <td style="padding:6px 0;color:#666;font-size:14px;">{label}</td>
        <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:{weight};color:#111111;">{value}</td>
      </tr>"""


async def send_pos_session_report(to: List[str], session: dict, report: dict) -> bool:
    """E-mail envoyé automatiquement à la clôture d'une session de caisse."""
    if not to:
        return False

    sales = report.get("sales") or {}
    refunds = report.get("refunds") or {}
    movements = report.get("movements") or {}
    diff = float(report.get("cash_difference") or 0)
    diff_color = "#2F7A4B" if abs(diff) < 0.005 else "#B23A3A"
    diff_label = "Caisse juste" if abs(diff) < 0.005 else ("Excédent" if diff > 0 else "Manquant")

    register = (session.get("register") or {}).get("code") or "Caisse"
    number = session.get("session_number")
    opened = str(session.get("opened_at") or "")[:16].replace("T", " ")
    closed = str(session.get("closed_at") or report.get("closed_at") or "")[:16].replace("T", " ")
    opened_by = _esc(str(session.get("opened_by_name") or ""))
    closed_by = _esc(str(session.get("closed_by_name") or ""))
    note = _esc(str(session.get("closing_note") or ""))

    movements_html = "".join(
        _row(
            f"{'Entrée' if m.get('type') == 'in' else 'Sortie'} · {_esc(str(m.get('reason') or ''))}",
            ("+ " if m.get("type") == "in" else "− ") + _chf(m.get("amount")),
        )
        for m in (movements.get("list") or [])
    )

    body = f"""
      <h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 6px;font-size:22px;font-weight:normal;color:#3D2A2A;">Clôture de caisse</h1>
      <p style="margin:0 0 20px;color:#888;font-size:13px;">
        {register}{f" · session n° {number}" if number else ""}<br>
        Ouverture : {opened} UTC{f" · {opened_by}" if opened_by else ""}<br>
        Clôture : {closed} UTC{f" · {closed_by}" if closed_by else ""}
      </p>

      <div style="background:{'#E5F3EA' if abs(diff) < 0.005 else '#FBE7E7'};border-radius:12px;padding:16px;text-align:center;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:{diff_color};">{diff_label}</p>
        <p style="margin:4px 0 0;font-size:26px;font-weight:700;color:{diff_color};">{"+ " if diff > 0 else ""}{_chf(diff)}</p>
      </div>

      <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#999;text-transform:uppercase;">Ventes</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        {_row("Tickets", str(sales.get("count", 0)))}
        {_row("Articles vendus", str(sales.get("items", 0)))}
        {_row("Espèces", _chf(sales.get("cash")))}
        {_row("Carte / TWINT", _chf(sales.get("card")))}
        {_row("Panier moyen", _chf(sales.get("average_basket")))}
        {_row("Total des ventes", _chf(sales.get("total")), True)}
      </table>

      <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#999;text-transform:uppercase;">Remboursements</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        {_row("Nombre", str(refunds.get("count", 0)))}
        {_row("Articles retournés", str(refunds.get("items_returned", 0)))}
        {_row("En espèces", "− " + _chf(refunds.get("cash")))}
        {_row("Sur carte", "− " + _chf(refunds.get("card")))}
        {_row("Chiffre d'affaires net", _chf(report.get("net_total")), True)}
      </table>

      <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#999;text-transform:uppercase;">Espèces</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        {_row("Fond de caisse", _chf(report.get("opening_float")))}
        {_row("+ Ventes en espèces", _chf(sales.get("cash")))}
        {_row("− Remboursements en espèces", _chf(refunds.get("cash")))}
        {_row("+ Entrées", _chf(movements.get("in")))}
        {_row("− Sorties", _chf(movements.get("out")))}
        {_row("Espèces attendues", _chf(report.get("expected_cash")), True)}
        {_row("Espèces comptées", _chf(report.get("counted_cash")), True)}
      </table>

      {f'''<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#999;text-transform:uppercase;">Mouvements</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">{movements_html}</table>''' if movements_html else ""}

      {f'<p style="margin:0;padding:12px;background:#F7F3EE;border-radius:8px;font-size:14px;"><strong>Note :</strong> {note}</p>' if note else ""}
    """

    subject = f"Clôture de caisse · {register}{f' n° {number}' if number else ''} · {_chf(report.get('net_total'))} · {diff_label}"
    return await _send(to, subject, _layout(body))
