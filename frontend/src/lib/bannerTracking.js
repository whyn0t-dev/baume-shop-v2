// ─────────────────────────────────────────────────────────────────────────────
// Suivi des bannières promotionnelles (CTR = clics / affichages)
//
// • Un « affichage » est compté quand au moins 50 % de la bannière est
//   visible, une seule fois par bannière et par session de navigation.
// • Un « clic » est compté à chaque clic sur un lien/bouton de la bannière.
// • Les événements partent vers /api/banners/track (Supabase) et, si
//   PostHog est actif, sont aussi envoyés à PostHog.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;
const SESSION_KEY = "baume_banner_session";
const SEEN_KEY = "baume_banner_seen";

function safeSession(fn, fallback) {
	try {
		return fn(window.sessionStorage);
	} catch {
		return fallback;
	}
}

export function getBannerSessionId() {
	return safeSession((ss) => {
		let id = ss.getItem(SESSION_KEY);
		if (!id) {
			id =
				(window.crypto?.randomUUID && window.crypto.randomUUID()) ||
				`${Date.now()}-${Math.random().toString(36).slice(2)}`;
			ss.setItem(SESSION_KEY, id);
		}
		return id;
	}, "no-session");
}

function alreadySeen(bannerId) {
	return safeSession((ss) => {
		const seen = JSON.parse(ss.getItem(SEEN_KEY) || "[]");
		if (seen.includes(bannerId)) return true;
		seen.push(bannerId);
		ss.setItem(SEEN_KEY, JSON.stringify(seen.slice(-200)));
		return false;
	}, false);
}

function send(payload) {
	const url = `${API_BASE}/banners/track`;
	const body = JSON.stringify(payload);
	try {
		// sendBeacon survit à la navigation déclenchée par le clic.
		// Type text/plain = requête « simple » (pas de pré-vérification CORS).
		if (navigator.sendBeacon) {
			const ok = navigator.sendBeacon(
				url,
				new Blob([body], { type: "text/plain;charset=UTF-8" }),
			);
			if (ok) return;
		}
	} catch {
		/* repli sur fetch */
	}
	fetch(url, {
		method: "POST",
		headers: { "Content-Type": "text/plain;charset=UTF-8" },
		body,
		keepalive: true,
	}).catch(() => {});
}

/**
 * @param {"view"|"click"} eventType
 * @param {{id: string, label?: string, target?: string}} banner
 */
export function trackBanner(eventType, banner) {
	if (!banner?.id) return;
	if (eventType === "view" && alreadySeen(banner.id)) return;

	const payload = {
		banner_id: banner.id,
		banner_label: banner.label || banner.id,
		event_type: eventType,
		target: banner.target || null,
		page: typeof window !== "undefined" ? window.location.pathname : null,
		session_id: getBannerSessionId(),
	};
	send(payload);

	try {
		if (window.posthog?.capture) {
			window.posthog.capture(
				eventType === "view" ? "banner_viewed" : "banner_clicked",
				payload,
			);
		}
	} catch {
		/* PostHog facultatif */
	}
}
