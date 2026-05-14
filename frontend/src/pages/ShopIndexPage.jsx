import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import BesoinCard from "../components/BesoinCard";
import ProductCard from "../components/ProductCard";
import Filters from "../components/Filters";
import { NEEDS, PRODUCT_CATS } from "../lib/constants";
import { ArrowRight } from "lucide-react";
import { getCategories, getProducts } from "../lib/api";
import { useCart } from "../lib/cart";
import { toast } from "sonner";

const DEFAULT_FILTERS = {
	need: null,
	category: null,
	flux: null,
	usage: null,
	size: null,
	max_price: 120,
	available: null,
};

export default function ShopIndexPage({ kind }) {
	const [items, setItems] = useState([]);
	const [needs, setNeeds] = useState([]);
	const [cats, setCats] = useState([]);
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const { addItem } = useCart();

	useEffect(() => {
		if (kind === "produit") {
			getProducts({ limit: 100 })
				.then((data) =>
					setItems(
						Array.isArray(data) && data.length > 0 ? data : PRODUCT_CATS,
					),
				)
				.catch(() => setItems(PRODUCT_CATS));

			getCategories("besoin")
				.then(setNeeds)
				.catch(() => {});
			getCategories("produit")
				.then(setCats)
				.catch(() => {});
		} else {
			getCategories("besoin")
				.then((data) =>
					setItems(Array.isArray(data) && data.length > 0 ? data : NEEDS),
				)
				.catch(() => setItems(NEEDS));
		}
	}, [kind]);

	// Filtrage côté client
	const filtered = useMemo(() => {
		if (kind !== "produit") return items;
		return items.filter((p) => {
			if (filters.need && !(p.needs || []).includes(filters.need)) return false;
			if (filters.category && p.product_category !== filters.category)
				return false;
			if (filters.flux && p.flux !== filters.flux) return false;
			if (filters.usage && p.usage !== filters.usage) return false;
			if (filters.size && !(p.sizes || []).includes(filters.size)) return false;
			if (filters.max_price && p.price > filters.max_price) return false;
			if (filters.available === true && !p.available) return false;
			return true;
		});
	}, [items, filters, kind]);

	const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
		if (k === "max_price") return v !== 120;
		return v !== null;
	}).length;

	const title =
		kind === "besoin" ? "Nos solutions par besoin" : "Nos collections produits";
	const tagline =
		kind === "besoin"
			? "Trouvez la solution adaptée à votre corps et votre moment de vie."
			: "Explorez nos produits sélectionnés avec exigence.";

	const safeItems = Array.isArray(items) ? items : [];

	return (
		<div data-testid={`shop-index-${kind}`} className="bg-baume-ivory">
			{/* Breadcrumb */}
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 md:pt-10">
				<Breadcrumb items={[{ label: title }]} />
			</div>

			{/* HERO */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-14">
				<div className="rounded-[32px] border border-baume-border bg-baume-white px-6 md:px-10 lg:px-12 py-10 md:py-14">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-4">
						{kind === "besoin" ? "Par besoin" : "Par produit"}
					</p>
					<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
						<div>
							<h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.04] text-baume-charcoal max-w-[820px]">
								{title}
							</h1>
							<p className="mt-4 italic text-baume-burgundy text-[22px] md:text-[28px] font-medium">
								{tagline}
							</p>
						</div>
						<Link
							to="/contact"
							className="shrink-0 h-12 px-6 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:opacity-90 transition"
						>
							Besoin d'aide <ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>

			{/* BESOIN MODE */}
			{kind === "besoin" && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
					{safeItems.map((n) => (
						<BesoinCard key={n.slug} need={n} />
					))}
				</section>
			)}

			{/* PRODUIT MODE — layout 2 colonnes avec filtres */}
			{kind === "produit" && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
					<div className="flex gap-10 lg:items-start">
						{/* Filtres desktop */}
						<Filters
							filters={filters}
							setFilters={setFilters}
							needs={needs}
							cats={cats}
							onReset={() => setFilters(DEFAULT_FILTERS)}
						/>

						{/* Contenu principal */}
						<div className="flex-1 min-w-0">
							{/* Barre résultats + filtres mobile */}
							<div className="flex items-center justify-between gap-4 mb-6">
								<div className="flex items-center gap-3">
									{/* Bouton filtre mobile (rendu par Filters mais on affiche le compte ici) */}
									<p className="text-[13px] text-baume-charcoal/60">
										<span className="font-semibold text-baume-charcoal">
											{filtered.length}
										</span>{" "}
										produit{filtered.length > 1 ? "s" : ""}
										{activeFilterCount > 0 && (
											<span className="ml-1 text-baume-burgundy">
												· {activeFilterCount} filtre
												{activeFilterCount > 1 ? "s" : ""} actif
												{activeFilterCount > 1 ? "s" : ""}
											</span>
										)}
									</p>
								</div>

								{activeFilterCount > 0 && (
									<button
										onClick={() => setFilters(DEFAULT_FILTERS)}
										className="text-[12px] font-semibold text-baume-burgundy hover:underline underline-offset-4"
									>
										Tout effacer
									</button>
								)}
							</div>

							{/* Grille produits */}
							{filtered.length === 0 ? (
								<div className="rounded-3xl border border-baume-border bg-baume-white p-16 text-center">
									<p className="font-editorial text-[28px] text-baume-charcoal/50">
										Aucun produit trouvé
									</p>
									<button
										onClick={() => setFilters(DEFAULT_FILTERS)}
										className="mt-4 text-[14px] font-semibold text-baume-burgundy hover:underline underline-offset-4"
									>
										Réinitialiser les filtres
									</button>
								</div>
							) : (
								<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
									{filtered.map((p) => (
										<ProductCard
											key={p.id || p.slug}
											product={p}
											onQuickAdd={(prod) => {
												addItem(prod, { quantity: 1 });
												toast.success("Ajouté à votre routine", {
													description: prod.name,
												});
											}}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</section>
			)}
		</div>
	);
}
