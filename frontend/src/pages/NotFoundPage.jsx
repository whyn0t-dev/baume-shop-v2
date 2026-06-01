import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";

export default function NotFoundPage() {
	return (
		<div className="min-h-[80vh] bg-baume-ivory flex items-center justify-center px-5">
			<div className="max-w-[560px] w-full text-center">
				{/* Numéro 404 éditorial */}
				<p className="font-editorial text-[120px] md:text-[160px] leading-none text-baume-burgundy/10 select-none">
					404
				</p>

				<div className="-mt-6 md:-mt-10">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
						Page introuvable
					</p>
					<h1 className="font-editorial text-[36px] md:text-[48px] leading-[1.1] text-baume-charcoal">
						Cette page n'existe pas
					</h1>
					<p className="mt-4 text-[15px] leading-[26px] text-baume-charcoal/60 max-w-[420px] mx-auto">
						La page que vous cherchez a peut-être été déplacée, supprimée ou n'a
						jamais existé. Pas de panique — voici quelques pistes.
					</p>
				</div>

				{/* Actions */}
				<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
					<Link
						to="/"
						className="h-12 px-7 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
					>
						Retour à l'accueil
						<ArrowRight className="h-4 w-4" />
					</Link>
					<Link
						to="/shop/produit"
						className="h-12 px-7 rounded-full border border-baume-border bg-baume-white text-baume-charcoal font-semibold text-[14px] inline-flex items-center gap-2 hover:border-baume-burgundy transition"
					>
						<Search className="h-4 w-4" />
						Voir nos produits
					</Link>
				</div>

				{/* Liens rapides */}
				<div className="mt-12 pt-8 border-t border-baume-border">
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/40 font-semibold mb-5">
						Pages populaires
					</p>
					<div className="flex flex-wrap justify-center gap-3">
						{[
							{ label: "Shop", to: "/shop/produit" },
							{ label: "Guides", to: "/guides" },
							{ label: "Ateliers", to: "/ateliers" },
							{ label: "À propos", to: "/a-propos" },
							{ label: "Contact", to: "/contact" },
							{ label: "FAQ", to: "/faq" },
						].map((link) => (
							<Link
								key={link.to}
								to={link.to}
								className="h-9 px-4 rounded-full border border-baume-border bg-baume-white text-baume-charcoal/70 text-[13px] font-medium hover:border-baume-burgundy hover:text-baume-burgundy transition"
							>
								{link.label}
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
