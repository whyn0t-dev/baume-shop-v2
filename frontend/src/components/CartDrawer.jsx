import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../lib/cart";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Progress } from "./ui/progress";
import { Minus, Plus, X } from "lucide-react";

const FREE_SHIP = 60;

export default function CartDrawer() {
  const { open, setOpen, items, subtotal, updateQty, removeItem } = useCart();
  const remaining = Math.max(0, FREE_SHIP - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIP) * 100);
  const empty = items.length === 0;

  const handleRemoveClick = useMemo(
    () => (key) => removeItem(key),
    [removeItem],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="bg-baume-ivory border-l border-baume-border w-full sm:max-w-[440px] p-0 flex flex-col"
        data-testid="cart-drawer"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Mon panier</SheetTitle>
          <SheetDescription>Contenu du panier et passage au paiement</SheetDescription>
        </SheetHeader>
        <div className="px-6 py-5 border-b border-baume-border flex items-center justify-between">
          <p className="font-editorial text-[24px] text-baume-burgundy">Mon panier</p>
          <span className="text-[13px] text-baume-charcoal/60">{items.length} article{items.length > 1 ? "s" : ""}</span>
        </div>

        {!empty && (
          <div className="px-6 pt-4 pb-2">
            <p className="text-[13px] text-baume-charcoal/75">
              {remaining > 0
                ? <>Encore <strong className="text-baume-burgundy">{remaining.toFixed(2)} CHF</strong> pour la livraison offerte</>
                : <>🌿 Livraison offerte !</>}
            </p>
            <Progress value={progress} className="mt-2 h-1 bg-baume-border [&>div]:bg-baume-burgundy" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {empty ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
              <p className="font-editorial text-[22px] text-baume-charcoal">Votre panier est vide</p>
              <p className="text-[14px] text-baume-charcoal/60 max-w-[240px]">
                Découvrez nos sélections par besoin, par produit ou nos best-sellers.
              </p>
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="mt-2 h-11 px-6 inline-flex items-center justify-center rounded-full bg-baume-burgundy text-baume-white text-[14px] font-semibold hover:bg-baume-burgundyDark transition-colors"
              >
                Continuer mes achats
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((it) => (
                <li
                  key={it.key}
                  data-testid={`cart-line-${it.slug}`}
                  className="flex gap-3 py-3 border-b border-baume-border/70 last:border-0"
                >
                  <img src={it.image} alt={it.name} className="h-20 w-16 object-cover rounded-lg bg-baume-white" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-baume-charcoal truncate">{it.name}</p>
                    <p className="text-[12px] text-baume-charcoal/60">
                      {[it.size, it.color].filter(Boolean).join(" · ") || "Taille unique"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-baume-border bg-baume-white">
                        <button
                          aria-label="Diminuer"
                          onClick={() => updateQty(it.key, it.quantity - 1)}
                          className="h-8 w-8 inline-flex items-center justify-center text-baume-charcoal hover:text-baume-burgundy"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-[13px] font-medium">{it.quantity}</span>
                        <button
                          aria-label="Augmenter"
                          onClick={() => updateQty(it.key, it.quantity + 1)}
                          className="h-8 w-8 inline-flex items-center justify-center text-baume-charcoal hover:text-baume-burgundy"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[14px] font-medium text-baume-charcoal">
                        {(it.price * it.quantity).toFixed(2)} CHF
                      </span>
                    </div>
                  </div>
                  <button
                    aria-label="Retirer"
                    onClick={() => handleRemoveClick(it.key)}
                    className="h-8 w-8 text-baume-charcoal/40 hover:text-baume-burgundy"
                    data-testid={`cart-remove-${it.slug}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!empty && (
          <div className="border-t border-baume-border p-6 space-y-4 bg-baume-white">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-baume-charcoal/70">Sous-total</span>
              <span className="font-medium text-[18px] text-baume-charcoal">{subtotal.toFixed(2)} CHF</span>
            </div>
            <p className="text-[12px] text-baume-charcoal/55">TVA incluse. Frais de port calculés à l'étape suivante.</p>
            <Link
              to="/checkout"
              onClick={() => setOpen(false)}
              data-testid="cart-checkout-button"
              className="w-full h-12 inline-flex items-center justify-center rounded-full bg-baume-burgundy text-baume-white text-[15px] font-semibold hover:bg-baume-burgundyDark transition-colors"
            >
              Passer au paiement
            </Link>
            <Link
              to="/panier"
              onClick={() => setOpen(false)}
              className="block text-center text-[13px] text-baume-burgundy hover:underline"
            >
              Voir le panier complet
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
