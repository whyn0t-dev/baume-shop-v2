import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ArticleCard from "../components/ArticleCard";
import { getGuides, getGuide } from "../lib/api";
import { ArrowRight, BookOpen, MessageCircle } from "lucide-react";

export function GuidesIndexPage() {
	const [guides, setGuides] = useState([]);

	useEffect(() => {
		getGuides()
			.then(setGuides)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="guides-page" className="bg-baume-ivory">
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb items={[{ label: "Guides & conseils" }]} />
			</div>

			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-14">
				<div className="rounded-[32px] border border-baume-border bg-baume-white px-6 md:px-10 lg:px-12 py-10 md:py-14">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-4">
						Ressources
					</p>

					<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
						<div>
							<h1 className="font-editorial text-[42px] md:text-[60px] leading-[1.04] text-baume-charcoal max-w-[820px]">
								Guides & conseils{" "}
								<span className="italic text-baume-burgundy">
									pour avancer en confiance
								</span>
								.
							</h1>

							<p className="mt-5 text-[17px] leading-[29px] text-baume-charcoal/70 max-w-[700px]">
								Rédigés avec nos expertes, revus par notre gynécologue
								partenaire. Tout ce qu'il faut savoir, sans jargon.
							</p>
						</div>

						<Link
							to="/contact"
							className="h-12 px-6 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
						>
							Poser une question <ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>

			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
				<div className="mb-8 flex items-center gap-2 text-baume-burgundy">
					<BookOpen className="h-5 w-5" />
					<p className="text-[12px] uppercase tracking-[0.2em] font-semibold">
						Tous les guides
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
					{guides.map((g, i) => (
						<ArticleCard key={g.slug} guide={g} featured={i === 0} />
					))}
				</div>
			</section>
		</div>
	);
}

export function GuideDetailPage() {
	const { slug } = useParams();
	const [guide, setGuide] = useState(null);

	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "instant" });
		getGuide(slug)
			.then(setGuide)
			.catch(() => setGuide(null));
	}, [slug]);

	if (!guide) {
		return (
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-24 text-center text-baume-charcoal/60">
				Chargement…
			</div>
		);
	}

	return (
		<div data-testid="guide-detail-page" className="bg-baume-ivory">
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb
					items={[{ label: "Guides", to: "/guides" }, { label: guide.title }]}
				/>
			</div>

			<article className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-14">
				<div className="max-w-[920px] mx-auto">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-4">
						{guide.category}
					</p>

					<h1 className="font-editorial text-[42px] md:text-[60px] leading-[1.04] text-baume-charcoal">
						{guide.title}
					</h1>

					<p className="mt-4 text-[14px] text-baume-charcoal/60">
						{guide.read_time} de lecture
					</p>

					<div className="mt-8 aspect-[16/9] rounded-[28px] overflow-hidden border border-baume-border bg-baume-white">
						<img
							src={guide.image}
							alt={guide.title}
							className="w-full h-full object-cover"
						/>
					</div>

					<p className="mt-8 font-editorial italic text-[24px] md:text-[28px] leading-[36px] text-baume-burgundy">
						{guide.excerpt}
					</p>

					<div className="mt-8 rounded-3xl border border-baume-border bg-baume-white p-6 md:p-10">
						<div className="text-[17px] leading-[31px] text-baume-charcoal/85 whitespace-pre-line">
							{guide.content}
						</div>
					</div>

					<div className="mt-10 p-6 md:p-8 rounded-3xl bg-baume-taupe/25 border border-baume-border flex flex-col md:flex-row md:items-center gap-5">
						<MessageCircle className="h-7 w-7 text-baume-burgundy shrink-0" />

						<div className="flex-1">
							<p className="font-editorial text-[24px] italic text-baume-burgundy">
								Besoin d'un conseil personnalisé ?
							</p>
							<p className="mt-2 text-[15px] text-baume-charcoal/75">
								Nos expertes vous répondent avec douceur et précision, en
								boutique ou à distance.
							</p>
						</div>

						<Link
							to="/contact"
							className="h-11 px-6 inline-flex items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]"
						>
							Parlez-nous
						</Link>
					</div>
				</div>
			</article>
		</div>
	);
}
