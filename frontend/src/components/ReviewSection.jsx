import React, { useEffect, useState } from "react";
import ReviewForm from "./ReviewForm";
import ReviewCard from "../components/ReviewCard";
import { getUserOrder } from "../lib/api"; // à adapter selon votre API
import { useAuth } from "../lib/auth"; // hook retournant { user }

// ─── Section avis vérifiés (à insérer dans ProductPage) ─────────────────────
// Ce composant est autonome : il vérifie si l'utilisateur connecté
// a commandé ce produit et affiche le formulaire uniquement dans ce cas.
//
// Props :
//   product     — objet produit complet
//   allReviews  — tableau d'avis (déjà chargé dans ProductPage)
//   onNewReview — callback (review) => void   quand un avis est soumis

export default function ReviewSection({
	product,
	allReviews = [],
	onNewReview,
}) {
	const { user, status } = useAuth();
	const [order, setOrder] = useState(null);
	const [existingReview, setExistingReview] = useState(null);
	const [loadingOrder, setLoadingOrder] = useState(true);
	const [activeTab, setActiveTab] = useState("list"); // "list" | "write"

	// ── Vérifier si l'utilisateur a commandé ce produit ──────────────────────
	useEffect(() => {
		if (status === "loading") return; // attendre que l'auth soit résolue
		if (!user) {
			setLoadingOrder(false);
			return;
		}
		getUserOrder(product.id)
			.then(({ order: o, review: r }) => {
				setOrder(o || null);
				setExistingReview(r || null);
				if (o && !r) setActiveTab("write");
			})
			.catch(() => {})
			.finally(() => setLoadingOrder(false));
	}, [user, status, product.id]);

	const hasOrdered = !!order;
	const canWrite = hasOrdered; // acheteur vérifié uniquement

	const handleSubmit = async (reviewData) => {
		await onNewReview?.(reviewData);
		setExistingReview(reviewData);
		setActiveTab("list");
	};

	return (
		<section id="avis-clients" className="bg-baume-white border-t border-baume-border">
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16">
				{/* ── En-tête de section ─────────────────────────────────────── */}
				<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
					<div>
						<p className="text-[11px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
							Avis clients
						</p>
						<h2 className="font-editorial text-[30px] md:text-[38px] text-baume-charcoal leading-tight">
							Ce qu'elles en pensent
						</h2>
					</div>

					{/* ── Bouton "Laisser un avis" (acheteur uniquement) ── */}
					{canWrite && (
						<button
							onClick={() =>
								setActiveTab(activeTab === "write" ? "list" : "write")
							}
							className={`self-start sm:self-auto shrink-0 h-10 px-5 rounded-full border text-[13px] font-semibold transition-all ${
								activeTab === "write"
									? "bg-baume-burgundy text-baume-white border-baume-burgundy"
									: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/60"
							}`}
						>
							{existingReview ? "Modifier mon avis" : "Laisser un avis"}
						</button>
					)}
				</div>

				{/* ── Formulaire de soumission ─────────────────────────────── */}
				{canWrite && activeTab === "write" && (
					<div className="mb-12 max-w-2xl">
						<ReviewForm
							product={product}
							order={order}
							currentUser={user}
							onSubmit={handleSubmit}
							existingReview={existingReview}
						/>
					</div>
				)}

				{/* ── Message si acheteur mais liste vide ──────────────────── */}
				{canWrite &&
					!existingReview &&
					activeTab === "list" &&
					allReviews.length === 0 && (
						<div className="mb-10 rounded-3xl border border-baume-border bg-baume-ivory/50 p-8 max-w-xl text-center mx-auto">
							<p className="font-editorial text-[22px] text-baume-charcoal mb-2">
								Soyez la première à partager
							</p>
							<p className="text-[14px] text-baume-charcoal/60 leading-[22px]">
								Vous avez commandé ce produit — votre retour d'expérience aide
								les autres à choisir en confiance.
							</p>
							<button
								onClick={() => setActiveTab("write")}
								className="mt-5 h-10 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[13px] hover:bg-baume-burgundyDark transition-colors"
							>
								Rédiger un avis
							</button>
						</div>
					)}

				{/* ── Liste des avis ────────────────────────────────────────── */}
				{allReviews.length > 0 && activeTab === "list" && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
						{allReviews.map((r) => (
							<ReviewCard key={r.id} review={r} />
						))}
					</div>
				)}

				{/* ── État vide (aucun avis, non-acheteur) ─────────────────── */}
				{allReviews.length === 0 && !canWrite && activeTab === "list" && (
					<div className="rounded-3xl border border-baume-border bg-baume-ivory/50 p-10 text-center">
						<p className="font-editorial text-[22px] text-baume-charcoal/60">
							Aucun avis pour l'instant
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
