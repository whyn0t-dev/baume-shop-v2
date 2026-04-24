import React, { useEffect, useState } from "react";
import Breadcrumb from "../components/Breadcrumb";
import ExpertCard from "../components/ExpertCard";
import { Clock, MapPin, Phone, Calendar } from "lucide-react";
import { getExperts } from "../lib/api";
import { Link } from "react-router-dom";

export default function StorePage() {
  const [experts, setExperts] = useState([]);
  useEffect(() => {
    getExperts().then(setExperts).catch(() => {});
  }, []);

  return (
    <div data-testid="store-page" className="bg-baume-ivory">
      <div className="baume-container pt-8">
        <Breadcrumb items={[{ label: "Boutique Genève" }]} />
      </div>

      {/* Hero */}
      <section className="baume-container py-10 md:py-14">
        <div className="relative rounded-[24px] overflow-hidden border border-baume-border aspect-[16/9] md:aspect-[21/9]">
          <img
            src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1800&q=85"
            alt="Boutique Baume Genève"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-12 text-baume-white">
            <p className="text-[12px] uppercase tracking-[0.2em] text-baume-white/80 font-semibold mb-3">Notre boutique</p>
            <h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05]">
              Un cocon au cœur <span className="italic">de Genève</span>
            </h1>
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="baume-container pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4">
            <div className="flex gap-3"><MapPin className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
              <div><p className="font-semibold text-baume-charcoal">Adresse</p><p className="text-baume-charcoal/70">Rue du Rhône 15, 1204 Genève</p></div>
            </div>
            <div className="flex gap-3"><Clock className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
              <div><p className="font-semibold text-baume-charcoal">Horaires</p>
                <p className="text-baume-charcoal/70">Mardi – Vendredi · 10h – 19h</p>
                <p className="text-baume-charcoal/70">Samedi · 10h – 18h</p>
                <p className="text-baume-charcoal/70">Dimanche & Lundi · fermé</p>
              </div>
            </div>
            <div className="flex gap-3"><Phone className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
              <div><p className="font-semibold text-baume-charcoal">Téléphone</p><p className="text-baume-charcoal/70">+41 22 000 00 00</p></div>
            </div>
            <div className="flex gap-3"><Calendar className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
              <div><p className="font-semibold text-baume-charcoal">Rendez-vous</p><p className="text-baume-charcoal/70">Conseil personnalisé sur réservation.</p></div>
            </div>
            <Link to="/contact" className="mt-2 inline-flex h-11 px-6 items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]">Prendre rendez-vous</Link>
          </div>

          <div className="rounded-2xl overflow-hidden border border-baume-border aspect-[4/3]">
            <iframe
              title="Carte Baume Genève"
              src="https://www.openstreetmap.org/export/embed.html?bbox=6.142,46.200,6.162,46.210&layer=mapnik&marker=46.205,6.152"
              className="w-full h-full"
              loading="lazy"
            />
          </div>
        </div>

        <div className="lg:col-span-7">
          <h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-2">
            Une expérience calme, intime et experte
          </h2>
          <p className="text-[17px] leading-[28px] text-baume-charcoal/75 max-w-[560px]">
            Nous avons pensé la boutique comme un lieu de dialogue : pas de jargon, pas de pression de vente.
            Une conseillère prend le temps, seule avec vous, pour comprendre votre besoin et trouver la bonne solution.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="aspect-square rounded-xl overflow-hidden border border-baume-border">
              <img src="https://images.unsplash.com/photo-1714648893954-3744b033f226?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="aspect-square rounded-xl overflow-hidden border border-baume-border">
              <img src="https://images.unsplash.com/photo-1745565610492-b70156cec381?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="aspect-square rounded-xl overflow-hidden border border-baume-border col-span-2">
              <img src="https://images.unsplash.com/photo-1777008873256-fcdf52ae61b3?crop=entropy&cs=srgb&fm=jpg&w=1800&q=80" alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          <h3 className="mt-12 font-editorial text-[24px] text-baume-charcoal mb-6">Nos expertes en boutique</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {experts.slice(0, 2).map((e) => <ExpertCard key={e.id} expert={e} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
