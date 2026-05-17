import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Star, SlidersHorizontal, X, ChevronDown, Search } from "lucide-react";
import { getAdminTable } from "../lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StarRow({ rating, size = "sm" }) {
	const sz = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
	return (
		<div className="flex items-center gap-0.5">
			{Array.from({ length: 5 }).map((_, i) => (
				<Star
					key={i}
					className={`${sz} ${
						i < Math.round(rating)
							? "fill-baume-burgundy text-baume-burgundy"
							: "fill-baume-border text-baume-border"
					}`}
				/>
			))}
		</div>
	);
}

function RatingBar({ label, count, total }) {
	const pct = total ? Math.round((count / total) * 100) : 0;
	return (
		<div className="flex items-center gap-3">
			<span className="text-[12px] text-baume-charcoal/60 w-4 shrink-0 text-right">
				{label}
			</span>
			<div className="flex-1 h-1.5 rounded-full bg-baume-border overflow-hidden">
				<div
					className="h-full rounded-full bg-baume-burgundy transition-all duration-500"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-[11px] text-baume-charcoal/50 w-6 shrink-0">
				{count}
			</span>
		</div>
	);
}

// ─── Composant carte avis ─────────────────────────────────────────────────────
function ReviewCard({ review, productName }) {
	return (
		<div className="group rounded-3xl border border-baume-border bg-baume-white p-6 flex flex-col gap-3 hover:border-baume-burgundy/30 hover:shadow-sm transition-all duration-200">
			{/* En-tête */}
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<StarRow rating={review.rating} />
					<p className="font-editorial text-[17px] text-baume-charcoal leading-snug mt-1">
						{review.title || "Avis client"}
					</p>
				</div>
				<span className="shrink-0 text-[28px] font-editorial text-baume-burgundy/20 leading-none select-none">
					{review.rating}
				</span>
			</div>

			{/* Corps */}
			{(review.body || review.content) && (
				<p className="text-[13px] leading-[21px] text-baume-charcoal/65 line-clamp-4">
					{review.body || review.content}
				</p>
			)}

			{/* Footer */}
			<div className="mt-auto pt-3 border-t border-baume-border flex items-center justify-between gap-2 flex-wrap">
				<div className="flex items-center gap-2">
					<div className="h-7 w-7 rounded-full bg-baume-ivory border border-baume-border flex items-center justify-center text-[11px] font-semibold text-baume-charcoal/60 shrink-0">
						{(review.author || "?")[0].toUpperCase()}
					</div>
					<div>
						<p className="text-[12px] font-semibold text-baume-charcoal leading-tight">
							{review.author || "Anonyme"}
						</p>
						{review.verified_purchase && (
							<p className="text-[10px] text-emerald-600 font-semibold">
								✓ Achat vérifié
							</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2 text-right">
					{productName && (
						<span className="text-[11px] text-baume-charcoal/40 truncate max-w-[120px]">
							{productName}
						</span>
					)}
					<span className="text-[11px] text-baume-charcoal/35">
						{review.created_at
							? new Date(review.created_at).toLocaleDateString("fr-CH", {
									day: "numeric",
									month: "short",
									year: "numeric",
								})
							: "–"}
					</span>
				</div>
			</div>
		</div>
	);
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ReviewsPage() {
	const [reviews, setReviews] = useState([]);
	const [products, setProducts] = useState([]);
	const [loading, setLoading] = useState(true);

	// Filtres
	const [search, setSearch] = useState("");
	const [filterRating, setFilterRating] = useState("all"); // "all" | "5" | "4" | "3" | "1-2"
	const [filterProduct, setFilterProduct] = useState("all");
	const [sortBy, setSortBy] = useState("recent"); // "recent" | "oldest" | "rating_desc" | "rating_asc"
	const [showFilters, setShowFilters] = useState(false);

	useEffect(() => {
		Promise.all([
			getAdminTable("reviews", 1000),
			getAdminTable("products", 200),
		])
			.then(([rev, prod]) => {
				setReviews(
					Array.isArray(rev) ? rev.filter((r) => r.status === "published") : [],
				);
				setProducts(Array.isArray(prod) ? prod : []);
			})
			.catch(() => {
				setReviews([]);
				setProducts([]);
			})
			.finally(() => setLoading(false));
	}, []);

	// Map product_id → name
	const productMap = useMemo(() => {
		const m = {};
		products.forEach((p) => {
			m[p.id] = p.name || p.title;
		});
		return m;
	}, [products]);

	// Stats globales
	const stats = useMemo(() => {
		if (!reviews.length) return { count: 0, average: 0, dist: {} };
		const total = reviews.length;
		const sum = reviews.reduce((s, r) => s + Number(r.rating), 0);
		const average = (sum / total).toFixed(1);
		const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
		reviews.forEach((r) => {
			const k = Math.round(Number(r.rating));
			if (dist[k] !== undefined) dist[k]++;
		});
		return { count: total, average, dist };
	}, [reviews]);

	// Produits uniques dans les avis
	const productsInReviews = useMemo(() => {
		const ids = [...new Set(reviews.map((r) => r.product_id).filter(Boolean))];
		return ids
			.map((id) => ({ id, name: productMap[id] || id.slice(0, 8) + "…" }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [reviews, productMap]);

	// Filtrage + tri
	const filtered = useMemo(() => {
		return reviews
			.filter((r) => {
				const rating = Number(r.rating);
				if (filterRating === "5" && rating !== 5) return false;
				if (filterRating === "4" && (rating < 4 || rating >= 5)) return false;
				if (filterRating === "3" && (rating < 3 || rating >= 4)) return false;
				if (filterRating === "1-2" && rating >= 3) return false;
				if (filterProduct !== "all" && r.product_id !== filterProduct)
					return false;
				if (search.trim()) {
					const q = search.toLowerCase();
					const inTitle = (r.title || "").toLowerCase().includes(q);
					const inBody = (r.body || r.content || "").toLowerCase().includes(q);
					const inAuthor = (r.author || "").toLowerCase().includes(q);
					const inProduct = (productMap[r.product_id] || "")
						.toLowerCase()
						.includes(q);
					if (!inTitle && !inBody && !inAuthor && !inProduct) return false;
				}
				return true;
			})
			.sort((a, b) => {
				if (sortBy === "recent")
					return new Date(b.created_at) - new Date(a.created_at);
				if (sortBy === "oldest")
					return new Date(a.created_at) - new Date(b.created_at);
				if (sortBy === "rating_desc")
					return Number(b.rating) - Number(a.rating);
				if (sortBy === "rating_asc") return Number(a.rating) - Number(b.rating);
				return 0;
			});
	}, [reviews, filterRating, filterProduct, search, sortBy, productMap]);

	const hasActiveFilters =
		filterRating !== "all" || filterProduct !== "all" || search.trim() !== "";

	const resetFilters = () => {
		setFilterRating("all");
		setFilterProduct("all");
		setSearch("");
	};

	return (
		<div className="min-h-screen bg-baume-ivory">
			{/* ── Hero ── */}
			<section className="bg-baume-white border-b border-baume-border">
				<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-14 md:py-20">
					<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
						Communauté Baume
					</p>
					<h1 className="font-editorial text-[44px] md:text-[64px] text-baume-charcoal leading-[1.0]">
						Ce qu'elles en pensent
					</h1>
					<p className="mt-5 text-[16px] text-baume-charcoal/60 leading-[26px] max-w-xl">
						Tous les avis vérifiés de notre communauté — honnêtes, précis, et
						partagés avec soin.
					</p>

					{/* ── Bloc stats ── */}
					{!loading && stats.count > 0 && (
						<div className="mt-10 flex flex-col sm:flex-row gap-8 items-start">
							{/* Note globale */}
							<div className="flex items-center gap-5">
								<span className="font-editorial text-[72px] leading-none text-baume-charcoal">
									{stats.average}
								</span>
								<div className="flex flex-col gap-2">
									<StarRow rating={parseFloat(stats.average)} size="lg" />
									<p className="text-[13px] text-baume-charcoal/55">
										{stats.count} avis vérifiés
									</p>
								</div>
							</div>

							{/* Barres distribution */}
							<div className="flex-1 min-w-[200px] max-w-xs space-y-2">
								{[5, 4, 3, 2, 1].map((n) => (
									<RatingBar
										key={n}
										label={n}
										count={stats.dist[n] || 0}
										total={stats.count}
									/>
								))}
							</div>
						</div>
					)}
				</div>
			</section>

			{/* ── Contenu ── */}
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10">
				{/* ── Barre de recherche + filtres ── */}
				<div className="flex flex-col sm:flex-row gap-3 mb-8">
					{/* Recherche */}
					<div className="relative flex-1">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-baume-charcoal/35 pointer-events-none" />
						<input
							type="text"
							placeholder="Rechercher un avis, un produit…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full h-11 pl-10 pr-4 rounded-full border border-baume-border bg-baume-white text-[14px] text-baume-charcoal placeholder:text-baume-charcoal/35 focus:outline-none focus:border-baume-burgundy/50 transition"
						/>
					</div>

					{/* Bouton filtres */}
					<button
						onClick={() => setShowFilters((v) => !v)}
						className={`h-11 px-5 rounded-full border text-[13px] font-semibold inline-flex items-center gap-2 transition-all ${
							showFilters || hasActiveFilters
								? "bg-baume-burgundy text-baume-white border-baume-burgundy"
								: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"
						}`}
					>
						<SlidersHorizontal className="h-4 w-4" />
						Filtres
						{hasActiveFilters && (
							<span className="h-5 w-5 rounded-full bg-baume-white text-baume-burgundy text-[11px] font-bold flex items-center justify-center">
								!
							</span>
						)}
					</button>

					{/* Tri */}
					<div className="relative">
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							className="h-11 pl-4 pr-8 rounded-full border border-baume-border bg-baume-white text-[13px] text-baume-charcoal font-medium appearance-none focus:outline-none focus:border-baume-burgundy/50 transition cursor-pointer"
						>
							<option value="recent">Plus récents</option>
							<option value="oldest">Plus anciens</option>
							<option value="rating_desc">Meilleures notes</option>
							<option value="rating_asc">Notes les plus basses</option>
						</select>
						<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-baume-charcoal/40 pointer-events-none" />
					</div>
				</div>

				{/* ── Panel filtres ── */}
				{showFilters && (
					<div className="rounded-3xl border border-baume-border bg-baume-white p-6 mb-6 flex flex-col md:flex-row gap-6">
						{/* Note */}
						<div className="flex-1">
							<p className="text-[11px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold mb-3">
								Note
							</p>
							<div className="flex flex-wrap gap-2">
								{[
									{ key: "all", label: "Toutes" },
									{ key: "5", label: "★★★★★" },
									{ key: "4", label: "★★★★" },
									{ key: "3", label: "★★★" },
									{ key: "1-2", label: "★★ et moins" },
								].map((f) => (
									<button
										key={f.key}
										onClick={() => setFilterRating(f.key)}
										className={`h-9 px-4 rounded-full border text-[12px] font-semibold transition-all ${
											filterRating === f.key
												? "bg-baume-burgundy text-baume-white border-baume-burgundy"
												: "bg-baume-ivory border-baume-border text-baume-charcoal hover:border-baume-burgundy/40"
										}`}
									>
										{f.label}
									</button>
								))}
							</div>
						</div>

						{/* Produit */}
						<div className="flex-1">
							<p className="text-[11px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold mb-3">
								Produit
							</p>
							<div className="relative">
								<select
									value={filterProduct}
									onChange={(e) => setFilterProduct(e.target.value)}
									className="w-full h-10 pl-4 pr-8 rounded-full border border-baume-border bg-baume-ivory text-[13px] text-baume-charcoal appearance-none focus:outline-none focus:border-baume-burgundy/50 transition cursor-pointer"
								>
									<option value="all">Tous les produits</option>
									{productsInReviews.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
								<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-baume-charcoal/40 pointer-events-none" />
							</div>
						</div>

						{/* Reset */}
						{hasActiveFilters && (
							<div className="flex items-end">
								<button
									onClick={resetFilters}
									className="h-10 px-4 rounded-full border border-baume-border text-[12px] font-semibold text-baume-charcoal hover:bg-baume-ivory inline-flex items-center gap-2 transition"
								>
									<X className="h-3.5 w-3.5" />
									Réinitialiser
								</button>
							</div>
						)}
					</div>
				)}

				{/* ── Résultat count ── */}
				<div className="flex items-center justify-between mb-6">
					<p className="text-[13px] text-baume-charcoal/55">
						{filtered.length} avis
						{filtered.length !== reviews.length && ` sur ${reviews.length}`}
					</p>
					{hasActiveFilters && (
						<button
							onClick={resetFilters}
							className="text-[12px] text-baume-burgundy font-semibold hover:underline underline-offset-4 inline-flex items-center gap-1"
						>
							<X className="h-3 w-3" />
							Effacer les filtres
						</button>
					)}
				</div>

				{/* ── États ── */}
				{loading ? (
					<div className="py-32 flex flex-col items-center gap-4">
						<div className="h-8 w-8 rounded-full border-2 border-baume-burgundy border-t-transparent animate-spin" />
						<p className="text-[14px] text-baume-charcoal/50">
							Chargement des avis…
						</p>
					</div>
				) : filtered.length === 0 ? (
					<div className="py-24 text-center rounded-3xl border border-baume-border bg-baume-white">
						<p className="font-editorial text-[26px] text-baume-charcoal/50 mb-2">
							Aucun avis trouvé
						</p>
						<p className="text-[13px] text-baume-charcoal/40">
							Essayez de modifier vos critères de recherche.
						</p>
						{hasActiveFilters && (
							<button
								onClick={resetFilters}
								className="mt-5 h-10 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition"
							>
								Voir tous les avis
							</button>
						)}
					</div>
				) : (
					/* ── Grille masonry-like ── */
					<div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
						{filtered.map((review) => (
							<div key={review.id} className="break-inside-avoid">
								<ReviewCard
									review={review}
									productName={productMap[review.product_id]}
								/>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
