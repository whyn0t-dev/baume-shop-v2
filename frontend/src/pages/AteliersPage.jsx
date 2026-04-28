import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ExpertCard from "../components/ExpertCard";
import { getExperts } from "../lib/api";
import { Calendar, MapPin, Clock } from "lucide-react";

const WORKSHOPS = [
	{
		title: "Découvrir la cup en douceur",
		date: "Jeudi 5 mars · 18h30",
		expert: "Laura Benoit",
		spots: "8 places",
		price: "Gratuit",
		description:
			"Atelier pratique : pliages, insertion, entretien, questions réponses.",
	},
	{
		title: "Post-partum : ressources & soins",
		date: "Mardi 17 mars · 19h00",
		expert: "Camille Rousseau",
		spots: "10 places",
		price: "CHF 25",
		description:
			"Comprendre les saignements, les soins adaptés, et se préparer aux premières semaines.",
	},
	{
		title: "Péri-ménopause : parlons-en",
		date: "Samedi 22 mars · 11h00",
		expert: "Dr. Sophie Meier",
		spots: "12 places",
		price: "CHF 35",
		description:
			"Échange avec une gynécologue sur la sécheresse, le sommeil, et l'équilibre hormonal.",
	},
];

export default function AteliersPage() {
	const [experts, setExperts] = useState([]);
	useEffect(() => {
		getExperts()
			.then(setExperts)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="ateliers-page" className="bg-baume-ivory">
			<div className="baume-container pt-8">
				<Breadcrumb items={[{ label: "Ateliers & experts" }]} />
			</div>
			<div className="baume-container py-10 md:py-14">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Rencontres mensuelles
				</p>
				<h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05] text-baume-charcoal max-w-[720px]">
					Nos expertes vous répondent,{" "}
					<span className="italic">en boutique</span>.
				</h1>
				<p className="mt-5 text-[17px] leading-[28px] text-baume-charcoal/70 max-w-[640px]">
					Ateliers petits groupes, conversations honnêtes, experts disponibles.
					Réservation requise.
				</p>
			</div>

			{/* Workshops */}
			<section className="baume-container pb-16">
				<h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-8">
					Prochains ateliers
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
					{WORKSHOPS.map((w) => (
						<article
							key={w.title}
							className="bg-baume-white border border-baume-border rounded-2xl p-6 flex flex-col gap-3"
						>
							<span className="text-[12px] uppercase tracking-[0.15em] text-baume-burgundy font-semibold">
								{w.price}
							</span>
							<h3 className="font-editorial text-[22px] leading-[28px] text-baume-charcoal">
								{w.title}
							</h3>
							<p className="text-[14px] leading-[22px] text-baume-charcoal/75">
								{w.description}
							</p>
							<div className="mt-auto pt-3 text-[13px] text-baume-charcoal/70 border-t border-baume-border space-y-1.5">
								<p className="inline-flex items-center gap-1.5">
									<Calendar className="h-4 w-4 text-baume-burgundy" /> {w.date}
								</p>
								<p className="inline-flex items-center gap-1.5">
									<MapPin className="h-4 w-4 text-baume-burgundy" /> Boutique
									Genève
								</p>
								<p className="inline-flex items-center gap-1.5">
									<Clock className="h-4 w-4 text-baume-burgundy" /> {w.spots}
								</p>
								<p className="text-baume-charcoal/60">Animé par {w.expert}</p>
							</div>
							<Link
								to="/contact"
								className="h-10 px-5 inline-flex items-center justify-center rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold"
							>
								Réserver ma place
							</Link>
						</article>
					))}
				</div>
			</section>

			{/* Experts */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-16 md:py-20">
					<h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-8">
						Notre équipe d'expertes
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
						{experts.map((e) => (
							<ExpertCard key={e.id} expert={e} />
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
