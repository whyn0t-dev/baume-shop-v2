import React from "react";
import Breadcrumb from "../components/Breadcrumb";

function LegalLayout({ testid, title, updated, children }) {
	return (
		<div data-testid={testid} className="bg-baume-ivory">
			<div className="baume-container pt-8">
				<Breadcrumb items={[{ label: title }]} />
			</div>
			<article className="baume-container py-10 md:py-14 max-w-[820px]">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Informations légales
				</p>
				<h1 className="font-editorial text-[36px] md:text-[48px] leading-[1.1] text-baume-charcoal">
					{title}
				</h1>
				<p className="mt-4 text-[13px] text-baume-charcoal/60">
					Dernière mise à jour : {updated}
				</p>
				<div className="mt-10 space-y-8 text-[16px] leading-[28px] text-baume-charcoal/85 [&_h2]:font-editorial [&_h2]:text-[24px] [&_h2]:md:text-[28px] [&_h2]:text-baume-charcoal [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-editorial [&_h3]:text-[20px] [&_h3]:text-baume-charcoal [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-baume-burgundy [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_p]:mb-3">
					{children}
				</div>
			</article>
		</div>
	);
}

export function MentionsLegalesPage() {
	return (
		<LegalLayout
			testid="mentions-legales-page"
			title="Mentions légales"
			updated="Février 2026"
		>
			<h2>Éditeur du site</h2>
			<p>
				<strong>Baume Sàrl</strong>
				<br />
				Rue du Rhône 15, 1204 Genève, Suisse
				<br />
				IDE : CHE-XXX.XXX.XXX
				<br />
				Registre du Commerce du Canton de Genève
				<br />
				Téléphone : +41 22 000 00 00
				<br />
				Email :{" "}
				<a href="mailto:contact@baume-shop.com">contact@baume-shop.com</a>
			</p>

			<h2>Directrice de la publication</h2>
			<p>Camille Rousseau, fondatrice de Baume Sàrl.</p>

			<h2>Hébergement</h2>
			<p>
				Le site <a href="https://baume-shop.com">baume-shop.com</a> est hébergé
				par un prestataire tiers. Pour toute demande relative à
				l'infrastructure, merci de contacter l'éditeur.
			</p>

			<h2>Propriété intellectuelle</h2>
			<p>
				L'ensemble des contenus présents sur ce site (textes, visuels,
				photographies, logos, marques) est la propriété exclusive de Baume Sàrl
				ou de ses partenaires. Toute reproduction, représentation, modification,
				publication ou adaptation, totale ou partielle, est interdite sans
				autorisation écrite préalable.
			</p>

			<h2>Liens externes</h2>
			<p>
				Le site peut comporter des liens vers des ressources tierces. Baume Sàrl
				ne saurait être tenue responsable du contenu des sites liés.
			</p>

			<h2>Droit applicable</h2>
			<p>
				Le présent site est soumis au droit suisse. Tout litige relève de la
				compétence exclusive des tribunaux genevois, sous réserve des
				dispositions impératives du droit de la consommation.
			</p>

			<h2>Médiation</h2>
			<p>
				En cas de différend, le client est invité à contacter le service client
				à <a href="mailto:contact@baume-shop.com">contact@baume-shop.com</a>{" "}
				avant toute démarche contentieuse.
			</p>
		</LegalLayout>
	);
}

export function CgvPage() {
	return (
		<LegalLayout
			testid="cgv-page"
			title="Conditions générales de vente"
			updated="Février 2026"
		>
			<p className="italic text-baume-charcoal/70">
				Les présentes conditions générales de vente (« CGV ») régissent les
				relations commerciales entre Baume Sàrl, société à responsabilité
				limitée de droit suisse, et toute personne majeure (« le Client »)
				effectuant un achat sur{" "}
				<a href="https://baume-shop.com">baume-shop.com</a>.
			</p>

			<h2>Article 1 — Objet</h2>
			<p>
				Les présentes CGV ont pour objet de définir les droits et obligations
				des parties dans le cadre de la vente en ligne de produits intimes et
				menstruels, de soins, de compléments et d'accessoires proposés par Baume
				Sàrl.
			</p>

			<h2>Article 2 — Produits et disponibilité</h2>
			<p>
				Les produits sont présentés avec la plus grande exactitude. Baume Sàrl
				se réserve le droit de retirer un produit ou de corriger une information
				à tout moment. Les commandes sont servies dans la limite des stocks
				disponibles.
			</p>

			<h2>Article 3 — Prix et paiement</h2>
			<ul>
				<li>
					Les prix sont indiqués en francs suisses (CHF), TVA suisse incluse
					lorsqu'elle s'applique.
				</li>
				<li>
					Les frais de livraison sont précisés avant validation de la commande.
				</li>
				<li>
					Paiement accepté : cartes bancaires, TWINT, Apple Pay, Google Pay
					(selon pays), via notre partenaire Stripe.
				</li>
				<li>La commande est validée après autorisation du paiement.</li>
			</ul>

			<h2>Article 4 — Commande</h2>
			<p>
				Toute commande implique l'acceptation sans réserve des présentes CGV. Un
				email de confirmation est envoyé après validation. Baume Sàrl se réserve
				le droit d'annuler toute commande en cas de soupçon de fraude ou de
				litige antérieur.
			</p>

			<h2>Article 5 — Livraison</h2>
			<ul>
				<li>
					<strong>Suisse</strong> : 2 à 3 jours ouvrés · 6,90 CHF ·{" "}
					<strong>offerte dès 60 CHF</strong>
				</li>
				<li>
					<strong>Union européenne</strong> (FR, BE, DE, IT, ES, AT, NL, LU) : 3
					à 5 jours ouvrés · 12,90 € · <strong>offerte dès 90 €</strong>
				</li>
				<li>
					<strong>Retrait boutique Genève</strong> : gratuit sur réservation
					(Rue du Rhône 15)
				</li>
			</ul>
			<p>
				Les délais sont donnés à titre indicatif. Un retard ne peut donner lieu
				à indemnité sauf disposition contraire impérative.
			</p>

			<h2>Article 6 — Droit de rétractation</h2>
			<p>
				Conformément au droit suisse et au droit européen applicable, le Client
				dispose de <strong>30 jours</strong> à compter de la réception pour
				retourner un produit <strong>non ouvert et en parfait état</strong>.
			</p>
			<p>
				Les produits d'hygiène intime ouverts (culottes menstruelles, cups,
				serviettes, soins déconditionnés) sont exclus du droit de rétractation
				pour raisons sanitaires. Cette restriction est conforme aux exigences
				légales en matière de produits intimes.
			</p>
			<p>
				Procédure : contacter{" "}
				<a href="mailto:contact@baume-shop.com">contact@baume-shop.com</a> en
				indiquant le numéro de commande. Le remboursement intervient sous 14
				jours après réception du retour.
			</p>

			<h2>Article 7 — Garantie et conformité</h2>
			<p>
				Tout produit défectueux ou non conforme donne lieu, au choix du Client,
				à échange, réparation ou remboursement, dans les conditions prévues par
				la loi.
			</p>

			<h2>Article 8 — Responsabilité</h2>
			<p>
				La responsabilité de Baume Sàrl est limitée au montant de la commande
				concernée. Les produits sont vendus à usage personnel ; leur usage
				demeure sous la responsabilité du Client.
			</p>

			<h2>Article 9 — Données personnelles</h2>
			<p>
				Le traitement des données personnelles du Client est détaillé dans notre{" "}
				<a href="/confidentialite">politique de confidentialité</a>.
			</p>

			<h2>Article 10 — Droit applicable et litiges</h2>
			<p>
				Les présentes CGV sont régies par le droit suisse. En cas de litige, une
				solution amiable sera recherchée avant toute action judiciaire. À
				défaut, les tribunaux de Genève sont seuls compétents, sous réserve des
				dispositions impératives en matière de consommation.
			</p>
		</LegalLayout>
	);
}

export function PrivacyPage() {
	return (
		<LegalLayout
			testid="privacy-page"
			title="Politique de confidentialité"
			updated="Février 2026"
		>
			<p className="italic text-baume-charcoal/70">
				Baume Sàrl attache une importance particulière au respect de votre vie
				privée. La présente politique explique quelles données nous collectons,
				pourquoi, comment et vos droits associés.
			</p>

			<h2>Responsable du traitement</h2>
			<p>
				Baume Sàrl — Rue du Rhône 15, 1204 Genève —{" "}
				<a href="mailto:contact@baume-shop.com">contact@baume-shop.com</a>.
			</p>

			<h2>Données collectées</h2>
			<ul>
				<li>
					<strong>Lors de la création d'un compte</strong> : prénom, nom, email,
					mot de passe (haché, jamais stocké en clair).
				</li>
				<li>
					<strong>Lors d'une commande</strong> : adresse de livraison,
					téléphone, détails de la commande.{" "}
					<em>Les données bancaires ne sont jamais enregistrées chez nous</em> —
					elles sont traitées directement par Stripe.
				</li>
				<li>
					<strong>Lors d'un contact</strong> : nom, email, contenu du message.
				</li>
				<li>
					<strong>Lors de la navigation</strong> : cookies techniques (session,
					panier) et, sous réserve de votre consentement, cookies analytiques.
				</li>
			</ul>

			<h2>Finalités</h2>
			<ul>
				<li>Traitement et livraison des commandes</li>
				<li>Gestion du compte client et de l'historique</li>
				<li>Service client et SAV</li>
				<li>Amélioration continue du site et de l'expérience utilisateur</li>
				<li>
					Communication marketing{" "}
					<strong>uniquement avec votre consentement</strong> explicite
				</li>
			</ul>

			<h2>Base légale</h2>
			<p>
				Exécution du contrat (commande, compte), obligations légales
				(comptabilité, conservation des factures), intérêt légitime (sécurité du
				site, prévention de la fraude), et consentement (newsletter, analytics).
			</p>

			<h2>Durée de conservation</h2>
			<ul>
				<li>
					Compte client : tant que le compte est actif, puis 3 ans après la
					dernière activité.
				</li>
				<li>
					Factures et pièces comptables : 10 ans (obligation légale suisse).
				</li>
				<li>Messages de contact : 3 ans.</li>
				<li>Cookies analytiques : 13 mois maximum.</li>
			</ul>

			<h2>Destinataires</h2>
			<p>
				Vos données sont traitées par Baume Sàrl et ses sous-traitants,
				strictement pour les finalités décrites :
			</p>
			<ul>
				<li>
					<strong>Stripe</strong> — traitement des paiements (hors EEE : clauses
					contractuelles types)
				</li>
				<li>
					<strong>Resend</strong> — envoi d'emails transactionnels
				</li>
				<li>
					<strong>Hébergeur</strong> — infrastructure technique
				</li>
				<li>
					Transporteurs (La Poste, DHL, Swiss Post) — livraison uniquement
				</li>
			</ul>
			<p>
				Aucune donnée n'est vendue ou cédée à des tiers à des fins commerciales.
			</p>

			<h2>Vos droits</h2>
			<p>
				Conformément à la LPD suisse et au RGPD (si applicable), vous disposez
				des droits suivants :
			</p>
			<ul>
				<li>Accès à vos données</li>
				<li>Rectification</li>
				<li>Effacement (« droit à l'oubli »)</li>
				<li>Portabilité</li>
				<li>Opposition et limitation du traitement</li>
				<li>Retrait du consentement à tout moment</li>
			</ul>
			<p>
				Pour exercer ces droits, écrivez-nous à{" "}
				<a href="mailto:contact@baume-shop.com">contact@baume-shop.com</a>. Nous
				répondons sous 30 jours maximum.
			</p>

			<h2>Sécurité</h2>
			<p>
				Nous mettons en œuvre des mesures techniques et organisationnelles
				conformes à l'état de l'art : chiffrement TLS, hachage bcrypt des mots
				de passe, cookies de session httpOnly, contrôle d'accès restreint,
				journaux de sécurité.
			</p>

			<h2>Cookies</h2>
			<p>
				Le site utilise des cookies techniques strictement nécessaires (session,
				panier, authentification). Les cookies analytiques ne sont posés
				qu'après votre consentement explicite (bandeau cookies).
			</p>

			<h2>Réclamation</h2>
			<p>
				En cas de désaccord persistant, vous pouvez saisir le{" "}
				<strong>
					Préposé fédéral à la protection des données et à la transparence
					(PFPDT)
				</strong>{" "}
				en Suisse, ou l'autorité de contrôle de votre pays de résidence au sein
				de l'Union européenne.
			</p>
		</LegalLayout>
	);
}
