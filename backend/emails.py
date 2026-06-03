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
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#3D2A2A;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.55);text-transform:uppercase;">
              Baume
            </p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);letter-spacing:1px;">
              Genève · Intimité &amp; bien-être féminin
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;color:#2C2C2C;font-size:15px;line-height:26px;">
            {body_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf7f4;padding:24px 40px;border-radius:0 0 16px 16px;border-top:1px solid #f0ece8;text-align:center;">
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
      <h1 style="margin:0 0 20px;font-size:24px;color:#3D2A2A;font-weight:400;">
        Nouveau message reçu
      </h1>

      <div style="background:#faf7f4;border:1px solid #f0ece8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;width:100px;">De</td>
            <td style="padding:6px 0;font-size:14px;color:#2C2C2C;font-weight:600;">{name}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;">Email</td>
            <td style="padding:6px 0;font-size:14px;">
              <a href="mailto:{email}" style="color:#3D2A2A;">{email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;">Motif</td>
            <td style="padding:6px 0;font-size:14px;color:#2C2C2C;">{topic or "Non précisé"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;">Sujet</td>
            <td style="padding:6px 0;font-size:14px;color:#2C2C2C;">{subject}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#2C2C2C;text-transform:uppercase;letter-spacing:1px;">
        Message
      </p>
      <div style="border-left:3px solid #3D2A2A;padding:12px 20px;background:#faf7f4;border-radius:0 8px 8px 0;font-size:14px;color:#444;line-height:22px;white-space:pre-wrap;">{message}</div>

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
      <h1 style="margin:0 0 8px;font-size:28px;color:#3D2A2A;font-weight:400;">
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
           style="display:inline-block;padding:12px 24px;border:1px solid #e0d8d0;color:#3D2A2A;border-radius:99px;font-size:13px;font-weight:600;text-decoration:none;">
          La boutique
        </a>
      </div>

      <div style="border-top:1px solid #f0ece8;padding-top:20px;">
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
          <td style="padding:10px 0;border-bottom:1px solid #f0ece8;font-size:14px;color:#2C2C2C;">
            {it.get("name") or it.get("product_title") or "Produit"}
            {"<br/><span style='font-size:12px;color:#888;'>" + " · ".join(filter(None, [it.get("size"), it.get("color")])) + "</span>" if it.get("size") or it.get("color") else ""}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0ece8;font-size:14px;color:#888;text-align:center;">
            × {it.get("quantity", 1)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0ece8;font-size:14px;color:#2C2C2C;text-align:right;font-weight:600;">
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
      <h1 style="margin:0 0 8px;font-size:28px;color:#3D2A2A;font-weight:400;">
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
            <th style="text-align:left;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #f0ece8;text-transform:uppercase;letter-spacing:1px;">Article</th>
            <th style="text-align:center;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #f0ece8;text-transform:uppercase;letter-spacing:1px;">Qté</th>
            <th style="text-align:right;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #f0ece8;text-transform:uppercase;letter-spacing:1px;">Prix</th>
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
          <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:#2C2C2C;border-top:2px solid #f0ece8;">Total</td>
          <td style="padding:12px 0 0;font-size:18px;font-weight:600;color:#2C2C2C;text-align:right;border-top:2px solid #f0ece8;">
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

      <div style="border-top:1px solid #f0ece8;padding-top:20px;">
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
