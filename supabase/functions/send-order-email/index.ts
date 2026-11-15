import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─── Client Supabase ──────────────────────────────────────────────────────────

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Baume Shop <contact@baumeshop-v2.weblax.fr>";
const SHOP_URL = "https://baumeshop-v2.weblax.fr";

// Adresse utilisée par la caisse pour les ventes sans client identifié
// (même valeur que POS_DEFAULT_EMAIL côté backend) : aucun e-mail n'y est envoyé.
const POS_DEFAULT_EMAIL = (Deno.env.get("POS_DEFAULT_EMAIL") || "").trim().toLowerCase();

// Statuts d'une commande payée. Une vente en boutique est remise tout de suite
// (« delivered ») : elle doit quand même recevoir sa confirmation.
const PAID_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_title?: string;
  name?: string;
  variant_title?: string;
  quantity: number;
  total_price?: number;
  unit_price?: number;
}

interface ShippingAddress {
  type?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  address?: string;
  line1?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

interface Order {
  id: string;
  order_number?: number | string | null;
  email: string;
  status?: string;
  first_name?: string;
  currency?: string;
  subtotal?: number;
  discount_total?: number;
  discount_code?: string;
  shipping_total?: number;
  total?: number;
  shipping_address?: ShippingAddress;
  order_items?: OrderItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formate un montant en devise */
function formatPrice(amount: number | null | undefined, currency = "CHF"): string {
  const value = typeof amount === "number" && isFinite(amount) ? amount : Number(amount) || 0;
  return `${value.toFixed(2)} ${currency.toUpperCase()}`;
}

/** Calcule le prix d'un article de façon sûre */
function itemTotal(item: OrderItem): number {
  const total = Number(item.total_price);
  if (isFinite(total) && item.total_price != null) return total;
  const unit = Number(item.unit_price);
  const qty = Number(item.quantity);
  if (isFinite(unit) && isFinite(qty)) return unit * qty;
  return 0;
}

/** Vente encaissée à la caisse de la boutique */
function isInStore(order: Order): boolean {
  return order.shipping_address?.type === "in_store";
}

/** Numéro affiché : celui du ticket de caisse si disponible */
function orderLabel(order: Order): string {
  return order.order_number ? String(order.order_number) : order.id.slice(0, 8).toUpperCase();
}

/** Envoie un email via Resend */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error (${res.status}): ${err}`);
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Baume Shop</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:32px;text-align:center;">
            <img src="${SHOP_URL}/email-logo-bordeaux.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#3D2A2A;">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6B5751;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bien-être féminin · Genève</p>
          </td>
        </tr>

        <!-- Contenu -->
        <tr>
          <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6B5751;">
              © 2026 Baume Shop · Rue du Rhône 15, Genève<br/>
              <a href="${SHOP_URL}" style="color:#6B5751;">${SHOP_URL.replace("https://", "")}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function orderItemsHtml(items: OrderItem[], currency: string): string {
  if (!items.length) return `
    <tr>
      <td style="padding:16px 0;font-size:14px;color:#6B5751;text-align:center;">
        Aucun article trouvé
      </td>
    </tr>`;

  return items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #E7DDD3;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:48px;vertical-align:top;">
              <div style="width:40px;height:40px;background:#F7F3EE;border-radius:8px;"></div>
            </td>
            <td style="padding-left:12px;vertical-align:top;">
              <p style="margin:0;font-size:14px;font-weight:bold;color:#111111;">
                ${item.product_title || item.name || "Produit"}
              </p>
              ${item.variant_title
      ? `<p style="margin:2px 0 0;font-size:12px;color:#6B5751;">${item.variant_title}</p>`
      : ""}
              <p style="margin:2px 0 0;font-size:12px;color:#6B5751;">Qté : ${item.quantity}</p>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <p style="margin:0;font-size:14px;font-weight:bold;color:#111111;">
                ${formatPrice(itemTotal(item), currency)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");
}

function totalsHtml(order: Order): string {
  const currency = order.currency || "CHF";
  const inStore = isInStore(order);
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#6B5751;">Sous-total</td>
        <td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;">
          ${formatPrice(order.subtotal, currency)}
        </td>
      </tr>
      ${(order.discount_total ?? 0) > 0 ? `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#2d7a4f;">
          Réduction${order.discount_code ? ` (${order.discount_code})` : ""}
        </td>
        <td style="padding:6px 0;font-size:14px;color:#2d7a4f;text-align:right;">
          −${formatPrice(order.discount_total, currency)}
        </td>
      </tr>` : ""}
      ${inStore ? "" : `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#6B5751;">Livraison</td>
        <td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;">
          ${(order.shipping_total ?? 0) > 0 ? formatPrice(order.shipping_total, currency) : "Offerte"}
        </td>
      </tr>`}
      <tr>
        <td style="padding:12px 0 0;font-size:16px;font-weight:bold;color:#111111;border-top:2px solid #E7DDD3;">
          Total
        </td>
        <td style="padding:12px 0 0;font-size:16px;font-weight:bold;color:#3D2A2A;text-align:right;border-top:2px solid #E7DDD3;">
          ${formatPrice(order.total, currency)}
        </td>
      </tr>
    </table>`;
}

function shippingHtml(order: Order): string {
  const shipping = order.shipping_address;
  if (!shipping) return "";

  if (isInStore(order)) {
    return `
    <div style="margin-top:24px;padding-top:24px;border-top:1px solid #E7DDD3;">
      <p style="margin:0 0 8px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
        Achat en boutique
      </p>
      <p style="margin:0;font-size:14px;color:#111111;line-height:1.8;">
        Baume Genève · Rue du Rhône 15, 1204 Genève
      </p>
    </div>`;
  }

  const hasAddress = shipping.address || shipping.line1;
  if (!hasAddress) return "";

  const name = shipping.name
    || `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim()
    || "";

  return `
    <div style="margin-top:24px;padding-top:24px;border-top:1px solid #E7DDD3;">
      <p style="margin:0 0 8px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
        Adresse de livraison
      </p>
      <p style="margin:0;font-size:14px;color:#111111;line-height:1.8;">
        ${name ? `${name}<br/>` : ""}
        ${(shipping.address || shipping.line1 || "")}<br/>
        ${shipping.postal_code || ""} ${shipping.city || ""}<br/>
        ${shipping.country || ""}
      </p>
    </div>`;
}

function orderIdBadge(order: Order): string {
  return `
    <div style="background:#F7F3EE;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
        Numéro de commande
      </p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#111111;font-family:monospace;">
        #${orderLabel(order)}
      </p>
    </div>`;
}

function heroHtml(order: Order, title: string): string {
  const inStore = isInStore(order);
  return `
    <div style="background:#3D2A2A;padding:40px 32px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#D3B1A0;letter-spacing:2px;text-transform:uppercase;">
        ${inStore ? "Achat confirmé" : "Commande confirmée"}
      </p>
      <h1 style="font-family:Georgia,'Times New Roman',serif;margin:12px 0 0;font-size:32px;color:#ffffff;font-weight:normal;">
        ${title}
      </h1>
      <p style="margin:8px 0 0;font-size:15px;color:#D3B1A0;">
        ${inStore
      ? "Merci pour votre visite à la boutique. Voici le récapitulatif de votre achat."
      : "Votre commande est en cours de préparation."}
      </p>
    </div>`;
}

// ── Email client existant ─────────────────────────────────────────────────────

function buildConfirmationEmail(order: Order, firstName: string): string {
  const items = order.order_items || [];
  const currency = order.currency || "CHF";
  const inStore = isInStore(order);

  const content = `
    ${heroHtml(order, `Merci ${firstName} ! 🌿`)}

    <div style="padding:32px;">
      ${orderIdBadge(order)}

      <p style="margin:0 0 16px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
        ${inStore ? "Votre achat" : "Votre commande"}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${orderItemsHtml(items, currency)}
      </table>

      ${totalsHtml(order)}
      ${shippingHtml(order)}

      <div style="margin-top:32px;text-align:center;">
        <a href="${SHOP_URL}/compte"
          style="display:inline-block;background:#3D2A2A;color:#ffffff;text-decoration:none;
                 padding:14px 32px;border-radius:50px;font-size:14px;font-weight:bold;">
          ${inStore ? "Voir mon compte et mes points" : "Suivre ma commande"}
        </a>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#6B5751;text-align:center;line-height:1.6;">
        Des questions ? <a href="${SHOP_URL}/contact" style="color:#3D2A2A;">Contactez-nous</a>
      </p>
    </div>`;

  return baseLayout(content);
}

// ── Email client invité ───────────────────────────────────────────────────────

function buildGuestConfirmationEmail(order: Order, welcomeCode: string | null): string {
  const items = order.order_items || [];
  const currency = order.currency || "CHF";
  const inStore = isInStore(order);

  const perks = [
    ["📦", "Suivi de vos commandes en temps réel"],
    ["⭐", "Laissez des avis sur vos produits achetés"],
    ["🔖", "Adresse pré-remplie à chaque commande"],
    ["🎁", "Offres exclusives réservées aux membres"],
  ];

  const content = `
    ${heroHtml(order, inStore ? "Merci pour votre achat ! 🌿" : "Merci pour votre commande ! 🌿")}

    <div style="padding:32px;">
      ${orderIdBadge(order)}

      <p style="margin:0 0 16px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
        ${inStore ? "Votre achat" : "Votre commande"}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${orderItemsHtml(items, currency)}
      </table>

      ${totalsHtml(order)}
      ${shippingHtml(order)}

      <!-- Bloc invitation compte -->
      <div style="margin-top:32px;background:#F7F3EE;border-radius:16px;padding:28px;text-align:center;">
        <p style="margin:0;font-size:20px;color:#111111;font-weight:normal;">
          ✨ Rejoignez la communauté Baume
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#6B5751;line-height:1.7;">
          Créez votre compte gratuit et profitez de :
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;text-align:left;">
          ${perks.map(([icon, text]) => `
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#111111;">
              <span style="margin-right:8px;">${icon}</span>${text}
            </td>
          </tr>`).join("")}
        </table>

        ${welcomeCode ? `
        <div style="margin-top:20px;background:#ffffff;border:2px dashed #3D2A2A;
                    border-radius:12px;padding:16px;">
          <p style="margin:0;font-size:12px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
            Cadeau de bienvenue
          </p>
          <p style="margin:8px 0;font-size:24px;font-weight:bold;color:#3D2A2A;
                    font-family:monospace;letter-spacing:4px;">
            ${welcomeCode}
          </p>
          <p style="margin:0;font-size:13px;color:#6B5751;">
            10% de réduction sur votre prochaine commande
          </p>
        </div>` : ""}

        <a href="${SHOP_URL}/inscription"
          style="display:inline-block;margin-top:20px;background:#3D2A2A;color:#ffffff;
                 text-decoration:none;padding:14px 32px;border-radius:50px;
                 font-size:14px;font-weight:bold;">
          Créer mon compte gratuitement
        </a>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#6B5751;text-align:center;line-height:1.6;">
        Des questions ? <a href="${SHOP_URL}/contact" style="color:#3D2A2A;">Contactez-nous</a>
      </p>
    </div>`;

  return baseLayout(content);
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Méthode
  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  // 2. Authentification des appels internes provenant de Render
  const expectedToken = Deno.env.get("BAUME_INTERNAL_TOKEN");
  const receivedToken = req.headers.get("X-Baume-Internal-Token");

  if (
    !expectedToken ||
    !receivedToken ||
    receivedToken !== expectedToken
  ) {
    return response({ error: "Unauthorized" }, 401);
  }

  // 3. Parsing du body
  let order_id: string | undefined;
  try {
    const body = await req.json();
    order_id = body?.order_id;
  } catch {
    return response({ error: "Invalid JSON body" }, 400);
  }

  if (!order_id) {
    return response({ error: "Champ order_id manquant" }, 400);
  }

  try {
    // 4. Récupérer la commande + articles en une seule requête
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single<Order>();

    if (orderError || !order) {
      console.error("[send-order-confirmation] Order not found:", orderError);
      return response({ error: "Commande introuvable" }, 404);
    }

    // Toute commande payée (y compris une vente en boutique déjà remise).
    if (!PAID_STATUSES.has(order.status || "")) {
      return response(
        { error: "La commande n'est pas payée" },
        409
      );
    }

    // 5. Vérifier l'email
    const email = order.email?.trim();
    if (!email) {
      return response({ error: "Email manquant sur la commande" }, 400);
    }

    // Vente en boutique sans client identifié : adresse de la boutique, pas d'e-mail.
    if (isInStore(order) && POS_DEFAULT_EMAIL && email.toLowerCase() === POS_DEFAULT_EMAIL) {
      console.log(`[send-order-confirmation] Vente boutique anonyme ${order.id} : aucun e-mail envoyé`);
      return response({ success: true, skipped: "in_store_anonymous" }, 200);
    }

    // 6. Vérifier si le client a un compte (profil existant)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name")
      .eq("email", email)
      .maybeSingle();

    const isGuest = !profile;

    // 7. Prénom : profil > commande > adresse de livraison > fallback
    const firstName =
      profile?.first_name ||
      order.first_name ||
      order.shipping_address?.first_name ||
      "cliente";

    // 8. Code promo WELCOME10 (uniquement pour les invités)
    let welcomeCode: string | null = null;
    if (isGuest) {
      const { data: discount } = await supabase
        .from("discounts")
        .select("code, active")
        .eq("code", "WELCOME10")
        .maybeSingle();

      if (discount?.active) {
        welcomeCode = discount.code;
      }
    }

    // 9. Construire et envoyer l'email
    const subject = isInStore(order)
      ? `Votre achat Baume #${orderLabel(order)} ✅`
      : `Votre commande Baume #${orderLabel(order)} est confirmée ✅`;
    const html = isGuest
      ? buildGuestConfirmationEmail(order, welcomeCode)
      : buildConfirmationEmail(order, firstName);

    await sendEmail(email, subject, html);

    console.log(`[send-order-confirmation] ✅ Email envoyé → ${email} (${isGuest ? "invité" : "membre"})`);

    return response({ success: true, email, guest: isGuest }, 200);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-order-confirmation] ❌", message);
    return response({ error: message }, 500);
  }
});

// ─── Helper réponse ───────────────────────────────────────────────────────────

function response(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
