import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
	Package,
	Truck,
	CheckCircle2,
	Clock,
	XCircle,
	RefreshCw,
	MapPin,
	ArrowRight,
	Loader2,
	ExternalLink,
	ShieldCheck,
	ChevronRight,
	Lock,
	AlertTriangle,
} from "lucide-react";
import { api } from "../lib/api";

// ── Transporteurs ────────────────────────────────────────────────────────────
const CARRIERS = {
	laposte: {
		label: "La Poste Suisse",
		url: (n) => `https://www.post.ch/fr/suivi?item=${n}`,
	},
	chronopost: {
		label: "Chronopost",
		url: (n) =>
			`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLt=${n}`,
	},
	dhl: {
		label: "DHL",
		url: (n) => `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${n}`,
	},
	ups: {
		label: "UPS",
		url: (n) => `https://www.ups.com/track?tracknum=${n}`,
	},
	fedex: {
		label: "FedEx",
		url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
	},
};

// ── Timeline statuts ─────────────────────────────────────────────────────────
const TIMELINE_STEPS = [
	{
		key: "paid",
		label: "Commande confirmée",
		sub: "Votre paiement a été reçu",
		icon: CheckCircle2,
	},
	{
		key: "processing",
		label: "En préparation",
		sub: "Votre commande est en cours de préparation",
		icon: Package,
	},
	{
		key: "shipped",
		label: "Expédiée",
		sub: "Votre commande est en route",
		icon: Truck,
	},
	{
		key: "delivered",
		label: "Livrée",
		sub: "Votre commande a été livrée",
		icon: CheckCircle2,
	},
];

const STATUS_ORDER = ["paid", "processing", "shipped", "delivered"];

// Labels lisibles pour chaque statut
const STATUS_LABELS = {
	paid: "Commande confirmée",
	processing: "En préparation",
	shipped: "Expédiée",
	delivered: "Livrée",
	cancelled: "Annulée",
	refunded: "Remboursée",
};

// Libellé de l'action pour passer à l'étape suivante
const NEXT_STEP_ACTION = {
	paid: "Passer en préparation",
	processing: "Marquer comme expédiée",
	shipped: "Marquer comme livrée",
};

function getStepIndex(status) {
	const idx = STATUS_ORDER.indexOf(status);
	return idx === -1 ? 0 : idx;
}

// ── Composant Timeline ───────────────────────────────────────────────────────
function Timeline({ status }) {
	const currentIndex = getStepIndex(status);
	const isCancelled = status === "cancelled" || status === "refunded";

	if (isCancelled) {
		return (
			<div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
				<XCircle className="h-6 w-6 text-red-500 shrink-0" />
				<div>
					<p className="font-semibold text-red-700 text-[14px]">
						{status === "refunded" ? "Commande remboursée" : "Commande annulée"}
					</p>
					<p className="text-[12px] text-red-500 mt-0.5">
						{status === "refunded"
							? "Le remboursement a été effectué"
							: "Cette commande a été annulée"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative">
			{TIMELINE_STEPS.map((step, index) => {
				const isDone = index <= currentIndex;
				const isCurrent = index === currentIndex;
				const Icon = step.icon;

				return (
					<div key={step.key} className="flex items-start gap-4 relative">
						{/* Ligne verticale */}
						{index < TIMELINE_STEPS.length - 1 && (
							<div
								className={`absolute left-[19px] top-10 w-0.5 h-8 ${
									index < currentIndex ? "bg-baume-burgundy" : "bg-baume-border"
								}`}
							/>
						)}

						{/* Icône */}
						<div
							className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
								isDone
									? "bg-baume-burgundy border-baume-burgundy text-white"
									: "bg-baume-white border-baume-border text-baume-charcoal/30"
							} ${isCurrent ? "ring-4 ring-baume-burgundy/20" : ""}`}
						>
							<Icon className="h-4 w-4" />
						</div>

						{/* Texte */}
						<div
							className={`pb-8 ${index === TIMELINE_STEPS.length - 1 ? "pb-0" : ""}`}
						>
							<p
								className={`text-[14px] font-semibold ${
									isDone ? "text-baume-charcoal" : "text-baume-charcoal/40"
								}`}
							>
								{step.label}
								{isCurrent && (
									<span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-baume-burgundy/10 text-baume-burgundy font-semibold">
										En cours
									</span>
								)}
							</p>
							<p
								className={`text-[12px] mt-0.5 ${
									isDone ? "text-baume-charcoal/55" : "text-baume-charcoal/30"
								}`}
							>
								{step.sub}
							</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── Composant Section Admin ──────────────────────────────────────────────────
function AdminStatusPanel({ order, onStatusUpdate }) {
	const [updating, setUpdating] = useState(false);
	const [confirmStep, setConfirmStep] = useState(null); // null | "next" | "cancel"
	const [error, setError] = useState(null);

	const currentStatus = order.status;
	const currentIndex = getStepIndex(currentStatus);
	const isFinalStatus =
		currentStatus === "delivered" ||
		currentStatus === "cancelled" ||
		currentStatus === "refunded";

	const nextStatus = STATUS_ORDER[currentIndex + 1] || null;
	const canAdvance = !isFinalStatus && nextStatus !== null;
	const canCancel =
		!isFinalStatus &&
		currentStatus !== "cancelled" &&
		currentStatus !== "refunded";

	const handleConfirm = async () => {
		if (!confirmStep) return;
		setUpdating(true);
		setError(null);
		try {
			const newStatus = confirmStep === "next" ? nextStatus : "cancelled";
			await api.patch(`/ecom/admin/orders/${order.id}/status`, {
				status: newStatus,
			});
			onStatusUpdate(newStatus);
		} catch (e) {
			setError("Une erreur est survenue. Veuillez réessayer.");
		} finally {
			setUpdating(false);
			setConfirmStep(null);
		}
	};

	return (
		<div className="rounded-2xl border-2 border-dashed border-baume-burgundy/30 bg-baume-white overflow-hidden">
			{/* En-tête */}
			<div className="flex items-center gap-3 px-5 py-4 bg-baume-burgundy/5 border-b border-baume-burgundy/15">
				<ShieldCheck className="h-4 w-4 text-baume-burgundy shrink-0" />
				<p className="text-[13px] font-semibold text-baume-burgundy tracking-wide uppercase">
					Panneau administrateur
				</p>
			</div>

			<div className="p-5 space-y-4">
				{/* Statut actuel */}
				<div className="flex items-center justify-between">
					<span className="text-[13px] text-baume-charcoal/60">
						Statut actuel
					</span>
					<span
						className={`text-[12px] font-semibold px-3 py-1 rounded-full ${
							isFinalStatus && currentStatus === "delivered"
								? "bg-emerald-100 text-emerald-700"
								: isFinalStatus
									? "bg-red-100 text-red-700"
									: "bg-baume-burgundy/10 text-baume-burgundy"
						}`}
					>
						{STATUS_LABELS[currentStatus] || currentStatus}
					</span>
				</div>

				{/* Progression visuelle */}
				{!["cancelled", "refunded"].includes(currentStatus) && (
					<div className="flex items-center gap-1">
						{STATUS_ORDER.map((s, i) => (
							<React.Fragment key={s}>
								<div
									className={`flex-1 h-1.5 rounded-full transition-all ${
										i <= currentIndex ? "bg-baume-burgundy" : "bg-baume-border"
									}`}
								/>
								{i < STATUS_ORDER.length - 1 && (
									<div className="w-1 h-1 rounded-full bg-baume-border shrink-0" />
								)}
							</React.Fragment>
						))}
					</div>
				)}

				{/* Zone de confirmation */}
				{confirmStep && (
					<div
						className={`rounded-xl p-4 border ${
							confirmStep === "cancel"
								? "bg-red-50 border-red-200"
								: "bg-amber-50 border-amber-200"
						}`}
					>
						<div className="flex items-start gap-3">
							<AlertTriangle
								className={`h-4 w-4 mt-0.5 shrink-0 ${
									confirmStep === "cancel" ? "text-red-500" : "text-amber-600"
								}`}
							/>
							<div className="flex-1">
								<p
									className={`text-[13px] font-semibold ${
										confirmStep === "cancel" ? "text-red-700" : "text-amber-800"
									}`}
								>
									{confirmStep === "cancel"
										? "Confirmer l'annulation ?"
										: `Passer au statut "${STATUS_LABELS[nextStatus]}" ?`}
								</p>
								<p
									className={`text-[12px] mt-0.5 ${
										confirmStep === "cancel" ? "text-red-600" : "text-amber-700"
									}`}
								>
									{confirmStep === "cancel"
										? "Cette action est irréversible."
										: "Vous ne pourrez pas revenir en arrière."}
								</p>
								<div className="flex gap-2 mt-3">
									<button
										onClick={handleConfirm}
										disabled={updating}
										className={`h-8 px-4 rounded-full text-[12px] font-semibold text-white inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
											confirmStep === "cancel"
												? "bg-red-500 hover:bg-red-600"
												: "bg-baume-burgundy hover:bg-baume-burgundyDark"
										}`}
									>
										{updating ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : null}
										Confirmer
									</button>
									<button
										onClick={() => setConfirmStep(null)}
										disabled={updating}
										className="h-8 px-4 rounded-full text-[12px] font-semibold text-baume-charcoal border border-baume-border hover:border-baume-burgundy transition-colors disabled:opacity-60"
									>
										Annuler
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Message d'erreur */}
				{error && (
					<p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
						{error}
					</p>
				)}

				{/* Actions */}
				{!confirmStep && (
					<div className="space-y-2">
						{isFinalStatus ? (
							/* État terminal : commande verrouillée */
							<div className="flex items-center gap-2.5 text-[13px] text-baume-charcoal/50 bg-baume-ivory rounded-xl px-4 py-3">
								<Lock className="h-4 w-4 shrink-0" />
								<span>
									{currentStatus === "delivered"
										? "Commande terminée — aucune modification possible."
										: "Commande clôturée — aucune modification possible."}
								</span>
							</div>
						) : (
							<>
								{/* Bouton avancer */}
								{canAdvance && (
									<button
										onClick={() => setConfirmStep("next")}
										className="w-full h-10 rounded-full bg-baume-burgundy text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark transition-colors"
									>
										{NEXT_STEP_ACTION[currentStatus]}
										<ChevronRight className="h-4 w-4" />
									</button>
								)}

								{/* Bouton annuler */}
								{canCancel && (
									<button
										onClick={() => setConfirmStep("cancel")}
										className="w-full h-10 rounded-full border border-red-200 text-red-500 text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
									>
										<XCircle className="h-4 w-4" />
										Annuler la commande
									</button>
								)}
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function OrderTrackingPage() {
	const { orderId } = useParams();
	const [order, setOrder] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Avec un hook useAuth ou useProfile selon ce que vous avez
	const { profile } = useAuth();
	const isAdmin = profile?.role === "admin";

	useEffect(() => {
		if (!orderId) return;
		setLoading(true);
		api
			.get(`/orders/${orderId}/tracking`)
			.then((r) => setOrder(r.data))
			.catch(() => setError("Commande introuvable"))
			.finally(() => setLoading(false));
	}, [orderId]);

	const handleStatusUpdate = (newStatus) => {
		setOrder((prev) => ({ ...prev, status: newStatus }));
	};

	if (loading) {
		return (
			<div className="min-h-[70vh] bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	if (error || !order) {
		return (
			<div className="min-h-[70vh] bg-baume-ivory flex items-center justify-center px-5">
				<div className="max-w-[480px] w-full text-center">
					<span className="text-[48px]">📦</span>
					<h1 className="font-editorial text-[32px] text-baume-charcoal mt-4">
						Commande introuvable
					</h1>
					<p className="mt-3 text-[15px] text-baume-charcoal/65">
						Vérifiez le lien ou contactez-nous si vous pensez qu'il y a une
						erreur.
					</p>
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						<Link
							to="/compte"
							className="h-12 px-7 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition-colors"
						>
							Mes commandes <ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							to="/contact"
							className="h-12 px-7 rounded-full border border-baume-border text-baume-charcoal font-semibold text-[14px] inline-flex items-center hover:border-baume-burgundy transition-colors"
						>
							Nous contacter
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const items = order.items || order.order_items || [];
	const currency = (order.currency || "CHF").toUpperCase();
	const shippingAddress = order.shipping_address || {};
	const orderNumber = `#${String(order.id).slice(0, 8).toUpperCase()}`;

	const carrierInfo = order.carrier ? CARRIERS[order.carrier] : null;
	const trackingUrl =
		carrierInfo && order.tracking_number
			? carrierInfo.url(order.tracking_number)
			: null;

	return (
		<div className="bg-baume-ivory min-h-[70vh]">
			{/* Hero */}
			<section className="bg-baume-burgundy text-baume-white py-12 md:py-16 px-5">
				<div className="max-w-[720px] mx-auto text-center">
					<p className="text-[12px] uppercase tracking-[0.28em] text-baume-white/60 font-semibold mb-3">
						Suivi de commande
					</p>
					<h1 className="font-editorial text-[36px] md:text-[48px] leading-[1.08]">
						{orderNumber}
					</h1>
					<p className="mt-3 text-[15px] text-baume-white/70">
						Passée le{" "}
						{order.created_at
							? new Date(order.created_at).toLocaleDateString("fr-CH", {
									day: "numeric",
									month: "long",
									year: "numeric",
								})
							: "—"}
						{order.email && ` · ${order.email}`}
					</p>
				</div>
			</section>

			<section className="py-10 px-5">
				<div className="max-w-[900px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
					{/* Colonne gauche */}
					<div className="space-y-6">
						{/* Timeline */}
						<div className="rounded-2xl border border-baume-border bg-baume-white p-6">
							<h2 className="text-[15px] font-semibold text-baume-charcoal mb-6">
								Statut de votre commande
							</h2>
							<Timeline status={order.status} />
						</div>

						{/* Tracking transporteur */}
						{trackingUrl && (
							<div className="rounded-2xl border border-baume-burgundy/30 bg-baume-burgundy/5 p-5 flex items-center justify-between gap-4">
								<div className="flex items-center gap-3">
									<Truck className="h-5 w-5 text-baume-burgundy shrink-0" />
									<div>
										<p className="text-[13px] font-semibold text-baume-charcoal">
											{carrierInfo?.label}
										</p>
										<p className="text-[12px] text-baume-charcoal/55 font-mono mt-0.5">
											{order.tracking_number}
										</p>
									</div>
								</div>
								<a
									href={trackingUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="h-10 px-5 rounded-full bg-baume-burgundy text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition-colors shrink-0"
								>
									Suivre <ExternalLink className="h-3.5 w-3.5" />
								</a>
							</div>
						)}

						{/* Articles */}
						<div className="rounded-2xl border border-baume-border bg-baume-white overflow-hidden">
							<div className="px-5 py-4 border-b border-baume-border">
								<h2 className="text-[15px] font-semibold text-baume-charcoal">
									Articles commandés
								</h2>
							</div>
							{items.length === 0 ? (
								<div className="p-5 text-[13px] text-baume-charcoal/50 text-center">
									Aucun article trouvé
								</div>
							) : (
								<div className="divide-y divide-baume-border">
									{items.map((item, i) => (
										<div
											key={item.id || i}
											className="px-5 py-4 flex items-center gap-4"
										>
											<div className="h-12 w-12 rounded-lg bg-baume-ivory border border-baume-border flex items-center justify-center shrink-0">
												<Package className="h-5 w-5 text-baume-charcoal/30" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-[13px] font-semibold text-baume-charcoal truncate">
													{item.product_title || item.name || "Produit"}
												</p>
												{item.variant_title && (
													<p className="text-[12px] text-baume-charcoal/55">
														{item.variant_title}
													</p>
												)}
											</div>
											<div className="text-right shrink-0">
												<p className="text-[13px] text-baume-charcoal/60">
													× {item.quantity || 1}
												</p>
												<p className="text-[13px] font-semibold text-baume-charcoal">
													{Number(item.total_price || 0).toFixed(2)} {currency}
												</p>
											</div>
										</div>
									))}
								</div>
							)}
							{/* Total */}
							<div className="px-5 py-4 border-t border-baume-border bg-baume-ivory/40 flex justify-between items-center">
								<span className="text-[14px] font-semibold text-baume-charcoal">
									Total
								</span>
								<span className="font-editorial text-[20px] text-baume-charcoal">
									{Number(order.total || 0).toFixed(2)} {currency}
								</span>
							</div>
						</div>
					</div>

					{/* Colonne droite */}
					<div className="space-y-4">
						{/* ── SECTION ADMIN ── */}
						{isAdmin && (
							<AdminStatusPanel
								order={order}
								onStatusUpdate={handleStatusUpdate}
							/>
						)}

						{/* Adresse */}
						{Object.keys(shippingAddress).length > 0 && (
							<div className="rounded-2xl border border-baume-border bg-baume-white p-5">
								<div className="flex items-center gap-2 mb-3">
									<MapPin className="h-4 w-4 text-baume-burgundy" />
									<h3 className="text-[14px] font-semibold text-baume-charcoal">
										Adresse de livraison
									</h3>
								</div>
								<div className="text-[13px] text-baume-charcoal/70 leading-6">
									<p>
										{shippingAddress.name ||
											[shippingAddress.first_name, shippingAddress.last_name]
												.filter(Boolean)
												.join(" ")}
									</p>
									<p>{shippingAddress.line1 || shippingAddress.address}</p>
									<p>
										{[shippingAddress.postal_code, shippingAddress.city]
											.filter(Boolean)
											.join(" ")}
									</p>
									<p>{shippingAddress.country}</p>
								</div>
							</div>
						)}

						{/* Récapitulatif financier */}
						<div className="rounded-2xl border border-baume-border bg-baume-white p-5">
							<h3 className="text-[14px] font-semibold text-baume-charcoal mb-3">
								Récapitulatif
							</h3>
							<div className="space-y-2 text-[13px]">
								<div className="flex justify-between text-baume-charcoal/70">
									<span>Sous-total</span>
									<span>
										{Number(order.subtotal || 0).toFixed(2)} {currency}
									</span>
								</div>
								{Number(order.discount_total || 0) > 0 && (
									<div className="flex justify-between text-emerald-600">
										<span>
											Réduction{" "}
											{order.discount_code && `(${order.discount_code})`}
										</span>
										<span>
											−{Number(order.discount_total || 0).toFixed(2)} {currency}
										</span>
									</div>
								)}
								<div className="flex justify-between text-baume-charcoal/70">
									<span>Livraison</span>
									<span>
										{Number(order.shipping_total || 0) === 0
											? "Offerte"
											: `${Number(order.shipping_total || 0).toFixed(2)} ${currency}`}
									</span>
								</div>
								<div className="flex justify-between font-semibold text-baume-charcoal pt-2 border-t border-baume-border">
									<span>Total</span>
									<span>
										{Number(order.total || 0).toFixed(2)} {currency}
									</span>
								</div>
							</div>
						</div>

						{/* Besoin d'aide */}
						<div className="rounded-2xl border border-baume-border bg-baume-white p-5">
							<div className="flex items-center gap-2 mb-2">
								<Clock className="h-4 w-4 text-baume-burgundy" />
								<h3 className="text-[14px] font-semibold text-baume-charcoal">
									Besoin d'aide ?
								</h3>
							</div>
							<p className="text-[13px] text-baume-charcoal/65 mb-3">
								Notre équipe répond sous 24h ouvrées.
							</p>
							<Link
								to="/contact"
								className="h-10 w-full rounded-full border border-baume-border text-baume-charcoal text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:border-baume-burgundy hover:text-baume-burgundy transition-colors"
							>
								Contacter le support
							</Link>
						</div>

						{/* Retour boutique */}
						<Link
							to="/shop/produit"
							className="h-12 w-full rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark transition-colors"
						>
							Continuer mes achats <ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
