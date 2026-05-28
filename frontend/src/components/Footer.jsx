import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Mail, MapPin, ArrowRight } from "lucide-react";
import { NEEDS, PRODUCT_CATS } from "../lib/constants";
import { resetConsent } from "../lib/consent";

export default function Footer() {
	return (
		<footer
			data-testid="site-footer"
			className="mt-24 w-full bg-baume-burgundy text-baume-white"
		>
			<div className="w-full px-6 lg:px-10 py-14 md:py-20">
				{/* Newsletter */}
				<div className="rounded-[28px] border border-baume-white/10 bg-baume-white/10 px-6 py-8 md:px-10 md:py-10 mb-14">
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
						<div className="lg:col-span-6">
							<p className="text-[12px] uppercase tracking-[0.22em] text-baume-taupe mb-2">
								Newsletter
							</p>
							<h3 className="text-[26px] md:text-[34px] font-semibold leading-tight">
								Recevez nos conseils, nouveautés et offres.
							</h3>
							<p className="mt-3 text-[14px] leading-[22px] text-baume-white/70 max-w-[560px]">
								Inscrivez-vous pour recevoir nos actualités, sélections produits
								et offres commerciales par email.
							</p>
						</div>

						<form
							className="lg:col-span-6 flex flex-col sm:flex-row gap-3"
							onSubmit={(e) => e.preventDefault()}
						>
							<input
								type="email"
								required
								placeholder="Votre adresse email"
								className="h-12 flex-1 rounded-full border border-baume-white/15 bg-baume-white px-5 text-[14px] text-baume-charcoal placeholder:text-baume-charcoal/45 outline-none focus:ring-2 focus:ring-baume-taupe"
							/>

							<button
								type="submit"
								className="h-12 px-6 rounded-full bg-baume-taupe text-baume-burgundy font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:bg-baume-white transition-colors"
							>
								S’abonner
								<ArrowRight className="h-4 w-4" />
							</button>
						</form>
					</div>

					<p className="mt-4 text-[12px] leading-[18px] text-baume-white/50">
						En vous inscrivant, vous acceptez de recevoir des emails
						publicitaires de Baume. Vous pourrez vous désinscrire à tout moment.
					</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12">
					<div className="lg:col-span-4">
						<Link
							to="/"
							className="inline-block text-[34px] font-semibold leading-none"
						>
							Baume
						</Link>

						<p className="mt-5 text-[14px] leading-[23px] text-baume-white/72 max-w-[340px]">
							Une boutique douce et guidée pour choisir des produits intimes,
							comprendre son corps et avancer sans jugement.
						</p>

						<div className="mt-7 space-y-3">
							<p className="text-[14px] text-baume-white/75 flex items-start gap-2">
								<MapPin className="h-4 w-4 mt-0.5 shrink-0 text-baume-taupe" />
								<span>
									Rue du Rhône 15
									<br />
									1204 Genève
								</span>
							</p>

							<p className="text-[14px] text-baume-white/75 flex items-center gap-2">
								<Mail className="h-4 w-4 shrink-0 text-baume-taupe" />
								<a
									href="mailto:bonjour@baume-shop.com"
									className="hover:text-baume-white"
								>
									bonjour@baume-shop.com
								</a>
							</p>
						</div>

						<div className="mt-7 flex items-center gap-3">
							<a
								href="https://instagram.com"
								aria-label="Instagram"
								className="h-10 w-10 rounded-full border border-baume-white/15 bg-baume-white/5 inline-flex items-center justify-center hover:bg-baume-white hover:text-baume-burgundy transition-colors"
							>
								<Instagram className="h-5 w-5" />
							</a>

							<a
								href="https://facebook.com"
								aria-label="Facebook"
								className="h-10 w-10 rounded-full border border-baume-white/15 bg-baume-white/5 inline-flex items-center justify-center hover:bg-baume-white hover:text-baume-burgundy transition-colors"
							>
								<Facebook className="h-5 w-5" />
							</a>
						</div>
					</div>

					<FooterColumn title="Par besoin">
						{NEEDS.slice(0, 6).map((n) => (
							<FooterLink key={n.slug} to={`/shop/besoin/${n.slug}`}>
								{n.name}
							</FooterLink>
						))}
					</FooterColumn>

					<FooterColumn title="Par produit">
						{PRODUCT_CATS.slice(0, 6).map((c) => (
							<FooterLink key={c.slug} to={`/shop/produit/${c.slug}`}>
								{c.name}
							</FooterLink>
						))}
					</FooterColumn>

					<FooterColumn title="Baume">
						<FooterLink to="/compte">Mon compte</FooterLink>
						<FooterLink to="/guides">Guides</FooterLink>
						<FooterLink to="/ateliers">Ateliers</FooterLink>
						<FooterLink to="/boutique-geneve">Boutique Genève</FooterLink>
						<FooterLink to="/faq">FAQ</FooterLink>
						<FooterLink to="/a-propos">À propos</FooterLink>
					</FooterColumn>
				</div>
			</div>

			<div className="border-t border-baume-white/10">
				<div className="w-full px-6 lg:px-10 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[12px] text-baume-white/55">
					<p>© {new Date().getFullYear()} Baume Sàrl · Conçu à Genève</p>
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
						<li>
							<Link to="/contact" className="hover:text-baume-white">
								Contact
							</Link>
						</li>
						<li>
							<button
								onClick={resetConsent}
								className="text-[12px] text-baume-white/55 hover:text-baume-white transition"
							>
								Gérer mes cookies
							</button>
						</li>
					</ul>
				</div>
			</div>
		</footer>
	);
}

function FooterColumn({ title, children }) {
	return (
		<div className="lg:col-span-2">
			<p className="text-[12px] uppercase tracking-[0.22em] text-baume-taupe mb-4">
				{title}
			</p>
			<ul className="space-y-2.5 text-[14px]">{children}</ul>
		</div>
	);
}

function FooterLink({ to, children }) {
	return (
		<li>
			<Link
				to={to}
				className="text-baume-white/72 hover:text-baume-white transition-colors"
			>
				{children}
			</Link>
		</li>
	);
}
