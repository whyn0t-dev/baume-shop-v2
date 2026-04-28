import React from "react";
import { Truck, ShieldCheck, RotateCcw, Heart } from "lucide-react";
import { TRUST_ITEMS } from "../lib/constants";

const ICON_MAP = {
	truck: Truck,
	shield: ShieldCheck,
	rotate: RotateCcw,
	heart: Heart,
};

export default function TrustBar() {
	return (
		<section
			data-testid="trust-bar"
			className="bg-baume-taupe/30 border-y border-baume-border"
		>
			<div className="baume-container py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
				{TRUST_ITEMS.map((item) => {
					const Icon = ICON_MAP[item.icon] || ShieldCheck;
					return (
						<div key={item.title} className="flex items-start gap-3">
							<span className="shrink-0 h-11 w-11 rounded-full bg-baume-white text-baume-burgundy inline-flex items-center justify-center">
								<Icon className="h-5 w-5" />
							</span>
							<div>
								<p className="text-[14px] font-semibold text-baume-charcoal">
									{item.title}
								</p>
								<p className="text-[13px] text-baume-charcoal/70 leading-[20px]">
									{item.desc}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
