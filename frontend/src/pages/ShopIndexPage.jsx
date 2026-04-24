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
    getCategories(kind).then(setItems).catch(() => setItems(kind === "besoin" ? NEEDS : PRODUCT_CATS));
  }, [kind]);

  const title = kind === "besoin" ? "Shop par besoin" : "Shop par produit";
  const tagline = kind === "besoin" ? "Entrez par votre besoin, nous vous guidons." : "Trouvez le format qui vous correspond.";

  return (
    <div data-testid={`shop-index-${kind}`} className="bg-baume-ivory">
      <div className="baume-container pt-8 md:pt-10">
        <Breadcrumb items={[{ label: title }]} />
      </div>
      <div className="baume-container py-10 md:py-14">
        <h1 className="font-editorial text-[36px] md:text-[56px] leading-[1.05] text-baume-charcoal max-w-[780px]">
          {title}
          <span className="block italic text-baume-burgundy text-[22px] md:text-[28px] font-medium mt-3">{tagline}</span>
        </h1>
      </div>

      {kind === "besoin" ? (
        <div className="baume-container pb-24 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {items.map((n) => <BesoinCard key={n.slug} need={n} />)}
        </div>
      ) : (
        <div className="baume-container pb-24 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {items.map((c) => (
            <Link
              key={c.slug}
              to={`/shop/produit/${c.slug}`}
              data-testid={`produit-card-${c.slug}`}
              className="group bg-baume-white border border-baume-border rounded-2xl overflow-hidden transition-all hover:border-baume-burgundy/40"
            >
              <div className="aspect-square bg-baume-ivory overflow-hidden">
                <img src={c.image} alt={c.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-4">
                <h3 className="font-editorial text-[20px] leading-[26px] text-baume-charcoal group-hover:text-baume-burgundy transition-colors">
                  {c.name}
                </h3>
                <p className="mt-1 text-[13px] text-baume-charcoal/65 line-clamp-2">{c.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-baume-burgundy">
                  Explorer <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
