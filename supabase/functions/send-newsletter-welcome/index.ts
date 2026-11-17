import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { requireTrustedCaller } from "../_shared/security.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://baumeshop-v2.weblax.fr";
const BACKEND_URL = Deno.env.get("BACKEND_URL") || "https://baume-shop-v2-gxo2.onrender.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Réservé au serveur Baume : empêche d'utiliser cette fonction pour envoyer des e-mails à n'importe qui.
  const denied = await requireTrustedCaller(req, { cors: corsHeaders });
  if (denied) return denied;

  try {
    const { email, unsubscribe_token } = await req.json();

    if (!email || !unsubscribe_token) {
      throw new Error("Email et token requis");
    }

    const unsubscribeUrl = `${BACKEND_URL}/api/newsletter/unsubscribe?token=${unsubscribe_token}`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:Inter,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;">
    <tr>
        <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                <!-- Header -->
                <tr>
                    <td style="background:#3D2A2A;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
                        <img src="${FRONTEND_URL}/email-logo-ivoire.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#F7F3EE;">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D3B1A0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bien-être féminin · Genève</p>
                    </td>
                </tr>

                <!-- Corps -->
                <tr>
                    <td style="background:#ffffff;padding:48px 40px;">
                        <p style="margin:0 0 12px;font-size:12px;color:rgba(0,0,0,0.5);text-transform:uppercase;letter-spacing:0.2em;">
                            Newsletter
                        </p>
                        <h2 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 20px;font-size:28px;color:#3D2A2A;font-weight:600;line-height:1.2;">
                            Bienvenue dans notre communauté 🌿
                        </h2>
                        <p style="margin:0 0 24px;font-size:15px;color:rgba(0,0,0,0.65);line-height:1.7;">
                            Merci de vous être inscrite à la newsletter Baume.
                            Vous recevrez en avant-première nos conseils bien-être,
                            nos nouvelles collections et nos offres exclusives.
                        </p>

                        <!-- Bloc ce que vous recevrez -->
                        <div style="background:#F7F3EE;border-radius:12px;padding:24px;margin-bottom:32px;">
                            <p style="margin:0 0 16px;font-size:13px;color:rgba(0,0,0,0.5);text-transform:uppercase;letter-spacing:0.15em;font-weight:600;">
                                Au programme
                            </p>
                            <table cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="padding:6px 0;font-size:14px;color:rgba(0,0,0,0.75);">
                                        🌸 Conseils bien-être et guides exclusifs
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:6px 0;font-size:14px;color:rgba(0,0,0,0.75);">
                                        🛍️ Nouveaux produits en avant-première
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:6px 0;font-size:14px;color:rgba(0,0,0,0.75);">
                                        🎁 Offres et réductions réservées aux abonnées
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:6px 0;font-size:14px;color:rgba(0,0,0,0.75);">
                                        📅 Invitations aux ateliers mensuels
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <!-- CTA -->
                        <div style="text-align:center;margin-bottom:40px;">
                            <a href="${FRONTEND_URL}/shop/produit"
                               style="display:inline-block;background:#3D2A2A;color:#ffffff;padding:16px 40px;border-radius:50px;font-size:15px;font-weight:600;text-decoration:none;">
                                Découvrir nos produits →
                            </a>
                        </div>

                        <!-- Liens secondaires -->
                        <div style="text-align:center;border-top:1px solid #E7DDD3;padding-top:24px;">
                            <p style="margin:0 0 12px;font-size:13px;color:rgba(0,0,0,0.45);">
                                Explorer Baume
                            </p>
                            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="padding:0 8px;">
                                        <a href="${FRONTEND_URL}/guides"
                                           style="color:#3D2A2A;font-size:13px;font-weight:500;text-decoration:underline;">
                                            Nos guides
                                        </a>
                                    </td>
                                    <td style="padding:0 8px;color:rgba(0,0,0,0.3);">·</td>
                                    <td style="padding:0 8px;">
                                        <a href="${FRONTEND_URL}/ateliers"
                                           style="color:#3D2A2A;font-size:13px;font-weight:500;text-decoration:underline;">
                                            Les ateliers
                                        </a>
                                    </td>
                                    <td style="padding:0 8px;color:rgba(0,0,0,0.3);">·</td>
                                    <td style="padding:0 8px;">
                                        <a href="${FRONTEND_URL}/quiz"
                                           style="color:#3D2A2A;font-size:13px;font-weight:500;text-decoration:underline;">
                                            Le quiz
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td style="background:#F7F3EE;padding:24px 40px;border-radius:0 0 16px 16px;text-align:center;">
                        <p style="margin:0 0 8px;font-size:12px;color:rgba(0,0,0,0.5);">
                            © ${new Date().getFullYear()} Baume Sàrl · Rue du Rhône 15, 1204 Genève
                        </p>
                        <p style="margin:0;font-size:11px;color:rgba(0,0,0,0.4);">
                            <a href="${FRONTEND_URL}/confidentialite" style="color:#3D2A2A;">Confidentialité</a>
                            &nbsp;·&nbsp;
                            <a href="${FRONTEND_URL}/contact" style="color:#3D2A2A;">Contact</a>
                            &nbsp;·&nbsp;
                            <a href="${unsubscribeUrl}" style="color:rgba(0,0,0,0.4);">Se désabonner</a>
                        </p>
                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>
</body>
</html>
        `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Baume Shop <contact@baumeshop-v2.weblax.fr>",
        to: email,
        subject: "Bienvenue dans la newsletter Baume 🌿",
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-newsletter-welcome error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
