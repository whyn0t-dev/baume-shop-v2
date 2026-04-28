import React from "react";

export default function ExpertCard({ expert }) {
	return (
		<article
			data-testid={`expert-card-${expert.id}`}
			className="bg-baume-white border border-baume-border rounded-2xl overflow-hidden flex flex-col"
		>
			<div className="aspect-[4/5] bg-baume-ivory overflow-hidden">
				<img
					src={expert.image}
					alt={expert.name}
					loading="lazy"
					className="w-full h-full object-cover"
				/>
			</div>
			<div className="p-5 flex-1 flex flex-col gap-2">
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy">
					{expert.role}
				</p>
				<h3 className="font-editorial text-[24px] leading-[30px] text-baume-charcoal">
					{expert.name}
				</h3>
				<p className="text-[13px] leading-[20px] text-baume-charcoal/70">
					{expert.bio}
				</p>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{expert.specialties?.map((s) => (
						<span
							key={s}
							className="text-[11px] px-2.5 py-1 rounded-full bg-baume-taupe/30 text-baume-charcoal/80 border border-baume-border"
						>
							{s}
						</span>
					))}
				</div>
			</div>
		</article>
	);
}
