# Sécurité — Baume Shop

Mis à jour le 17 novembre 2026.

## Principes
- Les clés secrètes (Stripe, service_role, webhook, Resend) ne vivent que sur le serveur
  (Render) et dans les secrets Supabase. Jamais dans le site, les apps ou git.
- Le site et les apps ne parlent jamais directement à la base : tout passe par l'API
  (`backend/`) ou par les fonctions Supabase.
- `verify_jwt = true` ne suffit pas : la clé publique du site est un jeton valide.
  Toute fonction sensible appelle `requireTrustedCaller` (`supabase/functions/_shared/security.ts`).

## Protections en place
| Domaine | Protection |
|---|---|
| Rôle admin | Déclencheur `trg_protect_profile_role` : une cliente ne peut pas modifier son rôle. |
| Base de données | RLS sur toutes les tables ; pas d'écriture directe sur commandes, réservations, newsletter, quiz ; codes promo lisibles par l'admin uniquement. |
| Fonctions Supabase | Remboursement et statuts : serveur ou admin connectée. E-mails : serveur uniquement. `create-checkout-session` désactivée. |
| Paiement | Prix recalculés côté serveur, coupons réservés avec contrôle du propriétaire, webhook Stripe signé et dédoublonné. |
| Connexion | 10 essais/minute et 60/heure par IP ; e-mail bloqué 15 min après 8 mauvais mots de passe. |
| Robots | Champ pot de miel (`website`) sur inscription, contact, newsletter ; limites sur contact, newsletter, quiz, ateliers, mot de passe oublié. |
| Données personnelles | Le lien public de suivi masque rue, téléphone, nom et e-mail (version complète si la cliente est connectée). |
| Téléversement | `/api/upload/image` réservé à l'admin, images uniquement, 10 Mo max. |
| HTTP | En-têtes nosniff, DENY, HSTS, Referrer-Policy sur toutes les réponses de l'API. |

## Déploiement d'une nouvelle fonction Supabase sensible
1. Importer `requireTrustedCaller` depuis `../_shared/security.ts` et l'appeler en début de handler.
2. Mettre `verify_jwt = true` dans `supabase/config.toml`.
3. Depuis le serveur, appeler la fonction avec `Authorization: Bearer <service_role>`.
