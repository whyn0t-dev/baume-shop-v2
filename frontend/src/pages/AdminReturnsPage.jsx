import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import {
	Package,
	CheckCircle,
	XCircle,
	RefreshCw,
	Loader2,
	AlertCircle,
	ChevronDown,
	ChevronUp,
	Image as ImageIcon,
} from "lucide-react";

const REASON_LABELS = {
	defective: "Produit défectueux",
	wrong_item: "Mauvais article reçu",
	not_as_described: "Non conforme à la description",
	changed_mind: "Changement d'avis",
	other: "Autre raison",
};

const STATUS_MAP = {
	pending: {
		label: "En attente",
		class: "bg-yellow-100 text-yellow-800 border-yellow-200",
	},
	approved: {
		label: "Approuvée",
		class: "bg-emerald-100 text-emerald-800 border-emerald-200",
	},
	rejected: {
		label: "Refusée",
		class: "bg-red-100 text-red-800 border-red-200",
	},
	refunded: {
		label: "Remboursée",
		class: "bg-blue-100 text-blue-800 border-blue-200",
	},
};

export default function AdminReturnsPage() {
	const { user, status } = useAuth();
	const [returns, setReturns] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("pending");
	const [expanded, setExpanded] = useState(null);
	const [reviewModal, setReviewModal] = useState(null);
	const [adminNote, setAdminNote] = useState("");
	const [processing, setProcessing] = useState(false);
	const [lightbox, setLightbox] = useState(null);

	useEffect(() => {
		loadReturns();
	}, [filter]);

	async function loadReturns() {
		setLoading(true);
		try {
			const data = await api
				.get(`/ecom/admin/returns?status=${filter}`)
				.then((r) => r.data);
			setReturns(data || []);
		} catch (err) {
			toast.error("Erreur lors du chargement");
		} finally {
			setLoading(false);
		}
	}

	async function handleReview(returnId, status) {
		if (!adminNote.trim() && status === "rejected") {
			toast.error("Veuillez indiquer une raison pour le refus");
			return;
		}
		setProcessing(true);
		try {
			await api.patch(`/ecom/admin/returns/${returnId}/review`, {
				status,
				admin_note: adminNote.trim() || null,
			});
			toast.success(
				status === "approved" ? "Demande approuvée ✅" : "Demande refusée",
			);
			setReviewModal(null);
			setAdminNote("");
			loadReturns();
		} catch (err) {
			toast.error(err?.response?.data?.detail || "Erreur");
		} finally {
			setProcessing(false);
		}
	}

	async function handleRefund(returnId) {
		if (
			!window.confirm(
				"Déclencher le remboursement ? Cette action est irréversible.",
			)
		)
			return;
		setProcessing(true);
		try {
			await api.patch(`/ecom/admin/returns/${returnId}/refund`);
			toast.success("Remboursement déclenché 💸");
			loadReturns();
		} catch (err) {
			toast.error(
				err?.response?.data?.detail || "Erreur lors du remboursement",
			);
		} finally {
			setProcessing(false);
		}
	}

	const pendingCount = returns.filter((r) => r.status === "pending").length;

	return (
		<div className="min-h-screen bg-baume-ivory">
			{/* Header */}
			<div className="px-6 lg:px-10 py-8 border-b border-baume-border bg-baume-white">
				<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
					Admin
				</p>
				<div className="mt-1 flex items-center justify-between gap-4">
					<h1 className="text-[32px] font-semibold text-baume-burgundy">
						Retours & Remboursements
					</h1>
					<button
						onClick={loadReturns}
						className="h-10 px-4 rounded-full border border-baume-border bg-baume-white text-baume-charcoal text-[13px] font-semibold inline-flex items-center gap-2 hover:border-baume-burgundy transition"
					>
						<RefreshCw className="h-4 w-4" />
						Rafraîchir
					</button>
				</div>
			</div>

			<div className="px-6 lg:px-10 py-8">
				{/* Stats */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					{[
						{ label: "Total", value: returns.length, filter: null },
						{
							label: "En attente",
							value: returns.filter((r) => r.status === "pending").length,
							filter: "pending",
							highlight: true,
						},
						{
							label: "Approuvées",
							value: returns.filter((r) => r.status === "approved").length,
							filter: "approved",
						},
						{
							label: "Remboursées",
							value: returns.filter((r) => r.status === "refunded").length,
							filter: "refunded",
						},
					].map((stat) => (
						<div
							key={stat.label}
							className={`rounded-2xl border p-4 cursor-pointer transition ${
								stat.highlight && stat.value > 0
									? "border-baume-burgundy/30 bg-baume-burgundy/5"
									: "border-baume-border bg-baume-white"
							}`}
							onClick={() => stat.filter && setFilter(stat.filter)}
						>
							<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold">
								{stat.label}
							</p>
							<p
								className={`text-[32px] font-editorial mt-1 ${
									stat.highlight && stat.value > 0
										? "text-baume-burgundy"
										: "text-baume-charcoal"
								}`}
							>
								{stat.value}
							</p>
						</div>
					))}
				</div>

				{/* Filtres */}
				<div className="flex gap-2 mb-6 flex-wrap">
					{["pending", "approved", "rejected", "refunded"].map((s) => (
						<button
							key={s}
							onClick={() => setFilter(s)}
							className={`h-9 px-4 rounded-full text-[12px] font-semibold transition ${
								filter === s
									? "bg-baume-burgundy text-baume-white"
									: "bg-baume-white border border-baume-border text-baume-charcoal/70 hover:border-baume-burgundy"
							}`}
						>
							{STATUS_MAP[s].label}
						</button>
					))}
				</div>

				{/* Liste */}
				{loading ? (
					<div className="flex justify-center py-20">
						<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
					</div>
				) : returns.length === 0 ? (
					<div className="rounded-3xl border border-baume-border bg-baume-white p-12 text-center">
						<Package className="h-10 w-10 text-baume-charcoal/20 mx-auto mb-3" />
						<p className="text-[14px] text-baume-charcoal/50">
							Aucune demande de retour
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{returns.map((req) => (
							<ReturnCard
								key={req.id}
								req={req}
								expanded={expanded === req.id}
								onToggle={() =>
									setExpanded(expanded === req.id ? null : req.id)
								}
								onApprove={() => {
									setReviewModal({ id: req.id, action: "approved" });
									setAdminNote("");
								}}
								onReject={() => {
									setReviewModal({ id: req.id, action: "rejected" });
									setAdminNote("");
								}}
								onRefund={() => handleRefund(req.id)}
								onImageClick={setLightbox}
								processing={processing}
							/>
						))}
					</div>
				)}
			</div>

			{/* Modal review */}
			{reviewModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="absolute inset-0 bg-black/40"
						onClick={() => setReviewModal(null)}
					/>
					<div className="relative bg-baume-white rounded-3xl border border-baume-border p-8 w-full max-w-md shadow-2xl">
						<h2 className="font-editorial text-[24px] text-baume-charcoal mb-2">
							{reviewModal.action === "approved"
								? "Approuver la demande"
								: "Refuser la demande"}
						</h2>
						<p className="text-[13px] text-baume-charcoal/60 mb-5">
							{reviewModal.action === "approved"
								? "Ajoutez un message optionnel pour le client."
								: "Indiquez la raison du refus — elle sera envoyée au client."}
						</p>
						<textarea
							value={adminNote}
							onChange={(e) => setAdminNote(e.target.value)}
							placeholder={
								reviewModal.action === "approved"
									? "Message optionnel au client…"
									: "Raison du refus (obligatoire)…"
							}
							rows={4}
							className="w-full rounded-2xl border border-baume-border bg-baume-ivory px-4 py-3 text-[14px] text-baume-charcoal outline-none focus:ring-2 focus:ring-baume-burgundy/30 resize-none mb-5"
						/>
						<div className="flex gap-3">
							<button
								onClick={() => setReviewModal(null)}
								className="flex-1 h-11 rounded-full border border-baume-border text-baume-charcoal text-[13px] font-semibold hover:bg-baume-ivory transition"
							>
								Annuler
							</button>
							<button
								onClick={() => handleReview(reviewModal.id, reviewModal.action)}
								disabled={processing}
								className={`flex-1 h-11 rounded-full text-baume-white text-[13px] font-semibold transition disabled:opacity-50 inline-flex items-center justify-center gap-2 ${
									reviewModal.action === "approved"
										? "bg-emerald-600 hover:bg-emerald-700"
										: "bg-red-600 hover:bg-red-700"
								}`}
							>
								{processing && <Loader2 className="h-4 w-4 animate-spin" />}
								{reviewModal.action === "approved" ? "Approuver" : "Refuser"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Lightbox images */}
			{lightbox && (
				<div
					className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
					onClick={() => setLightbox(null)}
				>
					<img
						src={lightbox}
						alt="Photo retour"
						className="max-w-full max-h-full rounded-2xl object-contain"
					/>
				</div>
			)}
		</div>
	);
}

function ReturnCard({
	req,
	expanded,
	onToggle,
	onApprove,
	onReject,
	onRefund,
	onImageClick,
	processing,
}) {
	const status = STATUS_MAP[req.status] || STATUS_MAP.pending;
	const orderRef = `#${String(req.order_id).slice(0, 8).toUpperCase()}`;
	const order = req.orders;

	return (
		<div className="rounded-3xl border border-baume-border bg-baume-white overflow-hidden">
			{/* Header card */}
			<div
				className="px-6 py-5 flex items-center gap-4 cursor-pointer hover:bg-baume-ivory/30 transition"
				onClick={onToggle}
			>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-3 flex-wrap mb-1">
						<span
							className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${status.class}`}
						>
							{status.label}
						</span>
						<span className="text-[13px] font-semibold text-baume-charcoal">
							Commande {orderRef}
						</span>
						<span className="text-[12px] text-baume-charcoal/50">
							{REASON_LABELS[req.reason]}
						</span>
					</div>
					<div className="flex items-center gap-4 text-[12px] text-baume-charcoal/50">
						<span>{req.email}</span>
						<span>·</span>
						<span>{new Date(req.created_at).toLocaleDateString("fr-CH")}</span>
						{order && (
							<>
								<span>·</span>
								<span className="font-semibold text-baume-charcoal">
									{Number(order.total).toFixed(2)} {order.currency || "CHF"}
								</span>
							</>
						)}
						{req.images?.length > 0 && (
							<>
								<span>·</span>
								<span className="flex items-center gap-1">
									<ImageIcon className="h-3 w-3" />
									{req.images.length} photo{req.images.length > 1 ? "s" : ""}
								</span>
							</>
						)}
					</div>
				</div>
				{expanded ? (
					<ChevronUp className="h-4 w-4 text-baume-charcoal/40 shrink-0" />
				) : (
					<ChevronDown className="h-4 w-4 text-baume-charcoal/40 shrink-0" />
				)}
			</div>

			{/* Détails expandés */}
			{expanded && (
				<div className="border-t border-baume-border px-6 py-5 space-y-5">
					{/* Articles */}
					{order?.order_items?.length > 0 && (
						<div>
							<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold mb-3">
								Articles commandés
							</p>
							<div className="space-y-2">
								{order.order_items.map((item, i) => (
									<div
										key={i}
										className="flex items-center justify-between text-[13px]"
									>
										<div>
											<span className="font-semibold text-baume-charcoal">
												{item.product_title}
											</span>
											{item.variant_title && (
												<span className="text-baume-charcoal/50 ml-1">
													— {item.variant_title}
												</span>
											)}
										</div>
										<span className="text-baume-charcoal/70 shrink-0">
											×{item.quantity} · {Number(item.total_price).toFixed(2)}{" "}
											CHF
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Message client */}
					<div>
						<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold mb-2">
							Message du client
						</p>
						<p className="text-[14px] text-baume-charcoal/80 leading-relaxed bg-baume-ivory rounded-2xl px-4 py-3">
							{req.message}
						</p>
					</div>

					{/* Photos */}
					{req.images?.length > 0 && (
						<div>
							<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold mb-3">
								Photos jointes
							</p>
							<div className="flex flex-wrap gap-3">
								{req.images.map((url, i) => (
									<img
										key={i}
										src={url}
										alt={`Photo ${i + 1}`}
										onClick={() => onImageClick(url)}
										className="h-24 w-24 rounded-2xl object-cover border border-baume-border cursor-pointer hover:opacity-90 transition"
									/>
								))}
							</div>
						</div>
					)}

					{/* Note admin existante */}
					{req.admin_note && (
						<div>
							<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold mb-2">
								Note admin
							</p>
							<p className="text-[13px] text-baume-charcoal/70 bg-baume-ivory rounded-2xl px-4 py-3">
								{req.admin_note}
							</p>
						</div>
					)}

					{/* Actions */}
					<div className="flex flex-wrap gap-3 pt-2">
						{req.status === "pending" && (
							<>
								<button
									onClick={onApprove}
									disabled={processing}
									className="h-10 px-5 rounded-full bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center gap-2"
								>
									<CheckCircle className="h-4 w-4" />
									Approuver
								</button>
								<button
									onClick={onReject}
									disabled={processing}
									className="h-10 px-5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[13px] font-semibold hover:bg-red-100 transition disabled:opacity-50 inline-flex items-center gap-2"
								>
									<XCircle className="h-4 w-4" />
									Refuser
								</button>
							</>
						)}
						{req.status === "approved" && (
							<button
								onClick={onRefund}
								disabled={processing}
								className="h-10 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition disabled:opacity-50 inline-flex items-center gap-2"
							>
								{processing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="h-4 w-4" />
								)}
								Déclencher le remboursement
							</button>
						)}
						{req.status === "refunded" && (
							<span className="h-10 px-5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[13px] font-semibold inline-flex items-center gap-2">
								<CheckCircle className="h-4 w-4" />
								Remboursé le{" "}
								{new Date(req.refunded_at).toLocaleDateString("fr-CH")}
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
