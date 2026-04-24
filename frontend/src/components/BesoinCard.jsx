import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export default function BesoinCard({ need }) {
  return (
    <Link
      to={`/shop/besoin/${need.slug}`}
      data-testid={`besoin-card-${need.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-baume-border bg-baume-white transition-all hover:border-baume-burgundy/40"
    >
      <div className="aspect-[4/5] overflow-hidden bg-baume-ivory">
        <img
          src={need.image}
          alt={need.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 bg-gradient-to-t from-black/65 via-black/20 to-transparent">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-editorial text-[24px] md:text-[28px] leading-[32px] text-baume-white">
              {need.name}
            </h3>
            <p className="mt-1 text-[13px] text-baume-white/85 italic">{need.tagline}</p>
          </div>
          <span className="shrink-0 h-10 w-10 rounded-full bg-baume-white text-baume-burgundy inline-flex items-center justify-center group-hover:bg-baume-burgundy group-hover:text-baume-white transition-colors">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
