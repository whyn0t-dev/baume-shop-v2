import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Loader2 } from "lucide-react";

export default function NewsletterUnsubscribePage() {
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token");
	const [status, setStatus] = useState("loading"); // loading | success | already | error

	useEffect(() => {
		if (!token) {
			setStatus("error");
			return;
		}

		api
			.get(`/newsletter/unsubscribe?token=${token}`)
			.then((r) => {
				if (r.data.already_unsubscribed) {
					setStatus("already");
				} else {
					setStatus("success");
				}
			})
			.catch(() => setStatus("error"));
	}, [token]);

	return (
		<div className="min-h-[70vh] bg-baume-ivory flex items-center justify-center px-5">
			<div className="max-w-[480px] w-full text-center">
				{status === "loading" && (
					<>
						<Loader2 className="h-8 w-8 animate-spin text-baume-burgundy mx-auto mb-4" />
						<p className="text-[15px] text-baume-charcoal/60">
							Traitement en cours…
						</p>
					</>
				)}

				{status === "success" && (
					<>
						<div className="w-16 h-16 rounded-full bg-baume-burgundy/10 flex items-center justify-center mx-auto mb-6">
							<span className="text-2xl">✓</span>
						</div>
						<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
							Désabonnement
						</p>
						<h1 className="font-editorial text-[32px] text-baume-charcoal mb-4">
							Vous êtes désabonnée
						</h1>
						<p className="text-[14px] text-baume-charcoal/65 leading-relaxed mb-8">
							Vous ne recevrez plus nos emails newsletter. Vous pouvez vous
							réinscrire à tout moment depuis le bas de notre site.
						</p>
						<Link
							to="/"
							className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
						>
							Retour à l'accueil
						</Link>
					</>
				)}

				{status === "already" && (
					<>
						<div className="w-16 h-16 rounded-full bg-baume-ivory border border-baume-border flex items-center justify-center mx-auto mb-6">
							<span className="text-2xl">👋</span>
						</div>
						<h1 className="font-editorial text-[32px] text-baume-charcoal mb-4">
							Déjà désabonnée
						</h1>
						<p className="text-[14px] text-baume-charcoal/65 leading-relaxed mb-8">
							Vous étiez déjà désabonnée de notre newsletter.
						</p>
						<Link
							to="/"
							className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
						>
							Retour à l'accueil
						</Link>
					</>
				)}

				{status === "error" && (
					<>
						<div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
							<span className="text-2xl">✕</span>
						</div>
						<h1 className="font-editorial text-[32px] text-baume-charcoal mb-4">
							Lien invalide
						</h1>
						<p className="text-[14px] text-baume-charcoal/65 leading-relaxed mb-8">
							Ce lien de désabonnement est invalide ou a déjà été utilisé.
							Contactez-nous si vous souhaitez vous désabonner.
						</p>
						<Link
							to="/contact"
							className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
						>
							Nous contacter
						</Link>
					</>
				)}
			</div>
		</div>
	);
}
