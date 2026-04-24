import React from "react";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

export default function ProductCard({ product, onQuickAdd }) {
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  return (
    <article
      data-testid={`product-card-${product.slug}`}
      className="group relative bg-baume-white border border-baume-border rounded-2xl overflow-hidden flex flex-col transition-all hover:border-baume-burgundy/30"
    >
      <Link to={`/produit/${product.slug}`} className="block aspect-[4/5] bg-baume-ivory overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </Link>
      {product.bestseller && (
        <span className="absolute top-3 left-3 bg-baume-burgundy text-baume-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full">
          Best-seller
        </span>
      )}
      {hasDiscount && (
        <span className="absolute top-3 right-3 bg-baume-ivory text-baume-burgundy text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-baume-border">
          Coffret
        </span>
      )}
      <div className="p-5 flex-1 flex flex-col">
        <Link to={`/produit/${product.slug}`} className="flex-1">
          <h3 className="font-editorial text-[22px] leading-[28px] text-baume-charcoal group-hover:text-baume-burgundy transition-colors">
            {product.name}
          </h3>
          <p className="mt-1 text-[13px] leading-[20px] text-baume-charcoal/65 line-clamp-2">{product.tagline}</p>
        </Link>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-[16px] text-baume-charcoal">{product.price.toFixed(2)} CHF</span>
            {hasDiscount && (
              <span className="text-[13px] text-baume-charcoal/40 line-through">
                {product.compare_price.toFixed(2)}
              </span>
            )}
          </div>
          {onQuickAdd && (!product.sizes?.length || product.sizes.length <= 1) && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onQuickAdd(product);
              }}
              data-testid={`quick-add-${product.slug}`}
              aria-label={`Ajouter ${product.name} au panier`}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full bg-baume-ivory text-baume-burgundy text-[12px] font-semibold hover:bg-baume-burgundy hover:text-baume-white transition-colors border border-baume-border"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Ajout rapide
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
