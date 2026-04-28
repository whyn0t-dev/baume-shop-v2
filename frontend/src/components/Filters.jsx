import React, { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { SlidersHorizontal, X } from "lucide-react";

const FLUX_OPTIONS = [
	{ value: "leger", label: "Léger" },
	{ value: "moyen", label: "Moyen" },
	{ value: "abondant", label: "Abondant" },
];
const USAGE_OPTIONS = [
	{ value: "jour", label: "Jour" },
	{ value: "nuit", label: "Nuit" },
	{ value: "sport", label: "Sport" },
];
const SIZES = ["XS", "S", "M", "L", "XL"];

function FilterPanel({ filters, setFilters, needs = [], cats = [], onReset }) {
	const toggle = (k, v) =>
		setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));

	return (
		<div className="space-y-8">
			{needs.length > 0 && (
				<div>
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
						Besoin
					</p>
					<ul className="space-y-2">
						{needs.map((n) => (
							<li key={n.slug} className="flex items-center gap-2">
								<Checkbox
									id={`need-${n.slug}`}
									checked={filters.need === n.slug}
									onCheckedChange={() => toggle("need", n.slug)}
									className="border-baume-border data-[state=checked]:bg-baume-burgundy data-[state=checked]:border-baume-burgundy"
								/>
								<label
									htmlFor={`need-${n.slug}`}
									className="text-[14px] text-baume-charcoal cursor-pointer"
								>
									{n.name}
								</label>
							</li>
						))}
					</ul>
				</div>
			)}
			{cats.length > 0 && (
				<div>
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
						Catégorie
					</p>
					<ul className="space-y-2">
						{cats.map((c) => (
							<li key={c.slug} className="flex items-center gap-2">
								<Checkbox
									id={`cat-${c.slug}`}
									checked={filters.category === c.slug}
									onCheckedChange={() => toggle("category", c.slug)}
									className="border-baume-border data-[state=checked]:bg-baume-burgundy data-[state=checked]:border-baume-burgundy"
								/>
								<label
									htmlFor={`cat-${c.slug}`}
									className="text-[14px] text-baume-charcoal cursor-pointer"
								>
									{c.name}
								</label>
							</li>
						))}
					</ul>
				</div>
			)}
			<div>
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
					Flux
				</p>
				<div className="flex flex-wrap gap-2">
					{FLUX_OPTIONS.map((o) => (
						<button
							key={o.value}
							onClick={() => toggle("flux", o.value)}
							data-testid={`filter-flux-${o.value}`}
							className={`h-9 px-4 rounded-full border text-[13px] font-medium transition-colors ${filters.flux === o.value ? "bg-baume-burgundy text-baume-white border-baume-burgundy" : "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"}`}
						>
							{o.label}
						</button>
					))}
				</div>
			</div>
			<div>
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
					Usage
				</p>
				<div className="flex flex-wrap gap-2">
					{USAGE_OPTIONS.map((o) => (
						<button
							key={o.value}
							onClick={() => toggle("usage", o.value)}
							className={`h-9 px-4 rounded-full border text-[13px] font-medium transition-colors ${filters.usage === o.value ? "bg-baume-burgundy text-baume-white border-baume-burgundy" : "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"}`}
						>
							{o.label}
						</button>
					))}
				</div>
			</div>
			<div>
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
					Taille
				</p>
				<div className="flex flex-wrap gap-2">
					{SIZES.map((s) => (
						<button
							key={s}
							onClick={() => toggle("size", s)}
							className={`h-9 min-w-[40px] px-3 rounded-full border text-[13px] font-medium transition-colors ${filters.size === s ? "bg-baume-burgundy text-baume-white border-baume-burgundy" : "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"}`}
						>
							{s}
						</button>
					))}
				</div>
			</div>
			<div>
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
					Prix : jusqu'à {filters.max_price || 120} CHF
				</p>
				<Slider
					value={[filters.max_price || 120]}
					onValueChange={(v) => setFilters((f) => ({ ...f, max_price: v[0] }))}
					min={10}
					max={120}
					step={5}
					className="[&_[role=slider]]:bg-baume-burgundy [&_[role=slider]]:border-baume-burgundy"
				/>
			</div>
			<div className="flex items-center gap-2">
				<Checkbox
					id="available"
					checked={filters.available === true}
					onCheckedChange={(v) =>
						setFilters((f) => ({ ...f, available: v ? true : null }))
					}
					className="border-baume-border data-[state=checked]:bg-baume-burgundy data-[state=checked]:border-baume-burgundy"
				/>
				<label
					htmlFor="available"
					className="text-[14px] text-baume-charcoal cursor-pointer"
				>
					Uniquement disponibles
				</label>
			</div>
			<Button
				onClick={onReset}
				variant="ghost"
				className="w-full rounded-full border border-baume-border text-baume-burgundy hover:bg-baume-burgundy/5"
				data-testid="filter-reset"
			>
				Réinitialiser les filtres
			</Button>
		</div>
	);
}

export default function Filters({ filters, setFilters, needs, cats, onReset }) {
	const [openMobile, setOpenMobile] = useState(false);
	return (
		<>
			{/* Desktop sticky sidebar */}
			<aside className="hidden lg:block sticky top-[96px] w-full max-w-[260px] h-max pr-4">
				<FilterPanel
					filters={filters}
					setFilters={setFilters}
					needs={needs}
					cats={cats}
					onReset={onReset}
				/>
			</aside>

			{/* Mobile trigger */}
			<div className="lg:hidden mb-4">
				<Sheet open={openMobile} onOpenChange={setOpenMobile}>
					<SheetTrigger asChild>
						<button
							data-testid="mobile-filter-trigger"
							className="h-11 px-5 inline-flex items-center gap-2 rounded-full border border-baume-border bg-baume-white text-[14px] font-semibold text-baume-charcoal"
						>
							<SlidersHorizontal className="h-4 w-4" /> Filtrer
						</button>
					</SheetTrigger>
					<SheetContent
						side="bottom"
						className="bg-baume-ivory h-[85vh] p-0 flex flex-col"
					>
						<SheetHeader className="sr-only">
							<SheetTitle>Filtres</SheetTitle>
							<SheetDescription>Filtrer les produits</SheetDescription>
						</SheetHeader>
						<div className="px-6 py-5 border-b border-baume-border flex items-center justify-between">
							<p className="font-editorial text-[24px] text-baume-burgundy">
								Filtres
							</p>
							<button aria-label="Fermer" onClick={() => setOpenMobile(false)}>
								<X className="h-5 w-5" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-6">
							<FilterPanel
								filters={filters}
								setFilters={setFilters}
								needs={needs}
								cats={cats}
								onReset={onReset}
							/>
						</div>
						<div className="border-t border-baume-border p-4 bg-baume-white">
							<button
								onClick={() => setOpenMobile(false)}
								className="w-full h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold"
							>
								Voir les résultats
							</button>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</>
	);
}
