// Utilitaires partagés par les fonctions Supabase Baume
// (emails Resend, contrôle du jeton interne, client Supabase service role).

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const env = (key: string, fallback = ""): string =>
	Deno.env.get(key) ?? fallback;

export const FRONTEND_URL = env("FRONTEND_URL", "https://baumeshop-v2.weblax.fr").replace(/\/$/, "");
export const SENDER_EMAIL = env("SENDER_EMAIL", "contact@baumeshop-v2.weblax.fr");
export const SENDER_NAME = env("SENDER_NAME", "Baume Genève");

export function adminClient(): SupabaseClient {
	return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
		auth: { persistSession: false },
	});
}

export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** Seuls le cron Supabase et le backend Baume (jeton interne) peuvent appeler ces fonctions. */
export function isAuthorized(req: Request): boolean {
	const expected = env("BAUME_INTERNAL_TOKEN");
	if (!expected) return false;
	return req.headers.get("X-Baume-Internal-Token") === expected;
}

export async function sendEmail(
	to: string | string[],
	subject: string,
	html: string,
): Promise<{ ok: boolean; error?: string }> {
	const apiKey = env("RESEND_API_KEY");
	if (!apiKey) return { ok: false, error: "RESEND_API_KEY manquante" };

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
			to: Array.isArray(to) ? to : [to],
			subject,
			html,
		}),
	});
	if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
	return { ok: true };
}

export const escapeHtml = (v: unknown): string =>
	String(v ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

export const chf = (v: unknown): string => {
	if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "—";
	return (
		new Intl.NumberFormat("fr-CH", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Number(v)) + " CHF"
	);
};

export const dateFr = (iso: string): string =>
	new Intl.DateTimeFormat("fr-CH", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "Europe/Zurich",
	}).format(new Date(iso));

/** Code promo lisible et difficile à deviner : PREFIX-XXXXXX */
export function randomCode(prefix: string): string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
	return `${prefix}-${suffix}`;
}

/** Mise en page email aux couleurs Baume (identique aux emails existants). */
export function layout(bodyHtml: string, width = 600): string {
	return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 20px;"><tr><td align="center">
<table width="${width}" cellpadding="0" cellspacing="0" style="max-width:${width}px;width:100%;">
<tr><td style="background:#3D2A2A;padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.6);text-transform:uppercase;">Baume</p>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);letter-spacing:1px;">Genève · Intimité &amp; bien-être féminin</p>
</td></tr>
<tr><td style="background:#ffffff;padding:36px 40px;color:#2C2C2C;font-size:15px;line-height:26px;">${bodyHtml}</td></tr>
<tr><td style="background:#faf7f4;padding:24px 40px;border-radius:0 0 16px 16px;border-top:1px solid #f0ece8;text-align:center;">
<p style="margin:0 0 4px;font-size:12px;color:#999;">Une question ? Écrivez-nous à <a href="mailto:${SENDER_EMAIL}" style="color:#3D2A2A;">${SENDER_EMAIL}</a></p>
<p style="margin:4px 0 0;font-size:11px;color:#bbb;">Baume Sàrl · Rue du Rhône 15 · 1204 Genève</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function promoBlock(code: string, percent: number, endsAt: string): string {
	return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td style="border:1px dashed #D3B1A0;border-radius:16px;background:#FBF5E3;padding:24px;text-align:center;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#3D2A2A;">−${percent}&nbsp;% sur votre prochaine commande</p>
<p style="margin:0;font-family:monospace;font-size:26px;font-weight:bold;color:#3D2A2A;letter-spacing:2px;">${escapeHtml(code)}</p>
<p style="margin:10px 0 0;font-size:12px;color:#888;">Valable une seule fois, jusqu'au ${dateFr(endsAt)}.</p>
</td></tr></table>`;
}

export function button(href: string, label: string): string {
	return `<p style="text-align:center;margin:28px 0 8px;"><a href="${href}" style="display:inline-block;background:#3D2A2A;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(label)}</a></p>`;
}
