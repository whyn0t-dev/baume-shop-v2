import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireTrustedCaller } from "../_shared/security.ts";
const corsHeaders = {
	"Access-Control-Allow-Origin": "https://baumeshop-v2.weblax.fr",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
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
		const { itemId, fulfillmentStatus } = await req.json();

		if (!itemId || !fulfillmentStatus) {
			return new Response(
				JSON.stringify({ error: "itemId et fulfillmentStatus requis" }),
				{
					status: 400,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				}
			);
		}

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
		);

		const { data, error } = await supabase
			.from("order_items")
			.update({
				fulfillment_status: fulfillmentStatus,
			})
			.eq("id", itemId)
			.select()
			.single();

		if (error) throw error;

		return new Response(JSON.stringify({ success: true, item: data }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err?.message || err) }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
