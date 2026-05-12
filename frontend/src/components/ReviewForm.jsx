import React, { useState, useRef } from "react";
import { Star, Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { uploadReviewImages } from "../lib/api";

// ─── Composant principal ──────────────────────────────────────────────────────
// Props :
//   product        — objet produit (id, name, image)
//   order          — objet commande (id, date) — passé uniquement si l'utilisateur a commandé ce produit
//   currentUser    — objet utilisateur connecté (id, name, avatar) ou null
//   onSubmit       — async (reviewData) => void  — appelé après validation
//   existingReview — objet avis existant ou null (pour édition)

export default function ReviewForm({
	product,
	order,
	currentUser,
	onSubmit,
	existingReview = null,
}) {
	const [rating, setRating] = useState(existingReview?.rating ?? 0);
	const [hovered, setHovered] = useState(0);
	const [title, setTitle] = useState(existingReview?.title ?? "");
	const [body, setBody] = useState(existingReview?.body ?? "");
	const [images, setImages] = useState(existingReview?.images ?? []);
	const [previews, setPreviews] = useState(existingReview?.images ?? []);
	const [status, setStatus] = useState("idle"); // idle | loading | success | error
	const [errors, setErrors] = useState({});
	const fileRef = useRef(null);

	// ── Garde-fou : accès réservé aux acheteurs connectés ────────────────────
	if (!currentUser) {
		return (
			<div className="rounded-3xl border border-baume-border bg-baume-white p-8 text-center">
				<p className="font-editorial text-[22px] text-baume-charcoal mb-2">
					Vous souhaitez laisser un avis ?
				</p>
				<p className="text-[14px] text-baume-charcoal/60">
					Connectez-vous pour partager votre expérience.
				</p>
			</div>
		);
	}

	if (!order) {
		return null; // Invisible si l'utilisateur n'a pas acheté ce produit
	}

	// ── Gestion des images ────────────────────────────────────────────────────
	const handleFiles = (files) => {
		const accepted = Array.from(files).filter((f) =>
			f.type.startsWith("image/"),
		);
		if (images.length + accepted.length > 4) {
			setErrors((e) => ({ ...e, images: "Maximum 4 photos." }));
			return;
		}
		setErrors((e) => ({ ...e, images: null }));
		setImages((prev) => [...prev, ...accepted]);
		accepted.forEach((f) => {
			const reader = new FileReader();
			reader.onload = (ev) =>
				setPreviews((prev) => [...prev, ev.target.result]);
			reader.readAsDataURL(f);
		});
	};

	const removeImage = (index) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
		setPreviews((prev) => prev.filter((_, i) => i !== index));
	};

	// ── Validation ────────────────────────────────────────────────────────────
	const validate = () => {
		const errs = {};
		if (!rating) errs.rating = "Choisissez une note.";
		if (!title.trim()) errs.title = "Ajoutez un titre.";
		if (body.trim().length < 20)
			errs.body = "Le commentaire doit faire au moins 20 caractères.";
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	// ── Soumission ────────────────────────────────────────────────────────────
	const handleSubmit = async () => {
		if (!validate()) return;
		setStatus("loading");
		try {
			const review = await onSubmit?.({
				product_id: product.id,
				rating,
				title,
				body,
			});

			// Upload des images seulement si l'utilisateur en a sélectionné
			// et que le serveur a retourné un id d'avis
			if (images.length > 0 && review?.id) {
				await uploadReviewImages(review.id, images);
			}

			setStatus("success");
		} catch {
			setStatus("error");
		}
	};

	// ── État succès ───────────────────────────────────────────────────────────
	if (status === "success") {
		return (
			<div className="rounded-3xl border border-baume-border bg-baume-white p-10 flex flex-col items-center text-center gap-4">
				<CheckCircle
					className="h-10 w-10 text-baume-burgundy"
					strokeWidth={1.3}
				/>
				<div>
					<p className="font-editorial text-[26px] text-baume-charcoal">
						Merci pour votre avis
					</p>
					<p className="text-[14px] text-baume-charcoal/60 mt-1">
						Il sera publié après validation par notre équipe.
					</p>
				</div>
			</div>
		);
	}

	const displayRating = hovered || rating;

	return (
		<div
			data-testid="review-form"
			className="rounded-3xl border border-baume-border bg-baume-white overflow-hidden"
		>
			{/* ── En-tête ── */}
			<div className="px-6 md:px-8 pt-7 pb-6 border-b border-baume-border flex items-center gap-4">
				<img
					src={product.image}
					alt={product.name}
					className="w-12 h-12 rounded-xl object-cover bg-baume-ivory shrink-0"
				/>
				<div className="flex-1 min-w-0">
					<p className="text-[11px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-0.5">
						{existingReview ? "Modifier votre avis" : "Votre avis"}
					</p>
					<p className="font-editorial text-[18px] text-baume-charcoal truncate">
						{product.name}
					</p>
				</div>
				{/* Acheteur vérifié */}
				<span className="shrink-0 text-[11px] font-medium text-baume-charcoal/50 border border-baume-border px-2.5 py-1 rounded-full hidden sm:inline">
					Achat vérifié
				</span>
			</div>

			<div className="px-6 md:px-8 py-7 flex flex-col gap-7">
				{/* ── Note ── */}
				<div>
					<label className="text-[12px] uppercase tracking-[0.15em] font-semibold text-baume-charcoal block mb-3">
						Votre note
					</label>
					<div
						className="flex items-center gap-1"
						onMouseLeave={() => setHovered(0)}
					>
						{[1, 2, 3, 4, 5].map((s) => (
							<button
								key={s}
								type="button"
								aria-label={`${s} étoile${s > 1 ? "s" : ""}`}
								onClick={() => setRating(s)}
								onMouseEnter={() => setHovered(s)}
								className="transition-transform hover:scale-110 active:scale-95"
							>
								<Star
									className={`h-8 w-8 transition-colors ${
										s <= displayRating
											? "fill-baume-burgundy text-baume-burgundy"
											: "text-baume-border"
									}`}
								/>
							</button>
						))}
						{displayRating > 0 && (
							<span className="ml-2 text-[13px] text-baume-charcoal/60">
								{
									["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent"][
										displayRating
									]
								}
							</span>
						)}
					</div>
					{errors.rating && (
						<p className="mt-1.5 text-[12px] text-red-500">{errors.rating}</p>
					)}
				</div>

				{/* ── Titre ── */}
				<div>
					<label className="text-[12px] uppercase tracking-[0.15em] font-semibold text-baume-charcoal block mb-3">
						Titre de l'avis
					</label>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						maxLength={80}
						placeholder="Résumez votre expérience en quelques mots…"
						className={`w-full h-11 px-4 rounded-2xl border bg-baume-ivory text-[14px] text-baume-charcoal placeholder:text-baume-charcoal/35 focus:outline-none focus:ring-1 focus:ring-baume-burgundy/30 transition-all ${
							errors.title
								? "border-red-300 bg-red-50/40"
								: "border-baume-border focus:border-baume-burgundy/40"
						}`}
					/>
					{errors.title && (
						<p className="mt-1.5 text-[12px] text-red-500">{errors.title}</p>
					)}
				</div>

				{/* ── Commentaire ── */}
				<div>
					<label className="text-[12px] uppercase tracking-[0.15em] font-semibold text-baume-charcoal block mb-3">
						Votre commentaire
					</label>
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={4}
						placeholder="Partagez votre expérience avec ce produit — utilisation, résultats, texture, odeur…"
						className={`w-full px-4 py-3 rounded-2xl border bg-baume-ivory text-[14px] text-baume-charcoal placeholder:text-baume-charcoal/35 resize-none focus:outline-none focus:ring-1 focus:ring-baume-burgundy/30 transition-all leading-[22px] ${
							errors.body
								? "border-red-300 bg-red-50/40"
								: "border-baume-border focus:border-baume-burgundy/40"
						}`}
					/>
					<div className="flex items-start justify-between mt-1.5">
						{errors.body ? (
							<p className="text-[12px] text-red-500">{errors.body}</p>
						) : (
							<span />
						)}
						<span
							className={`text-[11px] shrink-0 ${
								body.length < 20
									? "text-baume-charcoal/35"
									: "text-baume-charcoal/55"
							}`}
						>
							{body.length} / 800
						</span>
					</div>
				</div>

				{/* ── Photos ── */}
				<div>
					<label className="text-[12px] uppercase tracking-[0.15em] font-semibold text-baume-charcoal block mb-3">
						Photos{" "}
						<span className="normal-case font-normal text-baume-charcoal/45">
							(optionnel, max 4)
						</span>
					</label>

					<div className="flex flex-wrap gap-3">
						{previews.map((src, i) => (
							<div
								key={i}
								className="relative w-20 h-20 rounded-2xl overflow-hidden border border-baume-border group"
							>
								<img
									src={src}
									alt={`Photo ${i + 1}`}
									className="w-full h-full object-cover"
								/>
								<button
									type="button"
									onClick={() => removeImage(i)}
									className="absolute top-1 right-1 h-5 w-5 rounded-full bg-baume-charcoal/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
									aria-label="Supprimer"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}

						{previews.length < 4 && (
							<button
								type="button"
								onClick={() => fileRef.current?.click()}
								className="w-20 h-20 rounded-2xl border border-dashed border-baume-border bg-baume-ivory flex flex-col items-center justify-center gap-1 hover:border-baume-burgundy/50 hover:bg-baume-burgundy/5 transition-all group"
							>
								<Upload className="h-4 w-4 text-baume-charcoal/35 group-hover:text-baume-burgundy/60 transition-colors" />
								<span className="text-[10px] text-baume-charcoal/35 group-hover:text-baume-burgundy/60 transition-colors">
									Ajouter
								</span>
							</button>
						)}
					</div>

					{errors.images && (
						<p className="mt-1.5 text-[12px] text-red-500">{errors.images}</p>
					)}

					<input
						ref={fileRef}
						type="file"
						accept="image/*"
						multiple
						className="hidden"
						onChange={(e) => handleFiles(e.target.files)}
					/>
				</div>

				{/* ── Erreur API ── */}
				{status === "error" && (
					<div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
						<AlertCircle className="h-4 w-4 shrink-0" />
						Une erreur est survenue. Veuillez réessayer.
					</div>
				)}

				{/* ── Actions ── */}
				<div className="flex items-center gap-3 pt-1">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={status === "loading"}
						className="flex-1 h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{status === "loading"
							? "Envoi en cours…"
							: existingReview
								? "Mettre à jour"
								: "Publier mon avis"}
					</button>
					<p className="text-[11px] text-baume-charcoal/40 leading-[16px] max-w-[140px] hidden md:block">
						Votre avis sera vérifié avant publication.
					</p>
				</div>
			</div>
		</div>
	);
}
