import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireTrustedCaller } from "../_shared/security.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://baumeshop-v2.weblax.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Réservé au serveur Baume et aux administratrices connectées (back-office).
  const denied = await requireTrustedCaller(req, { admin: true, cors: corsHeaders });
  if (denied) return denied;

  try {
    const { orderId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Récupérer la commande ─────────────────────────────────────────
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error) throw error;

    if (!order?.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "Payment Intent introuvable" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Remboursement Stripe ──────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
    });

    // ── Mettre à jour le statut de la commande ────────────────────────
    await supabase
      .from("orders")
      .update({
        payment_status: "refunded",
        status: "refunded",
        refunded_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // ── Remettre le stock des variantes ET des produits ───────────────────
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("variant_id, product_id, quantity")
      .eq("order_id", orderId);

    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        // ── Cas 1 : produit avec variante ─────────────────────────────
        if (item.variant_id) {
          const { data: variant } = await supabase
            .from("product_variants")
            .select("stock")
            .eq("id", item.variant_id)
            .single();

          if (variant) {
            const newStock = (variant.stock || 0) + item.quantity;
            await supabase
              .from("product_variants")
              .update({
                stock: newStock,
                available: newStock > 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.variant_id);
          }
        }

        // ── Cas 2 : produit sans variante — mettre à jour products.stock ─
        if (item.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();

          if (product) {
            const newStock = (product.stock || 0) + item.quantity;
            await supabase
              .from("products")
              .update({
                stock: newStock,
                available: newStock > 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.product_id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, refund, items_restocked: orderItems?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
