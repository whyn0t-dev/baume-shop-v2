"""Transactional email templates for Baume, sent via Resend."""

import os
import asyncio
import logging
import resend
from typing import List

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "contact@baume-shop.com")
SENDER_NAME = os.environ.get("SENDER_NAME", "Baume Genève")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "contact@baume-shop.com")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _from() -> str:
    return f"{SENDER_NAME} <{SENDER_EMAIL}>"


async def _send(to: List[str], subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.info(f"[email skipped — RESEND_API_KEY missing] to={to} subject={subject!r}")
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
    <div style="font-family:Inter,Arial,sans-serif;background:#F7F3EE;padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E7DDD3;border-radius:16px;overflow:hidden">
        <tr><td style="padding:32px 40px 16px;border-bottom:1px solid #E7DDD3">
          <p style="margin:0;font-family:Georgia,'Cormorant Garamond',serif;font-size:28px;color:#4D1E19;letter-spacing:-0.01em">Baume</p>
          <p style="margin:2px 0 0;font-size:11px;letter-spacing:0.25em;color:#111111;text-transform:uppercase">Genève</p>
        </td></tr>
        <tr><td style="padding:32px 40px;color:#111111;font-size:15px;line-height:24px">
          {body_html}
        </td></tr>
        <tr><td style="padding:24px 40px;background:#F7F3EE;border-top:1px solid #E7DDD3;font-size:12px;color:#111111;opacity:0.7">
          Baume · Rue du Rhône 15 · 1204 Genève<br/>
          <a href="mailto:contact@baume-shop.com" style="color:#4D1E19">contact@baume-shop.com</a>
        </td></tr>
      </table>
    </div>
    """


async def send_contact_notification(name: str, email: str, subject: str, topic: str, message: str):
    body = f"""
      <h2 style="font-family:Georgia,serif;font-size:24px;color:#4D1E19;margin:0 0 16px">Nouveau message depuis le site</h2>
      <p style="margin:0 0 8px"><strong>De :</strong> {name} &lt;{email}&gt;</p>
      <p style="margin:0 0 8px"><strong>Sujet :</strong> {subject}</p>
      <p style="margin:0 0 16px"><strong>Motif :</strong> {topic or 'Non précisé'}</p>
      <div style="border-top:1px solid #E7DDD3;padding-top:16px;white-space:pre-wrap">{message}</div>
    """
    return await _send([CONTACT_EMAIL], f"[Contact Baume] {subject}", _layout(body))


async def send_contact_acknowledgement(to_email: str, name: str):
    body = f"""
      <h2 style="font-family:Georgia,serif;font-size:26px;color:#4D1E19;margin:0 0 16px">Bien reçu, {name}</h2>
      <p>Merci pour votre message. Nos expertes reviennent vers vous dans les <strong>24 heures ouvrées</strong>, avec douceur et précision.</p>
      <p>À très vite,<br/>L'équipe Baume</p>
    """
    return await _send([to_email], "Nous avons bien reçu votre message · Baume", _layout(body))


async def send_order_confirmation(to_email: str, first_name: str, order: dict):
    items_html = "".join(
        f"""<tr>
          <td style="padding:12px 0;border-bottom:1px solid #E7DDD3">
            <strong>{it['name']}</strong><br/>
            <span style="font-size:12px;color:#111111;opacity:0.7">
              {' · '.join(filter(None, [it.get('size'), it.get('color')])) or 'Taille unique'} · Qté {it['quantity']}
            </span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #E7DDD3;text-align:right;font-variant-numeric:tabular-nums">
            {it['subtotal']:.2f} {order['currency'].upper()}
          </td>
        </tr>"""
        for it in order.get("items", [])
    )
    body = f"""
      <h2 style="font-family:Georgia,serif;font-size:26px;color:#4D1E19;margin:0 0 16px">Merci, {first_name} ✦</h2>
      <p>Votre commande <strong>#{order.get('id', '')[:8].upper()}</strong> a bien été confirmée. Nous préparons votre colis avec soin depuis Genève.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0">
        {items_html}
        <tr><td style="padding:16px 0 0;font-weight:600">Total</td>
          <td style="padding:16px 0 0;text-align:right;font-weight:600;font-size:18px">{order['amount']:.2f} {order['currency'].upper()}</td></tr>
      </table>
      <p>Vous recevrez un email de suivi dès l'expédition. Délai estimé : 2 à 5 jours ouvrés.</p>
      <p style="margin-top:24px;font-size:13px;opacity:0.75">Une question sur votre commande ? Répondez à cet email ou écrivez à contact@baume-shop.com.</p>
    """
    return await _send([to_email], f"Commande confirmée · Baume", _layout(body))