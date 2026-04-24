import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ArticleCard from "../components/ArticleCard";
import { getGuides, getGuide } from "../lib/api";

export function GuidesIndexPage() {
  const [guides, setGuides] = useState([]);
  useEffect(() => { getGuides().then(setGuides).catch(() => {}); }, []);

  return (
    <div data-testid="guides-page" className="bg-baume-ivory">
      <div className="baume-container pt-8">
        <Breadcrumb items={[{ label: "Guides & conseils" }]} />
      </div>
      <div className="baume-container py-10 md:py-14">
        <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">Ressources</p>
        <h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05] text-baume-charcoal max-w-[720px]">
          Guides & conseils <span className="italic">pour avancer en confiance</span>.
        </h1>
        <p className="mt-5 text-[17px] leading-[28px] text-baume-charcoal/70 max-w-[640px]">
          Rédigés avec nos expertes, revus par notre gynécologue partenaire. Tout ce qu'il faut savoir, sans jargon.
        </p>
      </div>
      <div className="baume-container pb-24 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {guides.map((g, i) => <ArticleCard key={g.slug} guide={g} featured={i === 0} />)}
      </div>
    </div>
  );
}

export function GuideDetailPage() {
  const { slug } = useParams();
  const [guide, setGuide] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    getGuide(slug).then(setGuide).catch(() => setGuide(null));
  }, [slug]);

  if (!guide) {
    return <div className="baume-container py-24 text-center text-baume-charcoal/60">Chargement…</div>;
  }

  return (
    <div data-testid="guide-detail-page" className="bg-baume-ivory">
      <div className="baume-container pt-8">
        <Breadcrumb items={[{ label: "Guides", to: "/guides" }, { label: guide.title }]} />
      </div>
      <article className="baume-container py-10 md:py-14 max-w-[780px]">
        <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">{guide.category}</p>
        <h1 className="font-editorial text-[36px] md:text-[48px] leading-[1.1] text-baume-charcoal">{guide.title}</h1>
        <p className="mt-4 text-[14px] text-baume-charcoal/60">{guide.read_time} de lecture</p>
        <div className="mt-8 aspect-[16/9] rounded-2xl overflow-hidden border border-baume-border">
          <img src={guide.image} alt={guide.title} className="w-full h-full object-cover" />
        </div>
        <p className="mt-8 font-editorial italic text-[22px] leading-[32px] text-baume-burgundy">{guide.excerpt}</p>
        <div className="mt-8 text-[17px] leading-[30px] text-baume-charcoal/85 whitespace-pre-line">{guide.content}</div>

        <div className="mt-14 p-6 md:p-8 rounded-2xl bg-baume-taupe/25 border border-baume-border">
          <p className="font-editorial text-[22px] italic text-baume-burgundy">Besoin d'un conseil personnalisé ?</p>
          <p className="mt-2 text-[15px] text-baume-charcoal/75">Nos expertes vous répondent avec douceur et précision, en boutique ou à distance.</p>
          <Link to="/contact" className="mt-5 inline-flex h-11 px-6 items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]">
            Parlez-nous
          </Link>
        </div>
      </article>
    </div>
  );
}
