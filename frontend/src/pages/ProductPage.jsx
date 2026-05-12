import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ProductGallery from "../components/ProductGallery";
import ProductCard from "../components/ProductCard";
import ReviewSection from "../components/ReviewSection";
import {
	getProduct,
	getProducts,
	getReviews,
	getProductImages,
	submitReview,
} from "../lib/api";
import { useCart } from "../lib/cart";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import {
	Minus,
	Plus,
	Star,
	Truck,
	ShieldCheck,
	Store,
	MessageCircle,
	ArrowRight,
	Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// ─── Sections personnalisées par product_type ────────────────────────────────
// Chaque entrée : match(product) → boolean, sections[] → blocs affichés dans la colonne droite.
// Pour ajouter un nouveau type, dupliquer un bloc et adapter match + sections.

const CUSTOM_SECTIONS = [
	// ── Culotte Menstruelle / Protection Menstruelle ──────────────────────────
	{
		match: (p) => p.product_category === "culottes-menstruelles",
		sections: [
			{
				id: "cm-guide-flux",
				title: "Quel flux pour cette culotte ?",
				content: (
					<div className="space-y-3">
						<p className="text-[13px] leading-[22px] text-baume-charcoal/70">
							Chaque culotte est conçue pour un niveau d'absorption précis.
							Voici comment choisir selon votre flux :
						</p>
						<div className="grid grid-cols-3 gap-2">
							{[
								{ label: "Léger", desc: "1–2 tampons", active: false },
								{ label: "Moyen", desc: "2–3 tampons", active: true },
								{ label: "Abondant", desc: "4+ tampons", active: false },
							].map((f) => (
								<div
									key={f.label}
									className={`rounded-xl p-3 text-center border text-[12px] ${
										f.active
											? "bg-baume-burgundy/10 border-baume-burgundy text-baume-burgundy"
											: "bg-baume-ivory border-baume-border text-baume-charcoal/60"
									}`}
								>
									<p className="font-semibold">{f.label}</p>
									<p className="mt-0.5 opacity-80">{f.desc}</p>
								</div>
							))}
						</div>
					</div>
				),
			},
			{
				id: "cm-entretien",
				title: "Entretien & durabilité",
				content: (
					<div className="space-y-2">
						{[
							{ icon: "🧊", text: "Rincer à l'eau froide après utilisation" },
							{
								icon: "🫧",
								text: "Laver à 30°C en machine, sans assouplissant",
							},
							{
								icon: "💨",
								text: "Sécher à l'air libre — ne pas mettre au sèche-linge",
							},
							{ icon: "♻️", text: "Dure jusqu'à 150 cycles de lavage" },
						].map((item, i) => (
							<div
								key={i}
								className="flex items-start gap-2 text-[13px] text-baume-charcoal/75"
							>
								<span className="shrink-0">{item.icon}</span>
								<span>{item.text}</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "cm-certif",
				title: "Certifications",
				content: (
					<div className="flex flex-wrap gap-2">
						{[
							"OEKO-TEX®",
							"Coton bio",
							"Sans perturbateurs endocriniens",
							"Testé dermato",
						].map((c) => (
							<span
								key={c}
								className="text-[11px] px-2.5 py-1 rounded-full bg-baume-ivory border border-baume-border text-baume-charcoal/70 font-medium"
							>
								{c}
							</span>
						))}
					</div>
				),
			},
		],
	},

	// ── Cup / Disque Menstruel ────────────────────────────────────────────────
	{
		match: (p) => p.product_category === "cups-disques",
		sections: [
			{
				id: "cup-comparaison",
				title: "Cup ou disque — quelle différence ?",
				content: (
					<div className="rounded-2xl overflow-hidden border border-baume-border text-[12px]">
						<div className="grid grid-cols-3 bg-baume-ivory text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold">
							<div className="p-2.5" />
							<div className="p-2.5 border-l border-baume-border text-center">
								Cup
							</div>
							<div className="p-2.5 border-l border-baume-border text-center">
								Disque
							</div>
						</div>
						{[
							{ label: "Port", cup: "Jusqu'à 8h", disc: "Jusqu'à 12h" },
							{ label: "Intimité", cup: "Non", disc: "✓ Compatible" },
							{ label: "Pose", cup: "Pliage", disc: "Insertion plate" },
							{ label: "Capacité", cup: "Moyenne", disc: "Grande" },
						].map((row, i) => (
							<div
								key={i}
								className={`grid grid-cols-3 border-t border-baume-border ${i % 2 === 0 ? "bg-white" : "bg-baume-ivory/50"}`}
							>
								<div className="p-2.5 text-baume-charcoal/60">{row.label}</div>
								<div className="p-2.5 border-l border-baume-border text-center text-baume-charcoal/80">
									{row.cup}
								</div>
								<div className="p-2.5 border-l border-baume-border text-center text-baume-charcoal/80">
									{row.disc}
								</div>
							</div>
						))}
					</div>
				),
			},
			{
				id: "cup-sterilisation",
				title: "Stérilisation & entretien",
				content: (
					<div className="space-y-2">
						{[
							{
								icon: "🫙",
								text: "Stériliser dans l'eau bouillante 5 min avant chaque cycle",
							},
							{ icon: "🧼", text: "Nettoyer au savon doux entre chaque pose" },
							{ icon: "📦", text: "Conserver dans la pochette tissu fournie" },
							{ icon: "📅", text: "Durée de vie estimée : 5 à 10 ans" },
						].map((item, i) => (
							<div
								key={i}
								className="flex items-start gap-2 text-[13px] text-baume-charcoal/75"
							>
								<span className="shrink-0">{item.icon}</span>
								<span>{item.text}</span>
							</div>
						))}
					</div>
				),
			},
		],
	},

	// ── Maillot Menstruel ─────────────────────────────────────────────────────
	{
		match: (p) => p.product_category === "maillots-menstruels",
		sections: [
			{
				id: "maillot-fonctionnement",
				title: "Comment ça fonctionne ?",
				content: (
					<div className="space-y-3 text-[13px] leading-[21px] text-baume-charcoal/75">
						<p>
							La doublure intégrée absorbe les flux légers directement dans le
							maillot — sans tampon, sans serviette.
						</p>
						<div className="rounded-xl bg-baume-ivory border border-baume-border p-3 space-y-1.5">
							<p className="font-semibold text-baume-charcoal text-[12px] uppercase tracking-wider">
								Idéal pour
							</p>
							{[
								"Piscine & baignade en mer",
								"Flux léger ou fin de règles",
								"En complément d'une cup ou d'un disque",
							].map((t, i) => (
								<div key={i} className="flex items-center gap-2">
									<span className="h-1 w-1 rounded-full bg-baume-burgundy shrink-0" />
									<span>{t}</span>
								</div>
							))}
						</div>
					</div>
				),
			},
			{
				id: "maillot-entretien",
				title: "Entretien du maillot",
				content: (
					<div className="space-y-2">
						{[
							{ icon: "🌊", text: "Rincer à l'eau froide après chaque bain" },
							{ icon: "🧺", text: "Laver à 30°C sans assouplissant" },
							{ icon: "☀️", text: "Sécher à l'ombre — éviter le sèche-linge" },
							{
								icon: "🚫",
								text: "Ne pas repasser ni utiliser d'eau de Javel",
							},
						].map((item, i) => (
							<div
								key={i}
								className="flex items-start gap-2 text-[13px] text-baume-charcoal/75"
							>
								<span className="shrink-0">{item.icon}</span>
								<span>{item.text}</span>
							</div>
						))}
					</div>
				),
			},
		],
	},

	// ── Serviettes Lavables ───────────────────────────────────────────────────
	{
		match: (p) => p.product_category === "serviettes-lavables",
		sections: [
			{
				id: "sl-guide",
				title: "Guide d'utilisation",
				content: (
					<div className="space-y-3 text-[13px] text-baume-charcoal/75">
						<div className="grid grid-cols-3 gap-2 text-center">
							{[
								{
									step: "1",
									label: "Poser",
									desc: "Fixer avec la pression sur le sous-vêtement",
								},
								{
									step: "2",
									label: "Changer",
									desc: "Toutes les 4 à 6h selon le flux",
								},
								{
									step: "3",
									label: "Laver",
									desc: "Rincer froid, machine à 30°C",
								},
							].map((s) => (
								<div
									key={s.step}
									className="rounded-xl bg-baume-ivory border border-baume-border p-3"
								>
									<div className="w-6 h-6 rounded-full bg-baume-burgundy text-baume-white text-[11px] font-bold flex items-center justify-center mx-auto mb-1.5">
										{s.step}
									</div>
									<p className="font-semibold text-baume-charcoal text-[12px]">
										{s.label}
									</p>
									<p className="text-[11px] mt-1 leading-[16px] opacity-75">
										{s.desc}
									</p>
								</div>
							))}
						</div>
					</div>
				),
			},
		],
	},

	// ── Aromathérapie ─────────────────────────────────────────────────────────
	{
		match: (p) => p.product_category === "aromatherapie",
		sections: [
			{
				id: "aroma-precautions",
				title: "Précautions d'usage",
				content: (
					<div className="rounded-2xl bg-baume-ivory border border-baume-border p-4 space-y-2 text-[13px] text-baume-charcoal/75">
						<p className="font-semibold text-baume-charcoal">
							⚠️ À lire avant utilisation
						</p>
						{[
							"Usage externe uniquement — ne pas ingérer",
							"Tenir hors de portée des enfants",
							"Déconseillé aux femmes enceintes sans avis médical",
							"Effectuer un test cutané sur le pli du coude",
						].map((t, i) => (
							<div key={i} className="flex items-start gap-2">
								<span className="h-1 w-1 rounded-full bg-baume-burgundy mt-1.5 shrink-0" />
								<span>{t}</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "aroma-zones",
				title: "Zones d'application",
				content: (
					<div className="flex flex-wrap gap-2">
						{[
							"Poignets",
							"Tempes",
							"Bas du ventre",
							"Plexus solaire",
							"Nuque",
						].map((z) => (
							<span
								key={z}
								className="text-[12px] px-3 py-1.5 rounded-full bg-baume-taupe/30 border border-baume-border text-baume-charcoal/80"
							>
								{z}
							</span>
						))}
					</div>
				),
			},
		],
	},

	// ── Compléments alimentaires ──────────────────────────────────────────────
	{
		match: (p) => p.product_category === "bien-etre-gourmand",
		sections: [
			{
				id: "compl-cure",
				title: "Comment faire une cure ?",
				content: (
					<div className="space-y-3">
						<div className="grid grid-cols-3 gap-2 text-center text-[12px]">
							{[
								{ label: "Durée", value: "30 jours" },
								{ label: "Prise", value: "Matin" },
								{ label: "Avec", value: "Un grand verre d'eau" },
							].map((item) => (
								<div
									key={item.label}
									className="rounded-xl bg-baume-ivory border border-baume-border p-3"
								>
									<p className="text-baume-charcoal/50 text-[11px] uppercase tracking-wider mb-1">
										{item.label}
									</p>
									<p className="font-semibold text-baume-charcoal">
										{item.value}
									</p>
								</div>
							))}
						</div>
						<p className="text-[12px] text-baume-charcoal/55 leading-[18px]">
							Résultats visibles généralement à partir de 3 à 4 semaines. Nous
							recommandons 2 à 3 cures par an.
						</p>
					</div>
				),
			},
			{
				id: "compl-precautions",
				title: "Précautions",
				content: (
					<div className="space-y-1.5 text-[13px] text-baume-charcoal/70">
						{[
							"Compléments alimentaires — ne pas dépasser la dose recommandée",
							"Ne remplace pas une alimentation variée et équilibrée",
							"Consulter un professionnel de santé en cas de doute",
							"Conserver à l'abri de la chaleur et de l'humidité",
						].map((t, i) => (
							<div key={i} className="flex items-start gap-2">
								<span className="h-1 w-1 rounded-full bg-baume-burgundy mt-1.5 shrink-0" />
								<span>{t}</span>
							</div>
						))}
					</div>
				),
			},
		],
	},

	// ── Soins Intimes (Lubrifiants, Crèmes, Baumes, Huiles) ──────────────────
	{
		match: (p) => p.product_category === "soins-corps-visage",
		sections: [
			{
				id: "soin-compat",
				title: "Compatibilités",
				// La compatibilité latex/silicone dépend du produit — elle est résolue
				// dans customSections (useMemo) qui passe le produit réel.
				// Ici on stocke un résolveur plutôt que du JSX statique.
				_buildContent: (product) => (
					<div className="grid grid-cols-2 gap-2 text-[12px]">
						{[
							{
								label: "Préservatifs latex",
								value: product.slug?.includes("silicone") ? "✗ Non" : "✓ Oui",
							},
							{
								label: "Sex-toys silicone",
								value: product.slug?.includes("silicone") ? "✗ Non" : "✓ Oui",
							},
							{ label: "Peaux sensibles", value: "✓ Oui" },
							{ label: "Usage interne", value: "✓ Oui" },
						].map((item) => (
							<div
								key={item.label}
								className="flex items-center justify-between rounded-xl bg-baume-ivory border border-baume-border px-3 py-2 gap-2"
							>
								<span className="text-baume-charcoal/65">{item.label}</span>
								<span className="font-semibold text-baume-charcoal shrink-0">
									{item.value}
								</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "soin-conseil",
				title: "Le conseil de nos expertes",
				content: (
					<div className="rounded-2xl bg-baume-taupe/20 border border-baume-border p-4">
						<p className="font-editorial italic text-[16px] text-baume-burgundy mb-1">
							"Moins c'est plus."
						</p>
						<p className="text-[13px] leading-[21px] text-baume-charcoal/70">
							Commencez par une petite quantité et ajustez selon vos besoins. La
							plupart de nos soins sont concentrés — quelques gouttes suffisent
							pour un effet optimal.
						</p>
					</div>
				),
			},
		],
	},

	// ── Coffrets ─────────────────────────────────────────────────────────────
	{
		match: (p) => p.product_category === "moments-brillants",
		sections: [
			{
				id: "coffret-contenu",
				title: "Ce qui est inclus",
				content: (
					<div className="rounded-2xl bg-baume-ivory border border-baume-border p-4 space-y-2 text-[13px] text-baume-charcoal/75">
						<p className="text-[11px] uppercase tracking-wider text-baume-burgundy font-semibold mb-3">
							Contenu du coffret
						</p>
						{[
							"Produits soigneusement sélectionnés",
							"Emballage cadeau inclus",
							"Livret d'accompagnement",
							"Carte personnalisable",
						].map((item, i) => (
							<div key={i} className="flex items-center gap-2">
								<span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy shrink-0" />
								<span>{item}</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "coffret-cadeau",
				title: "Offrir ce coffret",
				content: (
					<div className="space-y-2 text-[13px] text-baume-charcoal/70">
						<p>
							Chaque coffret est expédié dans un emballage cadeau prêt à offrir.
							Vous pouvez y ajouter un message personnalisé lors du passage en
							caisse.
						</p>
						<div className="flex flex-wrap gap-2 mt-2">
							{[
								"Anniversaire",
								"Naissance",
								"Saint-Valentin",
								"Fête des mères",
							].map((o) => (
								<span
									key={o}
									className="text-[11px] px-2.5 py-1 rounded-full bg-baume-taupe/30 border border-baume-border text-baume-charcoal/70"
								>
									{o}
								</span>
							))}
						</div>
					</div>
				),
			},
		],
	},

	// ── Accessoire ────────────────────────────────────────────────
	{
		match: (p) => p.product_category === "accessoires",
		sections: [
			{
				id: "acc-matiere",
				title: "Matières & traçabilité",
				content: (
					<div className="space-y-2 text-[13px] text-baume-charcoal/75">
						<p>
							Nos accessoires sont fabriqués avec des matières certifiées et
							traçables, sélectionnées pour leur douceur et leur impact réduit
							sur l'environnement.
						</p>
						<div className="flex flex-wrap gap-2 mt-2">
							{[
								"GOTS certifié",
								"Polyester recyclé",
								"Sans BPA",
								"Fabrication EU",
							].map((c) => (
								<span
									key={c}
									className="text-[11px] px-2.5 py-1 rounded-full bg-baume-ivory border border-baume-border text-baume-charcoal/65"
								>
									{c}
								</span>
							))}
						</div>
					</div>
				),
			},
		],
	},

	// ── Bouillottes / Ambiance & Rituels ───────────────────────────────
	{
		match: (p) => p.product_category === "ambiance-rituels",
		sections: [
			{
				id: "rituel-utilisation",
				title: "Comment utiliser votre bouillotte ?",
				content: (
					<div className="space-y-2 text-[13px] text-baume-charcoal/75">
						{[
							"Remplir avec de l’eau chaude (non bouillante)",
							"Refermer soigneusement le bouchon",
							"Appliquer sur le bas du ventre ou les zones de tension",
							"Utiliser 15 à 20 minutes pour un effet optimal",
						].map((t, i) => (
							<div key={i} className="flex items-start gap-2">
								<span className="h-1 w-1 rounded-full bg-baume-burgundy mt-1.5 shrink-0" />
								<span>{t}</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "rituel-bienfaits",
				title: "Bienfaits de la chaleur",
				content: (
					<div className="space-y-2 text-[13px] text-baume-charcoal/75">
						{[
							"Soulage les douleurs menstruelles",
							"Détend les muscles et réduit les tensions",
							"Favorise la circulation sanguine",
							"Apporte une sensation immédiate de confort",
						].map((t, i) => (
							<div key={i} className="flex items-start gap-2">
								<span className="h-1 w-1 rounded-full bg-baume-burgundy mt-1.5 shrink-0" />
								<span>{t}</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "rituel-securite",
				title: "Précautions d’usage",
				content: (
					<div className="rounded-2xl bg-baume-ivory border border-baume-border p-4 space-y-2 text-[13px] text-baume-charcoal/75">
						<p className="font-semibold text-baume-charcoal">
							⚠️ À utiliser en toute sécurité
						</p>
						{[
							"Ne pas utiliser d’eau bouillante",
							"Ne pas appliquer directement sur la peau sans protection",
							"Vérifier l’absence de fuite avant utilisation",
							"Tenir hors de portée des enfants",
						].map((t, i) => (
							<div key={i} className="flex items-start gap-2">
								<span className="h-1 w-1 rounded-full bg-baume-burgundy mt-1.5 shrink-0" />
								<span>{t}</span>
							</div>
						))}
					</div>
				),
			},
		],
	},

	// ── Prêt-à-porter / Sous-vêtements ───────────────────────────────────────
	{
		match: (p) =>
			["pret-a-porter", "sous-vetements", "maillots-non-menstruels"].includes(
				p.product_category,
			),
		sections: [
			{
				id: "pap-entretien",
				title: "Entretien & conseils",
				content: (
					<div className="space-y-2">
						{[
							{
								icon: "🧺",
								text: "Lavage délicat à 30°C, retourner le vêtement",
							},
							{
								icon: "💨",
								text: "Séchage à plat ou sur cintre — éviter le sèche-linge",
							},
							{ icon: "🚫", text: "Ne pas repasser sur la matière principale" },
							{
								icon: "📦",
								text: "Plier et ranger dans un tiroir — éviter les cintres pour les tricots",
							},
						].map((item, i) => (
							<div
								key={i}
								className="flex items-start gap-2 text-[13px] text-baume-charcoal/75"
							>
								<span className="shrink-0">{item.icon}</span>
								<span>{item.text}</span>
							</div>
						))}
					</div>
				),
			},
			{
				id: "pap-guide-tailles",
				title: "Guide des tailles",
				content: (
					<div className="rounded-2xl overflow-hidden border border-baume-border text-[12px]">
						<div className="grid grid-cols-4 bg-baume-ivory text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold">
							{["Taille", "Tour de taille", "Tour de hanches", "Bonnet"].map(
								(h) => (
									<div
										key={h}
										className="p-2.5 border-r last:border-r-0 border-baume-border"
									>
										{h}
									</div>
								),
							)}
						</div>
						{[
							["XS", "60–64 cm", "86–90 cm", "85B–90B"],
							["S", "64–68 cm", "90–94 cm", "90B–95C"],
							["M", "68–72 cm", "94–98 cm", "95C–100C"],
							["L", "72–78 cm", "98–104 cm", "100D–105D"],
						].map((row, i) => (
							<div
								key={i}
								className={`grid grid-cols-4 border-t border-baume-border ${i % 2 === 0 ? "bg-white" : "bg-baume-ivory/40"}`}
							>
								{row.map((cell, j) => (
									<div
										key={j}
										className="p-2.5 border-r last:border-r-0 border-baume-border text-baume-charcoal/80"
									>
										{cell}
									</div>
								))}
							</div>
						))}
					</div>
				),
			},
		],
	},
];

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ProductPage() {
	const { slug } = useParams();
	const [product, setProduct] = useState(null);
	const [related, setRelated] = useState([]);
	const [reviews, setReviews] = useState([]);
	const [allReviews, setAllReviews] = useState([]);
	const [size, setSize] = useState(null);
	const [color, setColor] = useState(null);
	const [qty, setQty] = useState(1);
	const { addItem } = useCart();

	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "instant" });

		getProduct(slug).then(async (p) => {
			const productImages = await getProductImages(p.id).catch(() => []);

			setProduct({ ...p, images: productImages });
			setSize(null);
			setColor(p.colors?.[0] || null);
			setQty(1);

			if (p.product_category) {
				getProducts({ category: p.product_category, limit: 8 }).then((list) =>
					setRelated(list.filter((x) => x.id !== p.id).slice(0, 4)),
				);
			}

			getReviews(p.id)
				.then((r) => {
					setReviews(r);
					setAllReviews(r); // pour l'instant identique, peut être remplacé par une API globale
				})
				.catch(() => {
					setReviews([]);
					setAllReviews([]);
				});
		});
	}, [slug]);

	const crumbs = useMemo(() => {
		if (!product) return [];
		return [
			{ label: "Shop", to: "/shop/produit" },
			{ label: "Produit", to: "/shop/produit" },
			{ label: product.name },
		];
	}, [product]);

	// Sections personnalisées applicables à ce produit
	const customSections = useMemo(() => {
		if (!product) return [];

		const matched = CUSTOM_SECTIONS.filter((cs) => cs.match(product));
		return matched
			.flatMap((cs) => cs.sections)
			.map((section) => ({
				...section,
				content: section._buildContent
					? section._buildContent(product)
					: section.content,
			}));
	}, [product]);

	if (!product) {
		return (
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-24 text-center">
				<p className="font-editorial text-[24px] text-baume-charcoal/70">
					Chargement…
				</p>
			</div>
		);
	}

	const handleAdd = () => {
		if (product.sizes?.length > 0 && !size) {
			toast.error("Choisissez une taille", {
				description: "Merci de sélectionner votre taille avant d'ajouter.",
			});
			return;
		}
		addItem(product, { size, color, quantity: qty });
		toast.success("Ajouté à votre routine", { description: product.name });
	};

	return (
		<div data-testid="product-page" className="bg-baume-ivory">
			{/* Breadcrumb */}
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb items={crumbs} />
			</div>

			{/* ── Layout 2 colonnes : galerie sticky + droite défilante ── */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 md:py-14">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 lg:items-start">
					{/* ── Galerie — sticky pendant que la droite défile ── */}
					<div className="lg:col-span-7 lg:sticky lg:top-[88px]">
						<ProductGallery
							images={
								product.images?.length
									? product.images
											.sort((a, b) => (a.position || 1) - (b.position || 1))
											.map((img) => img.public_url || img.storage_path)
									: [product.image]
							}
							alt={product.name}
						/>
					</div>

					{/* ── Colonne droite — défile librement ── */}
					<div className="lg:col-span-5">
						<div className="flex flex-col gap-4">
							{/* ── Carte produit principale ── */}
							<div className="rounded-3xl border border-baume-border bg-baume-white p-6 md:p-8 shadow-sm">
								<div className="flex flex-wrap items-center gap-2 mb-5">
									{product.bestseller && (
										<span className="inline-block text-[11px] font-semibold uppercase tracking-wider bg-baume-burgundy text-baume-white px-3 py-1 rounded-full">
											Best-seller
										</span>
									)}
									{product.available ? (
										<span className="inline-block text-[11px] font-semibold uppercase tracking-wider bg-baume-ivory text-baume-charcoal px-3 py-1 rounded-full border border-baume-border">
											Disponible
										</span>
									) : (
										<span className="inline-block text-[11px] font-semibold uppercase tracking-wider bg-baume-ivory text-baume-charcoal/60 px-3 py-1 rounded-full border border-baume-border">
											Indisponible
										</span>
									)}
								</div>

								<h1 className="font-editorial text-[34px] md:text-[46px] leading-[1.05] text-baume-charcoal">
									{product.name}
								</h1>

								<p className="mt-3 text-[17px] leading-[27px] text-baume-charcoal/70">
									{product.tagline}
								</p>

								<div className="mt-5 flex items-center gap-2 text-[14px]">
									<div className="flex items-center gap-0.5">
										{Array.from({ length: 5 }).map((_, i) => (
											<Star
												key={i}
												className={`h-4 w-4 ${
													i < Math.round(product.rating)
														? "fill-baume-burgundy text-baume-burgundy"
														: "text-baume-border"
												}`}
											/>
										))}
									</div>
									<span className="text-baume-charcoal/60">
										{product.rating?.toFixed(1)} · {product.reviews_count} avis
									</span>
								</div>

								<div className="mt-7 flex items-baseline gap-3">
									<span
										data-testid="product-price"
										className="font-editorial text-[36px] leading-none text-baume-charcoal"
									>
										{product.price.toFixed(2)} CHF
									</span>
									{product.compare_price && (
										<span className="text-[16px] text-baume-charcoal/40 line-through">
											{product.compare_price.toFixed(2)} CHF
										</span>
									)}
								</div>

								{product.benefits?.length > 0 && (
									<div className="mt-7 rounded-2xl bg-baume-ivory border border-baume-border p-5">
										<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
											Points forts
										</p>
										<ul className="space-y-2">
											{product.benefits.slice(0, 5).map((b, i) => (
												<li
													key={i}
													className="flex items-start gap-2 text-[14px] leading-[22px] text-baume-charcoal/80"
												>
													<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-baume-burgundy" />
													{b}
												</li>
											))}
										</ul>
									</div>
								)}

								{product.sizes?.length > 0 && (
									<div className="mt-8">
										<div className="flex items-center justify-between gap-4">
											<p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-baume-charcoal">
												Choisir ma taille
											</p>
											<button className="text-[12px] text-baume-burgundy baume-link">
												Guide des tailles
											</button>
										</div>
										<div className="mt-3 flex flex-wrap gap-2">
											{product.sizes.map((s) => (
												<button
													key={s}
													onClick={() => setSize(s)}
													data-testid={`size-option-${s}`}
													className={`h-11 min-w-[52px] px-4 rounded-full border text-[14px] font-medium transition-all ${
														size === s
															? "bg-baume-burgundy text-baume-white border-baume-burgundy shadow-sm"
															: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/60"
													}`}
												>
													{s}
												</button>
											))}
										</div>
									</div>
								)}

								{product.colors?.length > 0 && (
									<div className="mt-6">
										<p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-baume-charcoal">
											Couleur
										</p>
										<div className="mt-3 flex flex-wrap gap-2">
											{product.colors.map((c) => (
												<button
													key={c}
													onClick={() => setColor(c)}
													className={`h-10 px-4 rounded-full border text-[13px] font-medium transition-all ${
														color === c
															? "bg-baume-burgundy text-baume-white border-baume-burgundy shadow-sm"
															: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/60"
													}`}
												>
													{c}
												</button>
											))}
										</div>
									</div>
								)}

								<div className="mt-8 flex items-stretch gap-3">
									<div className="inline-flex items-center rounded-full border border-baume-border bg-baume-white">
										<button
											aria-label="Diminuer"
											onClick={() => setQty((q) => Math.max(1, q - 1))}
											className="h-12 w-12 inline-flex items-center justify-center"
										>
											<Minus className="h-4 w-4" />
										</button>
										<span
											className="w-8 text-center font-medium"
											data-testid="product-qty"
										>
											{qty}
										</span>
										<button
											aria-label="Augmenter"
											onClick={() => setQty((q) => q + 1)}
											className="h-12 w-12 inline-flex items-center justify-center"
										>
											<Plus className="h-4 w-4" />
										</button>
									</div>

									<button
										data-testid="add-to-cart-button"
										onClick={handleAdd}
										disabled={!product.available}
										className="flex-1 h-12 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{product.available
											? "Ajouter à ma routine"
											: "Indisponible"}
									</button>
								</div>
							</div>

							{/* ── Peut-être associé avec ce produit ── */}
							{related.length > 0 && (
								<div className="rounded-3xl border border-baume-border bg-baume-white p-6 shadow-sm">
									<div className="flex items-center gap-2 mb-4">
										<Sparkles className="h-4 w-4 text-baume-burgundy" />
										<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold">
											Peut-être associé avec ce produit
										</p>
									</div>
									<div className="space-y-3">
										{related.slice(0, 3).map((p) => (
											<Link
												key={p.id}
												to={`/shop/produit/${p.slug}`}
												className="flex items-center gap-3 group"
											>
												<img
													src={p.image}
													alt={p.name}
													className="w-14 h-14 rounded-xl object-cover bg-baume-ivory shrink-0"
												/>
												<div className="flex-1 min-w-0">
													<p className="text-[13px] font-semibold text-baume-charcoal leading-tight truncate group-hover:text-baume-burgundy transition-colors">
														{p.name}
													</p>
													<p className="text-[12px] text-baume-charcoal/55 mt-0.5">
														{p.price.toFixed(2)} CHF
													</p>
												</div>
												<button
													onClick={(e) => {
														e.preventDefault();
														addItem(p, { quantity: 1 });
														toast.success("Ajouté", { description: p.name });
													}}
													className="shrink-0 h-8 px-3 rounded-full bg-baume-ivory border border-baume-border text-[12px] font-medium text-baume-charcoal hover:bg-baume-burgundy hover:text-baume-white hover:border-baume-burgundy transition-all"
												>
													+ Ajouter
												</button>
											</Link>
										))}
									</div>
									{related.length > 3 && (
										<Link
											to="/shop/produit"
											className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-baume-burgundy hover:underline underline-offset-4"
										>
											Voir tout <ArrowRight className="h-3 w-3" />
										</Link>
									)}
								</div>
							)}

							{/* ── Infos livraison / retours — horizontal ── */}
							<div className="rounded-3xl border border-baume-border bg-baume-white p-5 shadow-sm">
								<div className="flex items-center justify-center gap-6 flex-wrap">
									<InfoChip
										icon={Truck}
										title="Livraison 2 à 5 jours"
										sub="Offerte dès 60 CHF"
									/>
									<div className="hidden sm:block w-px h-10 bg-baume-border" />
									<InfoChip
										icon={Store}
										title="Retrait boutique"
										sub="Rue du Rhône 15, GE"
									/>
									<div className="hidden sm:block w-px h-10 bg-baume-border" />
									<InfoChip
										icon={ShieldCheck}
										title="Retours 30 jours"
										sub="Gratuit en Suisse"
									/>
								</div>
							</div>

							{/* ── Besoin d'aide ── */}
							<div className="rounded-3xl bg-baume-taupe/25 border border-baume-border p-5 flex gap-3 items-start shadow-sm">
								<MessageCircle className="h-5 w-5 text-baume-burgundy mt-0.5 shrink-0" />
								<div>
									<p className="font-editorial italic text-[19px] text-baume-burgundy">
										Besoin d'aide pour choisir ?
									</p>
									<p className="text-[13px] leading-[21px] text-baume-charcoal/70">
										Nos expertes vous répondent avec douceur et précision.{" "}
										<Link to="/contact" className="baume-link">
											Parlez-nous
										</Link>
									</p>
								</div>
							</div>

							{/* ── Laisser un avis ── */}
							<div className="rounded-3xl border border-baume-border bg-baume-white p-5 flex items-center justify-between gap-4 shadow-sm">
								<div>
									<p className="text-[13px] font-semibold text-baume-charcoal">
										Vous avez essayé ce produit ?
									</p>
									<p className="text-[12px] text-baume-charcoal/55 mt-0.5">
										Partagez votre expérience avec la communauté.
									</p>
								</div>

								<a
									href="#avis-clients"
									className="shrink-0 h-9 px-4 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition-colors inline-flex items-center"
								>
									Laisser un avis
								</a>
							</div>

							{/* ── Accordéons fins — style éditorial ── */}
							<Accordion
								type="single"
								collapsible
								className="divide-y divide-baume-border border-t border-baume-border"
							>
								{[
									{
										value: "composition",
										icon: <HeartIcon />,
										label: "Composition du produit",
										content: product.composition,
									},
									{
										value: "livraison",
										icon: <TruckIcon />,
										label: "Livraisons & Retours",
										content:
											"Livraison Suisse 2-3 jours (6.90 CHF, offerte dès 60 CHF). Europe 3-5 jours. Retrait boutique Genève. Retours sous 30 jours hors produits d'hygiène intime ouverts.",
									},
									{
										value: "utilisation",
										icon: <CheckIcon />,
										label: "Conseils d'utilisations",
										content: product.how_to_use,
									},
									{
										value: "fabrication",
										icon: <GlobeIcon />,
										label: "Provenance & Fabrication",
										content: product.fabrication,
									},
									{
										value: "description",
										icon: <InfoIcon />,
										label: "Description",
										content: product.description,
									},
								].map(({ value, icon, label, content }) => (
									<AccordionItem
										key={value}
										value={value}
										className="border-none"
									>
										<AccordionTrigger className="py-4 hover:no-underline group [&>svg]:hidden">
											<span className="flex items-center gap-3 flex-1">
												<span className="text-baume-charcoal/50 shrink-0">
													{icon}
												</span>
												<span className="font-editorial text-[17px] text-baume-charcoal group-data-[state=open]:text-baume-burgundy transition-colors">
													{label}
												</span>
											</span>
											<PlusMinusIcon />
										</AccordionTrigger>
										<AccordionContent className="text-[13px] leading-[22px] text-baume-charcoal/65 pb-4 pl-7">
											{content}
										</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						</div>
					</div>
				</div>
			</section>

			{/* ── Section avis clients avec résumé ── */}
			<ReviewSection
				product={product}
				allReviews={allReviews}
				onNewReview={async (data) => {
					const newReview = await submitReview(data);
					const updated = await getReviews(product.id);
					setAllReviews(updated);
				}}
			/>

			{/* ── Sections personnalisées pleine largeur ── */}
			{customSections.length > 0 && (
				<section className="bg-baume-white border-t border-baume-border">
					<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16">
						{/* Header éditorial */}
						<div className="max-w-2xl mb-12">
							<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
								Conseils & détails
							</p>
							<h2 className="font-editorial text-[32px] md:text-[42px] text-baume-charcoal leading-tight">
								Tout savoir sur ce produit
							</h2>
							<p className="mt-4 text-[15px] text-baume-charcoal/65 leading-[24px]">
								Nos expertes vous guident pour tirer le meilleur de votre
								produit, avec des conseils d’utilisation, d’entretien et de
								choix adaptés à votre routine.
							</p>
						</div>

						{/* Grid sections */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
							{customSections.map((section) => (
								<div
									key={section.id}
									className="rounded-3xl border border-baume-border bg-baume-ivory/40 p-6 md:p-7"
								>
									<h3 className="font-editorial text-[22px] text-baume-charcoal mb-4">
										{section.title}
									</h3>

									{section.images?.length > 0 && (
										<div className="grid grid-cols-2 gap-2 mb-4">
											{section.images.map((src, i) => (
												<img
													key={i}
													src={src}
													alt={`${section.title} ${i + 1}`}
													className="w-full h-32 object-cover rounded-xl"
												/>
											))}
										</div>
									)}

									<div>{section.content}</div>
								</div>
							))}
						</div>

						{/* Bloc complémentaire (évite le vide) */}
						<div className="mt-14 grid md:grid-cols-3 gap-6">
							<div className="rounded-2xl border border-baume-border p-5 bg-baume-white">
								<p className="font-semibold text-baume-charcoal text-[14px] mb-2">
									💡 Astuce
								</p>
								<p className="text-[13px] text-baume-charcoal/65 leading-[22px]">
									Pour des résultats optimaux, utilisez ce produit régulièrement
									et intégrez-le dans une routine cohérente adaptée à votre
									corps.
								</p>
							</div>

							<div className="rounded-2xl border border-baume-border p-5 bg-baume-white">
								<p className="font-semibold text-baume-charcoal text-[14px] mb-2">
									🌿 Philosophie
								</p>
								<p className="text-[13px] text-baume-charcoal/65 leading-[22px]">
									Nos produits privilégient des ingrédients sûrs, traçables et
									respectueux de votre équilibre intime.
								</p>
							</div>

							<div className="rounded-2xl border border-baume-border p-5 bg-baume-white">
								<p className="font-semibold text-baume-charcoal text-[14px] mb-2">
									🔁 Routine
								</p>
								<p className="text-[13px] text-baume-charcoal/65 leading-[22px]">
									Associez ce produit avec d'autres essentiels pour créer une
									routine bien-être complète et durable.
								</p>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* ── Produits associés (bas de page) ── */}
			{related.length > 0 && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16">
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
						<div>
							<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
								Sélection associée
							</p>
							<h2 className="font-editorial text-[30px] md:text-[40px] text-baume-charcoal">
								Vous aimerez aussi
							</h2>
						</div>
						<Link
							to="/shop/produit"
							className="inline-flex items-center gap-2 text-[14px] font-semibold text-baume-burgundy hover:underline underline-offset-4"
						>
							Voir le shop <ArrowRight className="h-4 w-4" />
						</Link>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
						{related.map((p) => (
							<ProductCard
								key={p.id}
								product={p}
								onQuickAdd={(prod) => addItem(prod, { quantity: 1 })}
							/>
						))}
					</div>
				</section>
			)}

			{/* ── Sticky mobile ── */}
			<div className="lg:hidden sticky bottom-0 z-30 bg-baume-white border-t border-baume-border p-3 flex items-center gap-3">
				<div className="min-w-0">
					<p className="text-[11px] text-baume-charcoal/60 leading-none truncate max-w-[140px]">
						{product.name}
					</p>
					<p className="text-[16px] font-semibold text-baume-charcoal mt-1">
						{product.price.toFixed(2)} CHF
					</p>
				</div>
				<button
					onClick={handleAdd}
					data-testid="sticky-add-to-cart-mobile"
					disabled={!product.available}
					className="flex-1 h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] disabled:opacity-50"
				>
					{product.available ? "Ajouter" : "Indisponible"}
				</button>
			</div>
		</div>
	);
}

// ─── Composant puce infos livraison ─────────────────────────────────────────
function InfoChip({ icon: Icon, title, sub }) {
	return (
		<div className="flex flex-col items-center gap-1.5 text-center">
			<span className="h-9 w-9 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center">
				<Icon className="h-4 w-4" />
			</span>
			<p className="text-[12px] font-semibold text-baume-charcoal leading-tight">
				{title}
			</p>
			<p className="text-[11px] text-baume-charcoal/55">{sub}</p>
		</div>
	);
}

// ─── Icônes fines pour accordéons ────────────────────────────────────────────
function HeartIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
		</svg>
	);
}
function TruckIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="1" y="3" width="15" height="13" rx="1" />
			<path d="M16 8h4l3 3v5h-7V8z" />
			<circle cx="5.5" cy="18.5" r="2.5" />
			<circle cx="18.5" cy="18.5" r="2.5" />
		</svg>
	);
}
function CheckIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M9 12l2 2 4-4" />
		</svg>
	);
}
function GlobeIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	);
}
function InfoIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="16" x2="12" y2="12" />
			<line x1="12" y1="8" x2="12.01" y2="8" />
		</svg>
	);
}
function PlusMinusIcon() {
	return (
		<>
			<span className="ml-auto shrink-0 text-baume-charcoal/40 group-data-[state=open]:hidden">
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</span>
			<span className="ml-auto shrink-0 text-baume-burgundy hidden group-data-[state=open]:inline">
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				>
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</span>
		</>
	);
}

// ─── (ancien InfoLine conservé si utilisé ailleurs) ──────────────────────────
export function InfoLine({ icon: Icon, title, text }) {
	return (
		<div className="flex items-center gap-3 p-4">
			<span className="h-10 w-10 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center shrink-0">
				<Icon className="h-5 w-5" />
			</span>
			<div>
				<p className="text-[14px] font-semibold text-baume-charcoal">{title}</p>
				<p className="text-[12px] text-baume-charcoal/65">{text}</p>
			</div>
		</div>
	);
}
