import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Mail, MapPin } from "lucide-react";
import { NEEDS, PRODUCT_CATS } from "../lib/constants";

export default function Footer() {
	return (
		<footer
			data-testid="site-footer"
			className="bg-baume-burgundy text-baume-white mt-24"
		>
			<div className="baume-container py-16 md:py-24 grid grid-cols-2 md:grid-cols-12 gap-8 md:gap-12">
				<div className="col-span-2 md:col-span-4">
					<span className="font-editorial text-[32px] leading-none">Baume</span>
					<p className="mt-4 text-[14px] leading-[22px] text-baume-white/75 max-w-[280px]">
						Prenez soin de votre intimité à chaque étape de votre vie. Produits
						choisis avec exigence, conseils humains, boutique à Genève.
					</p>
					<div className="mt-8 flex items-center gap-4">
						<a
							href="https://instagram.com"
							aria-label="Instagram"
							className="hover:text-baume-taupe transition-colors"
						>
							<Instagram className="h-5 w-5" />
						</a>
						<a
							href="https://facebook.com"
							aria-label="Facebook"
							className="hover:text-baume-taupe transition-colors"
						>
							<Facebook className="h-5 w-5" />
						</a>
					</div>
				</div>

				<div className="col-span-1 md:col-span-3">
					<p className="text-[12px] uppercase tracking-[0.2em] text-baume-taupe mb-4">
						Par besoin
					</p>
					<ul className="space-y-2 text-[14px]">
						{NEEDS.slice(0, 6).map((n) => (
							<li key={n.slug}>
								<Link
									to={`/shop/besoin/${n.slug}`}
									className="text-baume-white/80 hover:text-baume-white"
								>
									{n.name}
								</Link>
							</li>
						))}
					</ul>
				</div>

				<div className="col-span-1 md:col-span-3">
					<p className="text-[12px] uppercase tracking-[0.2em] text-baume-taupe mb-4">
						Par produit
					</p>
					<ul className="space-y-2 text-[14px]">
						{PRODUCT_CATS.slice(0, 6).map((c) => (
							<li key={c.slug}>
								<Link
									to={`/shop/produit/${c.slug}`}
									className="text-baume-white/80 hover:text-baume-white"
								>
									{c.name}
								</Link>
							</li>
						))}
					</ul>
				</div>

				<div className="col-span-2 md:col-span-2">
					<p className="text-[12px] uppercase tracking-[0.2em] text-baume-taupe mb-4">
						Boutique
					</p>
					<p className="text-[14px] text-baume-white/80 leading-[22px] flex items-start gap-2">
						<MapPin className="h-4 w-4 mt-0.5 shrink-0" />
						<span>
							Rue du Rhône 15
							<br />
							1204 Genève
						</span>
					</p>
					<p className="mt-4 text-[14px] text-baume-white/80 flex items-center gap-2">
						<Mail className="h-4 w-4" />
						<a
							href="mailto:bonjour@baume-shop.com"
							className="hover:text-baume-white"
						>
							bonjour@baume-shop.com
						</a>
					</p>
					<ul className="mt-6 space-y-2 text-[14px]">
						<li>
							<Link
								to="/compte"
								className="text-baume-white/80 hover:text-baume-white"
							>
								Mon compte
							</Link>
						</li>
						<li>
							<Link
								to="/faq"
								className="text-baume-white/80 hover:text-baume-white"
							>
								FAQ
							</Link>
						</li>
						<li>
							<Link
								to="/contact"
								className="text-baume-white/80 hover:text-baume-white"
							>
								Contact
							</Link>
						</li>
						<li>
							<Link
								to="/a-propos"
								className="text-baume-white/80 hover:text-baume-white"
							>
								À propos
							</Link>
						</li>
					</ul>
				</div>
			</div>

			<div className="border-t border-baume-white/10">
				<div className="baume-container py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[12px] text-baume-white/60">
					<p>
						© {new Date().getFullYear()} Baume Sàrl · Tous droits réservés ·
						Conçu à Genève
					</p>
					<ul className="flex flex-wrap items-center gap-4">
						<li>
							<Link
								to="/mentions-legales"
								data-testid="footer-legal-mentions"
								className="hover:text-baume-white"
							>
								Mentions légales
							</Link>
						</li>
						<li>
							<Link
								to="/cgv"
								data-testid="footer-legal-cgv"
								className="hover:text-baume-white"
							>
								CGV
							</Link>
						</li>
						<li>
							<Link
								to="/confidentialite"
								data-testid="footer-legal-privacy"
								className="hover:text-baume-white"
							>
								Confidentialité
							</Link>
						</li>
					</ul>
				</div>
			</div>
		</footer>
	);
}
