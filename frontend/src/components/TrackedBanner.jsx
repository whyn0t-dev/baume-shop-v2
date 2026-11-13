import React, { useEffect, useRef } from "react";
import { trackBanner } from "../lib/bannerTracking";

// Enveloppe une bannière promotionnelle pour mesurer son CTR.
//
// <TrackedBanner id="home-quiz" label="Bandeau quiz (accueil)">
//   ...contenu de la bannière avec ses liens...
// </TrackedBanner>
//
// • affichage : 50 % de la bannière visible (1 fois par session)
// • clic : tout clic sur un <a> ou <button> à l'intérieur
export default function TrackedBanner({
	id,
	label,
	as: Tag = "div",
	className,
	children,
	...rest
}) {
	const ref = useRef(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || !id) return undefined;

		if (typeof IntersectionObserver === "undefined") {
			trackBanner("view", { id, label });
			return undefined;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
						trackBanner("view", { id, label });
						observer.disconnect();
					}
				});
			},
			{ threshold: [0.5] },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [id, label]);

	const handleClick = (e) => {
		const link = e.target.closest?.("a, button");
		if (!link || !ref.current?.contains(link)) return;
		trackBanner("click", {
			id,
			label,
			target: link.getAttribute("href") || link.textContent?.trim()?.slice(0, 80),
		});
	};

	return (
		<Tag ref={ref} className={className} onClickCapture={handleClick} {...rest}>
			{children}
		</Tag>
	);
}
