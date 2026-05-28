import React, { useEffect, useState } from "react";
import { X, ChevronDown, Shield, BarChart2, Map } from "lucide-react";
import {
	getConsent,
	saveConsent,
	acceptAll,
	rejectAll,
	CATEGORIES,
} from "../lib/consent";

export default function CookieBanner() {
	const [visible, setVisible] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const [choices, setChoices] = useState({
		necessary: true,
		analytics: false,
		functional: false,
	});

	useEffect(() => {
		const consent = getConsent();
		if (!consent) {
			// Délai léger pour ne pas bloquer le rendu initial
			const t = setTimeout(() => setVisible(true), 800);
			return () => clearTimeout(t);
		}
	}, []);

	if (!visible) return null;

	const handleAcceptAll = () => {
		acceptAll();
		setVisible(false);
	};

	const handleRejectAll = () => {
		rejectAll();
		setVisible(false);
	};

	const handleSaveChoices = () => {
		saveConsent(choices);
		setVisible(false);
	};

	const toggle = (category) => {
		if (CATEGORIES[category].required) return;
		setChoices((prev) => ({ ...prev, [category]: !prev[category] }));
	};

	const categoryIcons = {
		necessary: Shield,
		analytics: BarChart2,
		functional: Map,
	};

	return (
		<div className="fixed inset-0 z-[9998] flex items-end justify-center sm:items-end sm:justify-end pointer-events-none">
			{/* Overlay léger */}
			<div className="absolute inset-0 bg-black/10 pointer-events-auto" />

			{/* Bandeau */}
			<div className="relative pointer-events-auto w-full sm:w-[480px] sm:m-5 bg-baume-white rounded-t-3xl sm:rounded-3xl border border-baume-border shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="px-6 pt-6 pb-4 border-b border-baume-border">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-[11px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-1">
								Confidentialité
							</p>
							<h2 className="font-editorial text-[22px] text-baume-charcoal leading-tight">
								Vos préférences cookies
							</h2>
						</div>
						<button
							onClick={handleRejectAll}
							className="h-8 w-8 rounded-full bg-baume-ivory border border-baume-border flex items-center justify-center hover:bg-baume-border transition shrink-0 mt-1"
						>
							<X className="h-3.5 w-3.5 text-baume-charcoal/60" />
						</button>
					</div>
					<p className="mt-3 text-[13px] leading-[20px] text-baume-charcoal/60">
						Nous utilisons des cookies pour améliorer votre expérience, analyser
						notre trafic et afficher notre carte boutique. Vous pouvez choisir
						lesquels accepter.
					</p>
				</div>

				{/* Détails des catégories */}
				{showDetails && (
					<div className="divide-y divide-baume-border border-b border-baume-border max-h-[280px] overflow-y-auto">
						{Object.values(CATEGORIES).map((cat) => {
							const Icon = categoryIcons[cat.id];
							return (
								<div key={cat.id} className="px-6 py-4 flex items-start gap-4">
									<div className="h-9 w-9 rounded-full bg-baume-ivory border border-baume-border flex items-center justify-center shrink-0 mt-0.5">
										<Icon className="h-4 w-4 text-baume-burgundy" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between gap-3">
											<p className="text-[13px] font-semibold text-baume-charcoal">
												{cat.label}
											</p>
											{cat.required ? (
												<span className="text-[11px] px-2 py-0.5 rounded-full bg-baume-ivory border border-baume-border text-baume-charcoal/50 shrink-0">
													Requis
												</span>
											) : (
												<button
													onClick={() => toggle(cat.id)}
													className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
														choices[cat.id]
															? "bg-baume-burgundy"
															: "bg-baume-border"
													}`}
												>
													<span
														className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow transition-transform ${
															choices[cat.id]
																? "translate-x-5"
																: "translate-x-0"
														}`}
													/>
												</button>
											)}
										</div>
										<p className="mt-1 text-[12px] leading-[18px] text-baume-charcoal/55">
											{cat.description}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* Actions */}
				<div className="px-6 py-4 space-y-3">
					{/* Bouton personnaliser */}
					<button
						onClick={() => setShowDetails((v) => !v)}
						className="w-full flex items-center justify-between text-[13px] text-baume-charcoal/60 hover:text-baume-charcoal transition"
					>
						<span>
							{showDetails ? "Masquer les détails" : "Personnaliser mes choix"}
						</span>
						<ChevronDown
							className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
						/>
					</button>

					{/* Boutons principaux */}
					<div className="flex gap-3">
						<button
							onClick={handleRejectAll}
							className="flex-1 h-11 rounded-full border border-baume-border text-baume-charcoal text-[13px] font-semibold hover:bg-baume-ivory transition"
						>
							Refuser
						</button>
						{showDetails ? (
							<button
								onClick={handleSaveChoices}
								className="flex-1 h-11 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition"
							>
								Enregistrer
							</button>
						) : (
							<button
								onClick={handleAcceptAll}
								className="flex-1 h-11 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition"
							>
								Tout accepter
							</button>
						)}
					</div>

					{/* Liens légaux */}
					<p className="text-center text-[11px] text-baume-charcoal/40">
						En continuant, vous acceptez notre{" "}
						<a
							href="/confidentialite"
							className="underline hover:text-baume-burgundy"
						>
							politique de confidentialité
						</a>{" "}
						et nos{" "}
						<a href="/cgv" className="underline hover:text-baume-burgundy">
							CGV
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
