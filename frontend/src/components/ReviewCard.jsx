import React, { useState } from "react";
import { Star, ShieldCheck } from "lucide-react";

export default function ReviewCard({ review }) {
  const [lightbox, setLightbox] = useState(null);

  // Compatibilité ancien (content) + nouveau (body) modèle
  const text = review.body || review.content || "";
  const images = review.images || [];
  const date = review.date || review.created_at;

  return (
    <>
      <article
        data-testid={`review-card-${review.id}`}
        className="bg-baume-white border border-baume-border rounded-2xl p-6 flex flex-col gap-3"
      >
        {/* ── Note ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.round(review.rating)
                    ? "fill-baume-burgundy text-baume-burgundy"
                    : "text-baume-border"
                }`}
              />
            ))}
          </div>

          {review.verified_purchase && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-baume-charcoal/50">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Achat vérifié
            </span>
          )}
        </div>

        {/* ── Titre ── */}
        {review.title && (
          <p className="font-editorial text-[19px] leading-[26px] text-baume-charcoal">
            « {review.title} »
          </p>
        )}

        {/* ── Corps ── */}
        <p className="text-[14px] leading-[22px] text-baume-charcoal/75 flex-1">
          {text}
        </p>

        {/* ── Photos ── */}
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap pt-1">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightbox(src)}
                className="w-16 h-16 rounded-xl overflow-hidden border border-baume-border bg-baume-ivory shrink-0 hover:opacity-80 transition-opacity"
              >
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* ── Auteur / date ── */}
        <p className="pt-3 text-[13px] text-baume-charcoal/55 font-medium border-t border-baume-border/60">
          {review.author}
          {date && (
            <>
              {" · "}
              {new Date(date).toLocaleDateString("fr-CH", {
                month: "long",
                year: "numeric",
              })}
            </>
          )}
        </p>
      </article>

      {/* ── Lightbox photo ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Aperçu"
            className="max-h-[85vh] max-w-full rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}