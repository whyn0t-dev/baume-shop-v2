import React from "react";
import {
	Sparkles,
	Droplets,
	Leaf,
	Sun,
	HeartHandshake,
	ShieldCheck,
	Flower2,
} from "lucide-react";
import NeedLanding from "../components/NeedLanding";

// ─────────────────────────────────────────────────────────────────────────────
// Page « Intimité » — /shop/besoin/intimite
// Le contenu (textes, intentions, produits associés) est défini ici ;
// la mise en page est partagée avec la page Sexualité (NeedLanding).
// ─────────────────────────────────────────────────────────────────────────────

const INTIMITE = {
	testId: "intimite-page",
	label: "Intimité",
	needSlug: "intimite",
	// Catégories de produits rattachées à la page (en plus du besoin « intimite »)
	categories: ["soins-intimes"],
	accent: {
		soft: "#F8EDC9",
		glow: "radial-gradient(circle, rgba(243,227,172,0.9) 0%, rgba(243,227,172,0.35) 45%, transparent 70%)",
	},
	hero: {
		eyebrow: "Confort · douceur · équilibre",
		title: ["Prendre soin de soi,", "en douceur."],
		lead: "Des soins délicats pour la zone intime, choisis pour respecter votre équilibre naturel au quotidien, à chaque étape de la vie.",
		cta: "Découvrir les soins",
		ctaSecondary: "Les bons gestes",
		quote: "Le confort intime fait partie du bien-être, tout simplement.",
	},
	pillars: [
		{
			icon: Leaf,
			title: "Des formules respectueuses",
			text: "Des soins doux, aux listes d'ingrédients courtes, pensés pour une zone délicate et pour les peaux sensibles.",
		},
		{
			icon: Flower2,
			title: "À chaque étape de la vie",
			text: "Cycle, grossesse, post-partum, péri-ménopause : vos besoins évoluent, notre sélection vous accompagne.",
		},
		{
			icon: HeartHandshake,
			title: "Un conseil humain",
			text: "Une hésitation ? Nos conseillères vous orientent en boutique à Genève ou par message, en toute confidentialité.",
		},
	],
	selection: {
		eyebrow: "La sélection Baume",
		title: "Vos soins du quotidien",
		lead: "Choisissez votre besoin du moment : nous vous montrons les soins les plus adaptés.",
	},
	intents: [
		{ key: "all", label: "Tout voir", icon: Sparkles },
		{
			key: "hygiene",
			label: "Toilette douce",
			icon: Droplets,
			hint: "Des gestes simples pour une toilette délicate, sans agresser.",
			keywords: ["lavant", "nettoyant", "toilette", "hygiene", "savon", "mousse", "gel intime", "lingette"],
		},
		{
			key: "confort",
			label: "Confort & hydratation",
			icon: Sun,
			hint: "Pour apaiser et retrouver une sensation de confort au fil des jours.",
			keywords: ["hydrat", "secheresse", "creme", "baume", "apais", "confort", "huile", "lubrifiant"],
		},
		{
			key: "equilibre",
			label: "Équilibre",
			icon: ShieldCheck,
			hint: "Pour accompagner l'équilibre naturel de la flore intime.",
			categories: ["complements"],
			keywords: ["flore", "probiot", "equilibre", "ph", "complement", "cranberry", "canneberge"],
		},
	],
	guide: {
		eyebrow: "Les bons gestes",
		title: "Quatre repères pour une routine sereine.",
		lead: "Une routine intime n'a pas besoin d'être compliquée. Quelques gestes suffisent à préserver confort et équilibre.",
		steps: [
			{
				title: "Moins, c'est mieux",
				text: "Une toilette externe par jour avec un soin doux suffit. La zone intime se protège naturellement : inutile de multiplier les produits.",
			},
			{
				title: "Choisissez des formules douces",
				text: "Préférez des soins sans parfum ajouté, au pH adapté et aux listes d'ingrédients courtes, surtout si votre peau est sensible.",
			},
			{
				title: "Écoutez votre corps",
				text: "Vos besoins changent selon le cycle, la grossesse ou la péri-ménopause. Adaptez votre routine à ce que vous ressentez.",
			},
			{
				title: "Demandez conseil",
				text: "Un inconfort qui persiste mérite l'avis d'un·e professionnel·le de santé. Pour le choix des soins, notre équipe est là pour vous.",
			},
		],
	},
	expert: {
		name: "Alicia Orelli",
		title: "Se reconnecter à son corps, en confiance.",
		text: "Alicia propose un accompagnement doux et sans jugement pour (re)trouver une relation apaisée avec son corps et son intimité.",
	},
	faqTitle: "Vos questions, nos réponses.",
	faq: [
		{
			q: "Faut-il un soin spécifique pour la zone intime ?",
			a: "La peau de la zone intime est plus fine et son équilibre est particulier. Un soin lavant doux, au pH adapté et sans parfum ajouté, est plus respectueux qu'un gel douche classique.",
		},
		{
			q: "À quelle fréquence faire sa toilette intime ?",
			a: "Une fois par jour suffit en général, uniquement en externe. Une toilette trop fréquente ou trop insistante peut fragiliser l'équilibre naturel.",
		},
		{
			q: "Mes besoins changent avec l'âge, est-ce normal ?",
			a: "Oui. Les variations hormonales liées au cycle, à la grossesse, au post-partum ou à la péri-ménopause peuvent modifier vos sensations. Notre sélection propose des soins adaptés à chaque étape.",
		},
		{
			q: "Que faire en cas d'inconfort persistant ?",
			a: "Nos produits accompagnent le confort au quotidien mais ne remplacent pas un avis médical. Si une gêne persiste, consultez votre médecin, votre gynécologue ou votre sage-femme.",
		},
		{
			q: "Puis-je retourner un soin ?",
			a: "Pour des raisons d'hygiène, les soins intimes ouverts ne peuvent pas être repris. Les produits non ouverts peuvent être retournés sous 30 jours.",
		},
	],
	guideKeywords: ["intim", "menopause", "post-partum", "secheresse", "flore", "inconfort"],
	contact: {
		title: "Besoin d'un conseil personnalisé ?",
		text: "Nos conseillères vous répondent avec douceur et discrétion, par message ou en boutique à Genève.",
	},
};

export default function IntimitePage() {
	return <NeedLanding config={INTIMITE} />;
}
