import React, { useState } from "react";
import {
	Mail,
	Phone,
	ArrowRight,
	Sparkles,
	Heart,
	Copy,
	ChevronDown,
	Gift,
} from "lucide-react";

const EXPERTS = [
	{
		name: "Loris Cavalieri",
		role: "Personal Trainer spécialisé dans les transitions hormonales féminines",
		offer: "Bilan Ménopause Offert",
		description:
			"45 min pour comprendre ce qui se passe et repartir avec un plan d’action concret.",
		code: "BAUME_LORIS",
		contactType: "Téléphone",
		contactIcon: Phone,
		image: "/images/image-loris-cavalieri.webp",
		sections: [
			{
				title: "Qui est Loris ?",
				text: "Personal Trainer à Genève depuis 9 ans. Reconverti par passion après un voyage fondateur en Thaïlande, il accompagne les femmes dans les transitions hormonales, notamment la péri-ménopause et la ménopause.",
			},
			{
				title: "Pourquoi cette spécialisation ?",
				text: "Face à de nombreuses clientes touchées par la péri-ménopause ou la ménopause, Loris a choisi de se former en profondeur pour proposer un accompagnement concret, humain et adapté.",
			},
			{
				title: "Comment il travaille ?",
				text: "Son suivi individuel, en cabinet à Genève ou en ligne, aide à retrouver de l’énergie, mieux dormir, gérer le stress, renforcer son corps et reprendre confiance. En 12 semaines, l’objectif est de repartir avec un corps plus fort et une meilleure compréhension de soi.",
			},
			{
				title: "Comment utiliser le code promo ?",
				text: "Contacte Loris directement par téléphone en mentionnant ton code promo Baume au moment de la prise de rendez-vous.",
			},
		],
	},
	{
		name: "Alicia Orelli",
		role: "Coach spécialisée dans la reconnexion au corps, à l’intimité et à la puissance intérieure",
		offer: "Séance découverte offerte",
		description:
			"Un espace pour te poser, être entendue, et comprendre quel accompagnement te correspond vraiment.",
		code: "BAUME_ALICIA",
		contactType: "Email : info@feminisance.ch",
		contactIcon: Mail,
		image: "/images/image-alicia-orelli.webp",
		sections: [
			{
				title: "Qui est Alicia ?",
				text: "Alicia accompagne les femmes dans la reconnexion à leur corps, leur intimité et leur puissance intérieure. Son parcours personnel autour du vaginisme, de l’endométriose, des ovaires polykystiques et de la PMA nourrit aujourd’hui son approche.",
			},
			{
				title: "Pourquoi cette spécialisation ?",
				text: "Après des années d’errance médicale et de honte silencieuse, Alicia a fait de son expérience une mission : permettre à chaque femme d’accéder aux ressources et à l’accompagnement dont elle aurait eu besoin plus tôt.",
			},
			{
				title: "Comment elle travaille ?",
				text: "Son approche est holistique, humaine et sans jugement. Elle propose des coachings individuels, des cercles de parole et des ressources en ligne pour accompagner le vaginisme, le cycle, la PMA ou simplement la reconnexion à soi.",
			},
			{
				title: "Comment utiliser le code ?",
				text: "Contacte Alicia directement par email en mentionnant ton code promo Baume au moment de la prise de rendez-vous.",
			},
		],
	},
];

export default function NosExperts() {
	const [openItems, setOpenItems] = useState({});

	function toggleItem(expertName, sectionTitle) {
		setOpenItems((current) => ({
			...current,
			[expertName]: current[expertName] === sectionTitle ? null : sectionTitle,
		}));
	}

	return (
		<main className="bg-baume-white text-baume-charcoal">
			<section className="relative overflow-hidden bg-baume-ivory">
				<div className="w-full px-6 lg:px-10 py-20 md:py-28">
					<div className="max-w-5xl">
						<p className="inline-flex items-center gap-2 rounded-full bg-baume-white px-4 py-2 text-[13px] font-semibold text-baume-burgundy border border-baume-border">
							<Sparkles className="h-4 w-4" />
							Nos coachs
						</p>

						<h1 className="mt-6 text-[42px] md:text-[68px] font-semibold leading-[0.95] tracking-tight text-baume-burgundy">
							Un accompagnement ancré dans votre réalité.
						</h1>

						<p className="mt-6 max-w-2xl text-[17px] md:text-[19px] leading-[30px] text-baume-charcoal/70">
							Des experts qui vous ressemblent, choisis pour leur écoute, leur
							douceur et leur capacité à accompagner les transitions du corps
							avec justesse.
						</p>
					</div>
				</div>
			</section>

			<section className="w-full px-6 lg:px-10 py-16 md:py-24">
				<div className="grid grid-cols-1 gap-14">
					{EXPERTS.map((expert, index) => {
						const ContactIcon = expert.contactIcon;
						const openedSection = openItems[expert.name];

						return (
							<article
								key={expert.name}
								className="rounded-[36px] border border-baume-border bg-baume-white overflow-hidden shadow-[0_18px_60px_rgba(61,42,42,0.08)]"
							>
								<div
									className={`grid grid-cols-1 lg:grid-cols-12 gap-0 ${
										index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
									}`}
								>
									<div className="lg:col-span-5 flex items-center justify-center p-8">
										<div className="flex flex-col items-center text-center">
											<div className="w-[220px] h-[220px] rounded-full overflow-hidden shadow-[0_18px_45px_rgba(61,42,42,0.15)]">
												<img
													src={expert.image}
													alt={expert.name}
													className="w-full h-full object-cover"
												/>
											</div>
										</div>
									</div>

									<div className="lg:col-span-7 p-7 md:p-10 lg:p-12">
										<div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
											<div>
												<h2 className="mt-3 text-[34px] md:text-[46px] font-semibold leading-tight text-baume-burgundy">
													{expert.name}
												</h2>

												<p className="mt-3 text-[16px] leading-[25px] text-baume-charcoal/65 max-w-2xl">
													{expert.role}
												</p>
											</div>

											<div className="rounded-[24px] bg-baume-burgundy text-baume-white p-5 border border-baume-burgundy shadow-[0_14px_35px_rgba(61,42,42,0.18)] shrink-0 xl:min-w-[260px]">
												<p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-baume-taupe font-semibold">
													<Gift className="h-4 w-4" />
													Code promo
												</p>

												<p className="mt-3 rounded-full bg-baume-white px-4 py-3 text-center text-[18px] font-semibold tracking-[0.08em] text-baume-burgundy">
													{expert.code}
												</p>

												<p className="mt-3 flex items-center gap-2 text-[13px] text-baume-white/70">
													<ContactIcon className="h-4 w-4 text-baume-taupe" />
													{expert.contactType}
												</p>
											</div>
										</div>

										<div className="mt-8 rounded-[24px] bg-baume-ivory border border-baume-border p-6">
											<div className="flex items-start gap-3">
												<Heart className="h-5 w-5 text-baume-burgundy shrink-0 mt-1" />
												<div>
													<h3 className="text-[22px] font-semibold text-baume-burgundy">
														{expert.offer}
													</h3>
													<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/70">
														{expert.description}
													</p>
												</div>
											</div>
										</div>

										<div className="mt-8 space-y-3">
											{expert.sections.map((section) => {
												const isOpen = openedSection === section.title;

												return (
													<div
														key={section.title}
														className="rounded-[22px] border border-baume-border bg-baume-white overflow-hidden"
													>
														<button
															type="button"
															onClick={() =>
																toggleItem(expert.name, section.title)
															}
															className="w-full px-5 py-5 flex items-center justify-between gap-4 text-left hover:bg-baume-ivory/60 transition-colors"
														>
															<span className="text-[18px] font-semibold text-baume-burgundy">
																{section.title}
															</span>

															<ChevronDown
																className={`h-5 w-5 text-baume-burgundy shrink-0 transition-transform ${
																	isOpen ? "rotate-180" : ""
																}`}
															/>
														</button>

														{isOpen && (
															<div className="px-5 pb-5">
																<p className="text-[14px] leading-[24px] text-baume-charcoal/70">
																	{section.text}
																</p>
															</div>
														)}
													</div>
												);
											})}
										</div>

										<div className="mt-8 flex flex-col sm:flex-row gap-3">
											<button
												type="button"
												onClick={() =>
													navigator.clipboard?.writeText(expert.code)
												}
												className="h-12 px-6 rounded-full border border-baume-border text-baume-charcoal font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:bg-baume-ivory transition-colors"
											>
												<Copy className="h-4 w-4" />
												Copier le code promo
											</button>

											<a
												href={
													expert.contactType.includes("Email")
														? "mailto:info@feminisance.ch"
														: "tel:+41799509099"
												}
												className="h-12 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark transition-colors"
											>
												Prendre contact
												<ArrowRight className="h-4 w-4" />
											</a>
										</div>
									</div>
								</div>
							</article>
						);
					})}
				</div>
			</section>
		</main>
	);
}
