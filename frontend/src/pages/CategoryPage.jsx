import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
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

  const title =
    category?.name || (kind === "besoin" ? "Shop par besoin" : "Shop par produit");

  const tagline =
    category?.tagline ||
    (kind === "besoin"
      ? "Trouvez une sélection adaptée à votre besoin."
      : "Explorez les produits par catégorie.");

  const description =
    category?.description ||
    "Une sélection rigoureuse, des conseils humains et une livraison depuis Genève.";

  const crumbs = useMemo(() => {
    const list = [{ label: "Shop", to: "/shop/besoin" }];
    list.push({
      label: kind === "besoin" ? "Par besoin" : "Par produit",
      to: `/shop/${kind}`,
    });
    if (category) list.push({ label: category.name });
    return list;
  }, [kind, category]);

  const showNeedsFilter = !(kind === "besoin" && slug);
  const showCatsFilter = !(kind === "produit" && slug);

  return (
    <div data-testid={`category-page-${kind}`} className="bg-baume-ivory">
      <div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 md:pt-10 pb-4">
        <Breadcrumb items={crumbs} />
      </div>

      <section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-10 md:pb-14">
        <div className="rounded-[32px] border border-baume-border bg-baume-white px-6 md:px-10 lg:px-12 py-10 md:py-14">
          <p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-4">
            {kind === "besoin" ? "Shop par besoin" : "Shop par produit"}
          </p>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.04] text-baume-charcoal max-w-[820px]">
                {title}
              </h1>

              <p className="mt-4 italic text-baume-burgundy text-[22px] md:text-[28px] font-medium">
                {tagline}
              </p>

              <p className="mt-5 text-[16px] md:text-[18px] leading-[29px] text-baume-charcoal/70 max-w-[720px]">
                {description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                to="/contact"
                className="h-12 px-6 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
              >
                Besoin d’aide <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/guides"
                className="h-12 px-6 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[14px] hover:bg-baume-ivory transition-colors"
              >
                Lire les guides
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
        <div className="flex flex-col xl:flex-row gap-8">
          <aside className="xl:w-[310px] shrink-0">
            <div className="xl:sticky xl:top-[150px] rounded-3xl border border-baume-border bg-baume-white p-5">
              <div className="flex items-center gap-2 mb-5">
                <SlidersHorizontal className="h-5 w-5 text-baume-burgundy" />
                <p className="font-editorial text-[24px] text-baume-charcoal">
                  Filtrer
                </p>
              </div>

              <Filters
                filters={filters}
                setFilters={setFilters}
                needs={showNeedsFilter ? needs : []}
                cats={showCatsFilter ? cats : []}
                onReset={() => setFilters({})}
              />
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="mb-6 rounded-3xl border border-baume-border bg-baume-white px-5 md:px-6 py-4 flex flex-col md:flex-row md:items-center gap-3">
              <div>
                <p className="font-editorial italic text-[20px] text-baume-burgundy">
                  Besoin d’aide pour choisir ?
                </p>
                <p className="text-[14px] text-baume-charcoal/70">
                  Consultez notre guide, ou contactez une experte — conseil gratuit et discret.
                </p>
              </div>

              <Link
                to="/contact"
                className="md:ml-auto inline-flex items-center gap-2 text-[14px] font-semibold text-baume-burgundy hover:underline underline-offset-4"
              >
                Nous contacter <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mb-6 flex items-center justify-between gap-4">
              <p
                className="text-[14px] text-baume-charcoal/70"
                data-testid="results-count"
              >
                {loading
                  ? "Chargement…"
                  : `${products.length} produit${products.length > 1 ? "s" : ""} trouvé${
                      products.length > 1 ? "s" : ""
                    }`}
              </p>

              <button
                type="button"
                onClick={() => setFilters({})}
                className="text-[14px] font-medium text-baume-burgundy hover:underline underline-offset-4"
              >
                Réinitialiser
              </button>
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onQuickAdd={(prod) => addItem(prod, { quantity: 1 })}
                  />
                ))}
              </div>
            ) : (
              !loading && (
                <div className="rounded-3xl border border-baume-border bg-baume-white p-10 md:p-14 text-center">
                  <p className="font-editorial text-[28px] text-baume-charcoal">
                    Aucun produit ne correspond à ces filtres.
                  </p>
                  <p className="mt-3 text-[15px] text-baume-charcoal/70">
                    Essayez de réinitialiser ou modifier vos critères.
                  </p>

                  <button
                    type="button"
                    onClick={() => setFilters({})}
                    className="mt-6 h-12 px-7 inline-flex items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              )
            )}
          </main>
        </div>
      </section>
    </div>
  );
}