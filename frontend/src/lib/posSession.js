import axios from "axios";

/**
 * Session de la caisse, distincte de la session du site.
 *
 * - Clés de stockage propres à la caisse : la déconnexion automatique du
 *   site (5 min d'inactivité) ne les touche pas, et inversement.
 * - Aucune expiration : la caisse reste active tant qu'on n'appuie pas sur
 *   « Désactiver la caisse ». Le jeton d'accès (≈ 1 h) est renouvelé
 *   automatiquement grâce au refresh token Supabase.
 */

const KEYS = {
	accessToken: "baume_pos_access_token",
	refreshToken: "baume_pos_refresh_token",
	user: "baume_pos_user",
	activatedAt: "baume_pos_activated_at",
};

const REFRESH_EVERY_MS = 30 * 60 * 1000;

const BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

function read(key) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key, value) {
	try {
		if (value == null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		/* stockage indisponible */
	}
}

export function getPosUser() {
	try {
		return JSON.parse(read(KEYS.user) || "null");
	} catch {
		return null;
	}
}

export function isPosActive() {
	return Boolean(read(KEYS.accessToken) && read(KEYS.refreshToken));
}

function saveTokens({ access_token: access, refresh_token: refresh }) {
	if (access) write(KEYS.accessToken, access);
	if (refresh) write(KEYS.refreshToken, refresh);
}

export function deactivatePos() {
	Object.values(KEYS).forEach((k) => write(k, null));
	window.dispatchEvent(new Event("baume-pos-session"));
}

// Client HTTP sans intercepteur, pour la connexion et le renouvellement.
const bare = axios.create({ baseURL: BASE_URL, timeout: 20000 });

/** Active la caisse avec un compte administrateur. */
export async function activatePos(email, password) {
	const { data } = await bare.post("/auth/login", { email, password });
	if (data?.user?.role !== "admin") {
		throw Object.assign(new Error("Ce compte n'a pas accès à la caisse."), { posForbidden: true });
	}
	saveTokens(data);
	write(KEYS.user, JSON.stringify(data.user));
	write(KEYS.activatedAt, new Date().toISOString());
	window.dispatchEvent(new Event("baume-pos-session"));
	return data.user;
}

let refreshing = null;

/** Renouvelle le jeton d'accès (un seul appel à la fois). */
export function refreshPosSession() {
	if (refreshing) return refreshing;
	const refreshToken = read(KEYS.refreshToken);
	if (!refreshToken) return Promise.reject(new Error("Caisse non activée"));

	refreshing = bare
		.post("/auth/refresh", { refresh_token: refreshToken })
		.then(({ data }) => {
			if (!data?.access_token) throw new Error("Renouvellement invalide");
			saveTokens(data);
			return data.access_token;
		})
		.catch((err) => {
			// Refresh token refusé (révoqué / session supprimée) : la caisse
			// doit être réactivée. Une erreur réseau, elle, ne désactive rien.
			if (err?.response?.status === 401) deactivatePos();
			throw err;
		})
		.finally(() => {
			refreshing = null;
		});

	return refreshing;
}

/** Client HTTP de la caisse : jeton caisse + renouvellement sur 401. */
export const posHttp = axios.create({ baseURL: BASE_URL, timeout: 15000 });

posHttp.interceptors.request.use((config) => {
	const token = read(KEYS.accessToken);
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

posHttp.interceptors.response.use(
	(response) => response,
	async (error) => {
		const original = error.config;
		if (error?.response?.status === 401 && original && !original._posRetried && read(KEYS.refreshToken)) {
			original._posRetried = true;
			const token = await refreshPosSession();
			original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
			return posHttp(original);
		}
		throw error;
	},
);

/** Renouvellement préventif tant que la caisse est ouverte. */
export function startPosKeepAlive() {
	const tick = () => {
		if (isPosActive()) refreshPosSession().catch(() => {});
	};
	const id = setInterval(tick, REFRESH_EVERY_MS);
	const onVisible = () => {
		if (document.visibilityState === "visible") tick();
	};
	document.addEventListener("visibilitychange", onVisible);
	return () => {
		clearInterval(id);
		document.removeEventListener("visibilitychange", onVisible);
	};
}
