import React from "react";
import { Star } from "lucide-react";

export default function ReviewCard({ review }) {
  return (
    <article
      data-testid={`review-card-${review.id}`}
      className="bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 flex flex-col gap-3"
    >
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < review.rating ? "fill-baume-burgundy text-baume-burgundy" : "text-baume-border"}`}
          />
        ))}
      </div>
      <p className="font-editorial text-[20px] leading-[28px] text-baume-charcoal">« {review.title} »</p>
      <p className="text-[14px] leading-[22px] text-baume-charcoal/75">{review.content}</p>
      <p className="mt-auto pt-3 text-[13px] text-baume-charcoal/60 font-medium border-t border-baume-border/60">
        {review.author} · {new Date(review.date).toLocaleDateString("fr-CH", { month: "long", year: "numeric" })}
      </p>
    </article>
  );
}
