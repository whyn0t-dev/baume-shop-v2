import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	ArrowRight,
	Check,
	Droplets,
	HeartHandshake,
	Leaf,
	ShieldCheck,
	Sparkles,
	SunMedium,
} from "lucide-react";
import { toast } from "sonner";

import Breadcrumb from "../components/Breadcrumb";
import ProductCard from "../components/ProductCard";
import { useCart } from "../lib/cart";
import { EXPERTS } from "../data/experts";

import ArticleCard from "../components/ArticleCard";
import { getGuides, getProducts } from "../lib/api";

import ProductCarousel from "../components/ProductCarousel";

function ProductSkeleton() {
	return (
		<div className="rounded-[18px] border border-baume-border bg-baume-white overflow-hidden">
			<div className="skeleton h-[240px]" />
			<div className="p-4 space-y-3">
				<div className="skeleton h-3 w-[70%] rounded" />
				<div className="skeleton h-3 w-[45%] rounded" />
				<div className="skeleton h-8 w-full rounded" />
			</div>
		</div>
	);
}

function InfoCard({ icon: Icon, title, children }) {
	return (
		<div className="rounded-[24px] border border-baume-border bg-baume-white p-6 md:p-7">
			<div className="w-11 h-11 rounded-full bg-baume-ivory flex items-center justify-center mb-5">
				<Icon className="w-5 h-5 text-baume-burgundy" />
			</div>

			<h3 className="font-editorial text-[23px] text-baume-charcoal">
				{title}
			</h3>

			<p className="mt-3 text-[14px] leading-6 text-baume-charcoal/60">
				{children}
			</p>
		</div>
	);
}

function CompareRow({ label, first, second, third }) {
	return (
		<div className="grid grid-cols-[1.2fr_repeat(3,1fr)] gap-3 py-4 border-t border-baume-border text-[13px] md:text-[14px]">
			<div className="font-semibold text-baume-charcoal">{label}</div>
			<div className="text-baume-charcoal/65">{first}</div>
			<div className="text-baume-charcoal/65">{second}</div>
			<div className="text-baume-charcoal/65">{third}</div>
		</div>
	);
}

export default function IntimitePage() {
	const [products, setProducts] = useState([]);
	const [loading, setLoading] = useState(true);

	const { addItem } = useCart();

	const [guides, setGuides] = useState([]);

	const loris = EXPERTS.find((expert) => expert.name === "Loris Cavalieri");

	useEffect(() => {
		getGuides()
			.then((data) => setGuides(Array.isArray(data) ? data : []))
			.catch(() => setGuides([]));
	}, []);

	useEffect(() => {
		let mounted = true;

		getProducts({ limit: 100 })
			.then((data) => {
				if (mounted) {
					setProducts(Array.isArray(data) ? data : []);
				}
			})
			.catch((error) => {
				console.error("Erreur chargement produits Intimité :", error);

				if (mounted) {
					setProducts([]);
				}
			})
			.finally(() => {
				if (mounted) {
					setLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, []);

	const intimateProducts = useMemo(() => {
		return products.filter((product) =>
			(product.needs || []).some(
				(need) => String(need).toLowerCase() === "intimite",
			),
		);
	}, [products]);

	const categories = useMemo(() => {
		const groups = new Map();

		intimateProducts.forEach((product) => {
			const category = product.product_category || "autres";

			if (!groups.has(category)) {
				groups.set(category, []);
			}

			groups.get(category).push(product);
		});

		return Array.from(groups.entries()).map(([slug, items]) => ({
			slug,
			label: String(slug).replace(/-/g, " "),
			products: items,
		}));
	}, [intimateProducts]);

	const handleQuickAdd = (product) => {
		addItem(product, { quantity: 1 });

		toast.success("Ajouté à votre routine", {
			description: product.name,
		});
	};

	return (
		<div data-testid="intimite-page" className="min-h-screen bg-baume-ivory">
			{/* BREADCRUMB */}
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 md:pt-10">
				<Breadcrumb
					items={[{ label: "Shop", to: "/shop/besoin" }, { label: "Intimité" }]}
				/>
			</div>

			{/* HERO */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 md:py-12">
				<div className="rounded-[34px] border border-baume-border bg-baume-white overflow-hidden">
					<div className="grid lg:grid-cols-[1.15fr_0.85fr]">
						<div className="p-8 md:p-12 lg:p-16 xl:p-20 flex flex-col justify-center min-h-[520px]">
							<div className="flex items-center gap-2 text-baume-burgundy mb-6">
								<HeartHandshake className="w-4 h-4" />
								<span className="text-[11px] uppercase tracking-[0.24em] font-semibold">
									Soin · confort · équilibre
								</span>
							</div>

							<h1 className="font-editorial text-[52px] md:text-[72px] leading-[0.95] text-baume-charcoal">
								Prendre soin
								<br />
								de son intimité.
							</h1>

							<p className="mt-7 font-editorial italic text-[24px] md:text-[30px] text-baume-burgundy">
								Avec douceur, simplement.
							</p>

							<p className="mt-6 max-w-[600px] text-[16px] leading-7 text-baume-charcoal/65">
								Hygiène intime, confort menstruel et gestes du quotidien :
								découvrez une sélection pensée pour accompagner votre corps sans
								compliquer votre routine.
							</p>

							<div className="flex flex-wrap gap-3 mt-9">
								<a
									href="#selection-intimite"
									className="h-12 px-6 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center gap-2 font-semibold text-[14px]"
								>
									Voir la sélection
									<ArrowRight className="w-4 h-4" />
								</a>

								<a
									href="#comparateur-intimite"
									className="h-12 px-6 rounded-full border border-baume-burgundy text-baume-burgundy inline-flex items-center font-semibold text-[14px]"
								>
									M'aider à choisir
								</a>
							</div>
						</div>

						<div className="bg-baume-burgundy/[0.06] p-8 md:p-12 flex items-center">
							<div className="w-full">
								<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-6">
									L'essentiel
								</p>

								<div className="space-y-3">
									{[
										["Confort", "Pour accompagner le quotidien.", ShieldCheck],
										["Douceur", "Des gestes simples et respectueux.", Leaf],
										["Sérénité", "Choisir selon vos besoins.", Sparkles],
									].map(([title, text, Icon]) => (
										<div
											key={title}
											className="rounded-[20px] bg-baume-white border border-baume-border p-5 flex gap-4"
										>
											<div className="w-10 h-10 rounded-full bg-baume-ivory flex items-center justify-center shrink-0">
												<Icon className="w-5 h-5 text-baume-burgundy" />
											</div>

											<div>
												<p className="font-semibold text-baume-charcoal">
													{title}
												</p>
												<p className="mt-1 text-[13px] text-baume-charcoal/55">
													{text}
												</p>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* REPÈRES */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-16">
				<div className="text-center max-w-[760px] mx-auto mb-10">
					<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
						Comprendre ses besoins
					</p>

					<h2 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal mt-4">
						À chaque moment, son essentiel.
					</h2>
				</div>

				<div className="grid md:grid-cols-3 gap-4 md:gap-6">
					<InfoCard icon={Droplets} title="Soin quotidien">
						Pour une routine simple centrée sur le confort et la sensation de
						fraîcheur.
					</InfoCard>

					<InfoCard icon={SunMedium} title="Pendant les règles">
						Des solutions pensées pour accompagner le cycle et faciliter le
						quotidien.
					</InfoCard>

					<InfoCard icon={HeartHandshake} title="Confort intime">
						Pour répondre à un besoin ponctuel ou compléter une routine
						personnelle.
					</InfoCard>
				</div>
			</section>

			{/* PRODUITS */}
			<section
				id="selection-intimite"
				className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12 md:py-16"
			>
				<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-9">
					<div>
						<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
							Sélection Baume
						</p>

						<h2 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal mt-3">
							Trouver ce qui vous convient
						</h2>
					</div>

					{!loading && (
						<p className="text-[13px] text-baume-charcoal/55">
							{intimateProducts.length} produit
							{intimateProducts.length > 1 ? "s" : ""}
						</p>
					)}
				</div>

				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
						{Array.from({ length: 8 }).map((_, index) => (
							<ProductSkeleton key={index} />
						))}
					</div>
				) : intimateProducts.length === 0 ? (
					<div className="rounded-[24px] border border-baume-border bg-baume-white p-12 text-center">
						<p className="font-editorial text-[28px] text-baume-charcoal">
							La sélection arrive bientôt.
						</p>
					</div>
				) : (
					<div className="space-y-16">
						{categories.map((category) => (
							<div key={category.slug}>
								<div className="flex items-center gap-4 mb-6">
									<h3 className="font-editorial text-[27px] md:text-[34px] text-baume-charcoal capitalize">
										{category.label}
									</h3>

									<div className="h-px bg-baume-border flex-1" />

									<span className="text-[12px] text-baume-charcoal/45">
										{category.products.length}
									</span>
								</div>
								<ProductCarousel
									products={category.products}
									onQuickAdd={handleQuickAdd}
								/>
							</div>
						))}
					</div>
				)}
			</section>

			{/* COMPARATEUR */}
			<section
				id="comparateur-intimite"
				className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12 md:py-20"
			>
				<div className="rounded-[30px] border border-baume-border bg-baume-white p-6 md:p-10 lg:p-12">
					<div className="max-w-[720px] mb-9">
						<div className="flex items-center gap-2 text-baume-burgundy">
							<Sparkles className="w-4 h-4" />
							<p className="text-[11px] uppercase tracking-[0.22em] font-semibold">
								Repères
							</p>
						</div>

						<h2 className="font-editorial text-[34px] md:text-[44px] text-baume-charcoal mt-3">
							Quel type de solution rechercher ?
						</h2>

						<p className="mt-4 text-[14px] md:text-[15px] leading-6 text-baume-charcoal/60">
							Quelques repères simples pour vous orienter avant de parcourir
							notre sélection.
						</p>
					</div>

					<div className="overflow-x-auto">
						<div className="min-w-[720px]">
							<div className="grid grid-cols-[1.2fr_repeat(3,1fr)] gap-3 pb-4">
								<div />
								<div className="font-semibold text-baume-charcoal">
									Soin intime
								</div>
								<div className="font-semibold text-baume-charcoal">
									Protection
								</div>
								<div className="font-semibold text-baume-charcoal">Confort</div>
							</div>

							<CompareRow
								label="Pour"
								first="Routine quotidienne"
								second="Cycle menstruel"
								third="Besoin ponctuel"
							/>

							<CompareRow
								label="Moment"
								first="Selon vos habitudes"
								second="Pendant les règles"
								third="Selon le besoin"
							/>

							<CompareRow
								label="Priorité"
								first="Douceur"
								second="Sérénité"
								third="Confort"
							/>

							<CompareRow
								label="Approche"
								first="Simple"
								second="Pratique"
								third="Ciblée"
							/>
						</div>
					</div>

					<p className="mt-6 text-[12px] leading-5 text-baume-charcoal/45">
						Ces indications sont des repères de choix et ne remplacent pas un
						avis médical.
					</p>
				</div>
			</section>

			{/* GUIDES & CONSEILS */}
			{guides.length > 0 && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-14">
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
						<div>
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
								Guides & conseils
							</p>

							<h2 className="font-editorial text-[36px] md:text-[46px] text-baume-charcoal mt-3">
								Comprendre son intimité
							</h2>
						</div>

						<Link
							to="/guides"
							className="inline-flex items-center gap-2 text-baume-burgundy font-semibold text-[14px]"
						>
							Tous les guides
							<ArrowRight className="w-4 h-4" />
						</Link>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{guides.slice(0, 3).map((guide) => (
							<ArticleCard key={guide.slug} guide={guide} />
						))}
					</div>
				</section>
			)}

			{/* ACCOMPAGNEMENT HORMONAL */}
			{loris && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12">
					<div className="grid md:grid-cols-2 rounded-[30px] overflow-hidden bg-baume-white border border-baume-border">
						<div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
								Corps & transitions hormonales
							</p>

							<h2 className="font-editorial text-[36px] md:text-[46px] text-baume-charcoal mt-4">
								Être accompagnée à chaque étape.
							</h2>

							<h3 className="font-semibold text-baume-burgundy mt-6">
								{loris.name}
							</h3>

							<p className="text-[14px] text-baume-charcoal/70 mt-2">
								{loris.role}
							</p>

							<p className="text-[15px] leading-7 text-baume-charcoal/65 mt-5">
								{loris.description}
							</p>

							<p className="mt-5 text-[14px] font-semibold text-baume-burgundy">
								{loris.offer}
							</p>

							<Link
								to="/experts"
								className="mt-8 h-12 px-6 w-fit rounded-full bg-baume-burgundy text-baume-white inline-flex items-center gap-2 font-semibold text-[14px]"
							>
								Découvrir son accompagnement
								<ArrowRight className="w-4 h-4" />
							</Link>
						</div>

						<div className="aspect-[4/3] md:aspect-auto bg-baume-ivory">
							<img
								src={loris.image}
								alt={loris.name}
								loading="lazy"
								className="w-full h-full object-cover"
							/>
						</div>
					</div>
				</section>
			)}

			{/* ACCOMPAGNEMENT */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
				<div className="rounded-[30px] bg-baume-burgundy text-baume-white p-8 md:p-12 lg:p-14 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
					<div className="max-w-[680px]">
						<div className="flex items-center gap-2 opacity-70 mb-3">
							<Check className="w-4 h-4" />
							<span className="text-[11px] uppercase tracking-[0.2em] font-semibold">
								Accompagnement
							</span>
						</div>

						<p className="font-editorial text-[30px] md:text-[40px] leading-tight">
							Vous hésitez encore ?
						</p>

						<p className="mt-3 text-[14px] md:text-[15px] opacity-70">
							Nos expertes peuvent vous orienter avec discrétion selon vos
							besoins.
						</p>
					</div>

					<div className="flex flex-wrap gap-3">
						<Link
							to="/contact"
							className="h-12 px-6 rounded-full bg-baume-white text-baume-burgundy inline-flex items-center gap-2 font-semibold text-[14px]"
						>
							Nous contacter
							<ArrowRight className="w-4 h-4" />
						</Link>

						<Link
							to="/guides"
							className="h-12 px-6 rounded-full border border-baume-white/40 inline-flex items-center font-semibold text-[14px]"
						>
							Lire les guides
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
