#!/bin/sh
# Déploie les protections d'accès des fonctions Supabase (17 novembre 2026).
# À lancer depuis le dossier baume-shop-v2 :  sh supabase/deploy-securite.sh
set -e
REF="bniuqpunzhzyuoqgdazm"

if command -v supabase >/dev/null 2>&1; then
  SB="supabase"
else
  SB="npx --yes supabase@latest"
fi

# Fonctions réservées au serveur Baume / aux administratrices :
# jeton obligatoire au niveau de Supabase + contrôle d'accès dans le code.
for f in refund-order update-order-status update-order-item-status \
         send-order-status-email send-return-status-email send-newsletter-welcome \
         send-preorder-available send-quiz-results; do
  echo "→ $f"
  $SB functions deploy "$f" --project-ref "$REF"
done

# Ancienne création de paiement : remplacée par une réponse « service indisponible ».
echo "→ create-checkout-session (désactivée)"
$SB functions deploy create-checkout-session --project-ref "$REF" --no-verify-jwt

echo "Terminé : 9 fonctions protégées."
