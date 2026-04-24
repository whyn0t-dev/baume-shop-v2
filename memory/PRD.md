# PRD — Baume · Refonte e-commerce baume-shop.com

## Problem statement (original, fr-FR)
Refonte complète du site **baume-shop.com**, marque suisse premium de bien-être féminin (cycle, intimité, sexualité, maternité, post-partum, péri-ménopause) avec boutique physique à Genève. Ton doux, précis, rassurant, jamais médicalisant ni infantilisant. Positionnement : sélection exigeante + accompagnement humain + contenus conseils.

**Stack imposée :** FastAPI + MongoDB + Stripe (paiement réel mode test) + Resend (formulaire contact, clé à fournir). Palette imposée : `#4D1E19` bourgogne, `#F7F3EE` ivoire, `#C0B4A6` taupe, `#E7DDD3` bordures. Typographies : **Cormorant Garamond** (titres) + **Inter** (UI/body).

## Architecture
- **Backend** `/app/backend/server.py` : FastAPI, MongoDB via Motor. Endpoints `/api/products`, `/api/categories`, `/api/reviews`, `/api/guides`, `/api/experts`, `/api/contact` (Resend), `/api/checkout/session` + `/api/checkout/status/{id}` + `/api/webhook/stripe` (emergentintegrations Stripe). Recalcul du prix côté serveur (anti-manipulation), seuil livraison offerte 60 CHF (CH) / 90 € (EU).
- **Seed** `/app/backend/seed_data.py` : 20 produits, 6 besoins, 8 catégories produit, 6 guides, 3 expertes, 6 reviews. Structure facilement extensible.
- **Frontend** : React + React Router 7 + Tailwind + shadcn/ui + sonner + lucide-react. Cart en `CartContext` + localStorage. Routes : `/`, `/shop/{besoin|produit}[/...slug]`, `/produit/:slug`, `/panier`, `/checkout`, `/commande/confirmation`, `/a-propos`, `/contact`, `/faq`, `/boutique-geneve`, `/ateliers`, `/guides[/:slug]`.

## User personas
- **Cliente cycle / règles** (25-40) : cherche culottes/cups/serviettes lavables fiables.
- **Future / jeune maman** : maternité, post-partum, soins doux.
- **Femme en péri-ménopause** : sécheresse, lubrifiants, accompagnement.
- **Ado & parent** : premiers cycles, ressources éducatives.
- **Cliente locale Genève** : retrait boutique, ateliers.

## What's been implemented (2026-04-24)
- Backend FastAPI complet (routes, validation Pydantic, gestion erreurs)
- Seed MongoDB (20 produits + 6 besoins + 8 catégories + 6 guides + 3 expertes + 6 reviews)
- Stripe checkout multi-étapes (CHF, prix recalculé serveur, fallback DB sur status)
- Resend setup (clé à fournir, contact persiste en DB en attendant)
- Design system Baume complet (palette + fonts + tokens Tailwind + index.css)
- 16 composants UI (Header+megamenu+drawer, Footer, Hero, Cards x5, TrustBar, Filters sticky+drawer, Gallery, Breadcrumb, CartDrawer, etc.)
- 13 pages complètes en français (Home, Shop index x2, Category x2, Product, Cart, Checkout 3-steps, Confirmation, About, Contact, FAQ, Store, Ateliers, Guides+Detail)
- Routing React Router avec scroll-to-top
- SEO : title/description/OG en français
- Accessibilité : focus visible bourgogne, sr-only Sheet titles, alt text, hiérarchie Hn
- Tests : backend 25/25 pass, frontend Playwright 100% sur flows critiques

## Prioritized backlog
- **P1** Fournir `RESEND_API_KEY` pour activer l'envoi email du formulaire contact
- **P1** Compte client (auth) + historique commandes + adresses sauvegardées
- **P2** Recherche globale (page dédiée `/recherche`) — endpoint `/api/products?search=` déjà prêt
- **P2** Newsletter (intégration Resend audiences ou Klaviyo)
- **P2** Wishlist / favoris
- **P2** Multilingue (fr-CH ↔ de-CH ↔ en-CH)
- **P3** Programme fidélité, codes promo, parrainage
- **P3** Gestion stocks temps réel, dashboard admin
- **P3** Avis clients : soumission, modération, photos
- **P3** Webhook Stripe complet : envoi email confirmation commande via Resend, mise à jour stock
- **P3** Remplacement images Unsplash par les vraies photos de la marque

## Tech debt / notes
- `payment_transactions.updated_at` mis à jour seulement quand le statut change (pourrait être à chaque poll).
- Cart store actuel = Context + localStorage ; persiste sur reload navigateur SPA.
- CORSMiddleware enregistré après `include_router` (fonctionne mais convention inverse).

## Next tasks
1. Récupérer `RESEND_API_KEY` du client et l'ajouter dans `/app/backend/.env`
2. Définir si on ajoute auth utilisateur dans la prochaine itération
3. Remplacer les images Unsplash par les visuels marque (champs `image`, `gallery` dans seed_data.py)
4. Brancher webhook Stripe pour envoi email de confirmation post-paiement
