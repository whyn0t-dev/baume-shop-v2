import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ProductCard from "../components/ProductCard";
import Filters from "../components/Filters";
import { getProducts, getCategories, getCategory } from "../lib/api";
import { useCart } from "../lib/cart";
import { NEEDS, PRODUCT_CATS } from "../lib/constants";

export default function CategoryPage({ kind }) {
  const { slug } = useParams();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(null);
  const [needs, setNeeds] = useState([]);
  const [cats, setCats] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    getCategories("besoin").then(setNeeds).catch(() => setNeeds(NEEDS));
    getCategories("produit").then(setCats).catch(() => setCats(PRODUCT_CATS));
  }, []);

  useEffect(() => {
    if (slug) {
      getCategory(kind, slug).then(setCategory).catch(() => setCategory(null));
    } else {
      setCategory(null);
    }
  }, [kind, slug]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (slug) {
      if (kind === "besoin") params.need = slug;
      else params.category = slug;
    }
    if (filters.need && !(kind === "besoin" && slug)) params.need = filters.need;
    if (filters.category && !(kind === "produit" && slug)) params.category = filters.category;
    if (filters.flux) params.flux = filters.flux;
    if (filters.usage) params.usage = filters.usage;
    if (filters.size) params.size = filters.size;
    if (filters.max_price) params.max_price = filters.max_price;
    if (filters.available) params.available = true;
    getProducts(params)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [kind, slug, filters]);

  const title = category?.name || (kind === "besoin" ? "Shop par besoin" : "Shop par produit");
  const tagline = category?.tagline || (kind === "besoin" ? "Entrez par l'étape de vie qui vous concerne." : "Choisissez par type de produit.");
  const description = category?.description || "Sélection rigoureuse, conseils humains, livraison depuis Genève.";

  const crumbs = useMemo(() => {
    const list = [{ label: "Shop", to: "/shop/besoin" }];
    list.push({ label: kind === "besoin" ? "Par besoin" : "Par produit", to: `/shop/${kind}` });
    if (category) list.push({ label: category.name });
    return list;
  }, [kind, category]);

  const showNeedsFilter = !(kind === "besoin" && slug);
  const showCatsFilter = !(kind === "produit" && slug);

  return (
    <div data-testid={`category-page-${kind}`} className="bg-baume-ivory">
      <div className="baume-container pt-8 md:pt-10 pb-4">
        <Breadcrumb items={crumbs} />
      </div>
      <div className="baume-container pb-10 md:pb-14">
        <h1 className="font-editorial text-[36px] md:text-[48px] leading-[1.1] text-baume-charcoal max-w-[720px]">
          {title}
          <span className="block italic text-baume-burgundy text-[22px] md:text-[26px] font-medium mt-2">{tagline}</span>
        </h1>
        <p className="mt-5 text-[16px] md:text-[18px] leading-[28px] text-baume-charcoal/70 max-w-[640px]">{description}</p>
      </div>

      <div className="baume-container pb-24 flex flex-col lg:flex-row gap-8">
        <Filters
          filters={filters}
          setFilters={setFilters}
          needs={showNeedsFilter ? needs : []}
          cats={showCatsFilter ? cats : []}
          onReset={() => setFilters({})}
        />

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[14px] text-baume-charcoal/70" data-testid="results-count">
              {loading ? "Chargement…" : `${products.length} produit${products.length > 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Inline conseil */}
          <div className="mb-6 rounded-2xl border border-baume-border bg-baume-white px-5 py-4 flex flex-col md:flex-row items-start md:items-center gap-3">
            <p className="font-editorial italic text-[18px] text-baume-burgundy">Besoin d'aide pour choisir ?</p>
            <p className="text-[14px] text-baume-charcoal/70">
              Consultez notre guide, ou contactez une experte — conseil gratuit et discret.
            </p>
            <Link to="/contact" className="md:ml-auto baume-link text-[14px] font-semibold">Nous contacter →</Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onQuickAdd={(prod) => addItem(prod, { quantity: 1 })} />
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-2xl border border-baume-border bg-baume-white p-10 text-center">
                <p className="font-editorial text-[22px] text-baume-charcoal">Aucun produit ne correspond à ces filtres.</p>
                <p className="mt-2 text-[14px] text-baume-charcoal/70">Essayez de réinitialiser ou modifier vos critères.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
