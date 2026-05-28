// ── Clés et catégories ────────────────────────────────────────────────────────
const CONSENT_KEY = "baume_cookie_consent";
const CONSENT_VERSION = "1.0";

export const CATEGORIES = {
    necessary: {
        id: "necessary",
        label: "Strictement nécessaires",
        description: "Authentification, panier, préférences. Ces cookies sont indispensables au fonctionnement du site et ne peuvent pas être désactivés.",
        required: true,
    },
    analytics: {
        id: "analytics",
        label: "Analytiques",
        description: "PostHog et Google Analytics (à venir) nous aident à comprendre comment vous utilisez le site afin de l'améliorer. Aucune donnée personnelle identifiable n'est partagée.",
        required: false,
    },
    functional: {
        id: "functional",
        label: "Fonctionnalités",
        description: "Google Maps pour afficher la carte de notre boutique. Ces cookies permettent des fonctionnalités enrichies.",
        required: false,
    },
};

// ── Lire le consentement stocké ───────────────────────────────────────────────
export function getConsent() {
    try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.version !== CONSENT_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}

// ── Sauvegarder le consentement ───────────────────────────────────────────────
export function saveConsent(choices) {
    const consent = {
        version: CONSENT_VERSION,
        date: new Date().toISOString(),
        choices: {
            necessary: true, // toujours true
            analytics: choices.analytics ?? false,
            functional: choices.functional ?? false,
        },
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    applyConsent(consent.choices);
    return consent;
}

// ── Accepter tout ─────────────────────────────────────────────────────────────
export function acceptAll() {
    return saveConsent({ analytics: true, functional: true });
}

// ── Refuser tout (sauf nécessaires) ──────────────────────────────────────────
export function rejectAll() {
    return saveConsent({ analytics: false, functional: false });
}

// ── Appliquer le consentement aux outils ─────────────────────────────────────
export function applyConsent(choices) {
    // PostHog
    if (typeof window !== "undefined" && window.posthog) {
        if (choices.analytics) {
            window.posthog.opt_in_capturing();
        } else {
            window.posthog.opt_out_capturing();
        }
    }

    // Google Analytics (prêt pour plus tard)
    if (typeof window !== "undefined" && window.gtag) {
        window.gtag("consent", "update", {
            analytics_storage: choices.analytics ? "granted" : "denied",
        });
    }

    // Dispatch un event pour que les composants réagissent
    window.dispatchEvent(
        new CustomEvent("baume:consent", { detail: choices })
    );
}

// ── Vérifier si une catégorie est acceptée ────────────────────────────────────
export function hasConsent(category) {
    const consent = getConsent();
    if (!consent) return false;
    return consent.choices[category] === true;
}

// ── Réinitialiser le consentement (pour le footer) ────────────────────────────
export function resetConsent() {
    localStorage.removeItem(CONSENT_KEY);
    window.location.reload();
}