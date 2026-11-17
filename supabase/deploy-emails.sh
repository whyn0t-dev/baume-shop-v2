#!/bin/sh
# Redéploie les fonctions qui envoient des emails (nouvelle charte Baume).
# À lancer depuis le dossier baume-shop-v2 :  sh supabase/deploy-emails.sh
# Le contrôle JWT de chaque fonction est conservé tel qu'il est en ligne.
set -e
REF="bniuqpunzhzyuoqgdazm"

# Utilise la commande supabase si elle est installée, sinon passe par npx.
if command -v supabase >/dev/null 2>&1; then
  SB="supabase"
else
  SB="npx --yes supabase@latest"
fi

# Fonctions appelées par Stripe, le cron ou le backend : sans JWT
for f in send-order-email send-welcome-email \
         send-loyalty-code send-post-purchase-offer send-personalized-offers \
         send-monthly-report stripe-webhook; do
  echo "→ $f"
  $SB functions deploy "$f" --project-ref "$REF" --no-verify-jwt
done

# Fonctions appelées par le site avec la session de l'utilisateur : JWT obligatoire
for f in send-order-status-email send-return-status-email send-newsletter-welcome \
         send-preorder-available send-quiz-results; do
  echo "→ $f"
  $SB functions deploy "$f" --project-ref "$REF"
done

echo "Terminé : 12 fonctions redéployées."
