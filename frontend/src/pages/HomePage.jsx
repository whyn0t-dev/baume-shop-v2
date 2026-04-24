import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Clock, Calendar } from "lucide-react";
import Hero from "../components/Hero";
import BesoinCard from "../components/BesoinCard";
import ProductCard from "../components/ProductCard";
import ReviewCard from "../components/ReviewCard";
import TrustBar from "../components/TrustBar";
import ArticleCard from "../components/ArticleCard";
import ExpertCard from "../components/ExpertCard";
import { getCategories, getProducts, getReviews, getGuides, getExperts } from "../lib/api";
import { useCart } from "../lib/cart";

export default function HomePage() {
  const [needs, setNeeds] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [guides, setGuides] = useState([]);
  const [experts, setExperts] = useState([]);
  const { addItem } = useCart();

  useEffect(() => {
    getCategories("besoin").then(setNeeds).catch(() => {});
    getProducts({ bestseller: true, limit: 8 }).then(setBestsellers).catch(() => {});
    getReviews().then((r) => setReviews(r.slice(0, 3))).catch(() => {});
    getGuides().then((g) => setGuides(g.slice(0, 3))).catch(() => {});
    getExperts().then(setExperts).catch(() => {});
  }, []);

  return (
    <div data-testid="home-page">
      <Hero />
      <TrustBar />

      {/* Shop par besoin */}
      <section className="baume-container py-16 md:py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 md:mb-14">
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">Par besoin</p>
            <h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal max-w-[520px]">
              Commencez par votre besoin
            </h2>
          </div>
          <Link to="/shop/besoin" className="baume-link">Voir tous les besoins</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {needs.map((n) => <BesoinCard key={n.slug} need={n} />)}
        </div>
      </section>

      {/* Best-sellers */}
      <section className="bg-baume-white border-y border-baume-border">
        <div className="baume-container py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">Best-sellers</p>
              <h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal">
                Plébiscités par vous <span className="italic text-baume-burgundy">· en boutique et en ligne</span>
              </h2>
            </div>
            <Link to="/shop/produit" className="baume-link">Tout voir</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {bestsellers.map((p) => (
              <ProductCard key={p.id} product={p} onQuickAdd={(prod) => addItem(prod, { quantity: 1 })} />
            ))}
          </div>
        </div>
      </section>

      {/* Conseils */}
      <section className="baume-container py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="lg:col-span-5">
            <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
              Nos conseils
            </p>
            <h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal">
              Nos conseils pour <span className="italic">bien choisir</span>
            </h2>
            <p className="mt-5 text-[17px] md:text-[18px] leading-[28px] text-baume-charcoal/75">
              Guides rédigés avec nos expertes : sage-femmes, conseillères, gynécologue partenaire.
              Une ressource précise et non médicalisante, pour avancer en confiance.
            </p>
            <Link
              to="/guides"
              className="mt-8 inline-flex items-center gap-2 h-12 px-7 rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px] hover:bg-baume-burgundy/5 transition-colors"
            >
              Lire les guides <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {guides.map((g, i) => <ArticleCard key={g.slug} guide={g} featured={i === 0} />)}
          </div>
        </div>
      </section>

      {/* Ateliers & experts */}
      <section className="bg-baume-taupe/20 border-y border-baume-border">
        <div className="baume-container py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">
                Ateliers & expertes
              </p>
              <h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal max-w-[520px]">
                Nos expertes vous répondent
              </h2>
            </div>
            <Link to="/ateliers" className="baume-link">Voir les ateliers</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {experts.map((e) => <ExpertCard key={e.id} expert={e} />)}
          </div>
        </div>
      </section>

      {/* Boutique Genève */}
      <section className="baume-container py-16 md:py-24">
        <div className="relative rounded-[28px] overflow-hidden border border-baume-border">
          <div className="aspect-[16/10] md:aspect-[21/9]">
            <img
              src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1600&q=85"
              alt="Intérieur de la boutique Baume à Genève"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-14">
            <p className="text-[12px] uppercase tracking-[0.2em] text-baume-white/80 font-semibold mb-3">Boutique</p>
            <h2 className="font-editorial text-[32px] md:text-[48px] leading-[1.1] text-baume-white max-w-[640px]">
              Passer nous voir <span className="italic">à Genève</span>
            </h2>
            <p className="mt-4 text-[16px] md:text-[18px] leading-[26px] text-baume-white/85 max-w-[520px]">
              Rue du Rhône 15 · Conseil personnalisé, ateliers, retrait de commande.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 md:gap-4 text-[13px] text-baume-white/85">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> 1204 Genève</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Mar–Sam · 10h–19h</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Ateliers mensuels</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/boutique-geneve"
                className="h-12 px-7 inline-flex items-center rounded-full bg-baume-white text-baume-burgundy font-semibold text-[15px] hover:bg-baume-ivory transition-colors"
              >
                Voir les horaires
              </Link>
              <Link
                to="/contact"
                className="h-12 px-7 inline-flex items-center rounded-full border border-baume-white/70 text-baume-white font-semibold text-[15px] hover:bg-white/10 transition-colors"
              >
                Prendre rendez-vous
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-baume-white border-y border-baume-border">
        <div className="baume-container py-16 md:py-24">
          <div className="text-center max-w-[640px] mx-auto mb-12">
            <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">Elles en parlent</p>
            <h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1] text-baume-charcoal">
              Une communauté qui nous fait <span className="italic">confiance</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
