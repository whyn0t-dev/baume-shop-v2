import React from "react";
import {
	Sparkles,
	Heart,
	Users,
	Feather,
	MessageCircleHeart,
	ShieldCheck,
	Compass,
} from "lucide-react";
import NeedLanding from "../components/NeedLanding";

// ─────────────────────────────────────────────────────────────────────────────
// Page « Sexualité » — /shop/besoin/sexualite
// Le contenu (textes, intentions, produits associés) est défini ici ;
// la mise en page est partagée avec la page Intimité (NeedLanding).
// ─────────────────────────────────────────────────────────────────────────────

const SEXUALITE = {
	testId: "sexualite-page",
	label: "Sexualité",
	needSlug: "sexualite",
	// Catégories de produits rattachées à la page (en plus du besoin « sexualite »)
	categories: ["lubrifiants", "accessoires-cadeaux"],
	accent: {
		soft: "#F1DED4",
		glow: "radial-gradient(circle, rgba(211,177,160,0.55) 0%, rgba(211,177,160,0.18) 45%, transparent 70%)",
	},
	hero: {
		eyebrow: "Plaisir · confiance · liberté",
		title: ["Le plaisir,", "à votre rythme."],
		lead: "Une sélection pensée pour explorer sans pression, seule ou à deux. Des produits choisis pour leur qualité et leur douceur, et une équipe qui en parle simplement.",
		cta: "Voir la sélection",
		ctaSecondary: "Comment bien choisir",
		quote: "Il n'existe pas une bonne façon de vivre sa sexualité : seulement la vôtre.",
	},
	pillars: [
		{
			icon: Compass,
			title: "Explorer sans tabou",
			text: "Mieux connaître ses envies est un chemin personnel. Nos repères vous aident à avancer à votre rythme, sans injonction.",
		},
		{
			icon: ShieldCheck,
			title: "Des produits de confiance",
			text: "Formules testées, matériaux sûrs pour le corps et marques sélectionnées une à une par l'équipe Baume.",
		},
		{
			icon: MessageCircleHeart,
			title: "En parler, simplement",
			text: "En boutique à Genève ou par message, nous répondons à vos questions avec bienveillance et en toute discrétion.",
		},
	],
	selection: {
		eyebrow: "La sélection Baume",
		title: "Trouvez ce qui vous ressemble",
		lead: "Choisissez une intention : nous vous montrons les produits qui y répondent le mieux.",
	},
	intents: [
		{ key: "all", label: "Tout voir", icon: Sparkles },
		{
			key: "solo",
			label: "Pour soi",
			icon: Heart,
			hint: "Prendre du temps pour soi et découvrir ce qui vous fait du bien.",
			keywords: ["solo", "pour soi", "vibr", "stimul", "masseur", "self", "clitor", "wand", "jouet"],
		},
		{
			key: "duo",
			label: "À deux",
			icon: Users,
			hint: "Des idées pour enrichir les moments partagés, dans la complicité.",
			keywords: ["duo", "couple", "a deux", "partenaire", "massage", "preservatif", "jeu", "bougie"],
		},
		{
			key: "douceur",
			label: "Confort & douceur",
			icon: Feather,
			hint: "Pour plus de glisse et de confort, en toute délicatesse.",
			categories: ["lubrifiants"],
			keywords: ["lubrifiant", "gel", "glisse", "hydrat", "secheresse", "douceur", "aloe", "huile"],
		},
	],
	guide: {
		eyebrow: "Bien choisir",
		title: "Quatre repères pour vous lancer.",
		lead: "Pas besoin de tout savoir avant de commencer. Ces quelques questions suffisent à orienter votre choix.",
		steps: [
			{
				title: "Partez de votre envie",
				text: "Découverte, moment pour soi ou envie de nouveauté à deux : votre intention guide le choix bien plus que la technique.",
			},
			{
				title: "Privilégiez la qualité",
				text: "Choisissez des matériaux sûrs pour le corps, faciles à nettoyer, et des formules sans ingrédients superflus.",
			},
			{
				title: "Lubrifiant : vérifiez la compatibilité",
				text: "Un lubrifiant à base d'eau convient à tous les usages et à tous les matériaux. Les formules siliconées durent plus longtemps mais ne s'utilisent pas avec les accessoires en silicone.",
			},
			{
				title: "Allez-y progressivement",
				text: "Commencez simplement, prenez le temps d'écouter vos sensations et communiquez avec votre partenaire. Le confort avant tout.",
			},
		],
	},
	expert: {
		name: "Alicia Orelli",
		title: "Un espace pour en parler, sans jugement.",
		text: "Alicia accompagne les femmes dans la reconnexion à leur corps et à leur intimité. Un premier échange pour poser vos questions et comprendre ce qui vous correspond.",
	},
	faqTitle: "On en parle librement.",
	faq: [
		{
			q: "Par quoi commencer quand on découvre ?",
			a: "Commencez par ce qui vous attire le plus, sans pression. Un lubrifiant de qualité et un accessoire simple, facile à prendre en main, sont souvent un bon point de départ. Notre équipe peut vous orienter en boutique ou par message.",
		},
		{
			q: "Comment choisir son lubrifiant ?",
			a: "À base d'eau : polyvalent, compatible avec tous les accessoires et les préservatifs, il se rince facilement. À base de silicone : plus longue durée de glisse, mais à éviter avec les accessoires en silicone. Les formules courtes, sans parfum, conviennent aux peaux sensibles.",
		},
		{
			q: "Comment entretenir un accessoire ?",
			a: "Nettoyez-le avant et après chaque utilisation à l'eau tiède et au savon doux (ou avec un nettoyant adapté), séchez-le bien puis rangez-le dans sa pochette, à l'abri de la poussière. Suivez toujours les indications du fabricant.",
		},
		{
			q: "Puis-je être conseillée en toute discrétion ?",
			a: "Oui. Vous pouvez nous écrire via le formulaire de contact ou le chat, ou passer à la boutique à Genève : nous prenons le temps de vous répondre, avec écoute et discrétion.",
		},
		{
			q: "Puis-je retourner un produit ?",
			a: "Pour des raisons d'hygiène, les produits intimes ouverts ne peuvent pas être repris. Les produits non ouverts peuvent être retournés sous 30 jours.",
		},
	],
	guideKeywords: ["lubrifiant", "sexual", "plaisir", "intim", "desir", "couple"],
	contact: {
		title: "Une question personnelle ?",
		text: "Notre équipe vous répond avec écoute et discrétion, par message ou en boutique à Genève.",
	},
};

export default function SexualitePage() {
	return <NeedLanding config={SEXUALITE} />;
}
