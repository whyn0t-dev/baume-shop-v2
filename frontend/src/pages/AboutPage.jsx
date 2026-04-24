import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ExpertCard from "../components/ExpertCard";
import { Heart, Sparkles, Users, Leaf } from "lucide-react";
import { getExperts } from "../lib/api";

const VALUES = [
  { icon: Heart, title: "Écoute & bienveillance", desc: "Un conseil jamais moralisateur, toujours adapté à votre étape de vie." },
  { icon: Sparkles, title: "Exigence de sélection", desc: "Chaque produit est testé et validé par notre équipe avant intégration." },
  { icon: Leaf, title: "Impact mesuré", desc: "Matières certifiées, emballages réduits, fabrication européenne dès que possible." },
  { icon: Users, title: "Communauté informée", desc: "Guides, ateliers, expertes — pour comprendre et décider en confiance." },
];

export default function AboutPage() {
  const [experts, setExperts] = React.useState([]);
  React.useEffect(() => {
    getExperts().then(setExperts).catch(() => {});
  }, []);

  return (
    <div data-testid="about-page" className="bg-baume-ivory">
      <div className="baume-container pt-8">
        <Breadcrumb items={[{ label: "À propos" }]} />
      </div>

      {/* Hero */}
      <section className="baume-container py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6">
          <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-4">Notre mission</p>
          <h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05] text-baume-charcoal">
            Accompagner les femmes, <span className="italic text-baume-burgundy">à chaque étape</span>.
          </h1>
          <p className="mt-6 text-[18px] leading-[28px] text-baume-charcoal/75 max-w-[560px]">
            Baume est née en 2021 à Genève, d'une envie simple : rassembler, sous un même toit, des produits
            intimes et menstruels exigeants, et un vrai accompagnement humain. Pas de sur-promesse, pas de ton
            moralisateur, pas de produits choisis au hasard.
          </p>
        </div>
        <div className="lg:col-span-6">
          <div className="aspect-[5/6] rounded-[24px] overflow-hidden border border-baume-border">
            <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1200&q=80" alt="L'équipe Baume" loading="lazy" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-baume-white border-y border-baume-border">
        <div className="baume-container py-16 md:py-20">
          <h2 className="font-editorial text-[32px] md:text-[40px] text-baume-charcoal mb-12 max-w-[560px]">
            Nos valeurs, tenues au quotidien.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl border border-baume-border p-6 md:p-8 bg-baume-white flex gap-4">
                <span className="shrink-0 h-12 w-12 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center">
                  <v.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-editorial text-[22px] text-baume-charcoal">{v.title}</h3>
                  <p className="mt-1 text-[15px] leading-[24px] text-baume-charcoal/75">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founders / Experts */}
      <section className="baume-container py-16 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-2">L'équipe</p>
            <h2 className="font-editorial text-[32px] md:text-[40px] text-baume-charcoal max-w-[520px]">
              Des femmes qui <span className="italic">accompagnent</span>
            </h2>
          </div>
          <Link to="/ateliers" className="baume-link">Voir les ateliers</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {experts.map((e) => <ExpertCard key={e.id} expert={e} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-baume-burgundy text-baume-white">
        <div className="baume-container py-16 md:py-20 text-center">
          <h2 className="font-editorial text-[32px] md:text-[40px] leading-[1.1]">Venez nous rencontrer à Genève</h2>
          <p className="mt-4 text-[16px] md:text-[18px] text-baume-white/85 max-w-[560px] mx-auto">
            Rue du Rhône 15. Conseil, retrait de commande, ateliers mensuels.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/boutique-geneve" className="h-12 px-8 inline-flex items-center rounded-full bg-baume-white text-baume-burgundy font-semibold text-[15px]">Voir la boutique</Link>
            <Link to="/shop/produit" className="h-12 px-8 inline-flex items-center rounded-full border border-baume-white/70 text-baume-white font-semibold text-[15px]">Découvrir nos produits</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
