# PRD — Baume · Refonte e-commerce baume-shop.com (production-ready)

## Problem statement (fr-FR)
Refonte complète de **baume-shop.com**, marque suisse premium de bien-être féminin (cycle, intimité, sexualité, maternité, post-partum, péri-ménopause) avec boutique physique à Genève. Ton doux, précis, rassurant, non médicalisant. Positionnement : sélection exigeante + accompagnement humain + contenus conseils.

**Stack production-ready :** FastAPI + MongoDB + Stripe (test) + Resend (clé à fournir) + JWT custom auth (bcrypt, httpOnly cookies). Palette imposée respectée : `#4D1E19` bourgogne, `#F7F3EE` ivoire, `#C0B4A6` taupe, `#E7DDD3` bordures. Typos : **Cormorant Garamond** + **Inter**.

## Architecture

### Backend (`/app/backend/`)
- `server.py` — routes API + auth_router (`/api/auth/*`)
- `auth.py` — JWT/bcrypt/get_current_user/RegisterRequest/LoginRequest/brute-force
- `emails.py` — Resend templates (contact_ack, welcome, order_confirmation, password_reset)
- `seed_data.py` — catalogue (20 produits, 6 besoins, 8 catégories, 6 guides, 3 expertes, 6 reviews) · dict `IMG` centralisé pour swap images
- `scripts/reseed.py` — clear + re-insert catalogue (à relancer après changement du dict `IMG`)

### Endpoints

**Publics** : `/api/products` (filtres), `/api/products/{slug}`, `/api/categories[/{kind}/{slug}]`, `/api/reviews`, `/api/guides[/{slug}]`, `/api/experts`, `/api/contact`

**Auth** : `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` (GET + PATCH), `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`

**Orders & Checkout** : `/api/checkout/session`, `/api/checkout/status/{session_id}`, `/api/webhook/stripe`, `/api/orders/mine` (auth), `/api/orders/{id}` (auth)

### Frontend (`/app/frontend/src/`)
- `lib/auth.jsx` — AuthContext (status: loading/authenticated/guest)
- `lib/cart.jsx` — CartContext + localStorage
- `lib/api.js` — axios `withCredentials: true`, auth helpers, `formatApiError`
- 19 pages, 16 composants shadcn-based

## User personas
- Cliente cycle (25-40) · Future/jeune maman · Péri-ménopause · Ado & parent · Locale Genève (boutique/atelier)

## Fonctionnalités production-ready ✅ (2026-04-24)
- Catalogue filtré (besoin/flux/usage/taille/prix/dispo) + recherche full-text
- Panier localStorage + drawer + progress bar livraison offerte (60 CHF CH / 90 € EU)
- Checkout 3 étapes avec pré-remplissage automatique si user authentifié
- Stripe checkout CHF (prix recalculé serveur, anti-manipulation)
- Order creation idempotent via webhook + poll `/checkout/status`
- Emails transactionnels : acknowledge contact, welcome, order confirmation, password reset (templates HTML brandés)
- Auth JWT complète : register, login, logout, me, PATCH profile, refresh, forgot/reset password
- Brute force protection (5 tentatives / 15 min par IP+email)
- Espace client `/compte` avec tabs Commandes + Informations
- Admin seeded (`admin@baume-shop.com` / `BaumeAdmin2026!`)
- SEO : title/description/OG en français, lang=en → à passer en `fr` si nécessaire
- Accessibilité : focus visible bourgogne, SheetTitle sr-only, alt text, hiérarchie Hn
- Design system 100% conforme (palette + fonts + échelle typo)

## Couverture tests
- **Backend** : 43/43 pytest ✅ (auth + orders + checkout + contact + catalogue)
- **Frontend** : 100% sur flows auth/checkout/panier testés via Playwright (testing_agent_v3 iter. 3)

## Configuration production (à finaliser)
1. `RESEND_API_KEY` — **requis** pour activer envoi email (dashboard Resend)
2. Images marque — remplacer les URLs Unsplash dans `seed_data.py` (dict `IMG`), puis `python backend/scripts/reseed.py`
3. Domaine vérifié Resend pour `contact@baume-shop.com`
4. `STRIPE_API_KEY` — passer en clé live quand prêt
5. `FRONTEND_URL` / `CORS_ORIGINS` — adapter au vrai domaine de prod

## Tech debt / améliorations futures
- Cart : migrer vers IndexedDB si volumes élevés (actuellement localStorage)
- Webhook signature Stripe : à vérifier une fois la vraie clé et l'endpoint webhook publics configurés dans le dashboard Stripe
- `server.py` (670 lignes) : à scinder en routers dédiés si évolution (auth_router, orders_router, catalog_router)
- Images : passer sur un CDN dédié (Cloudflare Images / Imgix) avec srcset AVIF

## Roadmap (P1 → P3)
- **P1** Remplacement images marque (prêt via IMG dict)
- **P1** Clé Resend + domaine vérifié → envoi emails réels
- **P1** Page Guide des tailles (modal depuis fiche produit)
- **P2** Recherche globale page dédiée `/recherche`
- **P2** Newsletter (Resend audiences)
- **P2** Wishlist
- **P2** Codes promo / fidélité
- **P3** Dashboard admin (produits/commandes/stocks)
- **P3** Avis clients avec photos, modération
- **P3** Multilingue FR/DE/EN (marché suisse)

## Next tasks
1. Réceptionner `RESEND_API_KEY` du client → ajouter dans `/app/backend/.env` → restart backend
2. Réceptionner vraies photos marque → substituer dans `seed_data.IMG` → `python backend/scripts/reseed.py`
3. Configurer domaine vérifié Resend pour l'email `contact@baume-shop.com`
4. Validation finale avec vraie clé Stripe + webhook configuré dans dashboard Stripe
