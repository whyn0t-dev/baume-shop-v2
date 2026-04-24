import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCheckoutStatus } from "../lib/api";
import { useCart } from "../lib/cart";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";

export default function ConfirmationPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [attempt, setAttempt] = useState(0);
  const { clear } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    let timer;
    const check = async (n = 0) => {
      if (n >= 8) {
        setStatus("timeout");
        return;
      }
      try {
        const res = await getCheckoutStatus(sessionId);
        setPaymentStatus(res.payment_status);
        setStatus(res.status);
        setAttempt(n);
        if (res.payment_status === "paid") {
          if (!cleared.current) {
            cleared.current = true;
            clear();
          }
          return;
        }
        if (res.status === "expired") return;
        timer = setTimeout(() => check(n + 1), 2500);
      } catch {
        timer = setTimeout(() => check(n + 1), 3000);
      }
    };
    check();
    return () => timer && clearTimeout(timer);
  }, [sessionId, clear]);

  const isPaid = paymentStatus === "paid";
  const isFailed = status === "expired" || status === "error";
  const isTimeout = status === "timeout";

  return (
    <div data-testid="confirmation-page" className="bg-baume-ivory min-h-[70vh]">
      <div className="baume-container py-20 md:py-28 max-w-[720px] mx-auto text-center">
        {isPaid ? (
          <>
            <div className="mx-auto h-16 w-16 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal">Merci pour votre commande</h1>
            <p className="mt-4 text-[16px] md:text-[18px] leading-[28px] text-baume-charcoal/75">
              Votre paiement a bien été reçu. Un email de confirmation vous sera envoyé sous quelques minutes.
              Votre commande sera expédiée depuis Genève dans les 24 h ouvrées.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/" className="h-12 px-8 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px]">
                Retour à l'accueil <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/guides" className="h-12 px-8 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px]">
                Lire nos guides
              </Link>
            </div>
          </>
        ) : isFailed || isTimeout ? (
          <>
            <div className="mx-auto h-16 w-16 rounded-full bg-baume-taupe/30 text-baume-burgundy inline-flex items-center justify-center mb-6">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="font-editorial text-[32px] md:text-[40px] text-baume-charcoal">Paiement non abouti</h1>
            <p className="mt-4 text-[15px] text-baume-charcoal/75">
              Votre paiement n'a pas pu être confirmé. Votre panier est toujours disponible — vous pouvez réessayer ou nous contacter.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/panier" className="h-12 px-8 inline-flex items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px]">Retour au panier</Link>
              <Link to="/contact" className="h-12 px-8 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px]">Nous contacter</Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 text-baume-burgundy animate-spin mx-auto mb-6" />
            <h1 className="font-editorial text-[28px] text-baume-charcoal">Vérification du paiement…</h1>
            <p className="mt-3 text-[14px] text-baume-charcoal/70">Merci de patienter quelques secondes (tentative {attempt + 1}/8).</p>
          </>
        )}
      </div>
    </div>
  );
}
