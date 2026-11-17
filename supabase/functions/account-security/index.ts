// Sauvegarde de la fonction déployée (version 2), mise en forme compacte.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { hasRequiredSessionLevel, isPasswordPwned } from "../_shared/security.ts";
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: Record<string, unknown>, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
	});
}

function validEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { status: 200, headers: corsHeaders });
	}

	if (req.method !== "POST") {
		return response({ success: false, message: "Méthode non autorisée." }, 405);
	}

	try {
		const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
		const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

		if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
			console.error("Variables Supabase manquantes.");
			return response({ success: false, message: "Configuration serveur incomplète." }, 500);
		}

		// ── Authentification utilisateur ──
		const authorization = req.headers.get("Authorization") || "";
		const token = authorization.replace(/^Bearer\s+/i, "").trim();

		if (!token) {
			return response({ success: false, message: "Session utilisateur manquante." }, 401);
		}

		const authClient = createClient(supabaseUrl, supabaseAnonKey, {
			auth: { persistSession: false, autoRefreshToken: false },
		});

		const { data: { user }, error: userError } = await authClient.auth.getUser(token);

		if (userError || !user) {
			console.error("Utilisateur non authentifié :", userError);
			return response({ success: false, message: "Votre session est invalide ou a expiré." }, 401);
		}

		// Compte protégé par double authentification : code obligatoire pour modifier e-mail ou mot de passe.
		if (!hasRequiredSessionLevel(token, user as never)) {
			return response({ success: false, message: "Code de double authentification requis." }, 401);
		}

		// ── Client admin ──
		const admin = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false, autoRefreshToken: false },
		});

		const body = await req.json().catch(() => null);
		const action = typeof body?.action === "string" ? body.action : "";

		// ── Modification e-mail ──
		if (action === "update_email") {
			const newEmail = typeof body?.new_email === "string" ? body.new_email.trim().toLowerCase() : "";

			if (!newEmail || !validEmail(newEmail)) {
				return response({ success: false, message: "L'adresse e-mail saisie n'est pas valide." }, 400);
			}

			if (newEmail === String(user.email || "").trim().toLowerCase()) {
				return response({ success: false, message: "Cette adresse e-mail est déjà utilisée sur votre compte." }, 400);
			}

			const { data: updatedUser, error: emailError } = await admin.auth.admin.updateUserById(user.id, {
				email: newEmail,
				// L'adresse est considérée comme confirmée directement.
				email_confirm: true,
			});

			if (emailError) {
				console.error("Erreur modification e-mail :", emailError);
				if (/already|registered|exists|duplicate/i.test(emailError.message)) {
					return response({ success: false, message: "Cette adresse e-mail est déjà utilisée par un autre compte." }, 409);
				}
				return response({ success: false, message: "Impossible de modifier l'adresse e-mail." }, 400);
			}

			return response({
				success: true,
				action: "update_email",
				email: updatedUser.user?.email || newEmail,
				message: "Adresse e-mail mise à jour.",
			});
		}

		// ── Modification mot de passe ──
		if (action === "update_password") {
			const currentPassword = typeof body?.current_password === "string" ? body.current_password : "";
			const newPassword = typeof body?.new_password === "string" ? body.new_password : "";

			if (!currentPassword || !newPassword) {
				return response({ success: false, message: "Le mot de passe actuel et le nouveau mot de passe sont obligatoires." }, 400);
			}
			if (newPassword.length < 8) {
				return response({ success: false, message: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, 400);
			}
			if (currentPassword === newPassword) {
				return response({ success: false, message: "Le nouveau mot de passe doit être différent de l'actuel." }, 400);
			}
			if (await isPasswordPwned(newPassword)) {
				return response({ success: false, message: "Ce mot de passe est apparu dans une fuite de données, choisissez-en un autre." }, 400);
			}
			if (!user.email) {
				return response({ success: false, message: "Votre compte ne possède pas d'adresse e-mail permettant de vérifier votre mot de passe." }, 400);
			}

			// Vérification du mot de passe actuel avec un client séparé (session jamais sauvegardée).
			const passwordVerifier = createClient(supabaseUrl, supabaseAnonKey, {
				auth: { persistSession: false, autoRefreshToken: false },
			});

			const { error: passwordVerificationError } = await passwordVerifier.auth.signInWithPassword({
				email: user.email,
				password: currentPassword,
			});

			if (passwordVerificationError) {
				return response({ success: false, message: "Le mot de passe actuel est incorrect." }, 401);
			}

			const { error: updatePasswordError } = await admin.auth.admin.updateUserById(user.id, {
				password: newPassword,
			});

			if (updatePasswordError) {
				console.error("Erreur modification mot de passe :", updatePasswordError);
				return response({ success: false, message: "Impossible de modifier le mot de passe." }, 400);
			}

			return response({ success: true, action: "update_password", message: "Mot de passe mis à jour." });
		}

		return response({ success: false, message: "Action de sécurité inconnue." }, 400);
	} catch (error) {
		console.error("account-security error :", error);
		return response({ success: false, message: "Une erreur serveur est survenue." }, 500);
	}
});
