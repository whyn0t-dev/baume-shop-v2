import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ProductGallery from "../components/ProductGallery";
import ProductCard from "../components/ProductCard";
import ReviewCard from "../components/ReviewCard";
import { getProduct, getProducts, getReviews } from "../lib/api";
import { useCart } from "../lib/cart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Minus, Plus, Star, Truck, ShieldCheck, Store, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    getProduct(slug).then((p) => {
      setProduct(p);
      // Intentionally do NOT pre-select a size — user must choose to avoid silent XS add.
      setSize(null);
      setColor(p.colors?.[0] || null);
      if (p.product_category) {
        getProducts({ category: p.product_category, limit: 8 })
          .then((list) => setRelated(list.filter((x) => x.id !== p.id).slice(0, 4)));
      }
      getReviews(p.id).then(setReviews).catch(() => setReviews([]));
    });
  }, [slug]);

  const crumbs = useMemo(() => {
    if (!product) return [];
    return [
      { label: "Shop", to: "/shop/produit" },
      { label: "Produit", to: "/shop/produit" },
      { label: product.name },
    ];
  }, [product]);

  if (!product) {
    return (
      <div className="baume-container py-24 text-center">
        <p className="font-editorial text-[24px] text-baume-charcoal/70">Chargement…</p>
      </div>
    );
  }

  const handleAdd = () => {
    if (product.sizes?.length > 0 && !size) {
      toast.error("Choisissez une taille", { description: "Merci de sélectionner votre taille avant d'ajouter." });
      return;
    }
    addItem(product, { size, color, quantity: qty });
    toast.success("Ajouté à votre routine", { description: product.name });
  };

  return (
    <div data-testid="product-page" className="bg-baume-ivory">
      <div className="baume-container pt-8">
        <Breadcrumb items={crumbs} />
      </div>

      <div className="baume-container py-8 md:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <ProductGallery images={product.gallery?.length ? product.gallery : [product.image]} alt={product.name} />
        </div>

        {/* Buy box — sticky desktop */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[96px]">
            {product.bestseller && (
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wider bg-baume-burgundy text-baume-white px-2.5 py-1 rounded-full mb-4">
                Best-seller
              </span>
            )}
            <h1 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal">{product.name}</h1>
            <p className="mt-2 text-[17px] leading-[26px] text-baume-charcoal/70">{product.tagline}</p>
            <div className="mt-4 flex items-center gap-2 text-[14px]">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-baume-burgundy text-baume-burgundy" : "text-baume-border"}`} />
                ))}
              </div>
              <span className="text-baume-charcoal/60">
                {product.rating.toFixed(1)} · {product.reviews_count} avis
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span data-testid="product-price" className="font-editorial text-[32px] leading-none text-baume-charcoal">
                {product.price.toFixed(2)} CHF
              </span>
              {product.compare_price && (
                <span className="text-[16px] text-baume-charcoal/40 line-through">
                  {product.compare_price.toFixed(2)}
                </span>
              )}
            </div>

            {/* Benefits */}
            {product.benefits?.length > 0 && (
              <ul className="mt-6 space-y-2">
                {product.benefits.slice(0, 5).map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] leading-[22px] text-baume-charcoal/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-baume-burgundy" />
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {/* Size */}
            {product.sizes?.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-baume-charcoal">Choisir ma taille</p>
                  <button className="text-[12px] text-baume-burgundy baume-link">Guide des tailles</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      data-testid={`size-option-${s}`}
                      className={`h-11 min-w-[52px] px-4 rounded-full border text-[14px] font-medium transition-colors ${size === s ? "bg-baume-burgundy text-baume-white border-baume-burgundy" : "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/60"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            {product.colors?.length > 0 && (
              <div className="mt-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-baume-charcoal">Couleur</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-10 px-4 rounded-full border text-[13px] font-medium transition-colors ${color === c ? "bg-baume-burgundy text-baume-white border-baume-burgundy" : "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/60"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Qty + CTA */}
            <div className="mt-8 flex items-stretch gap-3">
              <div className="inline-flex items-center rounded-full border border-baume-border bg-baume-white">
                <button aria-label="Diminuer" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-12 w-12 inline-flex items-center justify-center">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-medium" data-testid="product-qty">{qty}</span>
                <button aria-label="Augmenter" onClick={() => setQty((q) => q + 1)} className="h-12 w-12 inline-flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                data-testid="add-to-cart-button"
                onClick={handleAdd}
                className="flex-1 h-12 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark transition-colors"
              >
                Ajouter à ma routine
              </button>
            </div>

            {/* Logistics unified block */}
            <div className="mt-8 rounded-2xl border border-baume-border bg-baume-white divide-y divide-baume-border">
              <div className="flex items-center gap-3 p-4">
                <Truck className="h-5 w-5 text-baume-burgundy shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-baume-charcoal">Livraison 2 à 5 jours</p>
                  <p className="text-[12px] text-baume-charcoal/65">Offerte dès 60 CHF en Suisse</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <Store className="h-5 w-5 text-baume-burgundy shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-baume-charcoal">Retrait boutique disponible</p>
                  <p className="text-[12px] text-baume-charcoal/65">Rue du Rhône 15, Genève</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <ShieldCheck className="h-5 w-5 text-baume-burgundy shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-baume-charcoal">Retours sous 30 jours</p>
                  <p className="text-[12px] text-baume-charcoal/65">Simple et gratuit en Suisse</p>
                </div>
              </div>
            </div>

            {/* Help block */}
            <div className="mt-6 rounded-2xl bg-baume-taupe/25 border border-baume-border p-5 flex gap-3 items-start">
              <MessageCircle className="h-5 w-5 text-baume-burgundy mt-0.5 shrink-0" />
              <div>
                <p className="font-editorial italic text-[18px] text-baume-burgundy">Besoin d'aide pour choisir ?</p>
                <p className="text-[13px] text-baume-charcoal/70">
                  Nos expertes vous répondent avec douceur et précision.{" "}
                  <Link to="/contact" className="baume-link">Parlez-nous</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordions */}
      <div className="baume-container pb-16 max-w-[900px]">
        <Accordion type="single" collapsible className="space-y-3">
          <AccordionItem value="description" className="bg-baume-white border border-baume-border rounded-2xl px-5">
            <AccordionTrigger className="py-5 font-editorial text-[20px] text-baume-charcoal hover:no-underline">
              Description
            </AccordionTrigger>
            <AccordionContent className="text-[15px] leading-[24px] text-baume-charcoal/80 pb-5">
              {product.description}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="composition" className="bg-baume-white border border-baume-border rounded-2xl px-5">
            <AccordionTrigger className="py-5 font-editorial text-[20px] text-baume-charcoal hover:no-underline">Composition</AccordionTrigger>
            <AccordionContent className="text-[15px] leading-[24px] text-baume-charcoal/80 pb-5">{product.composition}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="utilisation" className="bg-baume-white border border-baume-border rounded-2xl px-5">
            <AccordionTrigger className="py-5 font-editorial text-[20px] text-baume-charcoal hover:no-underline">Comment l'utiliser ?</AccordionTrigger>
            <AccordionContent className="text-[15px] leading-[24px] text-baume-charcoal/80 pb-5">{product.how_to_use}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="livraison" className="bg-baume-white border border-baume-border rounded-2xl px-5">
            <AccordionTrigger className="py-5 font-editorial text-[20px] text-baume-charcoal hover:no-underline">Livraison & retours</AccordionTrigger>
            <AccordionContent className="text-[15px] leading-[24px] text-baume-charcoal/80 pb-5">
              Livraison Suisse 2-3 jours (6.90 CHF, offerte dès 60 CHF). Europe 3-5 jours. Retrait boutique Genève.
              Retours sous 30 jours (hors produits d'hygiène intime ouverts).
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="fabrication" className="bg-baume-white border border-baume-border rounded-2xl px-5">
            <AccordionTrigger className="py-5 font-editorial text-[20px] text-baume-charcoal hover:no-underline">Fabrication</AccordionTrigger>
            <AccordionContent className="text-[15px] leading-[24px] text-baume-charcoal/80 pb-5">{product.fabrication}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="bg-baume-white border-y border-baume-border">
          <div className="baume-container py-16">
            <h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-8">Avis clients</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          </div>
        </section>
      )}

      {/* Cross-sell */}
      {related.length > 0 && (
        <section className="baume-container py-16">
          <h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-8">Vous aimerez aussi</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p) => <ProductCard key={p.id} product={p} onQuickAdd={(prod) => addItem(prod, { quantity: 1 })} />)}
          </div>
        </section>
      )}

      {/* Mobile sticky ATC */}
      <div className="lg:hidden sticky bottom-0 z-30 bg-baume-white border-t border-baume-border p-3 flex items-center gap-3">
        <div>
          <p className="text-[11px] text-baume-charcoal/60 leading-none">{product.name}</p>
          <p className="text-[16px] font-semibold text-baume-charcoal mt-1">{product.price.toFixed(2)} CHF</p>
        </div>
        <button
          onClick={handleAdd}
          data-testid="sticky-add-to-cart-mobile"
          className="flex-1 h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]"
        >
          Ajouter à ma routine
        </button>
      </div>
    </div>
  );
}
