import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import { useCart } from "../lib/cart";
import { Minus, Plus, X, ShieldCheck, Truck } from "lucide-react";
import { Progress } from "../components/ui/progress";

const FREE_SHIP = 60;

export default function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();
  const remaining = Math.max(0, FREE_SHIP - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIP) * 100);

  return (
    <div data-testid="cart-page" className="bg-baume-ivory min-h-[60vh]">
      <div className="baume-container pt-8">
        <Breadcrumb items={[{ label: "Panier" }]} />
      </div>
      <div className="baume-container py-10 md:py-14">
        <h1 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal">Mon panier</h1>
        <p className="mt-3 text-[15px] text-baume-charcoal/70">
          {items.length === 0 ? "Votre panier est vide." : `${items.length} article${items.length > 1 ? "s" : ""} sélectionné${items.length > 1 ? "s" : ""}.`}
        </p>
      </div>

      <div className="baume-container pb-24">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-baume-border bg-baume-white p-10 text-center">
            <p className="font-editorial text-[24px] text-baume-charcoal">Commencez votre routine</p>
            <p className="mt-2 text-[14px] text-baume-charcoal/70">Découvrez nos best-sellers ou entrez par votre besoin.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/shop/besoin" className="h-11 px-6 inline-flex items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]">Shop par besoin</Link>
              <Link to="/shop/produit" className="h-11 px-6 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[14px]">Shop par produit</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-baume-white border border-baume-border rounded-2xl divide-y divide-baume-border">
              {items.map((it) => (
                <div key={it.key} className="p-5 flex gap-4" data-testid={`cart-page-line-${it.slug}`}>
                  <img src={it.image} alt={it.name} className="h-28 w-24 rounded-lg object-cover bg-baume-ivory" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/produit/${it.slug}`} className="text-[16px] font-medium text-baume-charcoal hover:text-baume-burgundy">{it.name}</Link>
                    <p className="text-[13px] text-baume-charcoal/60 mt-0.5">{[it.size, it.color].filter(Boolean).join(" · ") || "Taille unique"}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-full border border-baume-border">
                        <button aria-label="Diminuer" onClick={() => updateQty(it.key, it.quantity - 1)} className="h-9 w-9 inline-flex items-center justify-center">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-[14px]">{it.quantity}</span>
                        <button aria-label="Augmenter" onClick={() => updateQty(it.key, it.quantity + 1)} className="h-9 w-9 inline-flex items-center justify-center">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-[15px] font-medium text-baume-charcoal">{(it.price * it.quantity).toFixed(2)} CHF</p>
                    </div>
                  </div>
                  <button aria-label="Retirer" onClick={() => removeItem(it.key)} className="h-9 w-9 text-baume-charcoal/40 hover:text-baume-burgundy">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-4">
              <div className="bg-baume-white border border-baume-border rounded-2xl p-6 lg:sticky lg:top-[96px]">
                <p className="font-editorial text-[22px] text-baume-charcoal">Récapitulatif</p>

                <div className="mt-5 rounded-xl bg-baume-ivory p-3">
                  <p className="text-[12px] text-baume-charcoal/70">
                    {remaining > 0
                      ? <>Encore <strong className="text-baume-burgundy">{remaining.toFixed(2)} CHF</strong> pour la livraison offerte.</>
                      : <>Livraison offerte !</>}
                  </p>
                  <Progress value={progress} className="mt-2 h-1 bg-baume-border [&>div]:bg-baume-burgundy" />
                </div>

                <div className="mt-6 space-y-2 text-[14px]">
                  <div className="flex items-center justify-between">
                    <span className="text-baume-charcoal/70">Sous-total</span>
                    <span className="font-medium text-baume-charcoal" data-testid="cart-subtotal">{subtotal.toFixed(2)} CHF</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-baume-charcoal/70">Livraison</span>
                    <span className="text-baume-charcoal/70">Calculée au paiement</span>
                  </div>
                </div>
                <div className="my-5 border-t border-baume-border" />
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-baume-charcoal">Total estimé</span>
                  <span className="text-[22px] font-editorial text-baume-charcoal">{subtotal.toFixed(2)} CHF</span>
                </div>

                <Link
                  to="/checkout"
                  data-testid="cart-page-checkout"
                  className="mt-5 w-full h-12 inline-flex items-center justify-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark transition-colors"
                >
                  Passer au paiement
                </Link>

                <div className="mt-5 flex items-center gap-4 text-[12px] text-baume-charcoal/65">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Paiement sécurisé</span>
                  <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Expédié de Genève</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
