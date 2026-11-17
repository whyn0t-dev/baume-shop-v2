import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireTrustedCaller } from "../_shared/security.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://baumeshop-v2.weblax.fr";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "contact@baumeshop-v2.weblax.fr";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Réservé au serveur Baume : empêche d'utiliser cette fonction pour envoyer des e-mails à n'importe qui.
  const denied = await requireTrustedCaller(req, { cors: corsHeaders });
  if (denied) return denied;

  try {
    const {
      return_request_id,
      type, // "new_request" | "approved" | "rejected" | "refunded"
      email,
      order_id,
      reason,
      admin_note,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupérer les détails de la commande
    const { data: order } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    const orderRef = `#${String(order_id).slice(0, 8).toUpperCase()}`;
    const orderTotal = order ? `${Number(order.total).toFixed(2)} ${order.currency || "CHF"}` : "—";

    const REASON_LABELS: Record<string, string> = {
      defective: "Produit défectueux",
      wrong_item: "Mauvais article reçu",
      not_as_described: "Non conforme à la description",
      changed_mind: "Changement d'avis",
      other: "Autre raison",
    };

    let subject = "";
    let htmlContent = "";

    const baseStyle = `
            font-family: Inter, -apple-system, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
        `;

    const headerHtml = `
            <div style="background: #3D2A2A; padding: 32px 40px; text-align: center;">
                <img src="${FRONTEND_URL}/email-logo-ivoire.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#F7F3EE;">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D3B1A0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bien-être féminin · Genève</p>
            </div>
        `;

    const footerHtml = `
            <div style="padding: 24px 40px; background: #F7F3EE; text-align: center;">
                <p style="color: rgba(0,0,0,0.5); font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Baume Sàrl · Rue du Rhône 15, 1204 Genève
                </p>
                <p style="color: rgba(0,0,0,0.4); font-size: 11px; margin: 8px 0 0;">
                    <a href="${FRONTEND_URL}/compte" style="color: #3D2A2A;">Mon compte</a>
                    &nbsp;·&nbsp;
                    <a href="${FRONTEND_URL}/contact" style="color: #3D2A2A;">Nous contacter</a>
                </p>
            </div>
        `;

    if (type === "new_request") {
      // ── Email à l'admin ───────────────────────────────────────────
      subject = `🔔 Nouvelle demande de retour — Commande ${orderRef}`;
      htmlContent = `
                <div style="${baseStyle}">
                    ${headerHtml}
                    <div style="padding: 40px;">
                        <h2 style="font-family:Georgia,'Times New Roman',serif;color: #3D2A2A; font-size: 22px; margin: 0 0 16px;">
                            Nouvelle demande de retour
                        </h2>
                        <p style="color: rgba(0,0,0,0.6); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                            Un client vient de soumettre une demande de retour.
                        </p>
                        <div style="background: #F7F3EE; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: rgba(0,0,0,0.5); text-transform: uppercase; letter-spacing: 0.1em;">
                                Détails
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Commande :</strong> ${orderRef}
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Montant :</strong> ${orderTotal}
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Client :</strong> ${email}
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Motif :</strong> ${REASON_LABELS[reason] || reason}
                            </p>
                        </div>
                        <a href="${FRONTEND_URL}/admin/returns/${return_request_id}"
                           style="display: inline-block; background: #3D2A2A; color: #ffffff; padding: 14px 28px; border-radius: 50px; font-size: 14px; font-weight: 600; text-decoration: none;">
                            Voir la demande →
                        </a>
                    </div>
                    ${footerHtml}
                </div>
            `;

      // Envoyer à l'admin
      await sendEmail(ADMIN_EMAIL, subject, htmlContent);

      // ── Email de confirmation au client ───────────────────────────
      const clientSubject = `Votre demande de retour a bien été reçue — Commande ${orderRef}`;
      const clientHtml = `
                <div style="${baseStyle}">
                    ${headerHtml}
                    <div style="padding: 40px;">
                        <h2 style="font-family:Georgia,'Times New Roman',serif;color: #3D2A2A; font-size: 22px; margin: 0 0 16px;">
                            Demande de retour reçue
                        </h2>
                        <p style="color: rgba(0,0,0,0.6); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                            Nous avons bien reçu votre demande de retour pour la commande <strong>${orderRef}</strong>.
                            Notre équipe l'examinera dans les plus brefs délais et vous répondra sous 48h ouvrées.
                        </p>
                        <div style="background: #F7F3EE; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: rgba(0,0,0,0.5); text-transform: uppercase; letter-spacing: 0.1em;">
                                Récapitulatif
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Commande :</strong> ${orderRef}
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Montant :</strong> ${orderTotal}
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #111;">
                                <strong>Motif :</strong> ${REASON_LABELS[reason] || reason}
                            </p>
                        </div>
                        <a href="${FRONTEND_URL}/compte"
                           style="display: inline-block; background: #3D2A2A; color: #ffffff; padding: 14px 28px; border-radius: 50px; font-size: 14px; font-weight: 600; text-decoration: none;">
                            Suivre ma demande →
                        </a>
                    </div>
                    ${footerHtml}
                </div>
            `;
      await sendEmail(email, clientSubject, clientHtml);

    } else if (type === "approved") {
      subject = `✅ Votre demande de retour a été approuvée — Commande ${orderRef}`;
      htmlContent = `
                <div style="${baseStyle}">
                    ${headerHtml}
                    <div style="padding: 40px;">
                        <h2 style="font-family:Georgia,'Times New Roman',serif;color: #3D2A2A; font-size: 22px; margin: 0 0 16px;">
                            Demande de retour approuvée
                        </h2>
                        <p style="color: rgba(0,0,0,0.6); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                            Bonne nouvelle — votre demande de retour pour la commande <strong>${orderRef}</strong>
                            a été approuvée. Le remboursement sera traité dans les prochains jours ouvrés.
                        </p>
                        ${admin_note ? `
                        <div style="background: #F7F3EE; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: rgba(0,0,0,0.5); text-transform: uppercase; letter-spacing: 0.1em;">
                                Message de notre équipe
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #111; line-height: 1.6;">
                                ${admin_note}
                            </p>
                        </div>` : ""}
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 14px; color: #166534;">
                                ✓ Le remboursement sera effectué sur votre moyen de paiement d'origine sous 5 à 10 jours ouvrés.
                            </p>
                        </div>
                        <a href="${FRONTEND_URL}/compte"
                           style="display: inline-block; background: #3D2A2A; color: #ffffff; padding: 14px 28px; border-radius: 50px; font-size: 14px; font-weight: 600; text-decoration: none;">
                            Voir mon compte →
                        </a>
                    </div>
                    ${footerHtml}
                </div>
            `;
      await sendEmail(email, subject, htmlContent);

    } else if (type === "rejected") {
      subject = `❌ Votre demande de retour — Commande ${orderRef}`;
      htmlContent = `
                <div style="${baseStyle}">
                    ${headerHtml}
                    <div style="padding: 40px;">
                        <h2 style="font-family:Georgia,'Times New Roman',serif;color: #3D2A2A; font-size: 22px; margin: 0 0 16px;">
                            Demande de retour non acceptée
                        </h2>
                        <p style="color: rgba(0,0,0,0.6); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                            Après examen, nous ne sommes malheureusement pas en mesure d'accepter
                            votre demande de retour pour la commande <strong>${orderRef}</strong>.
                        </p>
                        ${admin_note ? `
                        <div style="background: #F7F3EE; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: rgba(0,0,0,0.5); text-transform: uppercase; letter-spacing: 0.1em;">
                                Raison
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #111; line-height: 1.6;">
                                ${admin_note}
                            </p>
                        </div>` : ""}
                        <p style="color: rgba(0,0,0,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                            Si vous pensez qu'il s'agit d'une erreur ou souhaitez plus d'informations,
                            n'hésitez pas à contacter notre service client.
                        </p>
                        <a href="${FRONTEND_URL}/contact"
                           style="display: inline-block; background: #3D2A2A; color: #ffffff; padding: 14px 28px; border-radius: 50px; font-size: 14px; font-weight: 600; text-decoration: none;">
                            Contacter le service client →
                        </a>
                    </div>
                    ${footerHtml}
                </div>
            `;
      await sendEmail(email, subject, htmlContent);

    } else if (type === "refunded") {
      subject = `💸 Votre remboursement est en cours — Commande ${orderRef}`;
      htmlContent = `
                <div style="${baseStyle}">
                    ${headerHtml}
                    <div style="padding: 40px;">
                        <h2 style="font-family:Georgia,'Times New Roman',serif;color: #3D2A2A; font-size: 22px; margin: 0 0 16px;">
                            Remboursement en cours
                        </h2>
                        <p style="color: rgba(0,0,0,0.6); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                            Votre remboursement pour la commande <strong>${orderRef}</strong>
                            a été déclenché avec succès.
                        </p>
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #166534; font-weight: 600;">
                                Informations importantes
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #166534;">
                                ✓ Montant remboursé : ${orderTotal}
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #166534;">
                                ✓ Délai : 5 à 10 jours ouvrés selon votre banque
                            </p>
                            <p style="margin: 4px 0; font-size: 14px; color: #166534;">
                                ✓ Retour sur votre moyen de paiement d'origine
                            </p>
                        </div>
                        <a href="${FRONTEND_URL}/compte"
                           style="display: inline-block; background: #3D2A2A; color: #ffffff; padding: 14px 28px; border-radius: 50px; font-size: 14px; font-weight: 600; text-decoration: none;">
                            Voir mon compte →
                        </a>
                    </div>
                    ${footerHtml}
                </div>
            `;
      await sendEmail(email, subject, htmlContent);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-return-status-email error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Baume Shop <contact@baumeshop-v2.weblax.fr>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }

  return res.json();
}
