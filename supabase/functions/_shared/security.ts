// Contrôle d'accès des fonctions Supabase.
//
// Important : le réglage verify_jwt de Supabase vérifie seulement qu'un jeton
// est valide. La clé publique du site (anon) est elle-même un jeton valide :
// verify_jwt ne prouve donc PAS que l'appel vient du serveur ou d'un admin.
// Ce module fait la vraie vérification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_TOKEN = Deno.env.get("BAUME_INTERNAL_TOKEN") ?? "";

type Options = {
	/** Autoriser aussi une administratrice connectée (back-office du site). */
	admin?: boolean;
	/** En-têtes CORS de la fonction, pour que le refus reste lisible par le navigateur. */
	cors?: Record<string, string>;
};

function bearer(req: Request): string {
	const h = req.headers.get("Authorization") ?? "";
	return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

/** Comparaison à temps constant (évite de deviner une clé caractère par caractère). */
function safeEqual(a: string, b: string): boolean {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

function claims(token: string): Record<string, unknown> | null {
	try {
		const part = token.split(".")[1];
		if (!part) return null;
		const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
		return JSON.parse(atob(b64));
	} catch {
		return null;
	}
}

// Résultat mis en cache pour la durée de vie de l'instance.
const verifiedServiceTokens = new Set<string>();

/** Vérifie auprès de Supabase qu'un jeton est réellement une clé serveur (service_role). */
async function isRealServiceKey(token: string): Promise<boolean> {
	if (verifiedServiceTokens.has(token)) return true;
	if (claims(token)?.role !== "service_role" || !SUPABASE_URL) return false;
	try {
		// Cette route d'administration ne répond qu'à une vraie clé service_role.
		const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
			headers: { apikey: token, Authorization: `Bearer ${token}` },
		});
		if (res.ok) {
			verifiedServiceTokens.add(token);
			return true;
		}
	} catch {
		// réseau indisponible : refus par prudence
	}
	return false;
}

/**
 * Double authentification : si le compte a un code à 6 chiffres actif, la session
 * doit avoir été ouverte avec ce code (niveau aal2). Une session ouverte avec le seul
 * mot de passe (aal1) est refusée.
 */
export function hasRequiredSessionLevel(token: string, user: { factors?: Array<{ status?: string; factor_type?: string }> } | null): boolean {
	const protectedAccount = (user?.factors ?? []).some((f) => f.status === "verified");
	if (!protectedAccount) return true;
	return claims(token)?.aal === "aal2";
}

async function isAdminUser(token: string): Promise<boolean> {
	if (!token || !SERVICE_KEY || !SUPABASE_URL) return false;
	if (claims(token)?.role !== "authenticated") return false;
	const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	const { data, error } = await admin.auth.getUser(token);
	if (error || !data?.user) return false;
	if (!hasRequiredSessionLevel(token, data.user as never)) return false;
	const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
	return profile?.role === "admin";
}

function deny(status: number, message: string, cors?: Record<string, string>): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { ...(cors ?? {}), "Content-Type": "application/json" },
	});
}

/**
 * Autorise uniquement :
 *  - le serveur Baume (clé service_role) ;
 *  - les tâches planifiées (en-tête X-Baume-Internal-Token) ;
 *  - une administratrice connectée, si `admin: true`.
 * Renvoie une réponse de refus, ou null si l'appel est autorisé.
 */
export async function requireTrustedCaller(req: Request, opts: Options = {}): Promise<Response | null> {
	const internal = req.headers.get("X-Baume-Internal-Token") ?? "";
	if (INTERNAL_TOKEN && safeEqual(internal, INTERNAL_TOKEN)) return null;

	const token = bearer(req);
	if (!token) return deny(401, "Non authentifié", opts.cors);

	if (SERVICE_KEY && safeEqual(token, SERVICE_KEY)) return null;
	if (await isRealServiceKey(token)) return null;

	if (opts.admin && (await isAdminUser(token))) return null;

	return deny(403, "Accès refusé", opts.cors);
}

/**
 * Mot de passe présent dans les fuites connues (service gratuit Pwned Passwords).
 * Seuls les 5 premiers caractères de l'empreinte SHA-1 sont envoyés.
 * En cas de panne du service : false (on ne bloque jamais une cliente).
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
	if (!password) return false;
	try {
		const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
		const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
		const prefix = hex.slice(0, 5);
		const suffix = hex.slice(5);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3000);
		const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
			headers: { "Add-Padding": "true", "User-Agent": "Baume-Shop" },
			signal: controller.signal,
		}).finally(() => clearTimeout(timer));
		if (!res.ok) return false;
		const text = await res.text();
		return text.split("\n").some((line) => {
			const [candidate, count] = line.trim().split(":");
			return candidate === suffix && Number(count) > 0;
		});
	} catch {
		return false;
	}
}
