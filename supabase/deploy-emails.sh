#!/bin/sh
# Redéploie les fonctions qui envoient des emails (nouvelle charte Baume).
# À lancer depuis le dossier baume-shop-v2 :  sh supabase/deploy-emails.sh
# Le contrôle JWT de chaque fonction est conservé tel qu'il est en ligne.
set -e
REF="bniuqpunzhzyuoqgdazm"

# Fonctions appelées par Stripe, le cron ou le backend : sans JWT
for f in send-order-email send-preorder-available send-welcome-email send-quiz-results \
         send-loyalty-code send-post-purchase-offer send-personalized-offers \
         send-monthly-report stripe-webhook; do
  echo "→ $f"
  supabase functions deploy "$f" --project-ref "$REF" --no-verify-jwt
done

# Fonctions appelées par le site avec la session de l'utilisateur : JWT obligatoire
for f in send-order-status-email send-return-status-email send-newsletter-welcome; do
  echo "→ $f"
  supabase functions deploy "$f" --project-ref "$REF"
done

echo "Terminé : 12 fonctions redéployées."
