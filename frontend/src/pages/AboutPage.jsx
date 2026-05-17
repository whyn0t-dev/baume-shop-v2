import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ExpertCard from "../components/ExpertCard";
import {
	Heart,
	Sparkles,
	Users,
	Leaf,
	ArrowRight,
	MapPin,
	ShieldCheck,
} from "lucide-react";
import { getExperts } from "../lib/api";

const VALUES = [
	{
		icon: Heart,
		title: "Écoute & bienveillance",
		desc: "Un conseil jamais moralisateur, toujours adapté à votre étape de vie.",
	},
	{
		icon: Sparkles,
		title: "Exigence de sélection",
		desc: "Chaque produit est testé et validé par notre équipe avant intégration.",
	},
	{
		icon: Leaf,
		title: "Impact mesuré",
		desc: "Matières certifiées, emballages réduits, fabrication européenne dès que possible.",
	},
	{
		icon: Users,
		title: "Communauté informée",
		desc: "Guides, ateliers, expertes — pour comprendre et décider en confiance.",
	},
];

export default function AboutPage() {
	const [experts, setExperts] = React.useState([]);

	React.useEffect(() => {
		getExperts()
			.then(setExperts)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="about-page" className="bg-baume-ivory">
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb items={[{ label: "À propos" }]} />
			</div>

			{/* Hero */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16 items-center">
				<div className="lg:col-span-6">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-4">
						Notre mission
					</p>

					<h1 className="font-editorial text-[42px] md:text-[64px] leading-[1.02] text-baume-charcoal">
						Une boutique pensée pour accompagner les femmes{" "}
						<span className="italic text-baume-burgundy">avec douceur</span>.
					</h1>

					<p className="mt-6 text-[18px] leading-[30px] text-baume-charcoal/75 max-w-[620px]">
						Baume est née à Genève d’une envie simple : réunir des produits
						intimes, menstruels et bien-être soigneusement sélectionnés, avec un
						vrai conseil humain. Ici, on prend le temps d’écouter, d’expliquer
						et d’orienter sans jugement.
					</p>

					<div className="mt-8 flex flex-wrap gap-3">
						<Link
							to="/shop/besoin"
							className="h-12 px-7 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
						>
							Trouver par besoin <ArrowRight className="h-4 w-4" />
						</Link>

						<Link
							to="/boutique-geneve"
							className="h-12 px-7 inline-flex items-center gap-2 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-white transition-colors"
						>
							<MapPin className="h-4 w-4" />
							Boutique Genève
						</Link>
					</div>
				</div>

				<div className="lg:col-span-6">
					<div className="relative aspect-[5/6] rounded-[32px] overflow-hidden border border-baume-border bg-baume-white">
						<img
							src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80"
							alt="L'équipe Baume"
							loading="lazy"
							className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
						/>

						<div className="absolute left-5 right-5 bottom-5 rounded-2xl bg-baume-white/92 backdrop-blur px-5 py-4 border border-baume-border">
							<p className="font-editorial text-[22px] text-baume-charcoal">
								Conseil discret, produits choisis, accompagnement humain.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Repères */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-14 md:pb-20">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
					<div className="rounded-3xl bg-baume-white border border-baume-border p-6 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
						<Heart className="h-6 w-6 text-baume-burgundy mb-4" />
						<h3 className="font-editorial text-[24px] text-baume-charcoal">
							À votre rythme
						</h3>
						<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/68">
							Une approche douce pour choisir sans pression, selon votre besoin
							du moment.
						</p>
					</div>

					<div className="rounded-3xl bg-baume-white border border-baume-border p-6 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
						<ShieldCheck className="h-6 w-6 text-baume-burgundy mb-4" />
						<h3 className="font-editorial text-[24px] text-baume-charcoal">
							Sélection exigeante
						</h3>
						<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/68">
							Chaque référence est pensée pour sa qualité, son utilité et son
							confort.
						</p>
					</div>

					<div className="rounded-3xl bg-baume-white border border-baume-border p-6 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
						<Sparkles className="h-6 w-6 text-baume-burgundy mb-4" />
						<h3 className="font-editorial text-[24px] text-baume-charcoal">
							Plus qu’une boutique
						</h3>
						<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/68">
							Guides, ateliers et expertes pour comprendre, échanger et avancer.
						</p>
					</div>
				</div>
			</section>

			{/* Values */}
			<section className="bg-baume-white border-y border-baume-border">
				<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16 md:py-20">
					<div className="max-w-[700px] mb-12">
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
							Notre engagement
						</p>
						<h2 className="font-editorial text-[34px] md:text-[46px] leading-[1.08] text-baume-charcoal">
							Des valeurs simples, tenues au quotidien.
						</h2>
						<p className="mt-4 text-[17px] leading-[28px] text-baume-charcoal/70">
							Nous voulons rendre le choix plus clair, plus humain et plus
							rassurant, surtout sur des sujets parfois intimes ou mal
							expliqués.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
						{VALUES.map((v) => (
							<div
								key={v.title}
								className="group rounded-3xl border border-baume-border p-6 md:p-8 bg-baume-white flex gap-4 hover:bg-baume-ivory hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300"
							>
								<span className="shrink-0 h-12 w-12 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center group-hover:bg-baume-white transition-colors">
									<v.icon className="h-5 w-5" />
								</span>

								<div>
									<h3 className="font-editorial text-[24px] text-baume-charcoal">
										{v.title}
									</h3>
									<p className="mt-2 text-[15px] leading-[24px] text-baume-charcoal/75">
										{v.desc}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Founders / Experts */}
			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16 md:py-20">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
					<div>
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
							L’équipe
						</p>
						<h2 className="font-editorial text-[34px] md:text-[46px] leading-[1.08] text-baume-charcoal max-w-[640px]">
							Des expertes qui accompagnent avec clarté et bienveillance.
						</h2>
						<p className="mt-4 text-[16px] leading-[26px] text-baume-charcoal/70 max-w-[640px]">
							Des profils complémentaires pour répondre aux questions liées au
							cycle, à l’intimité, à la maternité et au bien-être.
						</p>
					</div>

					<Link to="/ateliers" className="baume-link">
						Voir les ateliers
					</Link>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
					{experts.map((e) => (
						<ExpertCard key={e.id} expert={e} />
					))}
				</div>
			</section>

			{/* CTA */}
			<section className="bg-baume-burgundy text-baume-white border-t border-baume-border">
				<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16 md:py-20 text-center">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-white/70 font-semibold mb-3">
						Nous rencontrer
					</p>

					<h2 className="font-editorial text-[34px] md:text-[48px] leading-[1.08] max-w-[720px] mx-auto">
						Venez nous voir à Genève ou découvrez nos sélections en ligne.
					</h2>

					<p className="mt-4 text-[16px] md:text-[18px] text-baume-white/85 max-w-[580px] mx-auto">
						Rue du Rhône 15. Conseil, retrait de commande, ateliers mensuels.
					</p>

					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<Link
							to="/boutique-geneve"
							className="h-12 px-8 inline-flex items-center rounded-full bg-baume-white text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors"
						>
							Voir la boutique
						</Link>

						<Link
							to="/shop/produit"
							className="h-12 px-8 inline-flex items-center rounded-full border border-baume-white/70 text-baume-white font-semibold text-[15px] hover:bg-white/10 transition-colors"
						>
							Découvrir nos produits
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
