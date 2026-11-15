// send-monthly-report
// ─────────────────────────────────────────────────────────────────────────────
// Appelée le 1er de chaque mois par pg_cron (et à la demande depuis l'admin).
// Récupère les chiffres du mois précédent auprès du backend Baume
// (GET /api/internal/reports/monthly) puis envoie un rapport HTML :
//   • CA, coût des produits vendus, MARGE BRUTE, taux de marge, coefficient
//   • ventes par marque
//   • produits vendus (top / flop) et achats fournisseurs du mois
//   • stock initial / final
//
// Secrets requis : BACKEND_URL, BAUME_INTERNAL_TOKEN, RESEND_API_KEY,
//                  REPORT_RECIPIENTS (emails séparés par des virgules)

import {
	env,
	json,
	isAuthorized,
	sendEmail,
	layout,
	escapeHtml,
	chf,
	FRONTEND_URL,
} from "../_shared/baume.ts";

type Row = Record<string, any>;

const th = (label: string, right = false) =>
	`<th style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#777;text-align:${right ? "right" : "left"};border-bottom:1px solid #EADBD2;">${label}</th>`;
const td = (value: string, right = false) =>
	`<td style="padding:8px 10px;font-size:13px;color:#111111;text-align:${right ? "right" : "left"};border-bottom:1px solid #E7DDD3;">${value}</td>`;

function table(headers: [string, boolean][], rows: string[][]): string {
	if (!rows.length)
		return `<p style="font-size:13px;color:#999;margin:8px 0 24px;">Aucune donnée sur la période.</p>`;
	return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 28px;font-family:Arial,sans-serif;">
<tr>${headers.map(([h, r]) => th(h, r)).join("")}</tr>
${rows.map((cells) => `<tr>${cells.map((c, i) => td(c, headers[i][1])).join("")}</tr>`).join("")}
</table>`;
}

function kpi(label: string, value: string): string {
	return `<td width="50%" style="padding:6px;"><div style="border:1px solid #EADBD2;border-radius:14px;padding:16px;background:#F7F3EE;">
<p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#777;">${label}</p>
<p style="margin:6px 0 0;font-size:22px;color:#3D2A2A;">${value}</p></div></td>`;
}

function h2(title: string): string {
	return `<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:normal;color:#3D2A2A;margin:28px 0 4px;">${title}</h2>`;
}

function renderReport(r: Row): string {
	const m = r.metrics || {};
	const revenue = Number(m.product_revenue_after_discounts);
	const cogs = m.cogs_estimated == null ? null : Number(m.cogs_estimated);
	const coefficient = cogs && cogs > 0 ? (revenue / cogs).toFixed(2) : "—";
	const rate = m.gross_margin_rate == null ? "—" : `${m.gross_margin_rate} %`;
	const stock = r.stock_history || {};
	const purchases = r.purchases || { units: 0, lines: [] };

	const brands = (r.brands || []).map((b: Row) => [
		escapeHtml(b.vendor),
		String(b.units_sold ?? 0),
		chf(b.revenue_after_discounts),
		chf(b.cogs_estimated),
		chf(b.gross_margin_estimated),
		b.gross_margin_rate == null ? "—" : `${b.gross_margin_rate} %`,
	]);

	const sold = (r.products_sold || []).slice(0, 25).map((p: Row) => [
		escapeHtml(p.name),
		escapeHtml(p.vendor),
		String(p.quantity_sold_gross ?? 0),
		chf(p.revenue_after_discounts),
		chf(p.gross_margin_estimated),
	]);

	const least = (r.least_sellers || []).slice(0, 5).map((p: Row) => [
		escapeHtml(p.name),
		escapeHtml(p.vendor),
		String(p.quantity_sold_gross ?? 0),
	]);

	const bought = (purchases.lines || []).slice(0, 25).map((l: Row) => [
		escapeHtml(l.product + (l.variant ? ` — ${l.variant}` : "")),
		escapeHtml(l.vendor),
		String(l.units ?? 0),
		chf(l.value_chf),
	]);

	return layout(
		`
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#3D2A2A;">Rapport mensuel</p>
<h1 style="font-family:Georgia,'Times New Roman',serif;margin:0 0 8px;font-size:28px;font-weight:normal;color:#111111;">Bilan de ${escapeHtml(r.month_label)}</h1>
<p style="margin:0 0 20px;font-size:14px;color:#777;">Ventes, achats, marge brute et stocks du mois écoulé.</p>

<table width="100%" cellpadding="0" cellspacing="0">
<tr>${kpi("CA après remises", chf(m.product_revenue_after_discounts))}${kpi("Commandes", String(m.orders_count ?? 0))}</tr>
<tr>${kpi("Coût des produits vendus", chf(m.cogs_estimated))}${kpi("Marge brute", chf(m.gross_margin_estimated))}</tr>
<tr>${kpi("Taux de marge brute", rate)}${kpi("Coefficient", coefficient)}</tr>
<tr>${kpi("Unités vendues", String(m.units_sold_gross ?? 0))}${kpi("Remises accordées", chf(m.discounts_allocated))}</tr>
<tr>${kpi("Stock initial", stock.initial == null ? "—" : `${stock.initial} u.`)}${kpi("Stock final", stock.final == null ? "—" : `${stock.final} u.`)}</tr>
<tr>${kpi("Unités achetées (réceptions)", `${purchases.units ?? 0} u.`)}${kpi("Valeur des achats", chf(purchases.value_chf))}</tr>
</table>

${h2("Ventes par marque")}
${table(
	[["Marque", false], ["Unités", true], ["CA", true], ["Coût", true], ["Marge brute", true], ["Taux", true]],
	brands,
)}

${h2("Produits vendus")}
${table([["Produit", false], ["Marque", false], ["Qté", true], ["CA", true], ["Marge brute", true]], sold)}

${h2("Produits les moins vendus")}
${table([["Produit", false], ["Marque", false], ["Qté", true]], least)}

${h2("Produits achetés (réceptions de stock)")}
${table([["Produit", false], ["Marque", false], ["Unités", true], ["Valeur", true]], bought)}

<p style="font-size:12px;color:#999;margin-top:24px;">Marges indicatives : coûts d'achat actuels appliqués aux ventes, avant TVA et remboursements.</p>
<p style="text-align:center;margin:24px 0 0;"><a href="${FRONTEND_URL}/admin" style="color:#3D2A2A;font-family:Arial,sans-serif;font-size:13px;">Ouvrir le tableau de bord →</a></p>
`,
		680,
	);
}

Deno.serve(async (req) => {
	if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
	if (!isAuthorized(req)) return json({ error: "Non autorisé" }, 401);

	const backend = env("BACKEND_URL").replace(/\/$/, "");
	const recipients = env("REPORT_RECIPIENTS")
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean);

	if (!backend) return json({ error: "BACKEND_URL manquant" }, 500);
	if (!recipients.length) return json({ error: "REPORT_RECIPIENTS manquant" }, 500);

	const res = await fetch(`${backend}/api/internal/reports/monthly?period=previous_month`, {
		headers: { "X-Baume-Internal-Token": env("BAUME_INTERNAL_TOKEN") },
	});
	if (!res.ok) {
		return json({ error: `Backend ${res.status}`, detail: await res.text() }, 502);
	}
	const report = await res.json();

	const sent = await sendEmail(
		recipients,
		`Baume — Rapport mensuel ${report.month_label}`,
		renderReport(report),
	);
	if (!sent.ok) return json({ error: sent.error }, 502);

	return json({ success: true, month: report.month_label, recipients });
});
