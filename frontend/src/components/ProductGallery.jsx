import React, { useState } from "react";

export default function ProductGallery({ images = [], alt }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [];
  if (!list.length) return null;
  return (
    <div className="flex gap-3">
      <div className="hidden md:flex flex-col gap-2 w-[72px] shrink-0">
        {list.map((src, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            data-testid={`gallery-thumb-${i}`}
            aria-label={`Afficher image ${i + 1}`}
            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === active ? "border-baume-burgundy" : "border-baume-border hover:border-baume-burgundy/40"}`}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <div className="flex-1 aspect-[4/5] rounded-2xl overflow-hidden border border-baume-border bg-baume-ivory">
        <img src={list[active]} alt={alt} className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
