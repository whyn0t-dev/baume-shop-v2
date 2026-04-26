import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import BesoinCard from "../components/BesoinCard";
import { getCategories } from "../lib/api";
import { NEEDS, PRODUCT_CATS } from "../lib/constants";
import { ArrowRight } from "lucide-react";

export default function ShopIndexPage({ kind }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getCategories(kind)
      .then(setItems)
      .catch(() =>
        setItems(kind === "besoin" ? NEEDS : PRODUCT_CATS)
      );
  }, [kind]);

  const title =
    kind === "besoin"
      ? "Nos solutions par besoin"
      : "Nos collections produits";

  const tagline =
    kind === "besoin"
      ? "Trouvez la solution adaptée à votre corps et votre moment de vie."
      : "Explorez nos produits sélectionnés avec exigence.";

  return (
    <div data-testid={`shop-index-${kind}`} className="bg-baume-ivory">

      {/* Breadcrumb */}
      <div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 md:pt-10">
        <Breadcrumb items={[{ label: title }]} />
      </div>

      {/* HERO */}
      <section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-14">
        <div className="rounded-[32px] border border-baume-border bg-baume-white px-6 md:px-10 lg:px-12 py-10 md:py-14">

          <p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-4">
            {kind === "besoin" ? "Par besoin" : "Par produit"}
          </p>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.04] text-baume-charcoal max-w-[820px]">
                {title}
              </h1>

              <p className="mt-4 italic text-baume-burgundy text-[22px] md:text-[28px] font-medium">
                {tagline}
              </p>
            </div>

            <Link
              to="/contact"
              className="shrink-0 h-12 px-6 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:opacity-90 transition"
            >
              Besoin d’aide <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* GRID */}
      {kind === "besoin" ? (
        <section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {items.map((n) => (
            <BesoinCard key={n.slug} need={n} />
          ))}
        </section>
      ) : (
        <section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {items.map((c) => (
            <Link
              key={c.slug}
              to={`/shop/produit/${c.slug}`}
              data-testid={`produit-card-${c.slug}`}
              className="group bg-baume-white border border-baume-border rounded-3xl overflow-hidden transition-all hover:border-baume-burgundy/40 hover:shadow-sm"
            >
              <div className="aspect-square bg-baume-ivory overflow-hidden">
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              <div className="p-5">
                <h3 className="font-editorial text-[20px] leading-[26px] text-baume-charcoal group-hover:text-baume-burgundy transition-colors">
                  {c.name}
                </h3>

                <p className="mt-2 text-[13px] text-baume-charcoal/65 line-clamp-2">
                  {c.tagline}
                </p>

                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-baume-burgundy">
                  Explorer <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}