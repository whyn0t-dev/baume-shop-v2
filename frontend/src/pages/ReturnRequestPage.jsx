import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import {
	Upload,
	X,
	ArrowLeft,
	Package,
	AlertCircle,
	CheckCircle,
	Loader2,
} from "lucide-react";

const REASONS = [
	{ value: "defective", label: "Produit défectueux" },
	{ value: "wrong_item", label: "Mauvais article reçu" },
	{ value: "not_as_described", label: "Non conforme à la description" },
	{ value: "changed_mind", label: "Changement d'avis" },
	{ value: "other", label: "Autre raison" },
];

export default function ReturnRequestPage() {
	const { orderId } = useParams();
	const navigate = useNavigate();
	const { user, status } = useAuth();
	const fileInputRef = useRef(null);

	const [order, setOrder] = useState(null);
	const [existingReturn, setExistingReturn] = useState(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [uploadingImages, setUploadingImages] = useState(false);

	const [reason, setReason] = useState("");
	const [message, setMessage] = useState("");
	const [images, setImages] = useState([]); // { url, name }[]

	useEffect(() => {
		if (status === "loading") return;
		if (!user) {
			navigate("/connexion");
			return;
		}
		loadOrder();
	}, [orderId, status]);

	async function loadOrder() {
		setLoading(true);
		try {
			const [orderData, returns] = await Promise.all([
				api.get(`/orders/${orderId}`).then((r) => r.data),
				api.get("/returns/mine").then((r) => r.data),
			]);
			setOrder(orderData);

			const existing = returns.find((r) => r.order_id === orderId);
			if (existing) setExistingReturn(existing);
		} catch (err) {
			toast.error("Commande introuvable");
			navigate("/compte");
		} finally {
			setLoading(false);
		}
	}

	async function handleImageUpload(e) {
		const files = Array.from(e.target.files || []);
		if (!files.length) return;

		if (images.length + files.length > 5) {
			toast.error("Maximum 5 photos autorisées");
			return;
		}

		setUploadingImages(true);
		try {
			const uploaded = await Promise.all(
				files.map(async (file) => {
					const form = new FormData();
					form.append("file", file);
					const res = await api.post("/returns/upload-image", form, {
						headers: { "Content-Type": "multipart/form-data" },
					});
					return { url: res.data.url, name: file.name };
				}),
			);
			setImages((prev) => [...prev, ...uploaded]);
		} catch (err) {
			toast.error("Erreur lors de l'upload");
		} finally {
			setUploadingImages(false);
		}
	}

	function removeImage(index) {
		setImages((prev) => prev.filter((_, i) => i !== index));
	}

	async function handleSubmit(e) {
		e.preventDefault();
		if (!reason) {
			toast.error("Veuillez choisir un motif");
			return;
		}
		if (message.trim().length < 10) {
			toast.error("Veuillez décrire votre problème (10 caractères minimum)");
			return;
		}

		setSubmitting(true);
		try {
			await api.post("/returns", {
				order_id: orderId,
				reason,
				message: message.trim(),
				images: images.map((i) => i.url),
			});

			toast.success("Demande envoyée", {
				description: "Nous vous répondrons sous 48h ouvrées.",
			});
			navigate("/compte");
		} catch (err) {
			const msg = err?.response?.data?.detail || "Une erreur est survenue";
			toast.error(msg);
		} finally {
			setSubmitting(false);
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	// Demande déjà existante
	if (existingReturn) {
		return (
			<div className="min-h-screen bg-baume-ivory">
				<div className="max-w-[640px] mx-auto px-5 py-12">
					<Link
						to="/compte"
						className="inline-flex items-center gap-2 text-[13px] text-baume-charcoal/60 hover:text-baume-charcoal mb-8"
					>
						<ArrowLeft className="h-4 w-4" /> Retour au compte
					</Link>

					<div className="rounded-3xl border border-baume-border bg-baume-white p-8 text-center">
						<StatusBadge status={existingReturn.status} large />
						<h1 className="font-editorial text-[28px] text-baume-charcoal mt-4 mb-2">
							Demande de retour
						</h1>
						<p className="text-[14px] text-baume-charcoal/60 mb-6">
							Commande #{String(orderId).slice(0, 8).toUpperCase()}
						</p>

						<div className="text-left rounded-2xl bg-baume-ivory border border-baume-border p-5 space-y-3 mb-6">
							<div>
								<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 mb-1">
									Motif
								</p>
								<p className="text-[14px] text-baume-charcoal">
									{
										REASONS.find((r) => r.value === existingReturn.reason)
											?.label
									}
								</p>
							</div>
							<div>
								<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 mb-1">
									Message
								</p>
								<p className="text-[14px] text-baume-charcoal/80 leading-relaxed">
									{existingReturn.message}
								</p>
							</div>
							{existingReturn.admin_note && (
								<div>
									<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 mb-1">
										Réponse de notre équipe
									</p>
									<p className="text-[14px] text-baume-charcoal/80 leading-relaxed">
										{existingReturn.admin_note}
									</p>
								</div>
							)}
							{existingReturn.images?.length > 0 && (
								<div>
									<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 mb-2">
										Photos
									</p>
									<div className="flex flex-wrap gap-2">
										{existingReturn.images.map((url, i) => (
											<img
												key={i}
												src={url}
												alt={`Photo ${i + 1}`}
												className="h-16 w-16 rounded-xl object-cover border border-baume-border"
											/>
										))}
									</div>
								</div>
							)}
						</div>

						<p className="text-[12px] text-baume-charcoal/50">
							Demande soumise le{" "}
							{new Date(existingReturn.created_at).toLocaleDateString("fr-CH")}
						</p>
					</div>
				</div>
			</div>
		);
	}

	const isReturnable = ["paid", "processing", "shipped", "delivered"].includes(
		order?.status,
	);

	return (
		<div className="min-h-screen bg-baume-ivory">
			<div className="max-w-[640px] mx-auto px-5 py-12">
				<Link
					to="/compte"
					className="inline-flex items-center gap-2 text-[13px] text-baume-charcoal/60 hover:text-baume-charcoal mb-8"
				>
					<ArrowLeft className="h-4 w-4" /> Retour au compte
				</Link>

				{/* Header */}
				<div className="mb-8">
					<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
						Retour & Remboursement
					</p>
					<h1 className="font-editorial text-[36px] text-baume-charcoal leading-tight">
						Demande de retour
					</h1>
					<p className="mt-2 text-[14px] text-baume-charcoal/60">
						Commande #{String(orderId).slice(0, 8).toUpperCase()} ·{" "}
						{order?.total?.toFixed(2)} {order?.currency || "CHF"}
					</p>
				</div>

				{/* Commande non retournable */}
				{!isReturnable && (
					<div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex gap-3 mb-6">
						<AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
						<div>
							<p className="font-semibold text-red-700 text-[14px]">
								Retour non disponible
							</p>
							<p className="text-[13px] text-red-600 mt-1">
								Cette commande n'est pas éligible à un retour dans son état
								actuel. Contactez notre service client si vous pensez qu'il
								s'agit d'une erreur.
							</p>
						</div>
					</div>
				)}

				{/* Articles commandés */}
				{order?.items?.length > 0 && (
					<div className="rounded-3xl border border-baume-border bg-baume-white p-6 mb-6">
						<div className="flex items-center gap-2 mb-4">
							<Package className="h-4 w-4 text-baume-burgundy" />
							<p className="text-[12px] uppercase tracking-wider text-baume-burgundy font-semibold">
								Articles de la commande
							</p>
						</div>
						<div className="space-y-3">
							{order.items.map((item, i) => (
								<div
									key={i}
									className="flex items-center justify-between gap-3"
								>
									<div>
										<p className="text-[14px] font-semibold text-baume-charcoal">
											{item.product_title}
										</p>
										{item.variant_title && (
											<p className="text-[12px] text-baume-charcoal/50">
												{item.variant_title}
											</p>
										)}
									</div>
									<p className="text-[13px] text-baume-charcoal/70 shrink-0">
										×{item.quantity} · {Number(item.total_price).toFixed(2)} CHF
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Formulaire */}
				{isReturnable && (
					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Motif */}
						<div className="rounded-3xl border border-baume-border bg-baume-white p-6">
							<label className="block text-[13px] font-semibold uppercase tracking-wider text-baume-charcoal mb-4">
								Motif du retour *
							</label>
							<div className="space-y-2">
								{REASONS.map((r) => (
									<button
										key={r.value}
										type="button"
										onClick={() => setReason(r.value)}
										className={`w-full text-left px-4 py-3 rounded-2xl border text-[14px] transition ${
											reason === r.value
												? "bg-baume-burgundy text-baume-white border-baume-burgundy"
												: "bg-baume-ivory border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"
										}`}
									>
										{r.label}
									</button>
								))}
							</div>
						</div>

						{/* Message */}
						<div className="rounded-3xl border border-baume-border bg-baume-white p-6">
							<label className="block text-[13px] font-semibold uppercase tracking-wider text-baume-charcoal mb-3">
								Description *
							</label>
							<textarea
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								placeholder="Décrivez votre problème en détail — état du produit, circonstances, etc."
								rows={5}
								className="w-full rounded-2xl border border-baume-border bg-baume-ivory px-4 py-3 text-[14px] text-baume-charcoal outline-none focus:ring-2 focus:ring-baume-burgundy/30 resize-none"
							/>
							<p className="mt-2 text-[12px] text-baume-charcoal/40">
								{message.length} / 2000 caractères
							</p>
						</div>

						{/* Photos */}
						<div className="rounded-3xl border border-baume-border bg-baume-white p-6">
							<label className="block text-[13px] font-semibold uppercase tracking-wider text-baume-charcoal mb-1">
								Photos (optionnel)
							</label>
							<p className="text-[12px] text-baume-charcoal/50 mb-4">
								Ajoutez jusqu'à 5 photos du produit pour faciliter le
								traitement.
							</p>

							{/* Grille images */}
							{images.length > 0 && (
								<div className="grid grid-cols-3 gap-3 mb-4">
									{images.map((img, i) => (
										<div key={i} className="relative group aspect-square">
											<img
												src={img.url}
												alt={img.name}
												className="w-full h-full object-cover rounded-2xl border border-baume-border"
											/>
											<button
												type="button"
												onClick={() => removeImage(i)}
												className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
											>
												<X className="h-3 w-3" />
											</button>
										</div>
									))}
								</div>
							)}

							{images.length < 5 && (
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									disabled={uploadingImages}
									className="w-full h-16 rounded-2xl border-2 border-dashed border-baume-border flex items-center justify-center gap-2 text-[13px] text-baume-charcoal/50 hover:border-baume-burgundy/50 hover:text-baume-burgundy transition disabled:opacity-50"
								>
									{uploadingImages ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Upload className="h-4 w-4" />
									)}
									{uploadingImages ? "Chargement…" : "Ajouter des photos"}
								</button>
							)}

							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								multiple
								className="hidden"
								onChange={handleImageUpload}
							/>
						</div>

						{/* CGV */}
						<div className="rounded-2xl bg-baume-ivory border border-baume-border p-4 text-[13px] text-baume-charcoal/60 leading-relaxed">
							Les retours sont acceptés sous 30 jours pour les produits non
							ouverts et en parfait état. Les produits d'hygiène intime ouverts
							sont exclus conformément à nos{" "}
							<Link to="/cgv" className="text-baume-burgundy underline">
								CGV
							</Link>
							.
						</div>

						{/* Submit */}
						<button
							type="submit"
							disabled={submitting || !reason || message.trim().length < 10}
							className="w-full h-13 py-4 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{submitting && <Loader2 className="h-4 w-4 animate-spin" />}
							Envoyer ma demande
						</button>
					</form>
				)}
			</div>
		</div>
	);
}

function StatusBadge({ status, large }) {
	const map = {
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
	const s = map[status] || map.pending;
	return (
		<span
			className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold ${large ? "text-[14px]" : "text-[12px]"} ${s.class}`}
		>
			{status === "approved" || status === "refunded" ? (
				<CheckCircle className="h-3.5 w-3.5" />
			) : (
				<AlertCircle className="h-3.5 w-3.5" />
			)}
			{s.label}
		</span>
	);
}
