import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://baumeshop-v2.weblax.fr";
const FROM_EMAIL = "Baume Shop <contact@baumeshop-v2.weblax.fr>";

serve(async (req) => {
  try {
    const { email, product_name, product_slug } = await req.json();

    if (!email || !product_name) {
      return new Response(JSON.stringify({ error: "email et product_name requis" }), { status: 400 });
    }

    const html = `
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
            <h1 style="font-family:Georgia,'Times New Roman',serif;margin:0;font-size:28px;color:#fff;font-weight:400;">Votre produit est arrivé ✨</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#111111;line-height:1.6;">Bonjour,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#111111;line-height:1.6;">
              Bonne nouvelle ! Le produit que vous avez précommandé —
              <strong>${product_name}</strong> — est maintenant disponible et sera expédié très prochainement.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#111111;line-height:1.6;">
              Vous n'avez rien à faire, votre commande est en cours de préparation.
            </p>

            <div style="text-align:center;margin:32px 0;">
              <a href="${FRONTEND_URL}/produit/${product_slug}"
                 style="display:inline-block;padding:14px 32px;background:#3D2A2A;color:#fff;border-radius:99px;font-size:14px;font-weight:600;text-decoration:none;">
                Voir le produit →
              </a>
            </div>

            <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.6;">
              Merci pour votre confiance et votre patience.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F3EE;padding:24px 40px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;">
              Une question ? <a href="${FRONTEND_URL}/contact" style="color:#3D2A2A;">Contactez-nous</a>
            </p>
            <p style="margin:0;font-size:11px;color:#ccc;">© Baume — Tous droits réservés</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: `Votre pré-commande "${product_name}" est disponible ! ✨`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
