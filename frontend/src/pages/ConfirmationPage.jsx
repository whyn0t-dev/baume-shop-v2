import React, { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../lib/cart";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function ConfirmationPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { clear } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (!cleared.current) {
      cleared.current = true;
      clear();
    }
  }, [clear]);

  return (
    <div data-testid="confirmation-page" className="bg-baume-ivory min-h-[70vh]">
      <div className="baume-container py-20 md:py-28 max-w-[720px] mx-auto text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center justify-center mb-6">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <h1 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal">
          Merci pour votre commande
        </h1>

        <p className="mt-4 text-[16px] md:text-[18px] leading-[28px] text-baume-charcoal/75">
          Votre paiement a bien été reçu. Un email de confirmation vous sera envoyé sous quelques minutes.
          Votre commande sera expédiée depuis Genève dans les 24 h ouvrées.
        </p>

        {sessionId && (
          <p className="mt-4 text-[12px] text-baume-charcoal/45">
            Référence paiement : {sessionId}
          </p>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="h-12 px-8 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px]"
          >
            Retour à l'accueil <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            to="/guides"
            className="h-12 px-8 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px]"
          >
            Lire nos guides
          </Link>
        </div>
      </div>
    </div>
  );
}