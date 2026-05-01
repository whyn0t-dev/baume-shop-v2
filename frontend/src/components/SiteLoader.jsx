import React, { useEffect, useState } from "react";

export default function SiteLoader() {
	const [leaving, setLeaving] = useState(false);
	const [hide, setHide] = useState(false);

	useEffect(() => {
		const t1 = setTimeout(() => setLeaving(true), 1900);
		const t2 = setTimeout(() => setHide(true), 2500);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, []);

	if (hide) return null;

	return (
		<div
			className={`fixed inset-0 z-[9999] overflow-hidden bg-[#2a0d0b] flex items-center justify-center transition-opacity duration-700 ${
				leaving ? "opacity-0" : "opacity-100"
			}`}
		>
			<div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_35%)]" />

			<div className="relative flex flex-col items-center px-6">
				<div className="mb-5 h-[1px] w-28 bg-baume-white/30" />

				<p className="mb-4 text-baume-white/50 text-[11px] uppercase tracking-[0.35em]">
					Bienvenue
				</p>

				<h1 className="text-baume-white text-[42px] md:text-[64px] font-semibold tracking-[0.22em] uppercase leading-none">
					Baume
				</h1>

				<p className="mt-4 text-baume-white/55 text-[13px] tracking-[0.12em]">
					E-commerce naturel
				</p>

				<div className="mt-8 h-1.5 w-56 rounded-full bg-baume-white/15 overflow-hidden">
					<div className="h-full bg-[#c0b4a6] origin-left animate-loader-bar" />
				</div>

				<p className="mt-4 text-baume-white/35 text-[11px] tracking-[0.2em] uppercase">
					Chargement
				</p>
			</div>
		</div>
	);
}