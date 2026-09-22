import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	ArrowRight,
	Compass,
	Heart,
	MessageCircleHeart,
	MoonStar,
	ShieldCheck,
	Sparkles,
	Users,
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

function DiscoveryCard({ icon: Icon, title, text }) {
	return (
		<div className="group rounded-[24px] border border-baume-border bg-baume-white p-6 md:p-7">
			<div className="w-11 h-11 rounded-full bg-baume-ivory flex items-center justify-center">
				<Icon className="w-5 h-5 text-baume-burgundy" />
			</div>

			<h3 className="font-editorial text-[24px] text-baume-charcoal mt-6">
				{title}
			</h3>

			<p className="mt-3 text-[14px] leading-6 text-baume-charcoal/60">
				{text}
			</p>
		</div>
	);
}

function ChoiceLine({ icon: Icon, title, solo, duo, discovery }) {
	return (
		<div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 py-4 border-t border-baume-border items-center text-[13px] md:text-[14px]">
			<div className="flex items-center gap-2 font-semibold text-baume-charcoal">
				<Icon className="w-4 h-4 text-baume-burgundy" />
				{title}
			</div>

			<div className="text-baume-charcoal/60">{solo}</div>
			<div className="text-baume-charcoal/60">{duo}</div>
			<div className="text-baume-charcoal/60">{discovery}</div>
		</div>
	);
}

export default function SexualitePage() {
	const [products, setProducts] = useState([]);
	const [loading, setLoading] = useState(true);

	const { addItem } = useCart();

	const [guides, setGuides] = useState([]);

	const alicia = EXPERTS.find((expert) => expert.name === "Alicia Orelli");

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
				console.error("Erreur chargement produits Sexualité :", error);

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

	const sexualityProducts = useMemo(() => {
		return products.filter((product) =>
			(product.needs || []).some(
				(need) => String(need).toLowerCase() === "sexualite",
			),
		);
	}, [products]);

	const featuredProducts = sexualityProducts.slice(0, 6);
	const remainingProducts = sexualityProducts.slice(6);

	const handleQuickAdd = (product) => {
		addItem(product, { quantity: 1 });

		toast.success("Ajouté à votre routine", {
			description: product.name,
		});
	};

	return (
		<div data-testid="sexualite-page" className="min-h-screen bg-baume-ivory">
			{/* BREADCRUMB */}
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 md:pt-10">
				<Breadcrumb
					items={[
						{ label: "Shop", to: "/shop/besoin" },
						{ label: "Sexualité" },
					]}
				/>
			</div>

			{/* HERO */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 md:py-12">
				<div className="rounded-[36px] overflow-hidden bg-baume-burgundy text-baume-white">
					<div className="grid lg:grid-cols-[1.15fr_0.85fr]">
						<div className="p-8 md:p-12 lg:p-16 xl:p-20 min-h-[560px] flex flex-col justify-center">
							<div className="flex items-center gap-2 opacity-70 mb-6">
								<Sparkles className="w-4 h-4" />

								<span className="text-[11px] uppercase tracking-[0.24em] font-semibold">
									Plaisir · découverte · confiance
								</span>
							</div>

							<h1 className="font-editorial text-[52px] md:text-[72px] leading-[0.94]">
								Votre plaisir,
								<br />à votre manière.
							</h1>

							<p className="mt-7 max-w-[580px] font-editorial italic text-[24px] md:text-[31px] leading-tight">
								Explorer sans tabou, choisir sans pression.
							</p>

							<p className="mt-6 max-w-[570px] text-[15px] md:text-[16px] leading-7 opacity-75">
								Des produits et des repères pour découvrir ce qui vous
								ressemble, seul·e ou à deux, toujours à votre rythme.
							</p>

							<div className="flex flex-wrap gap-3 mt-9">
								<a
									href="#selection-sexualite"
									className="h-12 px-6 rounded-full bg-baume-white text-baume-burgundy inline-flex items-center gap-2 font-semibold text-[14px]"
								>
									Explorer
									<ArrowRight className="w-4 h-4" />
								</a>

								<a
									href="#guide-choix-sexualite"
									className="h-12 px-6 rounded-full border border-baume-white/40 inline-flex items-center font-semibold text-[14px]"
								>
									M'aider à choisir
								</a>
							</div>
						</div>

						<div className="p-8 md:p-12 flex items-center bg-baume-white/[0.07]">
							<div className="grid grid-cols-2 gap-3 w-full">
								<div className="rounded-[24px] bg-baume-white text-baume-charcoal p-6 min-h-[180px] flex flex-col justify-between">
									<Heart className="w-6 h-6 text-baume-burgundy" />
									<div>
										<p className="font-editorial text-[24px]">Pour soi</p>
										<p className="text-[12px] mt-2 text-baume-charcoal/55">
											Explorer ses envies.
										</p>
									</div>
								</div>

								<div className="rounded-[24px] border border-baume-white/20 p-6 min-h-[180px] flex flex-col justify-between">
									<Users className="w-6 h-6" />
									<div>
										<p className="font-editorial text-[24px]">À deux</p>
										<p className="text-[12px] mt-2 opacity-60">
											Partager et découvrir.
										</p>
									</div>
								</div>

								<div className="col-span-2 rounded-[24px] border border-baume-white/20 p-6 flex items-center gap-4">
									<Compass className="w-6 h-6 shrink-0" />
									<p className="font-editorial italic text-[22px]">
										Il n'y a pas une seule façon de vivre sa sexualité.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ENTRÉES PAR INTENTION */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12 md:py-20">
				<div className="max-w-[760px] mb-10">
					<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
						Par où commencer ?
					</p>

					<h2 className="font-editorial text-[38px] md:text-[50px] text-baume-charcoal mt-4">
						Commencez par votre envie.
					</h2>

					<p className="mt-4 text-[15px] leading-7 text-baume-charcoal/60">
						Pas besoin de connaître tous les produits. Quelques intentions
						suffisent pour commencer à explorer.
					</p>
				</div>

				<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<DiscoveryCard
						icon={Sparkles}
						title="Découvrir"
						text="Pour celles et ceux qui souhaitent simplement explorer."
					/>

					<DiscoveryCard
						icon={Heart}
						title="Pour soi"
						text="Prendre du temps pour soi et mieux connaître ses préférences."
					/>

					<DiscoveryCard
						icon={Users}
						title="À deux"
						text="Des idées pour enrichir les moments partagés."
					/>

					<DiscoveryCard
						icon={MoonStar}
						title="Douceur"
						text="Privilégier une approche progressive et confortable."
					/>
				</div>
			</section>

			{/* PRODUITS MIS EN AVANT */}
			<section
				id="selection-sexualite"
				className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12"
			>
				<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-9">
					<div>
						<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
							Sélection Baume
						</p>

						<h2 className="font-editorial text-[38px] md:text-[50px] text-baume-charcoal mt-3">
							Pour commencer à explorer
						</h2>
					</div>

					{!loading && (
						<p className="text-[13px] text-baume-charcoal/55">
							{sexualityProducts.length} produit
							{sexualityProducts.length > 1 ? "s" : ""}
						</p>
					)}
				</div>

				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
						{Array.from({ length: 4 }).map((_, index) => (
							<ProductSkeleton key={index} />
						))}
					</div>
				) : sexualityProducts.length === 0 ? (
					<div className="rounded-[24px] border border-baume-border bg-baume-white p-12 text-center">
						<p className="font-editorial text-[28px] text-baume-charcoal">
							La sélection arrive bientôt.
						</p>
					</div>
				) : (
					<ProductCarousel
						products={featuredProducts}
						onQuickAdd={handleQuickAdd}
					/>
				)}
			</section>

			{/* GUIDE COMPARATIF */}
			<section
				id="guide-choix-sexualite"
				className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-14 md:py-20"
			>
				<div className="rounded-[32px] border border-baume-border bg-baume-white p-6 md:p-10 lg:p-12">
					<div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-10 lg:gap-16">
						<div>
							<div className="w-11 h-11 rounded-full bg-baume-ivory flex items-center justify-center">
								<Compass className="w-5 h-5 text-baume-burgundy" />
							</div>

							<h2 className="font-editorial text-[34px] md:text-[44px] leading-tight text-baume-charcoal mt-6">
								Quelques repères pour choisir.
							</h2>

							<p className="mt-4 text-[14px] leading-6 text-baume-charcoal/60">
								Il n'y a pas de bon point de départ universel. L'essentiel est
								de choisir selon vos envies, votre contexte et votre niveau de
								confort.
							</p>

							<Link
								to="/guides"
								className="inline-flex items-center gap-2 mt-7 text-[14px] font-semibold text-baume-burgundy"
							>
								Approfondir dans nos guides
								<ArrowRight className="w-4 h-4" />
							</Link>
						</div>

						<div className="overflow-x-auto">
							<div className="min-w-[680px]">
								<div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 pb-4">
									<div />
									<div className="font-semibold text-baume-charcoal">
										Pour soi
									</div>
									<div className="font-semibold text-baume-charcoal">
										À deux
									</div>
									<div className="font-semibold text-baume-charcoal">
										Découverte
									</div>
								</div>

								<ChoiceLine
									icon={Heart}
									title="Intention"
									solo="Explorer"
									duo="Partager"
									discovery="Essayer"
								/>

								<ChoiceLine
									icon={MoonStar}
									title="Rythme"
									solo="Personnel"
									duo="Commun"
									discovery="Progressif"
								/>

								<ChoiceLine
									icon={ShieldCheck}
									title="Priorité"
									solo="Confort"
									duo="Échange"
									discovery="Simplicité"
								/>

								<ChoiceLine
									icon={Sparkles}
									title="Approche"
									solo="Libre"
									duo="Complice"
									discovery="Accessible"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ÉDITORIAL */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12 md:py-16">
				<div className="grid lg:grid-cols-2 rounded-[32px] overflow-hidden bg-baume-burgundy text-baume-white">
					<div className="min-h-[400px] bg-baume-white/[0.08] flex items-center justify-center p-10 md:p-14">
						<div className="max-w-[430px] text-center">
							<MessageCircleHeart className="w-8 h-8 mx-auto mb-7 opacity-80" />

							<p className="font-editorial italic text-[32px] md:text-[42px] leading-tight">
								Curiosité, communication et consentement.
							</p>
						</div>
					</div>

					<div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
						<p className="text-[11px] uppercase tracking-[0.22em] font-semibold opacity-60">
							Parler pour mieux choisir
						</p>

						<h2 className="font-editorial text-[34px] md:text-[44px] leading-tight mt-4">
							Le bien-être passe aussi par l'information.
						</h2>

						<p className="mt-5 text-[15px] leading-7 opacity-70">
							Nos guides sont là pour expliquer, rassurer et donner des repères
							sans imposer une seule manière de faire.
						</p>

						<div className="flex flex-wrap gap-3 mt-8">
							<Link
								to="/guides"
								className="h-12 px-6 rounded-full bg-baume-white text-baume-burgundy inline-flex items-center gap-2 font-semibold text-[14px]"
							>
								Découvrir les guides
								<ArrowRight className="w-4 h-4" />
							</Link>

							<Link
								to="/contact"
								className="h-12 px-6 rounded-full border border-baume-white/40 inline-flex items-center font-semibold text-[14px]"
							>
								Poser une question
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* RESTE DES PRODUITS */}
			{!loading && remainingProducts.length > 0 && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-14 md:py-20">
					<div className="mb-8">
						<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
							Continuer
						</p>

						<h2 className="font-editorial text-[36px] md:text-[46px] text-baume-charcoal mt-3">
							Poursuivre la découverte
						</h2>
					</div>
					<ProductCarousel
						products={remainingProducts}
						onQuickAdd={handleQuickAdd}
					/>
				</section>
			)}

			{/* GUIDES & CONSEILS */}
			{guides.length > 0 && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-14">
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
						<div>
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
								Guides & conseils
							</p>

							<h2 className="font-editorial text-[36px] md:text-[46px] text-baume-charcoal mt-3">
								Pour aller plus loin
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

			{/* EXPERTE */}
			{alicia && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12">
					<div className="grid md:grid-cols-2 rounded-[30px] overflow-hidden bg-baume-white border border-baume-border">
						<div className="aspect-[4/3] md:aspect-auto bg-baume-ivory">
							<img
								src={alicia.image}
								alt={alicia.name}
								loading="lazy"
								className="w-full h-full object-cover"
							/>
						</div>

						<div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
								Accompagnement personnalisé
							</p>

							<h2 className="font-editorial text-[36px] md:text-[46px] text-baume-charcoal mt-4">
								Un espace pour en parler.
							</h2>

							<h3 className="font-semibold text-baume-burgundy mt-6">
								{alicia.name}
							</h3>

							<p className="text-[14px] text-baume-charcoal/70 mt-2">
								{alicia.role}
							</p>

							<p className="text-[15px] leading-7 text-baume-charcoal/65 mt-5">
								{alicia.description}
							</p>

							<Link
								to="/experts"
								className="mt-8 h-12 px-6 w-fit rounded-full bg-baume-burgundy text-baume-white inline-flex items-center gap-2 font-semibold text-[14px]"
							>
								Découvrir son accompagnement
								<ArrowRight className="w-4 h-4" />
							</Link>
						</div>
					</div>
				</section>
			)}

			{/* CONTACT */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
				<div className="rounded-[28px] border border-baume-border bg-baume-white p-8 md:p-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
					<div className="max-w-[650px]">
						<p className="font-editorial italic text-[28px] md:text-[34px] text-baume-charcoal">
							Une question personnelle ?
						</p>

						<p className="mt-2 text-[14px] text-baume-charcoal/60">
							Notre équipe peut vous accompagner avec écoute et discrétion.
						</p>
					</div>

					<Link
						to="/contact"
						className="h-12 px-6 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center justify-center gap-2 font-semibold text-[14px]"
					>
						Nous contacter
						<ArrowRight className="w-4 h-4" />
					</Link>
				</div>
			</section>
		</div>
	);
}
