import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
	ArrowLeft,
	ChevronDown,
	CreditCard,
	Loader2,
	MapPin,
	Package,
	Truck,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
	getAdminOrder,
	updateOrderStatus,
	updateOrderItemStatus,
	refundOrder,
	api,
} from "../lib/api";

export default function OrderItems() {
	const { orderId } = useParams();
	const { user, status } = useAuth();

	const [order, setOrder] = useState(null);
	const [loading, setLoading] = useState(true);
	const [currentStatus, setCurrentStatus] = useState(null);

	const isAdmin =
		user?.role === "admin" || user?.is_admin === true || user?.isAdmin === true;

	useEffect(() => {
		if (order?.status) setCurrentStatus(order.status);
	}, [order]);

	async function handleStatusChange(newStatus) {
		if (!order?.id) return;

		if (newStatus === "refunded") {
			if (
				!window.confirm(
					"Rembourser cette commande via Stripe ? Cette action est irréversible.",
				)
			)
				return;
			try {
				await api.patch(`/ecom/admin/returns/${order.id}/refund`);
				setCurrentStatus("refunded");
				setOrder((prev) => ({ ...prev, status: "refunded" }));
			} catch (err) {
				alert(`Erreur remboursement : ${err.message}`);
			}
			return;
		}

		try {
			// ← Utiliser la route FastAPI qui déclenche l'email
			await api.patch(`/ecom/admin/orders/${order.id}/status`, {
				status: newStatus,
			});
			setCurrentStatus(newStatus);
			setOrder((prev) => ({ ...prev, status: newStatus }));
		} catch (err) {
			alert(err?.response?.data?.detail || err.message);
		}
	}

	useEffect(() => {
		if (status !== "authenticated" || !isAdmin) return;
		setLoading(true);
		getAdminOrder(orderId)
			.then((data) => setOrder(data))
			.catch(() => setOrder(null))
			.finally(() => setLoading(false));
	}, [orderId, status, isAdmin]);

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	if (status !== "authenticated" || !isAdmin) {
		return <Navigate to="/compte" replace />;
	}

	if (!order) {
		return (
			<div className="min-h-screen bg-baume-ivory p-8 text-center">
				<p className="text-baume-charcoal/60">Commande introuvable.</p>
				<Link
					to="/admin"
					className="mt-4 inline-block text-baume-burgundy text-[14px] font-semibold"
				>
					← Retour aux commandes
				</Link>
			</div>
		);
	}

	const items = Array.isArray(order.items) ? order.items : [];
	const currency = (order.currency || "CHF").toUpperCase();
	const shippingAddress =
		typeof order.shipping_address === "object" && order.shipping_address
			? order.shipping_address
			: {};
	const orderNumber = order.id
		? `#${String(order.id).slice(0, 8).toUpperCase()}`
		: "#Commande";
	const unfulfilledCount = items.filter(
		(i) => i.fulfillment_status !== "fulfilled",
	).length;

	return (
		<div className="min-h-screen bg-baume-ivory/40 text-baume-charcoal">
			{/* Header */}
			<header className="sticky top-0 z-10 border-b border-baume-border bg-baume-white/95 backdrop-blur px-4 md:px-8 py-4">
				<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 max-w-6xl mx-auto">
					<div>
						<Link
							to="/admin"
							className="inline-flex items-center gap-1 text-[13px] text-baume-burgundy hover:text-baume-burgundyDark mb-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Commandes
						</Link>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-[20px] font-semibold text-baume-charcoal">
								{orderNumber}
							</h1>
							<StatusBadge status={currentStatus} />
						</div>
						<p className="text-[12px] text-baume-charcoal/50 mt-1">
							{order.created_at
								? new Date(order.created_at).toLocaleString("fr-CH")
								: "Date inconnue"}
						</p>
					</div>

					{/* Actions statut */}
					<ActionMenu
						onProcessing={() => handleStatusChange("processing")}
						onShipped={() => handleStatusChange("shipped")}
						onDelivered={() => handleStatusChange("delivered")}
						onCancel={() => handleStatusChange("cancelled")}
						onRefund={() => handleStatusChange("refunded")}
					/>
				</div>
			</header>

			<main className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
				{/* Colonne gauche */}
				<div className="space-y-6">
					{/* Articles */}
					<Panel>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-[15px] font-semibold text-baume-charcoal">
								Articles
							</h2>
							{unfulfilledCount > 0 && (
								<span className="text-[12px] px-2 py-1 rounded-full bg-baume-ivory border border-baume-border text-baume-burgundy font-medium">
									{unfulfilledCount} non traité{unfulfilledCount > 1 ? "s" : ""}
								</span>
							)}
						</div>

						<div className="rounded-xl border border-baume-border overflow-hidden">
							{items.length === 0 ? (
								<div className="p-5 text-[13px] text-baume-charcoal/50 text-center">
									Aucun article trouvé pour cette commande.
								</div>
							) : (
								items.map((item) => (
									<div
										key={item.id}
										className="px-4 py-4 flex items-center gap-4 border-b border-baume-border last:border-b-0 bg-baume-white"
									>
										{/* Icône produit */}
										<div className="h-12 w-12 rounded-lg bg-baume-ivory border border-baume-border flex items-center justify-center shrink-0">
											<Package className="h-5 w-5 text-baume-charcoal/40" />
										</div>

										{/* Infos produit */}
										<div className="flex-1 min-w-0">
											<p className="text-[13px] font-semibold text-baume-charcoal truncate">
												{item.product_title || "Produit"}
											</p>
											{item.variant_title && (
												<p className="text-[12px] text-baume-charcoal/55">
													{item.variant_title}
												</p>
											)}
											{item.sku && (
												<p className="text-[11px] text-baume-charcoal/40">
													SKU : {item.sku}
												</p>
											)}
										</div>

										{/* Prix × quantité */}
										<div className="text-[13px] text-baume-charcoal/70 whitespace-nowrap text-right">
											<p>
												{Number(item.unit_price || 0).toFixed(2)} {currency} ×{" "}
												{item.quantity || 1}
											</p>
											<p className="font-semibold text-baume-charcoal">
												{Number(item.total_price || 0).toFixed(2)} {currency}
											</p>
										</div>

										{/* Bouton traiter */}
										<button
											type="button"
											onClick={async () => {
												try {
													await updateOrderItemStatus(item.id, "fulfilled");

													const updatedItems = order.items.map((i) =>
														i.id === item.id
															? { ...i, fulfillment_status: "fulfilled" }
															: i,
													);

													setOrder((prev) => ({
														...prev,
														items: updatedItems,
													}));

													// ← Vérifier si tous les articles sont maintenant traités
													const allFulfilled = updatedItems.every(
														(i) => i.fulfillment_status === "fulfilled",
													);

													if (allFulfilled && order.status === "paid") {
														// ← Passer la commande en "processing" et envoyer l'email
														await api.patch(
															`/ecom/admin/orders/${order.id}/status`,
															{
																status: "processing",
															},
														);
														setCurrentStatus("processing");
														setOrder((prev) => ({
															...prev,
															status: "processing",
														}));
													}
												} catch (err) {
													alert("Erreur lors du traitement de l'article");
												}
											}}
											disabled={item.fulfillment_status === "fulfilled"}
											className={`h-8 px-3 rounded-lg text-[12px] font-semibold ml-2 shrink-0 transition-colors ${
												item.fulfillment_status === "fulfilled"
													? "bg-baume-ivory text-baume-charcoal/50 cursor-default border border-baume-border"
													: "bg-baume-burgundy text-white hover:bg-baume-burgundyDark"
											}`}
										>
											{item.fulfillment_status === "fulfilled"
												? "Traité ✓"
												: "Marquer traité"}
										</button>
									</div>
								))
							)}
						</div>
					</Panel>

					{/* Récapitulatif financier */}
					<Panel>
						<div className="flex items-center gap-2 mb-4">
							<CreditCard className="h-4 w-4 text-baume-burgundy" />
							<h2 className="text-[15px] font-semibold text-baume-charcoal">
								Paiement
							</h2>
						</div>

						<div className="rounded-xl border border-baume-border overflow-hidden">
							<SummaryLine
								label="Sous-total"
								detail={`${items.length} article${items.length > 1 ? "s" : ""}`}
								value={`${Number(order.subtotal || 0).toFixed(2)} ${currency}`}
							/>
							{Number(order.discount_total || 0) > 0 && (
								<SummaryLine
									label="Réduction"
									detail={order.discount_code || "Code promo"}
									value={`-${Number(order.discount_total || 0).toFixed(2)} ${currency}`}
									green
								/>
							)}
							<SummaryLine
								label="Livraison"
								detail="Standard"
								value={
									Number(order.shipping_total || 0) === 0
										? "Offerte"
										: `${Number(order.shipping_total || 0).toFixed(2)} ${currency}`
								}
							/>
							{Number(order.tax_total || 0) > 0 && (
								<SummaryLine
									label="Taxes"
									detail="Incluses"
									value={`${Number(order.tax_total || 0).toFixed(2)} ${currency}`}
								/>
							)}
							<SummaryLine
								label="Total"
								value={`${Number(order.total || 0).toFixed(2)} ${currency}`}
								strong
							/>
						</div>

						{order.stripe_checkout_session_id && (
							<p className="mt-3 text-[11px] text-baume-charcoal/40">
								Session Stripe : {order.stripe_checkout_session_id}
							</p>
						)}
					</Panel>
				</div>

				{/* Colonne droite */}
				<aside className="space-y-4">
					{/* Client */}
					<Panel>
						<h2 className="text-[15px] font-semibold text-baume-charcoal mb-4">
							Client
						</h2>

						<div className="space-y-1">
							<p className="text-[13px] font-medium text-baume-charcoal">
								{shippingAddress.name ||
									[shippingAddress.first_name, shippingAddress.last_name]
										.filter(Boolean)
										.join(" ") ||
									"Nom non renseigné"}
							</p>
							<p className="text-[13px] text-baume-charcoal/60">
								{order.email || "Email non renseigné"}
							</p>
							{shippingAddress.phone && (
								<p className="text-[13px] text-baume-charcoal/60">
									{shippingAddress.phone}
								</p>
							)}
						</div>
					</Panel>

					{/* Adresse de livraison */}
					<Panel>
						<div className="flex items-center gap-2 mb-4">
							<MapPin className="h-4 w-4 text-baume-burgundy" />
							<h2 className="text-[15px] font-semibold text-baume-charcoal">
								Adresse de livraison
							</h2>
						</div>

						{Object.keys(shippingAddress).length > 0 ? (
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
						) : (
							<p className="text-[13px] text-baume-charcoal/50">
								Adresse non renseignée
							</p>
						)}
					</Panel>

					{/* Livraison + Tracking */}
					<Panel>
						<div className="flex items-center gap-2 mb-3">
							<Truck className="h-4 w-4 text-baume-burgundy" />
							<h2 className="text-[15px] font-semibold text-baume-charcoal">
								Livraison
							</h2>
						</div>
						<p className="text-[13px] text-baume-charcoal/70">
							{Number(order.shipping_total || 0) === 0
								? "Offerte"
								: `${Number(order.shipping_total || 0).toFixed(2)} ${currency}`}
						</p>

						<TrackingForm
							order={order}
							onSaved={(carrier, tracking) =>
								setOrder((prev) => ({
									...prev,
									carrier,
									tracking_number: tracking,
								}))
							}
						/>
					</Panel>
				</aside>
			</main>
		</div>
	);
}

// ── Composants utilitaires ─────────────────────────────────────────────────

function Panel({ children }) {
	return (
		<section className="rounded-2xl border border-baume-border bg-baume-white p-5 shadow-sm">
			{children}
		</section>
	);
}

function SummaryLine({ label, detail, value, strong = false, green = false }) {
	return (
		<div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 border-b border-baume-border last:border-b-0 bg-baume-white text-[13px]">
			<span
				className={
					strong
						? "font-semibold text-baume-charcoal"
						: "text-baume-charcoal/70"
				}
			>
				{label}
				{detail && (
					<span className="ml-1 text-baume-charcoal/40 text-[11px]">
						— {detail}
					</span>
				)}
			</span>
			<span
				className={`text-right ${strong ? "font-semibold text-baume-charcoal" : green ? "text-emerald-600" : "text-baume-charcoal/70"}`}
			>
				{value}
			</span>
		</div>
	);
}

function ActionMenu({
	onProcessing,
	onShipped,
	onDelivered,
	onCancel,
	onRefund,
}) {
	const [open, setOpen] = useState(false);

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="h-10 px-5 rounded-full bg-baume-burgundy hover:bg-baume-burgundyDark text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
			>
				Modifier le statut
				<ChevronDown className="h-3.5 w-3.5" />
			</button>

			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
					<div className="absolute right-0 mt-2 w-52 rounded-2xl border border-baume-border bg-baume-white shadow-lg overflow-hidden z-50">
						<MenuItem
							onClick={() => {
								onProcessing();
								setOpen(false);
							}}
						>
							⚙️ En traitement
						</MenuItem>
						<MenuItem
							onClick={() => {
								onShipped();
								setOpen(false);
							}}
						>
							🚚 Expédiée
						</MenuItem>
						<MenuItem
							onClick={() => {
								onDelivered();
								setOpen(false);
							}}
						>
							✅ Livrée
						</MenuItem>
						<div className="border-t border-baume-border" />
						<MenuItem
							tone="warning"
							onClick={() => {
								onCancel();
								setOpen(false);
							}}
						>
							❌ Annuler
						</MenuItem>
						<MenuItem
							tone="danger"
							onClick={() => {
								onRefund();
								setOpen(false);
							}}
						>
							💸 Rembourser
						</MenuItem>
					</div>
				</>
			)}
		</div>
	);
}

function MenuItem({ children, onClick, tone = "default" }) {
	const styles = {
		default: "hover:bg-baume-ivory text-baume-charcoal",
		warning: "hover:bg-orange-50 text-orange-700",
		danger: "hover:bg-red-50 text-red-700",
	};

	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-4 py-3 text-[13px] font-medium transition-colors ${styles[tone]}`}
		>
			{children}
		</button>
	);
}

function StatusBadge({ status }) {
	const map = {
		paid: {
			label: "Payée",
			class: "bg-emerald-50 text-emerald-700 border-emerald-200",
		},
		pending: {
			label: "En attente",
			class: "bg-baume-ivory text-baume-burgundy border-baume-border",
		},
		processing: {
			label: "En traitement",
			class: "bg-blue-50 text-blue-700 border-blue-200",
		},
		shipped: {
			label: "Expédiée",
			class: "bg-baume-taupe/30 text-baume-charcoal border-baume-border",
		},
		delivered: {
			label: "Livrée",
			class: "bg-baume-burgundy text-white border-baume-burgundyDark",
		},
		cancelled: {
			label: "Annulée",
			class: "bg-red-50 text-red-700 border-red-200",
		},
		refunded: {
			label: "Remboursée",
			class: "bg-gray-100 text-gray-700 border-gray-200",
		},
	};

	const s = map[status] || map.pending;

	return (
		<span
			className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium ${s.class}`}
		>
			{s.label}
		</span>
	);
}

const CARRIERS = [
	{
		key: "laposte",
		label: "La Poste Suisse",
		url: (n) => `https://www.post.ch/fr/suivi?item=${n}`,
	},
	{
		key: "chronopost",
		label: "Chronopost",
		url: (n) =>
			`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLt=${n}`,
	},
	{
		key: "dhl",
		label: "DHL",
		url: (n) => `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${n}`,
	},
	{
		key: "ups",
		label: "UPS",
		url: (n) => `https://www.ups.com/track?tracknum=${n}`,
	},
	{
		key: "fedex",
		label: "FedEx",
		url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
	},
];

function TrackingForm({ order, onSaved }) {
	const [carrier, setCarrier] = useState(order.carrier || "");
	const [tracking, setTracking] = useState(order.tracking_number || "");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const carrierInfo = CARRIERS.find((c) => c.key === carrier);
	const trackingUrl =
		carrierInfo && tracking ? carrierInfo.url(tracking) : null;

	async function handleSave() {
		setSaving(true);
		try {
			await api.patch(`/ecom/admin/orders/${order.id}/tracking`, {
				carrier,
				tracking_number: tracking,
			});
			onSaved(carrier, tracking);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch (err) {
			alert("Erreur lors de la sauvegarde");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="mt-4 pt-4 border-t border-baume-border space-y-3">
			<p className="text-[12px] font-semibold text-baume-charcoal/60 uppercase tracking-[0.12em]">
				Suivi colis
			</p>

			<select
				value={carrier}
				onChange={(e) => setCarrier(e.target.value)}
				className="w-full h-10 rounded-xl border border-baume-border bg-baume-white px-3 text-[13px] text-baume-charcoal"
			>
				<option value="">Choisir un transporteur</option>
				{CARRIERS.map((c) => (
					<option key={c.key} value={c.key}>
						{c.label}
					</option>
				))}
			</select>

			<input
				type="text"
				value={tracking}
				onChange={(e) => setTracking(e.target.value)}
				placeholder="Numéro de suivi"
				className="w-full h-10 rounded-xl border border-baume-border bg-baume-white px-3 text-[13px] text-baume-charcoal"
			/>

			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="h-9 px-4 rounded-full bg-baume-burgundy text-white text-[12px] font-semibold hover:bg-baume-burgundyDark disabled:opacity-60 transition-colors inline-flex items-center gap-2"
				>
					{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
					{saved ? "✓ Enregistré" : "Enregistrer"}
				</button>
				{trackingUrl && (
					<a
						href={trackingUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[12px] text-baume-burgundy hover:underline"
					>
						Voir le suivi
					</a>
				)}
			</div>
		</div>
	);
}
