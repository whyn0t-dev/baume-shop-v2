import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductCarousel({ products = [], onQuickAdd }) {
	const scrollRef = useRef(null);

	const scroll = (direction) => {
		const container = scrollRef.current;
		if (!container) return;

		const card = container.firstElementChild;
		const distance = card ? card.getBoundingClientRect().width + 20 : 320;

		container.scrollBy({
			left: direction * distance,
			behavior: "smooth",
		});
	};

	if (!products.length) return null;

	return (
		<div className="relative">
			<div className="flex justify-end gap-2 mb-5">
				<button
					type="button"
					onClick={() => scroll(-1)}
					aria-label="Voir les produits précédents"
					className="w-11 h-11 rounded-full border border-baume-border bg-baume-white flex items-center justify-center text-baume-burgundy hover:bg-baume-ivory transition"
				>
					<ChevronLeft className="w-5 h-5" />
				</button>

				<button
					type="button"
					onClick={() => scroll(1)}
					aria-label="Voir les produits suivants"
					className="w-11 h-11 rounded-full border border-baume-border bg-baume-white flex items-center justify-center text-baume-burgundy hover:bg-baume-ivory transition"
				>
					<ChevronRight className="w-5 h-5" />
				</button>
			</div>

			<div
				ref={scrollRef}
				className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-5"
				style={{
					scrollbarWidth: "none",
					WebkitOverflowScrolling: "touch",
				}}
			>
				{products.map((product) => (
					<div
						key={product.id || product.slug}
						className="flex-none w-[78%] sm:w-[45%] lg:w-[30%] xl:w-[23%] snap-start"
					>
						<ProductCard product={product} onQuickAdd={onQuickAdd} />
					</div>
				))}
			</div>
		</div>
	);
}
