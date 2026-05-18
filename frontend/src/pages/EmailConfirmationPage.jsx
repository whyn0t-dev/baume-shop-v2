import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function EmailConfirmationPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(hash.replace("#", ""));

    const errorCode = params.get("error_code") || hashParams.get("error_code");
    const errorDescription = params.get("error_description") || hashParams.get("error_description");
    const type = params.get("type") || hashParams.get("type");
    const hasToken = hash.includes("access_token") || params.get("token_hash");

    if (errorCode || errorDescription) {
      toast.error("Lien invalide ou expiré", {
        description: "Ce lien de confirmation n'est plus valide. Veuillez créer un nouveau compte.",
        duration: 8000,
      });
      setTimeout(() => navigate("/inscription"), 2000);
      return;
    }

    if (type === "signup" || hasToken) {
      toast.success("Compte validé !", {
        description: "Votre email a bien été confirmé. Vous pouvez maintenant vous connecter.",
        duration: 6000,
      });
      setTimeout(() => navigate("/connexion"), 1500);
      return;
    }

    // Cas inconnu — rediriger vers connexion par défaut
    setTimeout(() => navigate("/connexion"), 1500);
  }, [navigate]);

  return (
    <div className="bg-baume-ivory min-h-[70vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-baume-burgundy mx-auto mb-4" />
        <p className="text-[15px] text-baume-charcoal/70">
          Validation en cours…
        </p>
      </div>
    </div>
  );
}