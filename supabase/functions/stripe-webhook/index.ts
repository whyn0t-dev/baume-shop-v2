import Stripe from "https://esm.sh/stripe@13.11.0?target=deno&no-check=true";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") || "https://baumeshop-v2.weblax.fr").replace(/\/$/, "");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendWorkshopEmail({
  email,
  firstName,
  workshopTitle,
  startsAt,
  quantity,
}: {
  email: string;
  firstName: string;
  workshopTitle: string;
  startsAt: string;
  quantity: number;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Baume Shop <contact@baume-shop.com>",
      to: email,
      subject: `Confirmation de réservation — ${workshopTitle}`,
      html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:#3D2A2A;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
<img src="${FRONTEND_URL}/email-logo-ivoire.png" width="150" height="31" alt="Baume." style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:150px;height:31px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#F7F3EE;">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D3B1A0;">Atelier · Genève</p>
</td></tr>
<tr><td style="background:#ffffff;padding:36px 40px;color:#111111;font-size:15px;line-height:26px;">
<h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 16px;font-size:26px;font-weight:normal;color:#3D2A2A;">Réservation confirmée</h1>
<p style="margin:0 0 12px;">Bonjour ${firstName},</p>
<p style="margin:0 0 20px;">Votre réservation pour l'atelier <strong>${workshopTitle}</strong> est confirmée.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;border:1px solid #E7DDD3;border-radius:12px;"><tr><td style="padding:18px 22px;font-size:14px;color:#111111;">
<p style="margin:0 0 6px;"><strong>Date :</strong> ${new Date(startsAt).toLocaleString("fr-CH", { timeZone: "Europe/Zurich" })}</p>
<p style="margin:0;"><strong>Nombre de place(s) :</strong> ${quantity}</p>
</td></tr></table>
<p style="margin:24px 0 0;">Merci et à très bientôt,<br/>L'équipe Baume</p>
</td></tr>
<tr><td style="background:#F7F3EE;padding:24px 40px;border-radius:0 0 16px 16px;border-top:1px solid #E7DDD3;text-align:center;">
<p style="margin:0;font-size:11px;color:#6B5751;">Baume Sàrl · Rue du Rhône 15 · 1204 Genève</p>
</td></tr>
</table></td></tr></table></body></html>
      `,
    }),
  });

  if (!res.ok) {
    console.error("Resend error", await res.text());
  }
}

serve(async (req) => {
  try {
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
    } catch (err) {
      console.error("Signature error:", err.message);
      return new Response(`Webhook error: ${err.message}`, { status: 400 });
    }

    console.log("Event reçu:", event.type);

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("Session ID:", session.id);
      console.log("Metadata:", JSON.stringify(session.metadata));

      if (session.metadata?.type === "workshop_booking") {
        if (session.payment_status !== "paid") {
          return new Response(
            JSON.stringify({
              received: true,
              processed: false,
              reason: "payment_not_paid",
            }),
            { status: 200 }
          );
        }

        const bookingId = session.metadata.booking_id;
        const workshopId = session.metadata.workshop_id;

        if (!bookingId || !workshopId) {
          return new Response("Missing workshop metadata", { status: 400 });
        }

        const { data: booking, error: bookingError } = await supabase
          .from("workshop_bookings")
          .select("*")
          .eq("id", bookingId)
          .single();

        if (bookingError || !booking) {
          console.error("Booking error:", bookingError);
          return new Response(JSON.stringify(bookingError), { status: 500 });
        }

        if (booking.status !== "confirmed") {
          const { data: workshop, error: workshopError } = await supabase
            .from("workshops")
            .select("*")
            .eq("id", workshopId)
            .single();

          if (workshopError || !workshop) {
            console.error("Workshop error:", workshopError);
            return new Response(JSON.stringify(workshopError), { status: 500 });
          }

          const reservedCount = Number(workshop.reserved_count || 0);
          const capacity = Number(workshop.capacity || 0);
          const quantity = Number(booking.quantity || 1);

          if (reservedCount + quantity > capacity) {
            return new Response("Workshop is full", { status: 409 });
          }

          const newReservedCount = reservedCount + quantity;

          const { error: updateBookingError } = await supabase
            .from("workshop_bookings")
            .update({
              status: "confirmed",
              stripe_checkout_session_id: session.id,
            })
            .eq("id", bookingId);

          if (updateBookingError) {
            console.error("Update booking error:", updateBookingError);
            return new Response(JSON.stringify(updateBookingError), { status: 500 });
          }

          const { error: updateWorkshopError } = await supabase
            .from("workshops")
            .update({
              reserved_count: newReservedCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", workshopId);

          if (updateWorkshopError) {
            console.error("Update workshop error:", updateWorkshopError);
            return new Response(JSON.stringify(updateWorkshopError), { status: 500 });
          }

          await sendWorkshopEmail({
            email: booking.email,
            firstName: booking.first_name,
            workshopTitle: workshop.title,
            startsAt: workshop.starts_at,
            quantity: Number(booking.quantity || 1),
          });
        }

        return new Response(JSON.stringify({ received: true, type: "workshop_booking" }), {
          status: 200,
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (globalErr) {
    console.error("Global error:", globalErr?.message || String(globalErr));
    return new Response(
      JSON.stringify({ error: globalErr?.message || String(globalErr) }),
      { status: 500 }
    );
  }
});
