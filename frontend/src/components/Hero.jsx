import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section data-testid="hero" className="relative overflow-hidden bg-baume-ivory">
      <div className="baume-container pt-12 md:pt-20 pb-16 md:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-6 baume-reveal">
          <p className="text-[12px] tracking-[0.25em] uppercase text-baume-burgundy/80 font-semibold mb-6">
            Boutique · Genève · Depuis 2021
          </p>
          <h1 className="font-editorial text-[44px] md:text-[56px] leading-[1.05] md:leading-[64px] text-baume-charcoal max-w-[580px]">
            Prenez soin de votre intimité
            <span className="italic text-baume-burgundy"> à chaque étape</span> de votre vie.
          </h1>
          <p className="mt-6 text-[18px] md:text-[20px] leading-[28px] md:leading-[32px] text-baume-charcoal/75 max-w-[520px]">
            Des produits choisis avec exigence, des conseils humains, et une boutique à Genève.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              to="/shop/besoin"
              data-testid="hero-primary-cta"
              className="group inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark transition-colors"
            >
              Découvrir ma routine
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/shop/produit"
              data-testid="hero-secondary-cta"
              className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-burgundy/5 transition-colors"
            >
              Voir les best-sellers
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-6 text-[13px] text-baume-charcoal/60">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />
              Expédié depuis Genève
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />
              Paiement sécurisé
            </span>
            <span className="hidden sm:flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />
              Retours simplifiés
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 baume-reveal baume-reveal-delay-1">
          <div className="relative">
            <div className="relative aspect-[4/5] md:aspect-[5/6] rounded-[28px] overflow-hidden border border-baume-border bg-baume-taupe/20 baume-grain">
              <img
                src="https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1400&q=85"
                alt="Rituel bien-être intime — ambiance chaleureuse et éditoriale"
                fetchPriority="high"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="hidden md:block absolute -bottom-6 -left-6 bg-baume-white border border-baume-border rounded-2xl p-5 max-w-[240px] shadow-sm">
              <p className="font-editorial italic text-[20px] leading-[26px] text-baume-burgundy">
                « Enfin une marque qui me parle vraiment. »
              </p>
              <p className="mt-2 text-[12px] text-baume-charcoal/60">Claire, 34 ans · Cliente depuis 2023</p>
            </div>
            <div className="hidden md:flex absolute -top-4 -right-4 h-24 w-24 rounded-full bg-baume-burgundy text-baume-white items-center justify-center text-center p-4">
              <span className="text-[11px] leading-[14px] font-semibold uppercase tracking-wider">
                Nouveau
                <br />coffret
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
