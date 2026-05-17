import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, RefreshCw, ShoppingCart } from "lucide-react";
import { getProducts } from "../lib/api";
import { useCart } from "../lib/cart";
import { toast } from "sonner";

// ── Labels des catégories ────────────────────────────────────────────────────
const CATEGORY_LABELS = {
	"culottes-menstruelles": {
		label: "Culottes menstruelles",
		emoji: "👙",
		description:
			"Protection douce, écologique et sans déchet pour votre cycle.",
	},
	"cups-disques": {
		label: "Cups & Disques",
		emoji: "🥤",
		description:
			"Protection longue durée, idéale pour le sport et le quotidien actif.",
	},
	"serviettes-lavables": {
		label: "Serviettes lavables",
		emoji: "🌿",
		description:
			"Alternative naturelle et réutilisable aux protections jetables.",
	},
	"soins-corps-visage": {
		// ← était soins-intimes
		label: "Soins intimes & corps",
		emoji: "🌸",
		description:
			"Produits doux formulés pour respecter la flore intime et la peau.",
	},
	"bien-etre-gourmand": {
		// ← était bien-etre
		label: "Bien-être & compléments",
		emoji: "✨",
		description:
			"Compléments et soins pour accompagner votre cycle au quotidien.",
	},
};

export default function QuizResultsPage() {
	const location = useLocation();
	const navigate = useNavigate();
	const { addItem } = useCart();

	const state = location.state || {};
	const { recommendedCategories = [], email = "" } = state;

	const [products, setProducts] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (recommendedCategories.length === 0) {
			navigate("/quiz");
			return;
		}

		// Charger les produits des catégories recommandées
		const fetchProducts = async () => {
			setLoading(true);
			try {
				const allProducts = [];
				for (const cat of recommendedCategories.slice(0, 3)) {
					const prods = await getProducts({ category: cat, limit: 4 });
					allProducts.push(...prods);
				}
				// Dédupliquer par id
				const seen = new Set();
				const unique = allProducts.filter((p) => {
					if (seen.has(p.id)) return false;
					seen.add(p.id);
					return true;
				});
				setProducts(unique.slice(0, 12));
			} catch (err) {
				console.error("Error fetching products:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchProducts();
	}, [recommendedCategories, navigate]);

	function handleAddToCart(product) {
		addItem({
			id: product.id,
			product_id: product.id,
			name: product.name,
			price: product.price,
			image: product.image,
			quantity: 1,
		});
		toast.success(`${product.name} ajouté au panier`);
	}

	return (
		<div className="bg-baume-ivory min-h-[80vh]">
			{/* Hero résultats */}
			<section className="bg-baume-burgundy text-baume-white py-16 md:py-20 px-5">
				<div className="max-w-[720px] mx-auto text-center">
					<span className="text-[56px]">🌿</span>
					<p className="mt-4 text-[12px] uppercase tracking-[0.28em] text-baume-white/60 font-semibold">
						Vos résultats personnalisés
					</p>
					<h1 className="font-editorial text-[38px] md:text-[52px] leading-[1.08] mt-3">
						Votre routine idéale
					</h1>
					<p className="mt-4 text-[16px] text-baume-white/70 leading-[1.7] max-w-[520px] mx-auto">
						{email
							? `Un email de recommandations a été envoyé à ${email}.`
							: "Voici les produits sélectionnés spécialement pour vous."}
					</p>

					{/* Catégories recommandées */}
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						{recommendedCategories.map((cat) => {
							const info = CATEGORY_LABELS[cat];
							if (!info) return null;
							return (
								<div
									key={cat}
									className="inline-flex items-center gap-2 bg-baume-white/10 border border-baume-white/20 rounded-full px-4 py-2"
								>
									<span>{info.emoji}</span>
									<span className="text-[13px] font-semibold">
										{info.label}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* Explication des catégories */}
			<section className="py-12 px-5">
				<div className="max-w-[900px] mx-auto">
					<h2 className="font-editorial text-[28px] text-baume-charcoal mb-6 text-center">
						Pourquoi ces recommandations ?
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{recommendedCategories.slice(0, 3).map((cat, index) => {
							const info = CATEGORY_LABELS[cat];
							if (!info) return null;
							return (
								<div
									key={cat}
									className="rounded-2xl border border-baume-border bg-baume-white p-5"
								>
									<div className="flex items-center gap-3 mb-3">
										<span className="h-10 w-10 rounded-full bg-baume-ivory flex items-center justify-center text-[20px]">
											{info.emoji}
										</span>
										<div>
											<p className="text-[11px] text-baume-charcoal/40 font-semibold uppercase tracking-wider">
												Priorité {index + 1}
											</p>
											<p className="text-[14px] font-semibold text-baume-charcoal">
												{info.label}
											</p>
										</div>
									</div>
									<p className="text-[13px] text-baume-charcoal/65 leading-[1.6]">
										{info.description}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* Produits recommandés */}
			<section className="py-12 px-5 bg-baume-white">
				<div className="max-w-[1100px] mx-auto">
					<div className="text-center mb-10">
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-2">
							Sélection pour vous
						</p>
						<h2 className="font-editorial text-[32px] md:text-[40px] text-baume-charcoal">
							Nos produits recommandés
						</h2>
					</div>

					{loading ? (
						<div className="py-20 flex justify-center">
							<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
						</div>
					) : products.length === 0 ? (
						<div className="py-16 text-center text-baume-charcoal/50">
							<p>Aucun produit trouvé pour vos catégories.</p>
							<Link
								to="/shop/produit"
								className="mt-4 inline-flex items-center gap-1 text-baume-burgundy font-semibold hover:underline"
							>
								Voir tous nos produits <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{products.map((product) => (
								<ProductCard
									key={product.id}
									product={product}
									onAddToCart={() => handleAddToCart(product)}
								/>
							))}
						</div>
					)}
				</div>
			</section>

			{/* CTA refaire le quiz + voir tous les produits */}
			<section className="py-16 px-5">
				<div className="max-w-[600px] mx-auto text-center">
					<h2 className="font-editorial text-[28px] text-baume-charcoal">
						Envie d'affiner vos résultats ?
					</h2>
					<p className="mt-3 text-[15px] text-baume-charcoal/65">
						Refaites le quiz à tout moment — vos besoins évoluent, vos
						recommandations aussi.
					</p>

					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<Link
							to="/quiz"
							className="h-12 px-7 rounded-full border border-baume-border text-baume-charcoal font-semibold text-[14px] inline-flex items-center gap-2 hover:border-baume-burgundy hover:text-baume-burgundy transition-colors"
						>
							<RefreshCw className="h-4 w-4" />
							Refaire le quiz
						</Link>
						<Link
							to="/shop/produit"
							className="h-12 px-7 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition-colors"
						>
							Voir tous les produits <ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}

// ── Carte produit ────────────────────────────────────────────────────────────
function ProductCard({ product, onAddToCart }) {
	return (
		<div className="rounded-2xl border border-baume-border bg-baume-white overflow-hidden hover:shadow-md transition-shadow group">
			{/* Image */}
			<Link to={`/produit/${product.slug}`}>
				<div className="aspect-square bg-baume-ivory overflow-hidden">
					{product.image ? (
						<img
							src={product.image}
							alt={product.name}
							className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
						/>
					) : (
						<div className="h-full w-full flex items-center justify-center text-baume-charcoal/20 text-[48px]">
							🌿
						</div>
					)}
				</div>
			</Link>

			{/* Infos */}
			<div className="p-4">
				<Link to={`/produit/${product.slug}`}>
					<p className="text-[14px] font-semibold text-baume-charcoal hover:text-baume-burgundy transition-colors">
						{product.name}
					</p>
					{product.tagline && (
						<p className="text-[12px] text-baume-charcoal/55 mt-1 line-clamp-2">
							{product.tagline}
						</p>
					)}
				</Link>

				<div className="mt-3 flex items-center justify-between">
					<p className="font-semibold text-[15px] text-baume-charcoal">
						{Number(product.price || 0).toFixed(2)}{" "}
						{(product.currency || "CHF").toUpperCase()}
					</p>

					<button
						onClick={onAddToCart}
						disabled={!product.available}
						className="h-9 px-4 rounded-full bg-baume-burgundy text-baume-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-baume-burgundyDark disabled:opacity-40 transition-colors"
					>
						<ShoppingCart className="h-3.5 w-3.5" />
						Ajouter
					</button>
				</div>
			</div>
		</div>
	);
}
