import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
	ArrowRight,
	MapPin,
	Clock,
	Calendar,
	Heart,
	Sparkles,
	ShieldCheck,
} from "lucide-react";
import Hero from "../components/Hero";
import BesoinCard from "../components/BesoinCard";
import ProductCard from "../components/ProductCard";
import ReviewCard from "../components/ReviewCard";
import TrustBar from "../components/TrustBar";
import ArticleCard from "../components/ArticleCard";
import ExpertCard from "../components/ExpertCard";
import {
	getCategories,
	getProducts,
	getReviews,
	getGuides,
	getExperts,
} from "../lib/api";
import { useCart } from "../lib/cart";

export default function HomePage() {
	const [needs, setNeeds] = useState([]);
	const [bestsellers, setBestsellers] = useState([]);
	const [reviews, setReviews] = useState([]);
	const [guides, setGuides] = useState([]);
	const [experts, setExperts] = useState([]);
	const { addItem } = useCart();

	useEffect(() => {
		getCategories("besoin")
			.then(setNeeds)
			.catch(() => {});
		getReviews()
			.then((r) => setReviews(r.slice(0, 3)))
			.catch(() => {});
		getGuides()
			.then((g) => setGuides(g.slice(0, 3)))
			.catch(() => {});
		getExperts()
			.then(setExperts)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="home-page" className="bg-baume-ivory">
			<Hero />

			{/* Accès rapide */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-6 grid grid-cols-1 md:grid-cols-3 gap-3">
					<Link
						to="/shop/besoin"
						className="group rounded-2xl border border-baume-border bg-baume-ivory px-5 py-5 flex items-center justify-between hover:shadow-sm transition-all"
					>
						<div>
							<p className="font-editorial text-[22px] text-baume-charcoal">
								Je cherche une solution
							</p>
							<p className="text-[14px] text-baume-charcoal/65 mt-1">
								Règles, ménopause, intimité, post-partum…
							</p>
						</div>
						<ArrowRight className="h-5 w-5 text-baume-burgundy group-hover:translate-x-1 transition-transform" />
					</Link>

					<Link
						to="/shop/produit"
						className="group rounded-2xl border border-baume-border bg-baume-ivory px-5 py-5 flex items-center justify-between hover:shadow-sm transition-all"
					>
						<div>
							<p className="font-editorial text-[22px] text-baume-charcoal">
								Je veux voir les produits
							</p>
							<p className="text-[14px] text-baume-charcoal/65 mt-1">
								Culottes, cups, soins, accessoires…
							</p>
						</div>
						<ArrowRight className="h-5 w-5 text-baume-burgundy group-hover:translate-x-1 transition-transform" />
					</Link>

					<Link
						to="/ateliers"
						className="group rounded-2xl bg-baume-burgundy px-5 py-5 flex items-center justify-between text-baume-white hover:shadow-md transition-all"
					>
						<div>
							<p className="font-editorial text-[22px]">Nos ateliers</p>
							<p className="text-[14px] text-baume-white/75 mt-1">
								Rencontres, conseils et accompagnement.
							</p>
						</div>
						<Sparkles className="h-5 w-5 group-hover:scale-110 transition-transform" />
					</Link>
				</div>
			</section>

			<TrustBar />

			{/* Intro chaleureuse */}
			<section className="baume-container pt-14 md:pt-20 pb-6">
				<div className="max-w-[820px]">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
						Bienvenue chez Baume
					</p>
					<h1 className="font-editorial text-[38px] md:text-[58px] leading-[1.05] text-baume-charcoal">
						Une boutique intime, douce et guidée pour mieux vivre son corps.
					</h1>
					<p className="mt-5 text-[17px] md:text-[19px] leading-[30px] text-baume-charcoal/72 max-w-[700px]">
						Produits sélectionnés, conseils humains, ateliers et expertes :
						Baume vous accompagne à chaque étape, sans jugement et avec
						simplicité.
					</p>

					<div className="mt-8 flex flex-wrap gap-3">
						<Link
							to="/shop/besoin"
							className="h-12 px-7 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
						>
							Trouver par besoin <ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							to="/guides"
							className="h-12 px-7 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-white transition-colors"
						>
							Lire les conseils
						</Link>
					</div>
				</div>
			</section>

			{/* Shop par besoin */}
			<section className="baume-container py-14 md:py-20">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
					<div>
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
							Par besoin
						</p>
						<h2 className="font-editorial text-[32px] md:text-[44px] leading-[1.1] text-baume-charcoal max-w-[560px]">
							Commencez simplement par ce que vous ressentez
						</h2>
						<p className="mt-3 text-[16px] text-baume-charcoal/65 max-w-[560px]">
							Une navigation guidée pour trouver rapidement les produits
							adaptés.
						</p>
					</div>
					<Link to="/shop/besoin" className="baume-link">
						Voir tous les besoins
					</Link>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
					{needs.map((n) => (
						<BesoinCard key={n.slug} need={n} />
					))}
				</div>
			</section>

			{/* Best-sellers */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-16 md:py-24">
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
						<div>
							<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
								Best-sellers
							</p>
							<h2 className="font-editorial text-[32px] md:text-[44px] leading-[1.1] text-baume-charcoal">
								Les essentiels les plus appréciés
							</h2>
							<p className="mt-3 text-[16px] text-baume-charcoal/65 max-w-[620px]">
								Des produits choisis pour leur confort, leur efficacité et leur
								douceur au quotidien.
							</p>
						</div>
						<Link to="/shop/produit" className="baume-link">
							Tout voir
						</Link>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
						{bestsellers.map((p) => (
							<ProductCard
								key={p.id}
								product={p}
								onQuickAdd={(prod) => addItem(prod, { quantity: 1 })}
							/>
						))}
					</div>
				</div>
			</section>

			{/* Pourquoi Baume */}
			<section className="baume-container py-14 md:py-20">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
					<div className="rounded-3xl bg-baume-white border border-baume-border p-6">
						<Heart className="h-6 w-6 text-baume-burgundy mb-4" />
						<h3 className="font-editorial text-[24px] text-baume-charcoal">
							Sélection douce
						</h3>
						<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/68">
							Des produits pensés pour l’intimité, le confort et les moments
							sensibles.
						</p>
					</div>

					<div className="rounded-3xl bg-baume-white border border-baume-border p-6">
						<ShieldCheck className="h-6 w-6 text-baume-burgundy mb-4" />
						<h3 className="font-editorial text-[24px] text-baume-charcoal">
							Conseil discret
						</h3>
						<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/68">
							Une approche bienveillante pour aider à choisir sans se sentir
							perdue.
						</p>
					</div>

					<div className="rounded-3xl bg-baume-white border border-baume-border p-6">
						<Sparkles className="h-6 w-6 text-baume-burgundy mb-4" />
						<h3 className="font-editorial text-[24px] text-baume-charcoal">
							Ateliers & expertes
						</h3>
						<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/68">
							Des rencontres pour comprendre, échanger et avancer en confiance.
						</p>
					</div>
				</div>
			</section>

			{/* Conseils */}
			<section className="baume-container py-16 md:py-24">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16 items-center">
					<div className="lg:col-span-5">
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
							Nos conseils
						</p>
						<h2 className="font-editorial text-[32px] md:text-[44px] leading-[1.1] text-baume-charcoal">
							Des repères clairs pour{" "}
							<span className="italic text-baume-burgundy">bien choisir</span>
						</h2>
						<p className="mt-5 text-[17px] md:text-[18px] leading-[28px] text-baume-charcoal/75">
							Guides rédigés avec nos expertes : sage-femmes, conseillères,
							gynécologue partenaire. Une ressource précise et non
							médicalisante, pour avancer en confiance.
						</p>
						<Link
							to="/guides"
							className="mt-8 inline-flex items-center gap-2 h-12 px-7 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-burgundy/5 transition-colors"
						>
							Lire les guides <ArrowRight className="h-4 w-4" />
						</Link>
					</div>

					<div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
						{guides.map((g, i) => (
							<ArticleCard key={g.slug} guide={g} featured={i === 0} />
						))}
					</div>
				</div>
			</section>

			{/* Ateliers & experts */}
			<section className="bg-baume-taupe/20 border-y border-baume-border">
				<div className="baume-container py-16 md:py-24">
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
						<div>
							<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
								Ateliers & expertes
							</p>
							<h2 className="font-editorial text-[32px] md:text-[44px] leading-[1.1] text-baume-charcoal max-w-[560px]">
								Être accompagnée par des expertes de confiance
							</h2>
							<p className="mt-3 text-[16px] text-baume-charcoal/65 max-w-[600px]">
								Ateliers, conseils et accompagnement autour du cycle, de
								l’intimité et du bien-être.
							</p>
						</div>
						<Link to="/ateliers" className="baume-link">
							Voir les ateliers
						</Link>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
						{experts.map((e) => (
							<ExpertCard key={e.id} expert={e} />
						))}
					</div>
				</div>
			</section>

			{/* Boutique Genève */}
			<section className="baume-container py-16 md:py-24">
				<div className="relative rounded-[28px] overflow-hidden border border-baume-border">
					<div className="aspect-[16/10] md:aspect-[21/9]">
						<img
							src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1600&q=85"
							alt="Intérieur de la boutique Baume à Genève"
							loading="lazy"
							className="w-full h-full object-cover"
						/>
					</div>

					<div className="absolute inset-0 bg-gradient-to-tr from-black/65 via-black/35 to-transparent flex flex-col justify-end p-6 md:p-14">
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-white/80 font-semibold mb-3">
							Boutique
						</p>
						<h2 className="font-editorial text-[32px] md:text-[48px] leading-[1.1] text-baume-white max-w-[640px]">
							Passer nous voir <span className="italic">à Genève</span>
						</h2>
						<p className="mt-4 text-[16px] md:text-[18px] leading-[26px] text-baume-white/85 max-w-[520px]">
							Rue du Rhône 15 · Conseil personnalisé, ateliers, retrait de
							commande.
						</p>

						<div className="mt-6 flex flex-wrap items-center gap-3 md:gap-4 text-[13px] text-baume-white/85">
							<span className="inline-flex items-center gap-1.5">
								<MapPin className="h-4 w-4" /> 1204 Genève
							</span>
							<span className="inline-flex items-center gap-1.5">
								<Clock className="h-4 w-4" /> Mar–Sam · 10h–19h
							</span>
							<span className="inline-flex items-center gap-1.5">
								<Calendar className="h-4 w-4" /> Ateliers mensuels
							</span>
						</div>

						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								to="/boutique-geneve"
								className="h-12 px-7 inline-flex items-center rounded-full bg-baume-white text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors"
							>
								Voir les horaires
							</Link>
							<Link
								to="/contact"
								className="h-12 px-7 inline-flex items-center rounded-full border border-baume-white/70 text-baume-white font-semibold text-[15px] hover:bg-white/10 transition-colors"
							>
								Prendre rendez-vous
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Reviews */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-16 md:py-24">
					<div className="text-center max-w-[640px] mx-auto mb-12">
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
							Elles en parlent
						</p>
						<h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal">
							Une communauté qui nous fait{" "}
							<span className="italic text-baume-burgundy">confiance</span>
						</h2>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
						{reviews.map((r) => (
							<ReviewCard key={r.id} review={r} />
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
