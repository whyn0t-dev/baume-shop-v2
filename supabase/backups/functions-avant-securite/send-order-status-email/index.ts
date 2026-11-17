import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "Baume Shop Orders <contact@baumeshop-v2.weblax.fr>";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://baumeshop-v2.weblax.fr";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Contenu par statut ───────────────────────────────────────────────────────

const STATUS_CONTENT = {
  processing: {
    subject: "Votre commande est en cours de préparation 📦",
    title: "En cours de préparation",
    intro: "Bonne nouvelle ! Notre équipe prépare votre commande avec soin.",
    detail: "Vous recevrez un nouvel email dès qu'elle sera expédiée.",
    show_tracking: false,
  },
  shipped: {
    subject: "Votre commande est en route 🚚",
    title: "Commande expédiée",
    intro: "Votre commande vient d'être confiée au transporteur.",
    detail: "Vous pouvez suivre votre colis en temps réel via le lien ci-dessous.",
    show_tracking: true,
  },
  delivered: {
    subject: "Votre commande a été livrée ✨",
    title: "Commande livrée",
    intro: "Votre commande a bien été livrée. Nous espérons qu'elle vous ravira !",
    detail: "Si vous avez la moindre question, notre équipe est disponible pour vous aider.",
    show_tracking: false,
  },
  cancelled: {
    subject: "Votre commande a été annulée",
    title: "Commande annulée",
    intro: "Votre commande a été annulée.",
    detail: "Si vous pensez qu'il s'agit d'une erreur, n'hésitez pas à nous contacter.",
    show_tracking: false,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const CARRIERS: Record<string, { label: string; url: (n: string) => string }> = {
  "La Poste Suisse": {
    label: "La Poste Suisse",
    url: (n) => `https://www.post.ch/fr/outils/recherche-d-envois?shipment-id=${n}`
  },
  "Colissimo": {
    label: "Colissimo",
    url: (n) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}`
  },
  "Chronopost": {
    label: "Chronopost",
    url: (n) => `https://www.chronopost.fr/tracking-no-cms/suivi-colis?listeNumeros=${n}`
  },
  "DHL": {
    label: "DHL",
    url: (n) => `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${n}`
  },
  "UPS": {
    label: "UPS",
    url: (n) => `https://www.ups.com/track?tracknum=${n}`
  },
  "FedEx": {
    label: "FedEx",
    url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`
  },
  "GLS": {
    label: "GLS",
    url: (n) => `https://gls-group.com/track/${n}`
  },
  "TNT": {
    label: "TNT",
    url: (n) => `https://www.tnt.com/express/fr_fr/site/outils-expedition/suivi.html?searchType=CON&cons=${n}`
  },
  "Mondial Relay": {
    label: "Mondial Relay",
    url: (n) => `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${n}`
  },
  "DPD": {
    label: "DPD",
    url: (n) => `https://trace.dpd.fr/fr/trace/${n}`
  },
  "Autre": {
    label: "Transporteur",
    url: (n) => ""
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CH", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatAmount(amount: number, currency = "CHF") {
  return `${Number(amount).toFixed(2)} ${currency.toUpperCase()}`;
}

// ── Template HTML ────────────────────────────────────────────────────────────

function buildEmail(order: any, content: typeof STATUS_CONTENT[keyof typeof STATUS_CONTENT]) {
  const orderNumber = `#${String(order.id).slice(0, 8).toUpperCase()}`;
  const currency = (order.currency || "CHF").toUpperCase();
  const items = order.order_items || [];

  const carrierInfo = order.carrier ? CARRIERS[order.carrier] : null;
  const trackingUrl = order.tracking_url ||
    (carrierInfo && order.tracking_number ? carrierInfo.url(order.tracking_number) : null);

  const itemsRows = items.map((item: any) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E7DDD3;font-size:14px;color:#111111;">
        ${item.product_title || "Produit"}
        ${item.variant_title ? `<span style="color:#888;font-size:12px;"> — ${item.variant_title}</span>` : ""}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #E7DDD3;font-size:14px;color:#888;text-align:center;">
        × ${item.quantity}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #E7DDD3;font-size:14px;color:#111111;text-align:right;font-weight:600;">
        ${formatAmount(item.total_price, currency)}
      </td>
    </tr>
  `).join("");

  const trackingBlock = content.show_tracking && trackingUrl ? `
    <div style="margin:24px 0;padding:16px;background:#F7F3EE;border:1px solid #E7DDD3;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111111;">
        ${carrierInfo?.label}
      </p>
      <p style="margin:0 0 12px;font-size:12px;color:#888;font-family:monospace;">
        ${order.tracking_number}
      </p>
      <a href="${trackingUrl}" style="display:inline-block;padding:10px 24px;background:#3D2A2A;color:#fff;border-radius:99px;font-size:13px;font-weight:600;text-decoration:none;">
        Suivre mon colis →
      </a>
    </div>
  ` : "";

  const shippingAddress = order.shipping_address || {};
  const addressBlock = Object.keys(shippingAddress).length > 0 ? `
    <div style="margin-top:24px;padding:16px;background:#F7F3EE;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#111111;">Adresse de livraison</p>
      <p style="margin:0;font-size:13px;color:#666;line-height:1.8;">
        ${shippingAddress.name || [shippingAddress.first_name, shippingAddress.last_name].filter(Boolean).join(" ")}<br>
        ${shippingAddress.line1 || shippingAddress.address || ""}<br>
        ${[shippingAddress.postal_code, shippingAddress.city].filter(Boolean).join(" ")}<br>
        ${shippingAddress.country || ""}
      </p>
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#3D2A2A;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
            <img src="${FRONTEND_URL}/email-logo-ivoire.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 18px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#F7F3EE;">
            <h1 style="font-family:Georgia,'Times New Roman',serif;margin:0;font-size:28px;color:#fff;font-weight:400;">
              ${content.title}
            </h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">
              Commande ${orderNumber} · ${formatDate(order.created_at)}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px 40px;">
            <p style="margin:0 0 8px;font-size:15px;color:#111111;">
              Bonjour ${order.shipping_address?.first_name || order.email?.split("@")[0] || ""},
            </p>
            <p style="margin:0 0 4px;font-size:15px;color:#111111;">${content.intro}</p>
            <p style="margin:0 0 24px;font-size:14px;color:#888;">${content.detail}</p>

            ${trackingBlock}

            <!-- Articles -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <thead>
                <tr>
                  <th style="text-align:left;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #E7DDD3;text-transform:uppercase;letter-spacing:1px;">Article</th>
                  <th style="text-align:center;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #E7DDD3;text-transform:uppercase;letter-spacing:1px;">Qté</th>
                  <th style="text-align:right;font-size:12px;color:#888;font-weight:600;padding-bottom:8px;border-bottom:2px solid #E7DDD3;text-transform:uppercase;letter-spacing:1px;">Prix</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              ${Number(order.discount_total || 0) > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">
                  Réduction ${order.discount_code ? `(${order.discount_code})` : ""}
                </td>
                <td style="padding:6px 0;font-size:13px;color:#16a34a;text-align:right;">
                  −${formatAmount(order.discount_total, currency)}
                </td>
              </tr>` : ""}
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Livraison</td>
                <td style="padding:6px 0;font-size:13px;color:#888;text-align:right;">
                  ${Number(order.shipping_total || 0) === 0 ? "Offerte" : formatAmount(order.shipping_total, currency)}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:#111111;border-top:2px solid #E7DDD3;">Total</td>
                <td style="padding:12px 0 0;font-size:18px;font-weight:600;color:#111111;text-align:right;border-top:2px solid #E7DDD3;">
                  ${formatAmount(order.total, currency)}
                </td>
              </tr>
            </table>

            ${addressBlock}

            <!-- CTA -->
            <div style="margin-top:32px;text-align:center;">
              <a href="${FRONTEND_URL}/commande/suivi/${order.id}"
                 style="display:inline-block;padding:14px 32px;background:#3D2A2A;color:#fff;border-radius:99px;font-size:14px;font-weight:600;text-decoration:none;">
                Suivre ma commande →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F3EE;padding:24px 40px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;">
              Une question ? Répondez à cet email ou contactez-nous sur
              <a href="${FRONTEND_URL}/contact" style="color:#3D2A2A;">baume.ch/contact</a>
            </p>
            <p style="margin:0;font-size:11px;color:#ccc;">© Baume — Tous droits réservés</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const { order_id, new_status, tracking_number, carrier, tracking_url } = await req.json();

    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ error: "order_id et new_status requis" }), { status: 400 });
    }

    const content = STATUS_CONTENT[new_status as keyof typeof STATUS_CONTENT];
    if (!content) {
      // Pas d'email pour ce statut (ex: "paid" géré par send-order-email)
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    // Récupérer la commande avec ses items
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .limit(1);

    if (error || !orders?.length) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), { status: 404 });
    }

    const order = orders[0];

    if (!order.email) {
      return new Response(JSON.stringify({ error: "Pas d'email sur la commande" }), { status: 400 });
    }

    const html = buildEmail(order, content);

    // Envoyer via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: order.email,
        subject: content.subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, status: new_status }), { status: 200 });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
