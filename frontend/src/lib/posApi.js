import { posHttp } from "./posSession";

// ── Caisse (POS) : appels à l'API /api/pos/* avec la session propre à la caisse ──

export const posCatalog = () => posHttp.get("/pos/catalog").then((r) => r.data);

export const posSearchCustomers = (search) =>
	posHttp.get("/pos/customers", { params: { search, limit: 30 } }).then((r) => r.data);

export const posCustomer = (profileId) =>
	posHttp.get(`/pos/customers/${profileId}`).then((r) => r.data);

export const posLookupCustomer = (email) =>
	posHttp.get("/pos/customers/lookup", { params: { email } }).then((r) => r.data);

export const posOrders = (limit = 200) =>
	posHttp.get("/pos/orders", { params: { limit } }).then((r) => r.data);

export const posCreateQrCheckout = (payload) =>
	posHttp.post("/pos/checkout", payload, { timeout: 30000 }).then((r) => r.data);

export const posQrStatus = (sessionId) =>
	posHttp.get(`/pos/checkout/${sessionId}`).then((r) => r.data);

export const posCancelQr = (sessionId) =>
	posHttp.post(`/pos/checkout/${sessionId}/cancel`).then((r) => r.data);

export const posCashCheckout = (payload) =>
	posHttp.post("/pos/checkout/cash", payload, { timeout: 45000 }).then((r) => r.data);

export const posReceipt = (orderId) =>
	posHttp.get(`/pos/orders/${orderId}/receipt`).then((r) => r.data);

export function posError(err, fallback = "Une erreur est survenue") {
	const detail = err?.response?.data?.detail;
	if (typeof detail === "string") return detail;
	if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join(", ");
	if (err?.code === "ECONNABORTED") return "Le serveur met trop de temps à répondre.";
	return fallback;
}

const chf = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });

export const formatChf = (value) => chf.format(Number(value || 0));

export function newSaleId() {
	if (window.crypto?.randomUUID) return window.crypto.randomUUID();
	const b = window.crypto.getRandomValues(new Uint8Array(16));
	b[6] = (b[6] & 0x0f) | 0x40;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Arrondi au centime, en évitant les erreurs de virgule flottante.
export const roundChf = (value) => Math.round(Number(value || 0) * 100) / 100;
