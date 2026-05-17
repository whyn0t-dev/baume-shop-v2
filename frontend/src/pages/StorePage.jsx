import React, { useEffect, useState } from "react";
import Breadcrumb from "../components/Breadcrumb";
import ExpertCard from "../components/ExpertCard";
import {
	Clock,
	MapPin,
	Phone,
	Calendar,
	ArrowRight,
	Sparkles,
} from "lucide-react";
import { getExperts } from "../lib/api";
import { Link } from "react-router-dom";

export default function StorePage() {
	const [experts, setExperts] = useState([]);

	useEffect(() => {
		getExperts()
			.then(setExperts)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="store-page" className="bg-baume-ivory">
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb items={[{ label: "Boutique Genève" }]} />
			</div>

			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-14">
				<div className="relative rounded-[32px] overflow-hidden border border-baume-border aspect-[16/10] md:aspect-[21/8] bg-baume-white">
					<img
						src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1800&q=85"
						alt="Boutique Baume Genève"
						className="w-full h-full object-cover"
						loading="eager"
					/>
					<div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/30 to-transparent" />
					<div className="absolute inset-0 flex items-end p-6 md:p-12">
						<div className="max-w-[720px] text-baume-white">
							<p className="text-[12px] uppercase tracking-[0.22em] text-baume-white/80 font-semibold mb-3">
								Notre boutique
							</p>
							<h1 className="font-editorial text-[42px] md:text-[64px] leading-[1.02]">
								Un cocon au cœur <span className="italic">de Genève</span>
							</h1>
							<p className="mt-4 text-[16px] md:text-[18px] leading-[28px] text-baume-white/85 max-w-[560px]">
								Un lieu calme pour être conseillée, découvrir les produits et
								prendre le temps de choisir.
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
				<aside className="lg:col-span-4 space-y-5">
					<div className="lg:sticky lg:top-[150px] bg-baume-white border border-baume-border rounded-3xl p-6 md:p-8 space-y-5">
						<Info icon={MapPin} title="Adresse">
							Rue du Rhône 15, 1204 Genève
						</Info>

						<Info icon={Clock} title="Horaires">
							<span>Mardi – Vendredi · 10h – 19h</span>
							<span>Samedi · 10h – 18h</span>
							<span>Dimanche & Lundi · fermé</span>
						</Info>

						<Info icon={Phone} title="Téléphone">
							+41 22 000 00 00
						</Info>

						<Info icon={Calendar} title="Rendez-vous">
							Conseil personnalisé sur réservation.
						</Info>

						<Link
							to="/contact"
							className="mt-3 inline-flex h-12 px-6 items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
						>
							Prendre rendez-vous <ArrowRight className="h-4 w-4" />
						</Link>
					</div>

					<div className="rounded-3xl overflow-hidden border border-baume-border aspect-[4/3] bg-baume-white">
						<iframe
							title="Carte Baume Genève"
							src="https://www.openstreetmap.org/export/embed.html?bbox=6.142,46.200,6.162,46.210&layer=mapnik&marker=46.205,6.152"
							className="w-full h-full"
							loading="lazy"
						/>
					</div>
				</aside>

				<main className="lg:col-span-8">
					<div className="rounded-3xl bg-baume-white border border-baume-border p-6 md:p-10">
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
							Sur place
						</p>
						<h2 className="font-editorial text-[34px] md:text-[46px] leading-[1.08] text-baume-charcoal max-w-[760px]">
							Une expérience calme, intime et experte.
						</h2>
						<p className="mt-5 text-[17px] leading-[29px] text-baume-charcoal/75 max-w-[720px]">
							Nous avons pensé la boutique comme un lieu de dialogue : pas de
							jargon, pas de pression de vente. Une conseillère prend le temps,
							seule avec vous, pour comprendre votre besoin et trouver la bonne
							solution.
						</p>

						<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
							<MiniFeature title="Conseil discret" />
							<MiniFeature title="Retrait boutique" />
							<MiniFeature title="Ateliers mensuels" />
						</div>
					</div>

					<div className="mt-8 grid grid-cols-2 gap-4">
						<div className="aspect-square rounded-3xl overflow-hidden border border-baume-border">
							<img
								src="https://images.unsplash.com/photo-1714648893954-3744b033f226?crop=entropy&cs=srgb&fm=jpg&w=900&q=80"
								alt=""
								className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
							/>
						</div>
						<div className="aspect-square rounded-3xl overflow-hidden border border-baume-border">
							<img
								src="https://images.unsplash.com/photo-1745565610492-b70156cec381?crop=entropy&cs=srgb&fm=jpg&w=900&q=80"
								alt=""
								className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
							/>
						</div>
						<div className="aspect-[21/9] rounded-3xl overflow-hidden border border-baume-border col-span-2">
							<img
								src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1800&q=80"
								alt=""
								className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
							/>
						</div>
					</div>

					<div className="mt-12">
						<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
							<div>
								<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-2">
									En boutique
								</p>
								<h3 className="font-editorial text-[30px] md:text-[38px] text-baume-charcoal">
									Nos expertes à votre écoute
								</h3>
							</div>
							<Link to="/ateliers" className="baume-link">
								Voir les ateliers
							</Link>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{experts.slice(0, 2).map((e) => (
								<ExpertCard key={e.id} expert={e} />
							))}
						</div>
					</div>
				</main>
			</section>
		</div>
	);
}

function Info({ icon: Icon, title, children }) {
	return (
		<div className="flex gap-3">
			<span className="h-10 w-10 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center shrink-0">
				<Icon className="h-5 w-5" />
			</span>
			<div>
				<p className="font-semibold text-baume-charcoal">{title}</p>
				<div className="mt-1 flex flex-col text-baume-charcoal/70 text-[15px] leading-[23px]">
					{children}
				</div>
			</div>
		</div>
	);
}

function MiniFeature({ title }) {
	return (
		<div className="rounded-2xl bg-baume-ivory border border-baume-border px-4 py-4 flex items-center gap-3">
			<Sparkles className="h-4 w-4 text-baume-burgundy shrink-0" />
			<span className="text-[14px] font-medium text-baume-charcoal">
				{title}
			</span>
		</div>
	);
}
