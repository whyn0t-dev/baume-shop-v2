import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
	{
		tag: "Boutique · Genève · Depuis 2021",
		title: "Prenez soin de vous,\nsans honte ni compromis.",
		sub: "Des produits choisis avec exigence pour chaque phase de votre vie — cycle, intimité, maternité, ménopause.",
		cta: { label: "Découvrir ma routine", to: "/shop/besoin" },
		ctaSecondary: { label: "Voir les best-sellers", to: "/shop/produit" },
		image:
			"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1800&q=85",
		overlay: "from-baume-burgundy/75 via-baume-burgundy/40 to-transparent",
	},
	{
		tag: "Cycle & bien-être",
		title: "Votre cycle,\nvotre rythme.",
		sub: "Culottes menstruelles, cups, soins intimes — des solutions pensées pour que vos règles ne vous ralentissent plus.",
		cta: { label: "Explorer les produits", to: "/shop/produit" },
		ctaSecondary: { label: "Lire nos guides", to: "/guides" },
		image:
			"https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1800&q=85",
		overlay: "from-[#1a1a2e]/70 via-[#1a1a2e]/35 to-transparent",
	},
	{
		tag: "Post-partum & maternité",
		title: "Le post-partum\nmérite qu'on en parle.",
		sub: "Des produits doux et adaptés pour les semaines qui suivent l'accouchement — conçus avec des sage-femmes.",
		cta: { label: "Voir les soins", to: "/shop/besoin" },
		ctaSecondary: { label: "Nos expertes", to: "/ateliers" },
		image:
			"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1800&q=85",
		overlay: "from-[#2d1b1b]/75 via-[#2d1b1b]/40 to-transparent",
	},
	{
		tag: "Ménopause & transitions",
		title: "La ménopause\nn'est pas une fin.",
		sub: "Accompagnement, produits adaptés et ateliers animés par des expertes — parce que chaque transition mérite du soutien.",
		cta: { label: "Découvrir", to: "/shop/besoin" },
		ctaSecondary: { label: "Nos ateliers", to: "/ateliers" },
		image:
			"https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1800&q=85",
		overlay: "from-[#1c2b1c]/70 via-[#1c2b1c]/35 to-transparent",
	},
	{
		tag: "Intimité & désir",
		title: "Le plaisir féminin\nn'a rien à prouver.",
		sub: "Lubrifiants naturels, accessoires et conseils — une approche décomplexée de l'intimité, sans tabou.",
		cta: { label: "Explorer", to: "/shop/produit" },
		ctaSecondary: { label: "Faire le quiz", to: "/quiz" },
		image:
			"https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1800&q=85",
		overlay: "from-[#2b1a2b]/75 via-[#2b1a2b]/40 to-transparent",
	},
];

export default function Hero() {
	const [idx, setIdx] = useState(0);
	const [prev, setPrev] = useState(null);
	const [animating, setAnimating] = useState(false);
	const timer = useRef(null);

	function go(next) {
		if (animating || next === idx) return;
		setAnimating(true);
		setPrev(idx);
		setIdx(next);
		setTimeout(() => {
			setPrev(null);
			setAnimating(false);
		}, 700);
	}

	function startTimer() {
		clearInterval(timer.current);
		timer.current = setInterval(() => {
			setIdx((i) => {
				const next = (i + 1) % SLIDES.length;
				setPrev(i);
				setAnimating(true);
				setTimeout(() => {
					setPrev(null);
					setAnimating(false);
				}, 700);
				return next;
			});
		}, 6000);
	}

	useEffect(() => {
		startTimer();
		return () => clearInterval(timer.current);
	}, []);

	function handleNav(next) {
		clearInterval(timer.current);
		go(next);
		startTimer();
	}

	const slide = SLIDES[idx];
	const prevSlide = prev !== null ? SLIDES[prev] : null;

	return (
		<section
			data-testid="hero"
			className="relative w-full overflow-hidden"
			style={{ height: "calc(100vh - 64px)", minHeight: 560, maxHeight: 900 }}
		>
			{/* Image précédente (sort) */}
			{prevSlide && (
				<div
					key={`prev-${prev}`}
					className="absolute inset-0 z-10"
					style={{ animation: "heroFadeOut 0.7s ease forwards" }}
				>
					<img
						src={prevSlide.image}
						alt=""
						className="w-full h-full object-cover"
					/>
					<div
						className={`absolute inset-0 bg-gradient-to-r ${prevSlide.overlay}`}
					/>
				</div>
			)}

			{/* Image courante (entre) */}
			<div
				key={`curr-${idx}`}
				className="absolute inset-0 z-20"
				style={{ animation: "heroFadeIn 0.7s ease forwards" }}
			>
				<img
					src={slide.image}
					alt={slide.title}
					className="w-full h-full object-cover"
					fetchPriority={idx === 0 ? "high" : "auto"}
				/>
				<div className={`absolute inset-0 bg-gradient-to-r ${slide.overlay}`} />
			</div>

			{/* Contenu */}
			<div className="absolute inset-0 z-30 flex items-end md:items-center">
				<div className="baume-container w-full pb-20 md:pb-0">
					<div className="max-w-[640px]">
						<p
							key={`tag-${idx}`}
							className="text-[11px] uppercase tracking-[0.3em] text-white/70 font-semibold mb-5"
							style={{ animation: "slideUp 0.6s 0.15s ease both" }}
						>
							{slide.tag}
						</p>
						<h1
							key={`title-${idx}`}
							className="font-editorial text-[40px] md:text-[60px] lg:text-[72px] leading-[1.05] text-white whitespace-pre-line"
							style={{ animation: "slideUp 0.6s 0.25s ease both" }}
						>
							{slide.title}
						</h1>
						<p
							key={`sub-${idx}`}
							className="mt-5 text-[16px] md:text-[18px] leading-[28px] text-white/80 max-w-[520px]"
							style={{ animation: "slideUp 0.6s 0.35s ease both" }}
						>
							{slide.sub}
						</p>
						<div
							key={`cta-${idx}`}
							className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3"
							style={{ animation: "slideUp 0.6s 0.45s ease both" }}
						>
							<Link
								to={slide.cta.to}
								className="group inline-flex items-center gap-2 h-13 px-8 rounded-full bg-white text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors shadow-lg"
							>
								{slide.cta.label}
								<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
							</Link>
							<Link
								to={slide.ctaSecondary.to}
								className="inline-flex items-center gap-2 h-13 px-8 rounded-full border border-white/50 text-white font-semibold text-[15px] hover:bg-white/10 transition-colors"
							>
								{slide.ctaSecondary.label}
							</Link>
						</div>
					</div>
				</div>
			</div>

			{/* Navigation flèches */}
			<button
				onClick={() => handleNav((idx - 1 + SLIDES.length) % SLIDES.length)}
				className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-40 h-11 w-11 rounded-full bg-white/15 hover:bg-white/30 border border-white/30 inline-flex items-center justify-center transition-all backdrop-blur-sm"
				aria-label="Slide précédente"
			>
				<ChevronLeft className="h-5 w-5 text-white" />
			</button>
			<button
				onClick={() => handleNav((idx + 1) % SLIDES.length)}
				className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-40 h-11 w-11 rounded-full bg-white/15 hover:bg-white/30 border border-white/30 inline-flex items-center justify-center transition-all backdrop-blur-sm"
				aria-label="Slide suivante"
			>
				<ChevronRight className="h-5 w-5 text-white" />
			</button>

			{/* Points de navigation */}
			<div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
				{SLIDES.map((_, i) => (
					<button
						key={i}
						onClick={() => handleNav(i)}
						className={`rounded-full transition-all duration-300 ${
							i === idx
								? "w-7 h-2 bg-white"
								: "w-2 h-2 bg-white/40 hover:bg-white/70"
						}`}
						aria-label={`Slide ${i + 1}`}
					/>
				))}
			</div>

			{/* Compteur slide */}
			<div className="absolute bottom-7 right-6 md:right-10 z-40 text-white/50 text-[12px] font-mono tracking-wider">
				{String(idx + 1).padStart(2, "0")} /{" "}
				{String(SLIDES.length).padStart(2, "0")}
			</div>

			{/* Keyframes injectés */}
			<style>{`
        @keyframes heroFadeIn {
          from { opacity: 0; transform: scale(1.03); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes heroFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .h-13 { height: 3.25rem; }
      `}</style>
		</section>
	);
}
