// Ancienne création de paiement, remplacée par le serveur Baume (/api/checkout/session),
// qui recalcule les prix depuis la base. Cette version acceptait le prix envoyé par le
// navigateur : elle est désactivée pour qu'elle ne puisse plus être détournée.
// L'ancienne version est conservée dans supabase/backups/functions-avant-securite/.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() =>
	new Response(JSON.stringify({ error: "Ce service n'est plus disponible." }), {
		status: 410,
		headers: { "Content-Type": "application/json" },
	}),
);
