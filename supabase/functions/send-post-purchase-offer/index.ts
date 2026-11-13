// send-post-purchase-offer
// ─────────────────────────────────────────────────────────────────────────────
// Lancée chaque jour par pg_cron. Pour chaque commande payée il y a 30 jours :
//   1. crée un code promo personnel, à usage unique, de 5 % ou 10 %
//      (10 % si la commande atteignait le seuil, sinon 5 %),
//      valable POST_PURCHASE_VALIDITY_DAYS jours puis expiré automatiquement ;
//   2. envoie un email « Merci + votre avis compte » avec le code et un lien
//      vers chaque produit acheté pour laisser un avis ;
//   3. journalise l'envoi dans customer_followups (1 seul envoi par commande).
//
// Paramètres (corps JSON, facultatifs) : { "dry_run": true, "limit": 50 }
//
// Secrets : BAUME_INTERNAL_TOKEN, RESEND_API_KEY, FRONTEND_URL
//   POST_PURCHASE_DELAY_DAYS        (défaut 30)
//   POST_PURCHASE_VALIDITY_DAYS     (défaut 30)
//   POST_PURCHASE_LOW_PERCENT       (défaut 5)
//   POST_PURCHASE_HIGH_PERCENT      (défaut 10)
//   POST_PURCHASE_HIGH_THRESHOLD    (défaut 80 — montant CHF de la commande)

import {
	env,
	json,
	isAuthorized,
	adminClient,
	sendEmail,
	layout,
	escapeHtml,
	promoBlock,
	button,
	randomCode,
	FRONTEND_URL,
} from "../_shared/baume.ts";

const DELAY_DAYS = Number(env("POST_PURCHASE_DELAY_DAYS", "30"));
const VALIDITY_DAYS = Number(env("POST_PURCHASE_VALIDITY_DAYS", "30"));
const LOW_PERCENT = Number(env("POST_PURCHASE_LOW_PERCENT", "5"));
const HIGH_PERCENT = Number(env("POST_PURCHASE_HIGH_PERCENT", "10"));
const HIGH_THRESHOLD = Number(env("POST_PURCHASE_HIGH_THRESHOLD", "80"));
// Rattrapage : si le cron a été interrompu, on traite jusqu'à 15 jours de retard.
const CATCH_UP_DAYS = 15;
// Pas plus d'un email de ce type par cliente sur 14 jours.
const ANTI_SPAM_DAYS = 14;

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];

function renderEmail(opts: {
	firstName: string;
	items: { name: string; slug?: string }[];
	code: string;
	percent: number;
	endsAt: string;
}): string {
	const products = opts.items
		.slice(0, 4)
		.map((it) => {
			const link = it.slug ? `${FRONTEND_URL}/produit/${it.slug}#avis-clients` : `${FRONTEND_URL}/avis`;
			return `<tr><td style="padding:10px 0;border-bottom:1px solid #f0ece8;font-size:15px;color:#2C2C2C;">${escapeHtml(it.name)}</td>
<td style="padding:10px 0;border-bottom:1px solid #f0ece8;text-align:right;"><a href="${link}" style="color:#3D2A2A;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;">Donner mon avis →</a></td></tr>`;
		})
		.join("");

	return layout(`
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#3D2A2A;">Un mois déjà</p>
<h1 style="margin:0 0 16px;font-size:26px;font-weight:normal;color:#2C2C2C;">Merci ${escapeHtml(opts.firstName)}, comment ça se passe&nbsp;?</h1>
<p style="margin:0 0 16px;">Cela fait un mois que vous avez reçu votre commande. Nous espérons que vos produits vous accompagnent en douceur au quotidien.</p>
<p style="margin:0 0 8px;">Votre retour compte énormément : il aide d'autres femmes à choisir en confiance.</p>
${products ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">${products}</table>` : ""}
<p style="margin:24px 0 0;">Pour vous remercier, voici un petit cadeau pour votre prochaine commande&nbsp;:</p>
${promoBlock(opts.code, opts.percent, opts.endsAt)}
${button(`${FRONTEND_URL}/shop/produit`, "Utiliser mon code")}
<p style="margin:24px 0 0;font-size:13px;color:#888;">Code personnel, utilisable une seule fois sur une prochaine commande. Il expire automatiquement après la date indiquée.</p>
`);
}

Deno.serve(async (req) => {
	if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
	if (!isAuthorized(req)) return json({ error: "Non autorisé" }, 401);

	let body: { dry_run?: boolean; limit?: number } = {};
	try {
		body = await req.json();
	} catch {
		/* corps vide accepté */
	}
	const dryRun = !!body.dry_run;
	const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);

	const sb = adminClient();
	const now = new Date();
	const windowEnd = new Date(now.getTime() - DELAY_DAYS * 86400000);
	const windowStart = new Date(windowEnd.getTime() - CATCH_UP_DAYS * 86400000);

	// 1. Commandes éligibles
	const { data: orders, error } = await sb
		.from("orders")
		.select("id, email, customer_id, total, currency, created_at, status, order_items(product_id)")
		.in("status", PAID_STATUSES)
		.not("email", "is", null)
		.gte("created_at", windowStart.toISOString())
		.lte("created_at", windowEnd.toISOString())
		.order("created_at", { ascending: true })
		.limit(limit * 3);

	if (error) return json({ error: error.message }, 500);
	if (!orders?.length) return json({ success: true, processed: 0, message: "Aucune commande éligible" });

	// 2. Retirer celles déjà traitées
	const ids = orders.map((o) => o.id);
	const { data: done } = await sb.from("customer_followups").select("order_id").in("order_id", ids);
	const doneIds = new Set((done || []).map((d) => d.order_id));
	const todo = orders.filter((o) => !doneIds.has(o.id)).slice(0, limit);

	const results: Record<string, unknown>[] = [];
	const emailedThisRun = new Set<string>();

	for (const order of todo) {
		const email = String(order.email || "").trim().toLowerCase();
		if (!email) continue;

		// Cliente (prénom, compte, désinscription marketing)
		let customer: Record<string, any> | null = null;
		if (order.customer_id) {
			const { data } = await sb
				.from("customers")
				.select("id, profile_id, first_name, marketing_opt_out")
				.eq("id", order.customer_id)
				.maybeSingle();
			customer = data;
		}

		const logBase = {
			order_id: order.id,
			customer_email: email,
			profile_id: customer?.profile_id ?? null,
			kind: "post_purchase_30d",
		};

		if (customer?.marketing_opt_out) {
			if (!dryRun) await sb.from("customer_followups").insert({ ...logBase, status: "skipped_opt_out" });
			results.push({ order: order.id, status: "skipped_opt_out" });
			continue;
		}

		// Anti-spam : déjà un email récent pour cette adresse
		const since = new Date(now.getTime() - ANTI_SPAM_DAYS * 86400000).toISOString();
		const { count: recent } = await sb
			.from("customer_followups")
			.select("id", { count: "exact", head: true })
			.eq("customer_email", email)
			.eq("status", "sent")
			.gte("created_at", since);

		if ((recent ?? 0) > 0 || emailedThisRun.has(email)) {
			if (!dryRun) await sb.from("customer_followups").insert({ ...logBase, status: "skipped_recent" });
			results.push({ order: order.id, status: "skipped_recent" });
			continue;
		}

		// Montant → 5 % ou 10 %
		const total = Number(order.total || 0);
		const percent = total >= HIGH_THRESHOLD ? HIGH_PERCENT : LOW_PERCENT;
		const endsAt = new Date(now.getTime() + VALIDITY_DAYS * 86400000).toISOString();
		const code = randomCode("MERCI");

		// Produits achetés (pour les liens « Donner mon avis »)
		const productIds = [...new Set((order.order_items || []).map((i: any) => i.product_id).filter(Boolean))];
		let items: { name: string; slug?: string }[] = [];
		if (productIds.length) {
			const { data: prods } = await sb.from("products").select("id, name, slug").in("id", productIds);
			items = (prods || []).map((p) => ({ name: p.name, slug: p.slug }));
		}

		if (dryRun) {
			results.push({ order: order.id, email, percent, code: "(simulation)", items: items.length });
			continue;
		}

		// 3. Code promo personnel
		const { data: discount, error: dErr } = await sb
			.from("discounts")
			.insert({
				id: crypto.randomUUID(),
				code,
				type: "percentage",
				value: percent,
				active: true,
				usage_limit: 1,
				used_count: 0,
				owner_profile_id: customer?.profile_id ?? null,
				starts_at: now.toISOString(),
				ends_at: endsAt,
				description: `Merci J+${DELAY_DAYS} — commande ${order.id}`,
				campaign: "post_purchase_30d",
				created_at: now.toISOString(),
			})
			.select("id")
			.single();

		if (dErr) {
			await sb.from("customer_followups").insert({ ...logBase, status: "failed", error: dErr.message });
			results.push({ order: order.id, status: "failed", error: dErr.message });
			continue;
		}

		// 4. Email
		const firstName = customer?.first_name || "à vous";
		const sent = await sendEmail(
			email,
			`Un mois avec Baume — votre avis + −${percent} % offerts`,
			renderEmail({ firstName, items, code, percent, endsAt }),
		);

		await sb.from("customer_followups").insert({
			...logBase,
			discount_id: discount.id,
			discount_code: code,
			discount_percent: percent,
			expires_at: endsAt,
			status: sent.ok ? "sent" : "failed",
			error: sent.ok ? null : sent.error,
			sent_at: sent.ok ? now.toISOString() : null,
		});

		if (!sent.ok) {
			// Code inutilisable si l'email n'est pas parti
			await sb.from("discounts").update({ active: false }).eq("id", discount.id);
		} else {
			emailedThisRun.add(email);
		}
		results.push({ order: order.id, status: sent.ok ? "sent" : "failed", percent });
	}

	return json({
		success: true,
		dry_run: dryRun,
		processed: results.length,
		sent: results.filter((r) => r.status === "sent").length,
		results,
	});
});
