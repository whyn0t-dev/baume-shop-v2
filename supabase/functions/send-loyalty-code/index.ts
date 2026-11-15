import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Baume Shop <contact@baumeshop-v2.weblax.fr>";
const SHOP_URL = "https://baumeshop-v2.weblax.fr";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BAUME_INTERNAL_TOKEN = Deno.env.get("BAUME_INTERNAL_TOKEN");

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  // Cette fonction ne doit être appelée que par le backend.
  const authorization = req.headers.get("Authorization");

  const internalToken = req.headers.get("X-Baume-Internal-Token");

  if (
    !BAUME_INTERNAL_TOKEN ||
    !internalToken ||
    internalToken !== BAUME_INTERNAL_TOKEN
  ) {
    return response({ error: "Unauthorized" }, 401);
  }

  let email: string, first_name: string, code: string, reward: number, points_spent: number;

  try {
    const body = await req.json();
    email = body.email;
    first_name = body.first_name || "cliente";
    code = body.code;
    reward = body.reward;
    points_spent = body.points_spent;
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }


  // Valider la forme des données reçues.
  if (
    typeof code !== "string" ||
    !/^FIDELITE(?:[A-F0-9]{6}|[A-F0-9]{32})$/i.test(code)
  ) {
    return response({ error: "Code invalide" }, 400);
  }

  try {
    // Retrouver le vrai coupon.
    const discountRes = await fetch(
      `${SUPABASE_URL}/rest/v1/discounts` +
      `?code=eq.${encodeURIComponent(code.toUpperCase())}` +
      `&select=code,value,active,usage_limit,used_count,owner_profile_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!discountRes.ok) {
      throw new Error("Lecture du coupon impossible");
    }

    const discounts = await discountRes.json();
    const discount = discounts[0];

    if (
      !discount ||
      !discount.active ||
      !discount.owner_profile_id ||
      (discount.usage_limit !== null &&
        discount.used_count >= discount.usage_limit)
    ) {
      return response({ error: "Coupon indisponible" }, 400);
    }

    // Retrouver le compte réellement propriétaire du coupon.
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles` +
      `?id=eq.${discount.owner_profile_id}` +
      `&select=email,first_name`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!profileRes.ok) {
      throw new Error("Lecture du profil impossible");
    }

    const profiles = await profileRes.json();
    const owner = profiles[0];

    if (!owner?.email) {
      return response(
        { error: "Adresse e-mail du propriétaire introuvable" },
        400
      );
    }

    // Retrouver les points réellement dépensés.
    const loyaltyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/loyalty_points` +
      `?profile_id=eq.${discount.owner_profile_id}` +
      `&select=generated_codes`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!loyaltyRes.ok) {
      throw new Error("Lecture de la fidélité impossible");
    }

    const loyaltyRows = await loyaltyRes.json();
    const generatedCodes = loyaltyRows[0]?.generated_codes;

    const savedCoupon = Array.isArray(generatedCodes)
      ? generatedCodes.find(
        (item: { code?: string }) =>
          item.code?.toUpperCase() === code.toUpperCase()
      )
      : null;

    if (
      !savedCoupon ||
      Number(savedCoupon.reward) !== Number(discount.value) ||
      ![200, 400, 800].includes(Number(savedCoupon.points_spent))
    ) {
      return response(
        { error: "Informations du coupon incohérentes" },
        400
      );
    }

    // Remplacer les valeurs reçues par celles de la base.
    email = owner.email;
    first_name = String(owner.first_name || "cliente")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    code = discount.code;
    reward = Number(discount.value);
    points_spent = Number(savedCoupon.points_spent);

  } catch (err) {
    console.error("[send-loyalty-code] Vérification :", err);

    return response(
      { error: "Impossible de vérifier le coupon" },
      503
    );
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
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

            <!-- Hero -->
            <div style="background:#3D2A2A;padding:40px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#D3B1A0;letter-spacing:2px;text-transform:uppercase;">
                Programme de fidélité
              </p>
              <h1 style="font-family:Georgia,'Times New Roman',serif;margin:12px 0 0;font-size:32px;color:#ffffff;font-weight:normal;">
                Votre bon d'achat est prêt ⭐
              </h1>
              <p style="margin:8px 0 0;font-size:15px;color:#D3B1A0;">
                Bonjour, votre conversion de points a été effectuée avec succès.
              </p>
            </div>

            <div style="padding:32px;">

              <!-- Détails conversion -->
              <div style="background:#F7F3EE;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
                <p style="margin:0;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
                  Points convertis
                </p>
                <p style="margin:8px 0;font-size:36px;font-weight:bold;color:#3D2A2A;">
                  ${points_spent} pts → ${reward} CHF
                </p>
              </div>

              <!-- Code promo -->
              <p style="margin:0 0 12px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
                Votre code promo
              </p>
              <div style="border:2px dashed #3D2A2A;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                <p style="margin:0;font-size:11px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
                  Code à utiliser à la caisse
                </p>
                <p style="margin:10px 0 0;font-size:32px;font-weight:bold;color:#3D2A2A;font-family:monospace;letter-spacing:4px;">
                  ${code}
                </p>
                <p style="margin:8px 0 0;font-size:13px;color:#6B5751;">
                  Valable une seule fois · ${reward} CHF de réduction
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align:center;">
                <a href="${SHOP_URL}/shop/produit"
                  style="display:inline-block;background:#3D2A2A;color:#ffffff;text-decoration:none;
                         padding:14px 32px;border-radius:50px;font-size:14px;font-weight:bold;">
                  Utiliser mon code →
                </a>
              </div>

              <p style="margin:24px 0 0;font-size:13px;color:#6B5751;text-align:center;">
                Retrouvez vos codes dans <a href="${SHOP_URL}/compte" style="color:#3D2A2A;">votre compte</a>
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6B5751;">
              © 2026 Baume Shop · Genève<br/>
              <a href="${SHOP_URL}" style="color:#6B5751;">${SHOP_URL.replace("https://", "")}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject: `⭐ Votre bon d'achat Baume de ${reward} CHF est prêt !`,
        html,
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    console.log(`[send-loyalty-code] ✅ Email envoyé → ${email}`);
    return response({ success: true }, 200);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-loyalty-code] ❌", message);
    return response({ error: message }, 500);
  }
});

function response(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
