# Déploiement — demandes cliente (novembre 2026)

## 1. Migration SQL

Dans Supabase → SQL Editor, enregistrer d'abord les deux secrets utilisés par les tâches planifiées :

```sql
select vault.create_secret('https://<REF_PROJET>.supabase.co', 'baume_project_url');
select vault.create_secret('<même valeur que BAUME_INTERNAL_TOKEN du backend>', 'baume_internal_token');
```

Puis exécuter `migrations/20261113000000_baume_client_requests.sql`
(ou `supabase db push` avec la CLI). La migration peut être relancée sans risque.

Elle crée : `banner_events`, `customer_followups`, `customer_offers`, la fonction `banner_ctr_stats`,
les colonnes produits (`highlights`, `specs`, `care_instructions`), clients (`admin_notes`, `tags`,
`marketing_opt_out`), parrainage (`referee_email_normalized`, `referee_profile_id`, `referee_ip`,
`rejection_reason`), codes promo (`campaign`) et les 4 tâches pg_cron.

## 2. Fonctions Supabase

```bash
supabase functions deploy send-post-purchase-offer --no-verify-jwt
supabase functions deploy send-personalized-offers --no-verify-jwt
supabase functions deploy send-monthly-report --no-verify-jwt
```

(`--no-verify-jwt` : l'accès est protégé par l'en-tête `X-Baume-Internal-Token`.)

Secrets (Supabase → Edge Functions → Secrets) :

| Secret | Valeur |
|---|---|
| `BAUME_INTERNAL_TOKEN` | identique au backend |
| `RESEND_API_KEY` | clé Resend |
| `SENDER_EMAIL` / `SENDER_NAME` | ex. `contact@baume-shop.com` / `Baume Genève` |
| `FRONTEND_URL` | URL du site |
| `BACKEND_URL` | URL de l'API FastAPI (rapport mensuel) |
| `REPORT_RECIPIENTS` | emails du rapport, séparés par des virgules |
| `POST_PURCHASE_LOW_PERCENT` | `5` (défaut) |
| `POST_PURCHASE_HIGH_PERCENT` | `10` (défaut) |
| `POST_PURCHASE_HIGH_THRESHOLD` | `80` CHF (défaut) — au-delà, 10 % |
| `POST_PURCHASE_VALIDITY_DAYS` | `30` (défaut) |
| `OFFERS_PERCENT` / `OFFERS_VALIDITY_DAYS` | `10` / `21` (défaut) |

## 3. Tâches planifiées (créées par la migration)

| Tâche | Quand | Action |
|---|---|---|
| `baume-post-purchase-offer` | tous les jours 09:15 (Genève) | email J+30 + code 5 %/10 % |
| `baume-personalized-offers` | chaque lundi 10:20 | offres selon les achats |
| `baume-monthly-report` | le 1er du mois 08:05 | rapport mensuel |
| `baume-expire-campaign-discounts` | chaque nuit | désactive les codes expirés |

Tester sans envoyer d'email :

```sql
select public.baume_call_function('send-post-purchase-offer', '{"dry_run": true}');
select public.baume_call_function('send-personalized-offers', '{"mode":"auto","dry_run": true}');
-- résultat : select * from net._http_response order by id desc limit 5;
```

## 4. Front

`react-qr-code` est importé par `CarteFidelitePage.jsx` mais absent de `package.json` :
`yarn add react-qr-code` si la compilation échoue sur ce module.
