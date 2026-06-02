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
import { hasConsent, resetConsent } from "../lib/consent";

export default function StorePage() {
	const [experts, setExperts] = useState([]);

	const [functionalConsent, setFunctionalConsent] = useState(
		hasConsent("functional"),
	);

	useEffect(() => {
		const handler = (e) => {
			setFunctionalConsent(e.detail?.functional === true);
		};
		window.addEventListener("baume:consent", handler);
		return () => window.removeEventListener("baume:consent", handler);
	}, []);

	useEffect(() => {
		getExperts()
			.then(setExperts)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="store-page" className="bg-baume-ivory">
			{/* Breadcrumb */}
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb items={[{ label: "Boutique Genève" }]} />
			</div>

			{/* ── Hero ── */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8">
				<div className="relative rounded-[32px] overflow-hidden border border-baume-border aspect-[16/9] md:aspect-[21/7] bg-baume-white">
					<img
						src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1800&q=85"
						alt="Boutique Baume Genève"
						className="w-full h-full object-cover"
						loading="eager"
					/>
					<div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
					<div className="absolute inset-0 flex items-center p-8 md:p-14">
						<div className="max-w-[600px] text-baume-white">
							<p className="text-[11px] uppercase tracking-[0.3em] text-baume-white/70 font-semibold mb-4">
								Notre boutique · Genève
							</p>
							<h1 className="font-editorial text-[38px] md:text-[60px] leading-[1.05]">
								Un cocon au cœur <span className="italic">de Genève</span>
							</h1>
							<p className="mt-4 text-[15px] md:text-[17px] leading-[27px] text-baume-white/80 max-w-[480px]">
								Un lieu calme pour être conseillée, découvrir les produits et
								prendre le temps de choisir.
							</p>
							<Link
								to="/contact"
								className="mt-7 inline-flex h-12 px-6 items-center gap-2 rounded-full bg-baume-white text-baume-burgundy font-semibold text-[14px] hover:bg-baume-ivory transition-colors"
							>
								Prendre rendez-vous <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* ── Infos pratiques + carte ── */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
					{/* Infos pratiques */}
					<div className="rounded-3xl bg-baume-white border border-baume-border p-6 md:p-8 space-y-6">
						<div>
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-1">
								Informations pratiques
							</p>
							<h2 className="font-editorial text-[26px] text-baume-charcoal">
								Venez nous rendre visite
							</h2>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
							<Info icon={MapPin} title="Adresse">
								Rue du Rhône 15, 1204 Genève
							</Info>
							<Info icon={Phone} title="Téléphone">
								+41 22 000 00 00
							</Info>
							<Info icon={Clock} title="Horaires">
								<span>Mardi – Vendredi · 10h – 19h</span>
								<span>Samedi · 10h – 18h</span>
								<span className="text-baume-charcoal/40">
									Dimanche & Lundi · fermé
								</span>
							</Info>
							<Info icon={Calendar} title="Rendez-vous">
								Conseil personnalisé sur réservation.
							</Info>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-baume-border">
							<MiniFeature title="Conseil discret" />
							<MiniFeature title="Retrait boutique" />
							<MiniFeature title="Ateliers mensuels" />
						</div>
					</div>

					{/* Carte */}
					<div className="rounded-3xl overflow-hidden border border-baume-border bg-baume-white min-h-[300px] lg:min-h-0">
						{functionalConsent ? (
							<iframe
								title="Carte Baume Genève"
								src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2829.675550058614!2d6.155088776217653!3d46.20328038382383!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x478c65196573d253%3A0xe72e5048e03017b3!2sBaume%20Shop!5e1!3m2!1sfr!2sfr!4v1780391929312!5m2!1sfr!2sfr"
								className="w-full h-full min-h-[300px]"
								style={{ border: 0 }}
								allowFullScreen
								loading="lazy"
								referrerPolicy="no-referrer-when-downgrade"
							/>
						) : (
							<div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-baume-ivory gap-4 p-8 text-center">
								<MapPin className="h-8 w-8 text-baume-charcoal/30" />
								<p className="text-[14px] font-semibold text-baume-charcoal">
									Carte non disponible
								</p>
								<p className="text-[13px] text-baume-charcoal/55 max-w-[240px]">
									Acceptez les cookies fonctionnels pour afficher la carte
									Google Maps.
								</p>
								<button
									onClick={resetConsent}
									className="h-9 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition"
								>
									Gérer mes cookies
								</button>
							</div>
						)}
					</div>
				</div>
			</section>

			{/* ── Notre espace ── */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-8">
				<div className="rounded-3xl bg-baume-white border border-baume-border p-6 md:p-10">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
						<div>
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
								Sur place
							</p>
							<h2 className="font-editorial text-[30px] md:text-[40px] leading-[1.1] text-baume-charcoal">
								Une expérience calme, intime et experte.
							</h2>
							<p className="mt-5 text-[15px] leading-[26px] text-baume-charcoal/70">
								Nous avons pensé la boutique comme un lieu de dialogue : pas de
								jargon, pas de pression de vente. Une conseillère prend le
								temps, seule avec vous, pour comprendre votre besoin et trouver
								la bonne solution.
							</p>
						</div>

						{/* Photos grille */}
						<div className="grid grid-cols-2 gap-3">
							<div className="aspect-square rounded-2xl overflow-hidden border border-baume-border">
								<img
									src="https://images.unsplash.com/photo-1714648893954-3744b033f226?crop=entropy&cs=srgb&fm=jpg&w=600&q=80"
									alt=""
									className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
								/>
							</div>
							<div className="aspect-square rounded-2xl overflow-hidden border border-baume-border">
								<img
									src="https://images.unsplash.com/photo-1745565610492-b70156cec381?crop=entropy&cs=srgb&fm=jpg&w=600&q=80"
									alt=""
									className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── Nos expertes ── */}
			{experts.length > 0 && (
				<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-16">
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
						<div>
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-2">
								En boutique
							</p>
							<h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal">
								Nos expertes à votre écoute
							</h2>
						</div>
						<Link
							to="/ateliers"
							className="baume-link text-[14px] font-semibold"
						>
							Voir les ateliers →
						</Link>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{experts.slice(0, 2).map((e) => (
							<ExpertCard key={e.id} expert={e} />
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function Info({ icon: Icon, title, children }) {
	return (
		<div className="flex gap-3">
			<span className="h-9 w-9 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center shrink-0 mt-0.5">
				<Icon className="h-4 w-4" />
			</span>
			<div>
				<p className="font-semibold text-baume-charcoal text-[14px]">{title}</p>
				<div className="mt-1 flex flex-col text-baume-charcoal/65 text-[13px] leading-[22px]">
					{children}
				</div>
			</div>
		</div>
	);
}

function MiniFeature({ title }) {
	return (
		<div className="rounded-xl bg-baume-ivory border border-baume-border px-3 py-3 flex items-center gap-2">
			<Sparkles className="h-3.5 w-3.5 text-baume-burgundy shrink-0" />
			<span className="text-[13px] font-medium text-baume-charcoal">
				{title}
			</span>
		</div>
	);
}
