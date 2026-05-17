import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

// ── Algorithme de scoring ────────────────────────────────────────────────────
// Chaque réponse donne des points aux catégories de produits
const CATEGORY_SCORES = {
	// Q1 — Type de cycle
	q1_regulier: {
		"culottes-menstruelles": 2,
		"cups-disques": 2,
		"serviettes-lavables": 1,
	},
	q1_irregulier: { "culottes-menstruelles": 3, "bien-etre": 2 },
	q1_hormonal: { "soins-intimes": 2, "bien-etre": 2 },
	q1_menopause: { "soins-intimes": 3, "bien-etre": 3 },

	// Q2 — Type de flux
	q2_tres_leger: { "culottes-menstruelles": 1, "serviettes-lavables": 2 },
	q2_leger: { "culottes-menstruelles": 2, "serviettes-lavables": 2 },
	q2_moyen: { "culottes-menstruelles": 2, "cups-disques": 2 },
	q2_abondant: { "cups-disques": 3, "culottes-menstruelles": 2 },
	q2_tres_abondant: { "cups-disques": 3, "culottes-menstruelles": 3 },

	// Q3 — Inconforts (multi)
	q3_douleurs: { "bien-etre": 3, "soins-intimes": 1 },
	q3_ballonnements: { "bien-etre": 2 },
	q3_fatigue: { "bien-etre": 3 },
	q3_humeur: { "bien-etre": 2 },
	q3_maux_tete: { "bien-etre": 2 },
	q3_aucun: {},

	// Q4 — Protection actuelle
	q4_serviettes: { "culottes-menstruelles": 3, "serviettes-lavables": 2 },
	q4_tampons: { "cups-disques": 3, "culottes-menstruelles": 1 },
	q4_cup: { "cups-disques": 1, "soins-intimes": 2 },
	q4_culotte: { "culottes-menstruelles": 1, "bien-etre": 1 },
	q4_disque: { "cups-disques": 1 },
	q4_plusieurs: { "culottes-menstruelles": 2, "cups-disques": 1 },

	// Q5 — Sensibilité
	q5_tres_sensible: { "soins-intimes": 3, "bien-etre": 2 },
	q5_parfois: { "soins-intimes": 2 },
	q5_non: {},

	// Q6 — Bien-être intime
	q6_soins_quotidien: { "soins-intimes": 3 },
	q6_lubrifiants: { "soins-intimes": 3, "bien-etre": 1 },
	q6_flore: { "soins-intimes": 3 },
	q6_pas_priorite: {},

	// Q7 — Routine actuelle
	q7_aucune: { "bien-etre": 3, "soins-intimes": 2 },
	q7_quelques: { "bien-etre": 2, "soins-intimes": 1 },
	q7_complete: { "soins-intimes": 1 },
	q7_nouvelle: { "bien-etre": 3, "soins-intimes": 2 },

	// Q8 — Sport / aquatique
	q8_regulier: { "cups-disques": 3, "soins-intimes": 1 },
	q8_occasionnel: { "cups-disques": 1 },
	q8_non: {},

	// Q9 — Objectifs (multi)
	q9_douleurs: { "bien-etre": 3 },
	q9_peau: { "soins-intimes": 3 },
	q9_hormones: { "bien-etre": 3 },
	q9_eco: {
		"culottes-menstruelles": 2,
		"cups-disques": 2,
		"serviettes-lavables": 2,
	},
	q9_quotidien: { "soins-intimes": 2, "bien-etre": 1 },

	// Q10 — Préférences matières (multi)
	q10_coton: { "culottes-menstruelles": 2, "serviettes-lavables": 2 },
	q10_sans_perturbateurs: { "soins-intimes": 2, "bien-etre": 1 },
	q10_vegan: { "soins-intimes": 1, "bien-etre": 1 },
	q10_oeko: { "culottes-menstruelles": 1, "serviettes-lavables": 1 },
	q10_aucune: {},
};

// ── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
	{
		id: "q1",
		question: "Quel est votre type de cycle ?",
		type: "single",
		options: [
			{
				key: "regulier",
				label: "Régulier",
				sub: "Environ 28 jours",
				emoji: "🌙",
			},
			{
				key: "irregulier",
				label: "Irrégulier",
				sub: "Cycles variables",
				emoji: "🌊",
			},
			{
				key: "hormonal",
				label: "Sous contraceptif hormonal",
				sub: "Pilule, stérilet...",
				emoji: "💊",
			},
			{
				key: "menopause",
				label: "Ménopause / périménopause",
				sub: "Transition hormonale",
				emoji: "🌸",
			},
		],
	},
	{
		id: "q2",
		question: "Comment décririez-vous votre flux menstruel ?",
		type: "single",
		options: [
			{
				key: "tres_leger",
				label: "Très léger",
				sub: "Quelques gouttes",
				emoji: "💧",
			},
			{
				key: "leger",
				label: "Léger",
				sub: "Protection légère suffisante",
				emoji: "💧💧",
			},
			{
				key: "moyen",
				label: "Moyen",
				sub: "Protection standard",
				emoji: "💧💧💧",
			},
			{
				key: "abondant",
				label: "Abondant",
				sub: "Changements fréquents",
				emoji: "🌊",
			},
			{
				key: "tres_abondant",
				label: "Très abondant",
				sub: "Fuites possibles",
				emoji: "🌊🌊",
			},
		],
	},
	{
		id: "q3",
		question: "Quels inconforts ressentez-vous pendant vos règles ?",
		type: "multi",
		options: [
			{ key: "douleurs", label: "Douleurs / crampes", emoji: "⚡" },
			{ key: "ballonnements", label: "Ballonnements", emoji: "🫧" },
			{ key: "fatigue", label: "Fatigue intense", emoji: "😴" },
			{ key: "humeur", label: "Sautes d'humeur", emoji: "🌪️" },
			{ key: "maux_tete", label: "Maux de tête", emoji: "💆" },
			{ key: "aucun", label: "Aucun inconfort particulier", emoji: "✨" },
		],
	},
	{
		id: "q4",
		question: "Quelle protection utilisez-vous actuellement ?",
		type: "single",
		options: [
			{ key: "serviettes", label: "Serviettes jetables", emoji: "📋" },
			{ key: "tampons", label: "Tampons", emoji: "🔵" },
			{ key: "cup", label: "Cup menstruelle", emoji: "🥤" },
			{ key: "culotte", label: "Culotte menstruelle", emoji: "👙" },
			{ key: "disque", label: "Disque menstruel", emoji: "💿" },
			{ key: "plusieurs", label: "Plusieurs combinées", emoji: "🔄" },
		],
	},
	{
		id: "q5",
		question: "Êtes-vous sensible aux produits chimiques ou parfums ?",
		type: "single",
		options: [
			{
				key: "tres_sensible",
				label: "Oui, peau très sensible",
				sub: "Réactions fréquentes",
				emoji: "🌿",
			},
			{
				key: "parfois",
				label: "Parfois",
				sub: "Selon les produits",
				emoji: "🤔",
			},
			{ key: "non", label: "Non, pas particulièrement", emoji: "👍" },
		],
	},
	{
		id: "q6",
		question: "Quel est votre rapport au bien-être intime ?",
		type: "single",
		options: [
			{
				key: "soins_quotidien",
				label: "Soins doux au quotidien",
				sub: "Hygiène et confort",
				emoji: "🛁",
			},
			{
				key: "lubrifiants",
				label: "Lubrifiants naturels",
				sub: "Confort et plaisir",
				emoji: "🌊",
			},
			{
				key: "flore",
				label: "Équilibre de la flore intime",
				sub: "Santé vaginale",
				emoji: "🌱",
			},
			{
				key: "pas_priorite",
				label: "Pas ma priorité actuellement",
				emoji: "➡️",
			},
		],
	},
	{
		id: "q7",
		question: "Quelle est votre routine bien-être actuelle ?",
		type: "single",
		options: [
			{
				key: "aucune",
				label: "Aucune routine établie",
				sub: "Je veux commencer",
				emoji: "🌱",
			},
			{
				key: "quelques",
				label: "Quelques produits naturels",
				sub: "Routine légère",
				emoji: "🌿",
			},
			{
				key: "complete",
				label: "Routine complète",
				sub: "Compléments, soins, huiles...",
				emoji: "✨",
			},
			{
				key: "nouvelle",
				label: "Je veux tout changer",
				sub: "Nouvelle approche naturelle",
				emoji: "🦋",
			},
		],
	},
	{
		id: "q8",
		question: "Pratiquez-vous une activité sportive ou aquatique ?",
		type: "single",
		options: [
			{
				key: "regulier",
				label: "Oui, régulièrement",
				sub: "Piscine, sport intensif",
				emoji: "🏊",
			},
			{
				key: "occasionnel",
				label: "Occasionnellement",
				sub: "Quelques fois par mois",
				emoji: "🚴",
			},
			{ key: "non", label: "Non", emoji: "🛋️" },
		],
	},
	{
		id: "q9",
		question: "Quels sont vos objectifs bien-être ?",
		type: "multi",
		options: [
			{
				key: "douleurs",
				label: "Réduire les douleurs menstruelles",
				emoji: "💊",
			},
			{ key: "peau", label: "Prendre soin de ma peau et corps", emoji: "🌸" },
			{ key: "hormones", label: "Équilibre hormonal naturel", emoji: "⚖️" },
			{ key: "eco", label: "Alternatives écologiques", emoji: "♻️" },
			{ key: "quotidien", label: "Me sentir mieux au quotidien", emoji: "☀️" },
		],
	},
	{
		id: "q10",
		question: "Avez-vous des préférences sur les matières ou certifications ?",
		type: "multi",
		options: [
			{ key: "coton", label: "Coton bio uniquement", emoji: "🌾" },
			{
				key: "sans_perturbateurs",
				label: "Sans perturbateurs endocriniens",
				emoji: "🚫",
			},
			{ key: "vegan", label: "Vegan et cruelty-free", emoji: "🐰" },
			{ key: "oeko", label: "OEKO-TEX certifié", emoji: "✅" },
			{ key: "aucune", label: "Pas de préférence particulière", emoji: "🤷" },
		],
	},
];

// ── Calcul des recommandations ───────────────────────────────────────────────
function computeRecommendations(answers) {
	const scores = {};

	for (const [qId, value] of Object.entries(answers)) {
		const values = Array.isArray(value) ? value : [value];
		for (const v of values) {
			const key = `${qId}_${v}`;
			const categoryScores = CATEGORY_SCORES[key] || {};
			for (const [cat, pts] of Object.entries(categoryScores)) {
				scores[cat] = (scores[cat] || 0) + pts;
			}
		}
	}

	return Object.entries(scores)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([cat]) => cat);
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function QuizPage() {
	const { user } = useAuth();
	const navigate = useNavigate();

	const [step, setStep] = useState(0); // 0 = intro, 1-10 = questions, 11 = email
	const [answers, setAnswers] = useState({});
	const [email, setEmail] = useState(user?.email || "");
	const [submitting, setSubmitting] = useState(false);

	const currentQuestion = QUESTIONS[step - 1];
	const progress = step === 0 ? 0 : Math.round((step / QUESTIONS.length) * 100);

	function handleSingle(qId, key) {
		setAnswers((prev) => ({ ...prev, [qId]: key }));
		setTimeout(() => setStep((s) => s + 1), 300);
	}

	function handleMulti(qId, key) {
		setAnswers((prev) => {
			const current = Array.isArray(prev[qId]) ? prev[qId] : [];
			if (key === "aucun" || key === "aucune") return { ...prev, [qId]: [key] };
			const filtered = current.filter((k) => k !== "aucun" && k !== "aucune");
			if (filtered.includes(key)) {
				return { ...prev, [qId]: filtered.filter((k) => k !== key) };
			}
			return { ...prev, [qId]: [...filtered, key] };
		});
	}

	function isSelected(qId, key) {
		const val = answers[qId];
		if (Array.isArray(val)) return val.includes(key);
		return val === key;
	}

	async function handleSubmit() {
		if (!email.trim()) return;
		setSubmitting(true);

		try {
			const recommendedCategories = computeRecommendations(answers);

			const payload = {
				email: email.trim(),
				answers,
				recommended_categories: recommendedCategories,
				profile_id: user?.id || null,
			};

			await api.post("/quiz/submit", payload);

			navigate("/quiz/resultats", {
				state: { answers, recommendedCategories, email },
			});
		} catch (err) {
			console.error("Quiz submit error:", err);
			// On navigue quand même vers les résultats
			const recommendedCategories = computeRecommendations(answers);
			navigate("/quiz/resultats", {
				state: { answers, recommendedCategories, email },
			});
		} finally {
			setSubmitting(false);
		}
	}

	// ── Intro ──────────────────────────────────────────────────────────────────
	if (step === 0) {
		return (
			<div className="min-h-[80vh] bg-baume-ivory flex items-center justify-center px-5">
				<div className="max-w-[600px] w-full text-center">
					<span className="inline-block text-[48px] mb-6">🌿</span>
					<p className="text-[12px] uppercase tracking-[0.28em] text-baume-burgundy font-semibold mb-4">
						Quiz bien-être
					</p>
					<h1 className="font-editorial text-[42px] md:text-[56px] text-baume-charcoal leading-[1.05]">
						Trouvez votre routine idéale
					</h1>
					<p className="mt-5 text-[16px] md:text-[18px] text-baume-charcoal/65 leading-[1.7]">
						10 questions pour découvrir les produits Baume faits pour vous.
						Résultats personnalisés et envoyés par email.
					</p>

					<div className="mt-8 flex flex-wrap justify-center gap-4 text-[13px] text-baume-charcoal/55">
						<span className="flex items-center gap-1.5">
							<span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />
							10 questions
						</span>
						<span className="flex items-center gap-1.5">
							<span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />2
							minutes
						</span>
						<span className="flex items-center gap-1.5">
							<span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />
							Résultats gratuits
						</span>
					</div>

					<button
						onClick={() => setStep(1)}
						className="mt-10 h-14 px-10 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[16px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition-colors"
					>
						Commencer le quiz <ArrowRight className="h-5 w-5" />
					</button>
				</div>
			</div>
		);
	}

	// ── Étape email ────────────────────────────────────────────────────────────
	if (step > QUESTIONS.length) {
		return (
			<div className="min-h-[80vh] bg-baume-ivory flex items-center justify-center px-5">
				<div className="max-w-[520px] w-full">
					<div className="rounded-[32px] border border-baume-border bg-baume-white p-8 md:p-10 text-center">
						<span className="text-[48px]">✉️</span>
						<h2 className="font-editorial text-[32px] text-baume-charcoal mt-4">
							Où envoyer vos résultats ?
						</h2>
						<p className="mt-3 text-[15px] text-baume-charcoal/65 leading-[1.7]">
							Recevez vos recommandations personnalisées par email — et
							gardez-les pour votre prochaine commande.
						</p>

						<div className="mt-6 text-left">
							<label className="block text-[13px] font-semibold text-baume-charcoal/70 mb-2">
								Votre email
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="vous@exemple.com"
								className="w-full h-12 rounded-2xl border border-baume-border bg-baume-ivory/50 px-4 text-[14px] text-baume-charcoal outline-none focus:ring-2 focus:ring-baume-taupe"
							/>
						</div>

						<button
							onClick={handleSubmit}
							disabled={submitting || !email.trim()}
							className="mt-6 w-full h-13 py-3.5 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark disabled:opacity-60 transition-colors"
						>
							{submitting ? (
								<Loader2 className="h-5 w-5 animate-spin" />
							) : (
								<>
									Voir mes résultats <ArrowRight className="h-5 w-5" />
								</>
							)}
						</button>

						<button
							onClick={() => {
								const recommendedCategories = computeRecommendations(answers);
								navigate("/quiz/resultats", {
									state: { answers, recommendedCategories, email: "" },
								});
							}}
							className="mt-3 text-[13px] text-baume-charcoal/50 hover:text-baume-charcoal underline underline-offset-2"
						>
							Voir les résultats sans email
						</button>
					</div>
				</div>
			</div>
		);
	}

	// ── Questions ──────────────────────────────────────────────────────────────
	const q = currentQuestion;
	const currentAnswers = answers[q.id];
	const hasAnswer = Array.isArray(currentAnswers)
		? currentAnswers.length > 0
		: !!currentAnswers;

	return (
		<div className="min-h-[80vh] bg-baume-ivory px-5 py-10">
			<div className="max-w-[680px] mx-auto">
				{/* Barre de progression */}
				<div className="mb-8">
					<div className="flex items-center justify-between mb-2">
						<button
							onClick={() => setStep((s) => Math.max(0, s - 1))}
							className="inline-flex items-center gap-1 text-[13px] text-baume-charcoal/50 hover:text-baume-charcoal transition-colors"
						>
							<ArrowLeft className="h-4 w-4" />
							Retour
						</button>
						<span className="text-[13px] text-baume-charcoal/50 font-medium">
							{step} / {QUESTIONS.length}
						</span>
					</div>

					<div className="h-1.5 bg-baume-border rounded-full overflow-hidden">
						<div
							className="h-full bg-baume-burgundy rounded-full transition-all duration-500"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>

				{/* Question */}
				<div className="rounded-[32px] border border-baume-border bg-baume-white p-6 md:p-10">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
						Question {step}
					</p>
					<h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal leading-[1.15] mb-6">
						{q.question}
					</h2>

					{q.type === "multi" && (
						<p className="text-[13px] text-baume-charcoal/50 mb-4">
							Plusieurs réponses possibles
						</p>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{q.options.map((opt) => {
							const selected = isSelected(q.id, opt.key);
							return (
								<button
									key={opt.key}
									type="button"
									onClick={() =>
										q.type === "single"
											? handleSingle(q.id, opt.key)
											: handleMulti(q.id, opt.key)
									}
									className={`relative text-left rounded-2xl border p-4 transition-all ${
										selected
											? "border-baume-burgundy bg-baume-burgundy/5 shadow-sm"
											: "border-baume-border bg-baume-ivory/40 hover:border-baume-burgundy/50 hover:bg-baume-ivory"
									}`}
								>
									<div className="flex items-start gap-3">
										<span className="text-[22px] shrink-0">{opt.emoji}</span>
										<div className="flex-1 min-w-0">
											<p
												className={`text-[14px] font-semibold ${selected ? "text-baume-burgundy" : "text-baume-charcoal"}`}
											>
												{opt.label}
											</p>
											{opt.sub && (
												<p className="text-[12px] text-baume-charcoal/50 mt-0.5">
													{opt.sub}
												</p>
											)}
										</div>
										{selected && (
											<CheckCircle2 className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
										)}
									</div>
								</button>
							);
						})}
					</div>

					{/* Bouton suivant pour les questions multi */}
					{q.type === "multi" && (
						<div className="mt-6 flex justify-end">
							<button
								onClick={() => setStep((s) => s + 1)}
								disabled={!hasAnswer}
								className="h-11 px-7 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark disabled:opacity-40 transition-colors"
							>
								Continuer <ArrowRight className="h-4 w-4" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
