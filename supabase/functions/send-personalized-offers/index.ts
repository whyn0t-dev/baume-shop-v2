// send-personalized-offers
// ─────────────────────────────────────────────────────────────────────────────
// Offres de réduction automatiques basées sur les achats de chaque cliente.
//
// Mode "auto" (pg_cron, chaque lundi) — 3 règles, dans cet ordre :
//   • replenish : sa catégorie favorite a été achetée il y a 55–75 jours et
//                 aucune commande depuis → « C'est le moment de refaire le plein »
//   • winback   : dernière commande il y a 120–150 jours → « Vous nous manquez »
//   • loyal     : 3 commandes payées ou plus, aucune offre « loyal » depuis
//                 180 jours → « Merci pour votre fidélité »
// Chaque email propose 3 produits de sa catégorie favorite qu'elle n'a pas
// encore achetés, avec un code personnel à usage unique qui expire.
//
// Mode "manual" (bouton « Envoyer une offre » de la fiche client) :
//   { mode: "manual", profile_id, percent, validity_days, message }
//
// Garde-fous : 1 offre maximum par cliente sur 45 jours (auto), pas d'envoi
// si désinscription marketing, pas d'envoi si une offre est encore active.
//
// Secrets : BAUME_INTERNAL_TOKEN, RESEND_API_KEY, FRONTEND_URL
//   OFFERS_PERCENT (défaut 10), OFFERS_VALIDITY_DAYS (défaut 21)

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
	chf,
	FRONTEND_URL,
} from "../_shared/baume.ts";

const DEFAULT_PERCENT = Number(env("OFFERS_PERCENT", "10"));
const DEFAULT_VALIDITY = Number(env("OFFERS_VALIDITY_DAYS", "21"));
const COOLDOWN_DAYS = 45;
const DAY = 86400000;
const PAID = ["paid", "processing", "shipped", "delivered"];

type Rule = "replenish" | "winback" | "loyal" | "manual";

const COPY: Record<Rule, { subject: string; title: string; intro: string }> = {
	replenish: {
		subject: "C'est peut-être le moment de refaire le plein",
		title: "On pense à votre routine",
		intro: "Cela fait quelques semaines que vous avez adopté vos indispensables. Pour que vous ne soyez jamais prise au dépourvu, voici une attention rien que pour vous.",
	},
	winback: {
		subject: "Vous nous manquez — une attention pour vous",
		title: "Cela fait un moment…",
		intro: "Nous avons pensé à vous. Notre sélection s'est enrichie depuis votre dernière visite, et nous serions ravies de vous retrouver.",
	},
	loyal: {
		subject: "Merci pour votre fidélité",
		title: "Merci d'être là",
		intro: "Vous faites partie des clientes qui nous font confiance depuis plusieurs commandes. Pour vous remercier, voici une réduction personnelle.",
	},
	manual: {
		subject: "Une attention personnelle de Baume",
		title: "Rien que pour vous",
		intro: "Nous avons sélectionné quelques produits qui devraient vous plaire, d'après vos précédents achats.",
	},
};

const CATEGORY_LABELS: Record<string, string> = {};

function renderEmail(opts: {
	rule: Rule;
	firstName: string;
	categoryLabel: string | null;
	suggestions: Record<string, any>[];
	code: string;
	percent: number;
	endsAt: string;
	message?: string | null;
}): string {
	const copy = COPY[opts.rule];
	const cards = opts.suggestions
		.map(
			(p) => `<td width="33%" valign="top" style="padding:6px;">
<a href="${FRONTEND_URL}/produit/${p.slug}" style="text-decoration:none;color:#111111;">
${p.image ? `<img src="${escapeHtml(p.image)}" alt="" width="160" style="width:100%;max-width:160px;height:auto;border-radius:12px;display:block;margin:0 auto 8px;">` : ""}
<p style="margin:0;font-size:14px;line-height:19px;">${escapeHtml(p.name)}</p>
<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#3D2A2A;">${chf(p.price)}</p>
</a></td>`,
		)
		.join("");

	return layout(`
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#3D2A2A;">Offre personnelle</p>
<h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 16px;font-size:26px;font-weight:normal;color:#111111;">${copy.title}, ${escapeHtml(opts.firstName)}</h1>
<p style="margin:0 0 16px;">${copy.intro}</p>
${opts.message ? `<p style="margin:0 0 16px;font-style:italic;color:#3D2A2A;">${escapeHtml(opts.message)}</p>` : ""}
${promoBlock(opts.code, opts.percent, opts.endsAt)}
${
	cards
		? `<p style="margin:8px 0 4px;font-size:14px;color:#777;">${
				opts.categoryLabel ? `Sélectionnés pour vous — ${escapeHtml(opts.categoryLabel)}` : "Sélectionnés pour vous"
			}</p><table width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table>`
		: ""
}
${button(`${FRONTEND_URL}/shop/produit`, "Découvrir la boutique")}
<p style="margin:24px 0 0;font-size:12px;color:#999;">Code personnel, utilisable une seule fois. Vous ne souhaitez plus recevoir nos offres ? Répondez simplement à cet email.</p>
`);
}

async function loadCategoryLabels(sb: ReturnType<typeof adminClient>) {
	if (Object.keys(CATEGORY_LABELS).length) return;
	const { data } = await sb.from("categories").select("slug,name").eq("kind", "produit");
	(data || []).forEach((c) => (CATEGORY_LABELS[c.slug] = c.name));
}

/** Analyse des achats d'une cliente. */
function analyse(orders: Record<string, any>[], productMap: Map<string, any>) {
	const paid = orders.filter((o) => PAID.includes(o.status));
	const catQty: Record<string, number> = {};
	const catLast: Record<string, string> = {};
	const bought = new Set<string>();
	for (const o of paid) {
		for (const it of o.order_items || []) {
			const p = productMap.get(it.product_id);
			if (it.product_id) bought.add(it.product_id);
			const cat = p?.product_category;
			if (!cat) continue;
			catQty[cat] = (catQty[cat] || 0) + Number(it.quantity || 1);
			if (!catLast[cat] || o.created_at > catLast[cat]) catLast[cat] = o.created_at;
		}
	}
	const favorite = Object.entries(catQty).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
	const lastOrderAt = paid.map((o) => o.created_at).sort().pop() || null;
	return { paidCount: paid.length, favorite, favoriteLastAt: favorite ? catLast[favorite] : null, lastOrderAt, bought };
}

function pickRule(a: ReturnType<typeof analyse>, now: number, recentLoyal: boolean): Rule | null {
	if (!a.lastOrderAt) return null;
	const sinceLast = (now - new Date(a.lastOrderAt).getTime()) / DAY;
	if (a.favoriteLastAt) {
		const sinceFav = (now - new Date(a.favoriteLastAt).getTime()) / DAY;
		if (sinceFav >= 55 && sinceFav <= 75 && sinceLast >= 55) return "replenish";
	}
	if (sinceLast >= 120 && sinceLast <= 150) return "winback";
	if (a.paidCount >= 3 && !recentLoyal) return "loyal";
	return null;
}

async function suggestions(
	sb: ReturnType<typeof adminClient>,
	category: string | null,
	exclude: Set<string>,
) {
	let q = sb
		.from("products")
		.select("id,name,slug,image,price,product_category,bestseller")
		.eq("status", "active")
		.order("bestseller", { ascending: false })
		.limit(20);
	if (category) q = q.eq("product_category", category);
	const { data } = await q;
	return (data || []).filter((p) => !exclude.has(p.id)).slice(0, 3);
}

async function sendOffer(
	sb: ReturnType<typeof adminClient>,
	args: {
		rule: Rule;
		customer: Record<string, any>;
		email: string;
		analysis: ReturnType<typeof analyse>;
		percent: number;
		validityDays: number;
		message?: string | null;
		dryRun?: boolean;
	},
) {
	const now = new Date();
	const endsAt = new Date(now.getTime() + args.validityDays * DAY).toISOString();
	const code = randomCode(args.rule === "loyal" ? "FIDELE" : "POURVOUS");
	const picks = await suggestions(sb, args.analysis.favorite, args.analysis.bought);
	const categoryLabel = args.analysis.favorite ? CATEGORY_LABELS[args.analysis.favorite] || args.analysis.favorite : null;

	if (args.dryRun) {
		return { status: "dry_run", rule: args.rule, email: args.email, suggestions: picks.length };
	}

	const { data: discount, error } = await sb
		.from("discounts")
		.insert({
			id: crypto.randomUUID(),
			code,
			type: "percentage",
			value: args.percent,
			active: true,
			usage_limit: 1,
			used_count: 0,
			owner_profile_id: args.customer.profile_id,
			starts_at: now.toISOString(),
			ends_at: endsAt,
			description: `Offre personnalisée (${args.rule})`,
			campaign: `personalized_${args.rule}`,
			created_at: now.toISOString(),
		})
		.select("id")
		.single();
	if (error) return { status: "failed", error: error.message };

	const sent = await sendEmail(
		args.email,
		COPY[args.rule].subject,
		renderEmail({
			rule: args.rule,
			firstName: args.customer.first_name || "",
			categoryLabel,
			suggestions: picks,
			code,
			percent: args.percent,
			endsAt,
			message: args.message,
		}),
	);

	await sb.from("customer_offers").insert({
		profile_id: args.customer.profile_id,
		customer_id: args.customer.id,
		email: args.email,
		rule: args.rule,
		category: args.analysis.favorite,
		product_ids: picks.map((p) => p.id),
		discount_id: discount.id,
		discount_code: code,
		discount_percent: args.percent,
		expires_at: endsAt,
		status: sent.ok ? "sent" : "failed",
		error: sent.ok ? null : sent.error,
		sent_at: sent.ok ? now.toISOString() : null,
	});

	if (!sent.ok) await sb.from("discounts").update({ active: false }).eq("id", discount.id);
	return { status: sent.ok ? "sent" : "failed", rule: args.rule, code, error: sent.error };
}

Deno.serve(async (req) => {
	if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
	if (!isAuthorized(req)) return json({ error: "Non autorisé" }, 401);

	let body: Record<string, any> = {};
	try {
		body = await req.json();
	} catch {
		/* corps vide accepté */
	}

	const sb = adminClient();
	await loadCategoryLabels(sb);
	const now = Date.now();

	// ── Mode manuel : une cliente précise ─────────────────────────────────────
	if (body.mode === "manual") {
		const { data: customer } = await sb
			.from("customers")
			.select("id, profile_id, email, first_name, marketing_opt_out")
			.eq("profile_id", body.profile_id)
			.maybeSingle();
		const { data: profile } = await sb.from("profiles").select("email, first_name").eq("id", body.profile_id).maybeSingle();
		const email = String(profile?.email || customer?.email || "").toLowerCase();
		if (!customer || !email) return json({ error: "Cliente introuvable" }, 404);
		if (customer.marketing_opt_out) return json({ error: "Cette cliente a refusé les offres marketing" }, 409);

		const { data: orders } = await sb
			.from("orders")
			.select("id,status,created_at,order_items(product_id,quantity)")
			.eq("customer_id", customer.id);
		const ids = [...new Set((orders || []).flatMap((o) => (o.order_items || []).map((i: any) => i.product_id)).filter(Boolean))];
		const { data: prods } = ids.length
			? await sb.from("products").select("id,product_category").in("id", ids)
			: { data: [] as any[] };
		const analysis = analyse(orders || [], new Map((prods || []).map((p) => [p.id, p])));

		const result = await sendOffer(sb, {
			rule: "manual",
			customer: { ...customer, first_name: customer.first_name || profile?.first_name },
			email,
			analysis,
			percent: Math.min(Math.max(Number(body.percent) || DEFAULT_PERCENT, 5), 30),
			validityDays: Math.min(Math.max(Number(body.validity_days) || DEFAULT_VALIDITY, 3), 90),
			message: body.message,
		});
		if (result.status !== "sent") return json({ error: result.error || "Envoi impossible", ...result }, 502);
		return json({ success: true, ...result });
	}

	// ── Mode automatique : toutes les clientes ────────────────────────────────
	const dryRun = !!body.dry_run;
	const since = new Date(now - 400 * DAY).toISOString();

	const { data: orders, error } = await sb
		.from("orders")
		.select("id,customer_id,status,created_at,order_items(product_id,quantity)")
		.in("status", PAID)
		.not("customer_id", "is", null)
		.gte("created_at", since)
		.limit(20000);
	if (error) return json({ error: error.message }, 500);

	const byCustomer = new Map<string, any[]>();
	for (const o of orders || []) {
		if (!byCustomer.has(o.customer_id)) byCustomer.set(o.customer_id, []);
		byCustomer.get(o.customer_id)!.push(o);
	}
	if (!byCustomer.size) return json({ success: true, processed: 0 });

	const allProductIds = [...new Set((orders || []).flatMap((o) => (o.order_items || []).map((i: any) => i.product_id)).filter(Boolean))];
	const productMap = new Map<string, any>();
	for (let i = 0; i < allProductIds.length; i += 300) {
		const { data } = await sb.from("products").select("id,product_category").in("id", allProductIds.slice(i, i + 300));
		(data || []).forEach((p) => productMap.set(p.id, p));
	}

	const customerIds = [...byCustomer.keys()];
	const customers: any[] = [];
	for (let i = 0; i < customerIds.length; i += 300) {
		const { data } = await sb
			.from("customers")
			.select("id, profile_id, email, first_name, marketing_opt_out")
			.in("id", customerIds.slice(i, i + 300));
		customers.push(...(data || []));
	}

	const cooldownSince = new Date(now - COOLDOWN_DAYS * DAY).toISOString();
	const loyalSince = new Date(now - 180 * DAY).toISOString();
	const { data: recentOffers } = await sb
		.from("customer_offers")
		.select("profile_id, rule, created_at, expires_at, status")
		.gte("created_at", loyalSince);

	const results: Record<string, unknown>[] = [];
	for (const customer of customers) {
		if (!customer.profile_id || customer.marketing_opt_out) continue;
		const email = String(customer.email || "").toLowerCase();
		if (!email) continue;

		const mine = (recentOffers || []).filter((o) => o.profile_id === customer.profile_id && o.status === "sent");
		if (mine.some((o) => o.created_at >= cooldownSince)) continue; // anti-spam
		if (mine.some((o) => o.expires_at && new Date(o.expires_at).getTime() > now)) continue; // offre encore active
		const recentLoyal = mine.some((o) => o.rule === "loyal");

		const analysis = analyse(byCustomer.get(customer.id) || [], productMap);
		const rule = pickRule(analysis, now, recentLoyal);
		if (!rule) continue;

		const r = await sendOffer(sb, {
			rule,
			customer,
			email,
			analysis,
			percent: DEFAULT_PERCENT,
			validityDays: DEFAULT_VALIDITY,
			dryRun,
		});
		results.push({ customer: customer.id, ...r });
		if (results.length >= 200) break; // plafond par exécution
	}

	return json({
		success: true,
		dry_run: dryRun,
		processed: results.length,
		sent: results.filter((r) => r.status === "sent").length,
		results,
	});
});
