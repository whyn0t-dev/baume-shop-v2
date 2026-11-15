import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://baumeshop-v2.weblax.fr";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { access_token } = await req.json();

        // Récupérer le profil via le token
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: { user }, error } = await supabase.auth.getUser(access_token);
        if (error || !user) throw new Error("Utilisateur introuvable");

        const email = user.email!;
        const firstName = user.user_metadata?.first_name || email.split("@")[0];

        const html = `
            <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">

                <!-- Header -->
                <div style="background: #3D2A2A; padding: 32px 40px; text-align: center;">
                    <img src="${FRONTEND_URL}/email-logo-ivoire.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#F7F3EE;">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D3B1A0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bien-être féminin · Genève</p>
                </div>

                <!-- Corps -->
                <div style="padding: 48px 40px;">
                    <p style="color: rgba(0,0,0,0.5); font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 12px;">
                        Bienvenue
                    </p>
                    <h2 style="font-family:Georgia,'Times New Roman',serif;color: #3D2A2A; font-size: 32px; font-weight: 600; margin: 0 0 20px; line-height: 1.2;">
                        Bonjour ${firstName} 🌿
                    </h2>
                    <p style="color: rgba(0,0,0,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        Votre compte Baume est maintenant activé. Merci de nous rejoindre —
                        nous sommes ravis de vous accueillir dans notre communauté.
                    </p>

                    <!-- Bloc mise en avant -->
                    <div style="background: #F7F3EE; border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                        <p style="color: #3D2A2A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600; margin: 0 0 16px;">
                            Ce qui vous attend
                        </p>
                        <div style="space-y: 12px;">
                            ${[
                                "🛍️ Des produits intimes sélectionnés avec soin",
                                "📖 Des guides écrits par nos expertes",
                                "🎁 Un programme de fidélité dès votre premier achat",
                                "💬 Un chat avec nos expertes pour vous guider",
                            ].map(item => `
                                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                                    <p style="margin: 0; font-size: 14px; color: rgba(0,0,0,0.75); line-height: 1.5;">
                                        ${item}
                                    </p>
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin-bottom: 32px;">
                        <a href="${FRONTEND_URL}/shop/produit"
                           style="display: inline-block; background: #3D2A2A; color: #ffffff; padding: 16px 36px; border-radius: 50px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: 0.02em;">
                            Découvrir nos produits →
                        </a>
                    </div>

                    <!-- Liens secondaires -->
                    <div style="text-align: center; border-top: 1px solid #E7DDD3; padding-top: 24px;">
                        <p style="color: rgba(0,0,0,0.45); font-size: 13px; margin: 0 0 12px;">
                            Explorer Baume
                        </p>
                        <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
                            ${[
                                { label: "Nos guides", url: `${FRONTEND_URL}/guides` },
                                { label: "Les ateliers", url: `${FRONTEND_URL}/ateliers` },
                                { label: "Notre boutique", url: `${FRONTEND_URL}/boutique-geneve` },
                                { label: "Le quiz bien-être", url: `${FRONTEND_URL}/quiz` },
                            ].map(link => `
                                <a href="${link.url}"
                                   style="color: #3D2A2A; font-size: 13px; font-weight: 500; text-decoration: underline;">
                                    ${link.label}
                                </a>
                            `).join("")}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding: 24px 40px; background: #F7F3EE; text-align: center;">
                    <p style="color: rgba(0,0,0,0.5); font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Baume Sàrl · Rue du Rhône 15, 1204 Genève
                    </p>
                    <p style="color: rgba(0,0,0,0.4); font-size: 11px; margin: 8px 0 0;">
                        <a href="${FRONTEND_URL}/compte" style="color: #3D2A2A;">Mon compte</a>
                        &nbsp;·&nbsp;
                        <a href="${FRONTEND_URL}/confidentialite" style="color: #3D2A2A;">Confidentialité</a>
                        &nbsp;·&nbsp;
                        <a href="${FRONTEND_URL}/contact" style="color: #3D2A2A;">Contact</a>
                    </p>
                </div>
            </div>
        `;

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Baume Shop<contact@baumeshop-v2.weblax.fr>",
                to: email,
                subject: `Bienvenue chez Baume, ${firstName} 🌿`,
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
        console.error("send-welcome-email error:", err);
        return new Response(
            JSON.stringify({ error: String(err?.message || err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
