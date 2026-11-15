import Stripe from "https://esm.sh/stripe@13.11.0?target=deno&no-check=true";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://baumeshop-v2.weblax.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) return json({ error: "Missing STRIPE_SECRET_KEY" }, 500);

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-04-10" });

    const body = await req.json();
    console.log("Body reçu:", JSON.stringify(body));

    const {
      items = [],
      email,
      shipping_address,
      shipping_country,
      shipping_total = 0,
      origin_url,
      discount_code,
      discount_amount = 0,
    } = body;

    console.log("discount_code:", discount_code, "discount_amount:", discount_amount);

    if (!origin_url) return json({ error: "origin_url manquant" }, 400);
    if (!email) return json({ error: "email manquant" }, 400);
    if (!Array.isArray(items) || items.length === 0) return json({ error: "Panier vide" }, 400);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => {
      const price = Number(item.price || 0);
      const quantity = Number(item.quantity || 1);
      if (!item.name) throw new Error("Produit sans nom");
      if (!price || price <= 0) throw new Error(`Prix invalide pour ${item.name}: ${item.price}`);

      return {
        quantity,
        price_data: {
          currency: "chf",
          product_data: {
            name: item.name,
            metadata: {
              product_id: String(item.product_id || ""),
              variant_id: String(item.variant_id || ""),  // ← seul ajout
              size: String(item.size || ""),
              color: String(item.color || ""),
              sku: String(item.sku || ""),
            },
          },
          unit_amount: Math.round(price * 100),
        },
      };
    });

    // ── Coupon Stripe pour la réduction ───────────────────────────────────
    const discountAmountCents = Math.round(Number(discount_amount || 0) * 100);
    let stripeCoupon = null;

    if (discountAmountCents > 0 && discount_code) {
      console.log("Création coupon Stripe:", discountAmountCents, "cents");
      try {
        const coupon = await stripe.coupons.create({
          amount_off: discountAmountCents,
          currency: "chf",
          duration: "once",
          name: `Réduction ${String(discount_code).slice(0, 20)}`,
          max_redemptions: 1,
        });
        stripeCoupon = coupon.id;
        console.log("Coupon créé:", stripeCoupon);
      } catch (couponErr) {
        console.error("Erreur création coupon:", couponErr);

        return json(
          { error: "Impossible d'appliquer votre réduction. Veuillez réessayer." },
          500
        );
      }
    }

    // ── Ligne livraison ────────────────────────────────────────────────────
    const shippingAmount = Math.round(Number(shipping_total || 0) * 100);
    if (shippingAmount > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "chf",
          product_data: { name: "Livraison" },
          unit_amount: shippingAmount,
        },
      });
    }

    console.log("Création session Stripe...");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items,
      ...(stripeCoupon ? { discounts: [{ coupon: stripeCoupon }] } : {}),
      success_url: `${origin_url}/commande/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin_url}/checkout`,
      metadata: {
        email,
        shipping_country: shipping_country || "",
        shipping_total: String(shipping_total || 0),
        shipping_address: JSON.stringify(shipping_address || {}),
        cart_items: JSON.stringify(items),
        discount_code: discount_code || "",
        discount_amount: String(discount_amount || 0),
      },
      payment_method_types: ["card"],
    });

    console.log("Session créée:", session.id, "url:", session.url);
    return json({ url: session.url }, 200);

  } catch (err) {
    console.error("Checkout error:", err instanceof Error ? err.message : JSON.stringify(err));
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
