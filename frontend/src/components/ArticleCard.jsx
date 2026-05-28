import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export default function ArticleCard({ guide, featured = false }) {
	return (
		<Link
			to={`/guides/${guide.slug}`}
			data-testid={`article-card-${guide.slug}`}
			className={`group block bg-baume-white border border-baume-border rounded-2xl overflow-hidden transition-all hover:border-baume-burgundy/40 ${featured ? "md:col-span-2" : ""}`}
		>
			<div
				className={`${featured ? "aspect-[16/9]" : "aspect-[4/3]"} overflow-hidden bg-baume-ivory`}
			>
				<img
					src={guide.image}
					alt={guide.title}
					loading="lazy"
					className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
				/>
			</div>
			<div className="p-6 md:p-7 flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[11px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold">
						{guide.category}
					</span>
					<span className="text-[12px] text-baume-charcoal/50">
						{guide.read_time}
					</span>
				</div>
				<h3
					className={`font-editorial text-baume-charcoal ${featured ? "text-[30px] leading-[36px]" : "text-[22px] leading-[28px]"}`}
				>
					{guide.title}
				</h3>
				<p className="text-[14px] leading-[22px] text-baume-charcoal/70">
					{guide.excerpt}
				</p>
				<span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-baume-burgundy group-hover:gap-2 transition-all">
					Lire le guide <ArrowUpRight className="h-4 w-4" />
				</span>
			</div>
		</Link>
	);
}
