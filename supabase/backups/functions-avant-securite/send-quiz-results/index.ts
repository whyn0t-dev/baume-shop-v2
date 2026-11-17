import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Baume Shop <contact@baumeshop-v2.weblax.fr>";
const SHOP_URL = "https://baumeshop-v2.weblax.fr";

// ── Labels catégories ─────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; emoji: string; description: string }> = {
  "culottes-menstruelles": {
    label: "Culottes menstruelles",
    emoji: "👙",
    description: "Protection douce, écologique et sans déchet pour votre cycle.",
  },
  "cups-disques": {
    label: "Cups & Disques",
    emoji: "🥤",
    description: "Protection longue durée, idéale pour le sport et le quotidien actif.",
  },
  "serviettes-lavables": {
    label: "Serviettes lavables",
    emoji: "🌿",
    description: "Alternative naturelle et réutilisable aux protections jetables.",
  },
  "soins-corps-visage": {
    label: "Soins intimes & corps",
    emoji: "🌸",
    description: "Produits doux formulés pour respecter la flore intime et la peau.",
  },
  "bien-etre-gourmand": {
    label: "Bien-être & compléments",
    emoji: "✨",
    description: "Compléments et soins pour accompagner votre cycle au quotidien.",
  },
};

// ── Helper email ──────────────────────────────────────────────────────────
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

// ── Template email ────────────────────────────────────────────────────────
function buildQuizEmail(
  categories: string[],
  products: Array<{ name: string; price: number; currency: string; image: string; slug: string; tagline: string }>
): string {

  // ── Catégories ────────────────────────────────────────────────────────
  const categoryCards = categories
    .slice(0, 3)
    .map((cat, index) => {
      const info = CATEGORY_LABELS[cat];
      if (!info) return "";
      return `
      <tr>
        <td style="padding:8px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#F7F3EE;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:16px 20px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:40px;vertical-align:middle;font-size:24px;">${info.emoji}</td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <p style="margin:0;font-size:11px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
                        Priorité ${index + 1}
                      </p>
                      <p style="margin:2px 0 0;font-size:15px;font-weight:bold;color:#111111;">
                        ${info.label}
                      </p>
                      <p style="margin:4px 0 0;font-size:13px;color:#6B5751;line-height:1.5;">
                        ${info.description}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  // ── Produits 2 par ligne ──────────────────────────────────────────────
  const productList = products.slice(0, 4);
  const productRows: Array<typeof productList> = [];
  for (let i = 0; i < productList.length; i += 2) {
    productRows.push(productList.slice(i, i + 2));
  }

  const productRowsHtml = productRows.map((row) => `
    <tr>
      ${row.map((p) => `
      <td width="260" style="padding:8px;vertical-align:top;">
        <table width="260" cellpadding="0" cellspacing="0"
          style="border:1px solid #E7DDD3;border-radius:12px;overflow:hidden;background:#ffffff;">
          <tr>
            <td style="height:160px;background:#F7F3EE;text-align:center;vertical-align:middle;">
              ${p.image
      ? `<img src="${p.image}" width="260" height="160"
                    style="display:block;width:100%;height:160px;object-fit:cover;" />`
      : `<span style="font-size:36px;">🌿</span>`}
            </td>
          </tr>
          <tr>
            <td style="padding:14px;">
              <p style="margin:0;font-size:14px;font-weight:bold;color:#111111;">${p.name}</p>
              ${p.tagline
      ? `<p style="margin:4px 0 0;font-size:12px;color:#6B5751;line-height:1.4;">${p.tagline.slice(0, 60)}...</p>`
      : ""}
              <p style="margin:8px 0 0;font-size:15px;font-weight:bold;color:#3D2A2A;">
                ${Number(p.price || 0).toFixed(2)} ${(p.currency || "CHF").toUpperCase()}
              </p>
              <a href="${SHOP_URL}/produit/${p.slug}"
                style="display:inline-block;margin-top:10px;background:#3D2A2A;color:#ffffff;
                       text-decoration:none;padding:8px 16px;border-radius:20px;
                       font-size:12px;font-weight:bold;">
                Découvrir →
              </a>
            </td>
          </tr>
        </table>
      </td>`).join("")}
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Vos résultats Baume</title>
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
                Vos résultats personnalisés
              </p>
              <h1 style="font-family:Georgia,'Times New Roman',serif;margin:12px 0 0;font-size:32px;color:#ffffff;font-weight:normal;">
                Votre routine idéale 🌿
              </h1>
              <p style="margin:8px 0 0;font-size:15px;color:#D3B1A0;line-height:1.6;">
                Basée sur vos réponses, voici notre sélection exclusive pour vous.
              </p>
            </div>

            <div style="padding:32px;">

              <!-- Catégories recommandées -->
              <p style="margin:0 0 16px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
                Vos catégories prioritaires
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${categoryCards}
              </table>

              <!-- Produits recommandés 2 par ligne -->
              ${products.length > 0 ? `
              <p style="margin:32px 0 16px;font-size:13px;color:#6B5751;letter-spacing:2px;text-transform:uppercase;">
                Nos produits pour vous
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${productRowsHtml}
              </table>` : ""}

              <!-- CTA -->
              <div style="margin-top:32px;text-align:center;">
                <a href="${SHOP_URL}/shop/produit"
                  style="display:inline-block;background:#3D2A2A;color:#ffffff;text-decoration:none;
                         padding:14px 32px;border-radius:50px;font-size:14px;font-weight:bold;">
                  Voir tous nos produits →
                </a>
              </div>

              <!-- Refaire le quiz -->
              <div style="margin-top:16px;text-align:center;">
                <a href="${SHOP_URL}/quiz"
                  style="font-size:13px;color:#6B5751;text-decoration:underline;">
                  Refaire le quiz
                </a>
              </div>

              <p style="margin:24px 0 0;font-size:13px;color:#6B5751;text-align:center;line-height:1.6;">
                Des questions ? <a href="${SHOP_URL}/contact" style="color:#3D2A2A;">Contactez-nous</a>
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
}

// ── Handler principal ─────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  let email: string;
  let recommended_categories: string[];

  try {
    const body = await req.json();
    email = body?.email;
    recommended_categories = body?.recommended_categories || [];
  } catch {
    return response({ error: "Invalid JSON body" }, 400);
  }

  if (!email || !recommended_categories.length) {
    return response({ error: "email et recommended_categories requis" }, 400);
  }

  try {
    const products: any[] = [];
    for (const cat of recommended_categories.slice(0, 3)) {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, currency, image, slug, tagline")
        .eq("product_category", cat)
        .eq("status", "active")
        .eq("available", true)
        .limit(2);

      if (data) products.push(...data);
    }

    const html = buildQuizEmail(recommended_categories, products);
    const subject = "🌿 Vos recommandations Baume personnalisées";

    await sendEmail(email, subject, html);

    console.log(`[send-quiz-results] ✅ Email envoyé → ${email}`);
    return response({ success: true, email }, 200);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-quiz-results] ❌", message);
    return response({ error: message }, 500);
  }
});

function response(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
