import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Store, RotateCcw, Truck, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import Breadcrumb from "./Breadcrumb";
import ProductCard from "./ProductCard";
import ArticleCard from "./ArticleCard";
import TrackedBanner from "./TrackedBanner";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import { useCart } from "../lib/cart";
import { getGuides, getProducts } from "../lib/api";
import { EXPERTS } from "../data/experts";

// ─────────────────────────────────────────────────────────────────────────────
// Gabarit des pages « besoin » éditoriales (Sexualité, Intimité…)
// Toute la personnalité de la page vient de l'objet `config` :
// textes, intentions (filtres), catégories de produits associées, repères,
// FAQ, experte et mots-clés des guides.
// ─────────────────────────────────────────────────────────────────────────────

const PAD = "w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20";

function normalize(str) {
	return String(str || "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "");
}

function productText(p) {
	return normalize(
		[
			p.name,
			p.tagline,
			p.description,
			p.product_category,
			...(p.benefits || []),
			...(p.highlights || []),
		].join(" "),
	);
}

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

function Eyebrow({ children, light = false }) {
	return (
		<p
			className={`text-[11px] uppercase tracking-[0.24em] font-semibold ${
				light ? "text-baume-white/70" : "text-baume-burgundy"
			}`}
		>
			{children}
		</p>
	);
}

export default function NeedLanding({ config }) {
	const { addItem } = useCart();
	const [products, setProducts] = useState([]);
	const [guides, setGuides] = useState([]);
	const [loading, setLoading] = useState(true);
	const [intent, setIntent] = useState(config.intents[0].key);
	const [showAll, setShowAll] = useState(false);

	const expert = EXPERTS.find((e) => e.name === config.expert?.name);
	const accent = config.accent; // { soft, ring, glow }

	useEffect(() => {
		let mounted = true;
		getProducts({ limit: 200 })
			.then((data) => mounted && setProducts(Array.isArray(data) ? data : []))
			.catch(() => mounted && setProducts([]))
			.finally(() => mounted && setLoading(false));
		getGuides()
			.then((data) => mounted && setGuides(Array.isArray(data) ? data : []))
			.catch(() => mounted && setGuides([]));
		return () => {
			mounted = false;
		};
	}, []);

	// Produits associés : besoin de la page OU catégories rattachées
	const related = useMemo(() => {
		const list = products.filter(
			(p) =>
				(p.needs || []).some((n) => normalize(n) === config.needSlug) ||
				config.categories.includes(p.product_category),
		);
		// Best-sellers et produits disponibles d'abord
		return list.sort(
			(a, b) =>
				Number(!!b.bestseller) - Number(!!a.bestseller) ||
				Number(!!b.available) - Number(!!a.available) ||
				Number(b.rating || 0) - Number(a.rating || 0),
		);
	}, [products, config]);

	const intentDef = config.intents.find((i) => i.key === intent) || config.intents[0];

	const filtered = useMemo(() => {
		if (!intentDef.keywords?.length && !intentDef.categories?.length) return related;
		const kws = (intentDef.keywords || []).map(normalize);
		return related.filter(
			(p) =>
				(intentDef.categories || []).includes(p.product_category) ||
				kws.some((k) => productText(p).includes(k)),
		);
	}, [related, intentDef]);

	const visible = showAll ? filtered : filtered.slice(0, 8);

	const relatedGuides = useMemo(() => {
		const kws = config.guideKeywords.map(normalize);
		const matched = guides.filter((g) =>
			kws.some((k) => normalize(`${g.title} ${g.slug} ${g.excerpt || ""}`).includes(k)),
		);
		return (matched.length ? matched : guides).slice(0, 3);
	}, [guides, config]);

	const heroImages = related.map((p) => p.image).filter(Boolean).slice(0, 3);

	const handleQuickAdd = (product) => {
		addItem(product, { quantity: 1 });
		toast.success("Ajouté à votre routine", { description: product.name });
	};

	return (
		<div data-testid={config.testId} className="min-h-screen bg-baume-ivory">
			<div className={`${PAD} pt-8 md:pt-10`}>
				<Breadcrumb
					items={[{ label: "Shop", to: "/shop/besoin" }, { label: config.label }]}
				/>
			</div>

			{/* ── HERO ─────────────────────────────────────────────────────── */}
			<section className={`${PAD} pt-6 pb-10 md:pb-16`}>
				<div className="relative overflow-hidden rounded-[40px] border border-baume-border bg-baume-white">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full blur-3xl opacity-60"
						style={{ background: accent.glow }}
					/>
					<div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-10 p-8 md:p-12 lg:p-16 xl:p-20">
						<div className="flex flex-col justify-center">
							<Eyebrow>{config.hero.eyebrow}</Eyebrow>
							<h1 className="mt-6 font-editorial text-[50px] md:text-[76px] xl:text-[88px] leading-[0.92] text-baume-charcoal">
								{config.hero.title[0]}
								<br />
								<span className="italic text-baume-burgundy">
									{config.hero.title[1]}
								</span>
							</h1>
							<p className="mt-7 max-w-[560px] text-[16px] md:text-[18px] leading-[30px] text-baume-charcoal/70">
								{config.hero.lead}
							</p>
							<div className="mt-9 flex flex-wrap gap-3">
								<a
									href="#selection"
									className="h-12 px-7 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center gap-2 font-semibold text-[14px] hover:opacity-90 transition"
								>
									{config.hero.cta}
									<ArrowRight className="h-4 w-4" />
								</a>
								<a
									href="#reperes"
									className="h-12 px-7 rounded-full border border-baume-burgundy/30 text-baume-burgundy inline-flex items-center font-semibold text-[14px] hover:bg-baume-ivory transition"
								>
									{config.hero.ctaSecondary}
								</a>
							</div>
							<ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[13px] text-baume-charcoal/60">
								<li className="inline-flex items-center gap-2">
									<Store className="h-4 w-4 text-baume-burgundy" /> Conseil en
									boutique à Genève
								</li>
								<li className="inline-flex items-center gap-2">
									<Truck className="h-4 w-4 text-baume-burgundy" /> Livraison
									offerte dès 60 CHF
								</li>
								<li className="inline-flex items-center gap-2">
									<RotateCcw className="h-4 w-4 text-baume-burgundy" /> 30 jours
									pour changer d'avis*
								</li>
							</ul>
						</div>

						{/* Composition visuelle : produits de la sélection */}
						<div className="relative hidden sm:block min-h-[380px] md:min-h-[460px]">
							<div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-3">
								{[0, 1, 2].map((i) => {
									const placement = [
										"col-span-4 row-span-4 col-start-1 row-start-1",
										"col-span-2 row-span-3 col-start-5 row-start-1",
										"col-span-3 row-span-2 col-start-4 row-start-5",
									][i];
									const src = heroImages[i];
									return (
										<div
											key={i}
											className={`${placement} overflow-hidden rounded-[28px] border border-baume-border`}
											style={{ background: accent.soft }}
										>
											{src ? (
												<img
													src={src}
													alt=""
													loading={i === 0 ? "eager" : "lazy"}
													className="h-full w-full object-cover"
												/>
											) : (
												<div className="h-full w-full flex items-center justify-center">
													{React.createElement(config.pillars[i % config.pillars.length].icon, {
														className: "h-10 w-10 text-baume-burgundy/40",
													})}
												</div>
											)}
										</div>
									);
								})}
								<div className="col-span-3 row-span-2 col-start-1 row-start-5 overflow-hidden rounded-[28px] bg-baume-burgundy text-baume-white p-5 md:p-6 flex flex-col justify-between gap-2">
									<p className="font-editorial italic text-[15px] sm:text-[17px] xl:text-[19px] leading-snug">
										« {config.hero.quote} »
									</p>
									<p className="text-[11px] uppercase tracking-[0.2em] text-baume-white/60">
										L'équipe Baume
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── NAVIGATION DE PAGE ─────────────────────────────────────────── */}
			<nav
				aria-label="Sur cette page"
				className={`${PAD} sticky top-[64px] z-20 py-3 bg-baume-ivory/90 backdrop-blur`}
			>
				<div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{[
						["#selection", "La sélection"],
						["#reperes", "Bien choisir"],
						expert && ["#experte", "Parler à une experte"],
						["#questions", "Vos questions"],
						relatedGuides.length > 0 && ["#guides", "Guides"],
					]
						.filter(Boolean)
						.map(([href, label]) => (
							<a
								key={href}
								href={href}
								className="h-9 px-4 shrink-0 inline-flex items-center rounded-full border border-baume-border bg-baume-white text-[13px] font-semibold text-baume-charcoal hover:border-baume-burgundy/50 hover:text-baume-burgundy transition"
							>
								{label}
							</a>
						))}
				</div>
			</nav>

			{/* ── PILIERS ────────────────────────────────────────────────────── */}
			<section className={`${PAD} py-12 md:py-16`}>
				<div className="grid md:grid-cols-3 gap-4">
					{config.pillars.map((p, i) => (
						<div
							key={p.title}
							className="rounded-[28px] border border-baume-border bg-baume-white p-7 md:p-8"
						>
							<div className="flex items-center justify-between">
								<span
									className="h-12 w-12 rounded-full flex items-center justify-center"
									style={{ background: accent.soft }}
								>
									<p.icon className="h-5 w-5 text-baume-burgundy" />
								</span>
								<span className="font-editorial text-[40px] leading-none text-baume-taupe">
									{String(i + 1).padStart(2, "0")}
								</span>
							</div>
							<h2 className="mt-6 font-editorial text-[26px] text-baume-charcoal">
								{p.title}
							</h2>
							<p className="mt-3 text-[14px] leading-[24px] text-baume-charcoal/65">
								{p.text}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* ── SÉLECTION (produits associés, filtrables par intention) ────── */}
			<section id="selection" className={`${PAD} py-12 md:py-16 scroll-mt-32`}>
				<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
					<div className="max-w-[680px]">
						<Eyebrow>{config.selection.eyebrow}</Eyebrow>
						<h2 className="mt-4 font-editorial text-[38px] md:text-[54px] leading-[1] text-baume-charcoal">
							{config.selection.title}
						</h2>
						<p className="mt-4 text-[15px] leading-7 text-baume-charcoal/65">
							{config.selection.lead}
						</p>
					</div>
					{!loading && (
						<p className="text-[13px] text-baume-charcoal/55">
							{filtered.length} produit{filtered.length > 1 ? "s" : ""}
						</p>
					)}
				</div>

				<div
					role="tablist"
					aria-label="Filtrer par intention"
					className="flex gap-2 overflow-x-auto pb-2 mb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{config.intents.map((i) => (
						<button
							key={i.key}
							type="button"
							role="tab"
							aria-selected={intent === i.key}
							onClick={() => {
								setIntent(i.key);
								setShowAll(false);
							}}
							className={`h-11 px-5 shrink-0 inline-flex items-center gap-2 rounded-full border text-[14px] font-semibold transition ${
								intent === i.key
									? "bg-baume-burgundy text-baume-white border-baume-burgundy"
									: "bg-baume-white text-baume-charcoal border-baume-border hover:border-baume-burgundy/50"
							}`}
						>
							{i.icon && <i.icon className="h-4 w-4" />}
							{i.label}
						</button>
					))}
				</div>

				{intentDef.hint && (
					<p className="-mt-4 mb-8 text-[14px] italic text-baume-charcoal/60 font-editorial">
						{intentDef.hint}
					</p>
				)}

				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<ProductSkeleton key={i} />
						))}
					</div>
				) : filtered.length === 0 ? (
					<div className="rounded-[28px] border border-baume-border bg-baume-white p-10 md:p-14 text-center">
						<p className="font-editorial text-[28px] text-baume-charcoal">
							{related.length === 0
								? "La sélection arrive très bientôt."
								: "Aucun produit pour cette intention pour l'instant."}
						</p>
						<p className="mt-3 text-[14px] text-baume-charcoal/60">
							Notre équipe peut vous conseiller en boutique ou par message.
						</p>
						{related.length > 0 && (
							<button
								type="button"
								onClick={() => setIntent(config.intents[0].key)}
								className="mt-6 h-11 px-6 rounded-full bg-baume-burgundy text-baume-white text-[14px] font-semibold"
							>
								Voir toute la sélection
							</button>
						)}
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
							{visible.map((p) => (
								<ProductCard key={p.id || p.slug} product={p} onQuickAdd={handleQuickAdd} />
							))}
						</div>
						{filtered.length > 8 && (
							<div className="mt-10 text-center">
								<button
									type="button"
									onClick={() => setShowAll((v) => !v)}
									className="h-12 px-7 inline-flex items-center gap-2 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[14px] hover:bg-baume-white transition"
								>
									{showAll ? "Voir moins" : `Voir les ${filtered.length} produits`}
									<ChevronDown
										className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`}
									/>
								</button>
							</div>
						)}
					</>
				)}
			</section>

			{/* ── REPÈRES POUR CHOISIR ───────────────────────────────────────── */}
			<section id="reperes" className={`${PAD} py-12 md:py-16 scroll-mt-32`}>
				<div className="rounded-[36px] bg-baume-burgundy text-baume-white p-8 md:p-12 lg:p-16">
					<div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
						<div>
							<Eyebrow light>{config.guide.eyebrow}</Eyebrow>
							<h2 className="mt-4 font-editorial text-[36px] md:text-[50px] leading-[1.02]">
								{config.guide.title}
							</h2>
							<p className="mt-5 text-[15px] leading-7 text-baume-white/75">
								{config.guide.lead}
							</p>
							<Link
								to="/guides"
								className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold underline underline-offset-4 decoration-baume-white/40 hover:decoration-baume-white"
							>
								Tous nos guides <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
						<ol className="grid sm:grid-cols-2 gap-4">
							{config.guide.steps.map((s, i) => (
								<li
									key={s.title}
									className="rounded-[24px] border border-baume-white/15 bg-baume-white/[0.06] p-6"
								>
									<span className="text-[12px] font-semibold tracking-[0.2em] text-baume-white/50">
										ÉTAPE {i + 1}
									</span>
									<h3 className="mt-3 font-editorial text-[24px] leading-tight">{s.title}</h3>
									<p className="mt-3 text-[14px] leading-6 text-baume-white/70">{s.text}</p>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			{/* ── EXPERTE ────────────────────────────────────────────────────── */}
			{expert && (
				<section id="experte" className={`${PAD} py-12 md:py-16 scroll-mt-32`}>
					<div className="grid md:grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-[36px] border border-baume-border bg-baume-white">
						<div className="relative aspect-[4/3] md:aspect-auto" style={{ background: accent.soft }}>
							<img
								src={expert.image}
								alt={expert.name}
								loading="lazy"
								className="absolute inset-0 h-full w-full object-cover"
							/>
						</div>
						<div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
							<Eyebrow>Accompagnement personnalisé</Eyebrow>
							<h2 className="mt-4 font-editorial text-[34px] md:text-[46px] leading-tight text-baume-charcoal">
								{config.expert.title}
							</h2>
							<p className="mt-5 text-[15px] leading-7 text-baume-charcoal/65">
								{config.expert.text}
							</p>
							<div className="mt-7 flex items-center gap-4 rounded-2xl border border-baume-border p-4">
								<div>
									<p className="font-semibold text-baume-charcoal">{expert.name}</p>
									<p className="text-[13px] text-baume-charcoal/60">{expert.role}</p>
								</div>
							</div>
							{expert.offer && (
								<p className="mt-4 text-[13px] text-baume-burgundy font-semibold">
									{expert.offer} avec le code {expert.code}
								</p>
							)}
							<Link
								to="/experts"
								className="mt-8 h-12 px-7 w-fit rounded-full bg-baume-burgundy text-baume-white inline-flex items-center gap-2 font-semibold text-[14px]"
							>
								Découvrir son accompagnement <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					</div>
				</section>
			)}

			{/* ── FAQ ────────────────────────────────────────────────────────── */}
			<section id="questions" className={`${PAD} py-12 md:py-16 scroll-mt-32`}>
				<div className="grid lg:grid-cols-[0.7fr_1.3fr] gap-10">
					<div>
						<Eyebrow>Vos questions</Eyebrow>
						<h2 className="mt-4 font-editorial text-[36px] md:text-[48px] leading-[1.02] text-baume-charcoal">
							{config.faqTitle}
						</h2>
						<p className="mt-4 text-[14px] leading-6 text-baume-charcoal/60">
							Une question plus personnelle ? Écrivez-nous, nous répondons avec
							discrétion.
						</p>
					</div>
					<Accordion type="single" collapsible className="rounded-[28px] border border-baume-border bg-baume-white px-6 md:px-8">
						{config.faq.map((f, i) => (
							<AccordionItem
								key={f.q}
								value={`faq-${i}`}
								className={i === config.faq.length - 1 ? "border-none" : "border-baume-border"}
							>
								<AccordionTrigger className="py-5 text-left font-editorial text-[19px] text-baume-charcoal hover:no-underline">
									{f.q}
								</AccordionTrigger>
								<AccordionContent className="pb-5 text-[14px] leading-[24px] text-baume-charcoal/65">
									{f.a}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</section>

			{/* ── GUIDES ─────────────────────────────────────────────────────── */}
			{relatedGuides.length > 0 && (
				<section id="guides" className={`${PAD} py-12 md:py-16 scroll-mt-32`}>
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
						<div>
							<Eyebrow>Guides & conseils</Eyebrow>
							<h2 className="mt-3 font-editorial text-[36px] md:text-[46px] text-baume-charcoal">
								Pour aller plus loin
							</h2>
						</div>
						<Link
							to="/guides"
							className="inline-flex items-center gap-2 text-baume-burgundy font-semibold text-[14px]"
						>
							Tous les guides <ArrowRight className="h-4 w-4" />
						</Link>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{relatedGuides.map((g) => (
							<ArticleCard key={g.slug} guide={g} />
						))}
					</div>
				</section>
			)}

			{/* ── CONTACT ────────────────────────────────────────────────────── */}
			<section className={`${PAD} pt-6 pb-24`}>
				<TrackedBanner
					id={`${config.needSlug}-contact`}
					label={`Page ${config.label} — bandeau conseil`}
					className="rounded-[32px] border border-baume-border bg-baume-white p-8 md:p-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8"
				>
					<div className="flex items-start gap-5 max-w-[680px]">
						<span
							className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center"
							style={{ background: accent.soft }}
						>
							<MessageCircle className="h-6 w-6 text-baume-burgundy" />
						</span>
						<div>
							<p className="font-editorial italic text-[28px] md:text-[34px] text-baume-charcoal leading-tight">
								{config.contact.title}
							</p>
							<p className="mt-2 text-[14px] text-baume-charcoal/60">{config.contact.text}</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						<Link
							to="/contact"
							className="h-12 px-6 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center gap-2 font-semibold text-[14px]"
						>
							Nous écrire <ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							to="/boutique-geneve"
							className="h-12 px-6 rounded-full border border-baume-border text-baume-charcoal inline-flex items-center font-semibold text-[14px] hover:border-baume-burgundy/50"
						>
							Venir en boutique
						</Link>
					</div>
				</TrackedBanner>
				<p className="mt-4 text-[11px] text-baume-charcoal/45">
					* Retours sous 30 jours sur les produits non ouverts, hors produits
					d'hygiène intime ouverts.
				</p>
			</section>
		</div>
	);
}
