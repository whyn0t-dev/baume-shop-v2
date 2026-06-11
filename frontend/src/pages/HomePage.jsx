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
	Star,
	Users,
	Package,
	Award,
	Leaf,
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

const STATS = [
	{ icon: Users, value: "+2 000", label: "clientes fidèles" },
	{ icon: Star, value: "4.9 / 5", label: "note moyenne" },
	{ icon: Package, value: "33", label: "produits sélectionnés" },
	{ icon: Award, value: "Depuis 2021", label: "à Genève" },
];

const ENGAGEMENTS = [
	{
		icon: Heart,
		titre: "Sélection sans compromis",
		texte:
			"Chaque produit est testé, sourcé et validé avec nos expertes. Rien n'entre dans notre boutique par hasard.",
	},
	{
		icon: ShieldCheck,
		titre: "Conseil humain",
		texte:
			"Nos sage-femmes et gynécologue partenaire rédigent nos guides. Du vrai savoir, transmis sans jargon.",
	},
	{
		icon: Leaf,
		titre: "Matières douces & éthiques",
		texte:
			"Coton biologique, silicone médical, formules clean — parce que votre corps mérite ce qu'il y a de mieux.",
	},
	{
		icon: Sparkles,
		titre: "Communauté bienveillante",
		texte:
			"Ateliers, conseils en boutique, échanges en ligne — vous n'êtes jamais seule face à vos questions.",
	},
];

const VALEURS = [
	{
		n: "01",
		titre: "Votre corps, vos règles.",
		texte:
			"Nous ne vendons pas de la honte déguisée en produit. Chaque article existe pour vous faciliter la vie, pas pour vous faire sentir que votre corps est un problème.",
	},
	{
		n: "02",
		titre: "L'expertise sans condescendance.",
		texte:
			"Nos conseils viennent de professionnelles de santé et de femmes qui ont traversé ce que vous traversez. Du savoir concret, transmis avec respect.",
	},
	{
		n: "03",
		titre: "Choisir, pas subir.",
		texte:
			"Règles, ménopause, post-partum, intimité : Baume existe pour que vous ayez le choix. Des solutions adaptées à votre corps, à votre rythme.",
	},
];

export default function HomePage() {
	const [needs, setNeeds] = useState([]);
	const [bestsellers, setBestsellers] = useState([]);
	const [reviews, setReviews] = useState([]);
	const [guides, setGuides] = useState([]);
	const [experts, setExperts] = useState([]);
	const { addItem } = useCart();
	const [showQuizPopup, setShowQuizPopup] = useState(false);

	useEffect(() => {
		const dismissed = sessionStorage.getItem("quiz_popup_dismissed");
		if (!dismissed) {
			const t = setTimeout(() => setShowQuizPopup(true), 3500);
			return () => clearTimeout(t);
		}
	}, []);

	function dismissPopup() {
		sessionStorage.setItem("quiz_popup_dismissed", "true");
		setShowQuizPopup(false);
	}

	useEffect(() => {
		getCategories("besoin")
			.then(setNeeds)
			.catch(() => {});
		getProducts({ bestseller: true })
			.then((p) => setBestsellers(p.slice(0, 4)))
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
			{/* 1. HERO SLIDER */}
			<Hero />

			{/* 2. RÉASSURANCE */}
			<TrustBar />

			{/* 3. STATS */}
			<section className="baume-container py-12 md:py-16">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{STATS.map(({ icon: Icon, value, label }) => (
						<div
							key={label}
							className="group rounded-2xl bg-baume-white border border-baume-border px-5 py-6 flex flex-col gap-3 hover:border-baume-burgundy/30 hover:shadow-sm transition-all"
						>
							<span className="h-10 w-10 rounded-full bg-baume-ivory border border-baume-border inline-flex items-center justify-center group-hover:bg-baume-burgundy/5 transition-colors">
								<Icon className="h-4 w-4 text-baume-burgundy" />
							</span>
							<p className="font-editorial text-[32px] leading-none text-baume-charcoal">
								{value}
							</p>
							<p className="text-[12px] text-baume-charcoal/50 uppercase tracking-wider font-medium">
								{label}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* 4. ACCÈS RAPIDE */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-6 grid grid-cols-1 md:grid-cols-3 gap-3">
					<Link
						to="/shop/besoin"
						className="group rounded-2xl border border-baume-border bg-baume-white px-5 py-5 flex items-center justify-between hover:bg-baume-ivory hover:shadow-sm transition-all"
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
						className="group rounded-2xl border border-baume-border bg-baume-white px-5 py-5 flex items-center justify-between hover:bg-baume-ivory hover:shadow-sm transition-all"
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
						className="group rounded-2xl bg-baume-burgundy px-5 py-5 flex items-center justify-between text-baume-white hover:bg-baume-burgundyDark hover:shadow-md transition-all"
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

			{/* 5. SHOP PAR BESOIN */}
			<section className="baume-container py-16 md:py-24">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
					<div>
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
							Par besoin
						</p>
						<h2 className="font-editorial text-[32px] md:text-[44px] leading-[1.1] text-baume-charcoal max-w-[560px]">
							Commencez simplement par ce que vous ressentez
						</h2>
						<p className="mt-3 text-[16px] text-baume-charcoal/65 max-w-[560px]">
							Une navigation guidée pour trouver rapidement les produits adaptés
							à votre situation.
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

			{/* 6. BEST-SELLERS */}
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

			{/* 7. SECTION ÉDITORIALE SPLIT */}
			<section className="baume-container py-16 md:py-24">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-[28px] overflow-hidden border border-baume-border">
					<div className="relative aspect-[4/3] lg:aspect-auto min-h-[380px]">
						<img
							src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=85"
							alt="Femme épanouie — routine bien-être Baume"
							className="w-full h-full object-cover"
							loading="lazy"
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-baume-burgundy/20 to-transparent" />
					</div>
					<div className="bg-baume-burgundy p-8 md:p-12 lg:p-14 flex flex-col justify-center">
						<p className="text-[11px] uppercase tracking-[0.3em] text-baume-white/60 font-semibold mb-5">
							Notre philosophie
						</p>
						<h2 className="font-editorial text-[32px] md:text-[42px] leading-[1.1] text-baume-white">
							Votre corps mérite{" "}
							<span className="italic">mieux que la honte.</span>
						</h2>
						<p className="mt-6 text-[16px] leading-[27px] text-baume-white/75">
							Baume est née d'un constat simple : les femmes manquent de lieux
							où parler de leur corps sans pudeur mal placée. Nous avons créé
							une boutique — physique à Genève, en ligne partout — où le conseil
							est humain, les produits sont choisis avec soin, et vous êtes
							accueillie sans jugement.
						</p>
						<p className="mt-4 text-[16px] leading-[27px] text-baume-white/75">
							Parce que prendre soin de soi n'est pas un luxe. C'est un droit.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								to="/about"
								className="h-11 px-6 inline-flex items-center gap-2 rounded-full bg-baume-white text-baume-burgundy font-semibold text-[14px] hover:bg-baume-ivory transition-colors"
							>
								Notre histoire <ArrowRight className="h-4 w-4" />
							</Link>
							<Link
								to="/quiz"
								className="h-11 px-6 inline-flex items-center gap-2 rounded-full border border-baume-white/40 text-baume-white font-semibold text-[14px] hover:bg-baume-white/10 transition-colors"
							>
								Faire le quiz
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* 8. NOS ENGAGEMENTS */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-16 md:py-24">
					<div className="text-center max-w-[580px] mx-auto mb-12">
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
							Nos engagements
						</p>
						<h2 className="font-editorial text-[32px] md:text-[42px] leading-[1.1] text-baume-charcoal">
							Pourquoi des milliers de femmes nous font confiance
						</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
						{ENGAGEMENTS.map(({ icon: Icon, titre, texte }) => (
							<div
								key={titre}
								className="group rounded-2xl border border-baume-border bg-baume-ivory p-6 flex flex-col gap-4 hover:border-baume-burgundy/30 hover:shadow-sm transition-all"
							>
								<span className="h-11 w-11 rounded-full bg-baume-white border border-baume-border inline-flex items-center justify-center group-hover:bg-baume-burgundy/5 transition-colors">
									<Icon className="h-5 w-5 text-baume-burgundy" />
								</span>
								<h3 className="font-editorial text-[20px] text-baume-charcoal leading-tight">
									{titre}
								</h3>
								<p className="text-[14px] leading-[22px] text-baume-charcoal/65">
									{texte}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* 9. MANIFESTE / VALEURS */}
			<section className="baume-container py-16 md:py-24">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
					<div className="lg:col-span-4 lg:sticky lg:top-8">
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
							Ce en quoi nous croyons
						</p>
						<h2 className="font-editorial text-[32px] md:text-[44px] leading-[1.1] text-baume-charcoal">
							Un engagement{" "}
							<span className="italic text-baume-burgundy">féministe</span>,
							concret.
						</h2>
						<p className="mt-4 text-[16px] leading-[26px] text-baume-charcoal/65">
							Baume ne vend pas de honte. Nous vendons des solutions — choisies,
							testées et recommandées par des femmes pour des femmes.
						</p>
					</div>
					<div className="lg:col-span-8 flex flex-col gap-4">
						{VALEURS.map((v) => (
							<div
								key={v.n}
								className="group rounded-2xl border border-baume-border bg-baume-white p-6 flex gap-5 items-start hover:border-baume-burgundy/30 hover:shadow-sm transition-all"
							>
								<span className="text-[13px] font-mono font-bold text-baume-burgundy/35 shrink-0 mt-0.5 group-hover:text-baume-burgundy/70 transition-colors">
									{v.n}
								</span>
								<div>
									<p className="font-semibold text-[17px] text-baume-charcoal mb-2">
										{v.titre}
									</p>
									<p className="text-[14px] leading-[23px] text-baume-charcoal/65">
										{v.texte}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* 10. CONSEILS / GUIDES */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-16 md:py-24">
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
								className="mt-8 inline-flex items-center gap-2 h-12 px-7 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors"
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
				</div>
			</section>

			{/* 11. CITATION PLEIN ÉCRAN */}
			<section className="relative overflow-hidden bg-baume-burgundy">
				<div
					className="absolute inset-0 opacity-[0.06]"
					style={{
						backgroundImage:
							"radial-gradient(circle, #fff 1.5px, transparent 1.5px)",
						backgroundSize: "40px 40px",
					}}
				/>
				<div className="relative baume-container py-20 md:py-28 text-center max-w-[820px] mx-auto">
					<span className="text-[52px] leading-none" aria-hidden="true">
						🌸
					</span>
					<blockquote className="mt-8 font-editorial text-[28px] md:text-[44px] lg:text-[52px] leading-[1.1] text-baume-white italic">
						« Connaître son corps, c'est reprendre le pouvoir sur sa vie. »
					</blockquote>
					<p className="mt-6 text-[13px] text-baume-white/50 uppercase tracking-[0.25em] font-medium">
						L'engagement Baume · Genève, depuis 2021
					</p>
					<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
						<Link
							to="/quiz"
							className="h-12 px-8 inline-flex items-center gap-2 rounded-full bg-baume-white text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors shadow-lg"
						>
							Trouver ma routine <ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							to="/about"
							className="h-12 px-8 inline-flex items-center rounded-full border border-baume-white/40 text-baume-white font-semibold text-[15px] hover:bg-baume-white/10 transition-colors"
						>
							Notre histoire
						</Link>
					</div>
				</div>
			</section>

			{/* 12. ATELIERS & EXPERTES */}
			<section className="bg-baume-taupe/25 border-y border-baume-border">
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
								l'intimité et du bien-être.
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

			{/* 13. BOUTIQUE GENÈVE */}
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
					<div className="absolute inset-0 bg-gradient-to-tr from-baume-burgundy/90 via-baume-burgundy/55 to-transparent flex flex-col justify-end p-6 md:p-14">
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
								className="h-12 px-7 inline-flex items-center rounded-full border border-baume-white/70 text-baume-white font-semibold text-[15px] hover:bg-baume-white/10 transition-colors"
							>
								Prendre rendez-vous
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* 14. AVIS CLIENTS */}
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
					<div className="mt-10 text-center">
						<Link
							to="/shop/produit"
							className="h-12 px-8 inline-flex items-center gap-2 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors"
						>
							Découvrir nos produits <ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>

			{/* QUIZ POPUP */}
			{showQuizPopup && (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-5">
					<div
						className="absolute inset-0 bg-baume-charcoal/40 backdrop-blur-sm"
						onClick={dismissPopup}
					/>
					<div className="relative bg-baume-white rounded-[32px] border border-baume-border p-8 md:p-10 max-w-[480px] w-full text-center shadow-2xl">
						<button
							onClick={dismissPopup}
							className="absolute top-4 right-4 h-8 w-8 rounded-full bg-baume-ivory text-baume-charcoal/50 hover:text-baume-charcoal inline-flex items-center justify-center transition-colors"
						>
							✕
						</button>
						<span className="text-[48px]">🌿</span>
						<h2 className="font-editorial text-[28px] text-baume-charcoal mt-4 leading-[1.2]">
							Trouvez votre routine idéale
						</h2>
						<p className="mt-3 text-[14px] text-baume-charcoal/65 leading-[1.7]">
							Répondez à 10 questions et recevez une sélection de produits
							personnalisée — gratuitement et en 2 minutes.
						</p>
						<div className="mt-6 flex flex-col gap-3">
							<Link
								to="/quiz"
								onClick={dismissPopup}
								className="h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark transition-colors"
							>
								Faire le quiz <ArrowRight className="h-4 w-4" />
							</Link>
							<button
								onClick={dismissPopup}
								className="text-[13px] text-baume-charcoal/50 hover:text-baume-charcoal underline underline-offset-2 transition-colors"
							>
								Non merci, je continue ma visite
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
