import React, { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "./ui/sheet";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Slider } from "./ui/slider";
import { SlidersHorizontal, X, ChevronDown, Check, RotateCcw } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Filtres boutique — barre horizontale au-dessus des produits
//
//  1. Rangée « sections » : une pastille arrondie par section de produits
//     (catégories). Sur une page déjà filtrée par catégorie, les pastilles
//     affichent les besoins à la place.
//  2. Rangée de boutons arrondis qui ouvrent un petit menu : Besoin, Flux,
//     Usage, Taille, Prix + bascule « Disponibles ».
//  3. Les filtres actifs apparaissent en puces supprimables.
//
// Sur mobile, les pastilles de section restent visibles (défilement
// horizontal) et les autres filtres s'ouvrent dans un panneau du bas.
// ─────────────────────────────────────────────────────────────────────────────

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
const MAX_PRICE = 120;

const pill = (active) =>
	`h-10 px-5 inline-flex items-center gap-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors ${
		active
			? "bg-baume-burgundy text-baume-white border-baume-burgundy"
			: "bg-baume-white text-baume-charcoal border-baume-border hover:border-baume-burgundy/50"
	}`;

const optionBtn = (active) =>
	`h-9 px-4 rounded-full border text-[13px] font-medium transition-colors ${
		active
			? "bg-baume-burgundy text-baume-white border-baume-burgundy"
			: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"
	}`;

function labelFor(list, value, key = "slug") {
	const found = list.find((o) => (o[key] ?? o.value) === value);
	return found ? found.name || found.label : value;
}

// ── Rangée de pastilles « sections » ────────────────────────────────────────
function SectionPills({ items, value, onChange, allLabel }) {
	if (!items.length) return null;
	return (
		<div
			className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			role="tablist"
			aria-label="Sections de produits"
			data-testid="filter-sections"
		>
			<button
				type="button"
				role="tab"
				aria-selected={!value}
				onClick={() => onChange(null)}
				className={pill(!value)}
			>
				{allLabel}
			</button>
			{items.map((it) => (
				<button
					key={it.slug}
					type="button"
					role="tab"
					aria-selected={value === it.slug}
					onClick={() => onChange(value === it.slug ? null : it.slug)}
					className={pill(value === it.slug)}
					data-testid={`filter-section-${it.slug}`}
				>
					{it.name}
				</button>
			))}
		</div>
	);
}

// ── Bouton arrondi qui ouvre un menu ────────────────────────────────────────
function DropdownFilter({ label, activeLabel, children, testId }) {
	const active = !!activeLabel;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button type="button" className={pill(active)} data-testid={testId}>
					{active ? `${label} : ${activeLabel}` : label}
					<ChevronDown className="h-4 w-4 opacity-70" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={8}
				className="w-auto min-w-[220px] max-w-[320px] rounded-3xl border-baume-border bg-baume-white p-4 shadow-lg"
			>
				{children}
			</PopoverContent>
		</Popover>
	);
}

function OptionList({ options, value, onSelect }) {
	return (
		<ul className="flex flex-col gap-1">
			{options.map((o) => {
				const v = o.slug ?? o.value;
				const active = value === v;
				return (
					<li key={v}>
						<button
							type="button"
							onClick={() => onSelect(active ? null : v)}
							className={`w-full flex items-center justify-between gap-3 rounded-full px-4 h-9 text-[14px] transition-colors ${
								active
									? "bg-baume-burgundy/10 text-baume-burgundy font-semibold"
									: "text-baume-charcoal hover:bg-baume-ivory"
							}`}
						>
							{o.name || o.label}
							{active && <Check className="h-4 w-4" />}
						</button>
					</li>
				);
			})}
		</ul>
	);
}

// ── Panneau complet (utilisé dans le panneau mobile) ────────────────────────
function FilterPanel({ filters, setFilters, needs = [], onReset }) {
	const toggle = (k, v) =>
		setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));

	return (
		<div className="space-y-8">
			{needs.length > 0 && (
				<div>
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
						Besoin
					</p>
					<div className="flex flex-wrap gap-2">
						{needs.map((n) => (
							<button
								key={n.slug}
								onClick={() => toggle("need", n.slug)}
								className={optionBtn(filters.need === n.slug)}
							>
								{n.name}
							</button>
						))}
					</div>
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
							className={optionBtn(filters.flux === o.value)}
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
							className={optionBtn(filters.usage === o.value)}
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
							className={`${optionBtn(filters.size === s)} min-w-[44px]`}
						>
							{s}
						</button>
					))}
				</div>
			</div>
			<div>
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-burgundy font-semibold mb-3">
					Prix : jusqu'à {filters.max_price || MAX_PRICE} CHF
				</p>
				<Slider
					value={[filters.max_price || MAX_PRICE]}
					onValueChange={(v) => setFilters((f) => ({ ...f, max_price: v[0] }))}
					min={10}
					max={MAX_PRICE}
					step={5}
					className="[&_[role=slider]]:bg-baume-burgundy [&_[role=slider]]:border-baume-burgundy"
				/>
			</div>
			<button
				type="button"
				onClick={() =>
					setFilters((f) => ({ ...f, available: f.available ? null : true }))
				}
				className={optionBtn(filters.available === true)}
			>
				Uniquement disponibles
			</button>
			<button
				onClick={onReset}
				className="w-full h-11 rounded-full border border-baume-border text-baume-burgundy font-semibold hover:bg-baume-burgundy/5"
				data-testid="filter-reset"
			>
				Réinitialiser les filtres
			</button>
		</div>
	);
}

// ── Composant principal ─────────────────────────────────────────────────────
export default function Filters({
	filters,
	setFilters,
	needs = [],
	cats = [],
	onReset,
}) {
	const [openMobile, setOpenMobile] = useState(false);

	// Les pastilles « sections » montrent les catégories de produits.
	// Si la page est déjà une catégorie (cats vide), elles montrent les besoins.
	const sectionKey = cats.length > 0 ? "category" : "need";
	const sectionItems = cats.length > 0 ? cats : needs;
	const dropdownNeeds = cats.length > 0 ? needs : [];

	const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

	const chips = [
		filters.need && dropdownNeeds.length
			? { k: "need", label: labelFor(needs, filters.need) }
			: null,
		filters.flux
			? { k: "flux", label: `Flux ${labelFor(FLUX_OPTIONS, filters.flux, "value")}` }
			: null,
		filters.usage
			? { k: "usage", label: labelFor(USAGE_OPTIONS, filters.usage, "value") }
			: null,
		filters.size ? { k: "size", label: `Taille ${filters.size}` } : null,
		filters.max_price && filters.max_price < MAX_PRICE
			? { k: "max_price", label: `≤ ${filters.max_price} CHF` }
			: null,
		filters.available ? { k: "available", label: "Disponibles" } : null,
	].filter(Boolean);

	const activeCount = chips.length;

	return (
		<div className="space-y-4" data-testid="filters-bar">
			{/* 1. Sections de produits */}
			<SectionPills
				items={sectionItems}
				value={filters[sectionKey] || null}
				onChange={(v) => set(sectionKey, v)}
				allLabel="Tout voir"
			/>

			{/* 2. Boutons de filtre — desktop */}
			<div className="hidden lg:flex flex-wrap items-center gap-2">
				{dropdownNeeds.length > 0 && (
					<DropdownFilter
						label="Besoin"
						activeLabel={filters.need ? labelFor(needs, filters.need) : null}
						testId="filter-need"
					>
						<OptionList
							options={dropdownNeeds}
							value={filters.need}
							onSelect={(v) => set("need", v)}
						/>
					</DropdownFilter>
				)}
				<DropdownFilter
					label="Flux"
					activeLabel={
						filters.flux ? labelFor(FLUX_OPTIONS, filters.flux, "value") : null
					}
					testId="filter-flux"
				>
					<OptionList
						options={FLUX_OPTIONS}
						value={filters.flux}
						onSelect={(v) => set("flux", v)}
					/>
				</DropdownFilter>
				<DropdownFilter
					label="Usage"
					activeLabel={
						filters.usage ? labelFor(USAGE_OPTIONS, filters.usage, "value") : null
					}
					testId="filter-usage"
				>
					<OptionList
						options={USAGE_OPTIONS}
						value={filters.usage}
						onSelect={(v) => set("usage", v)}
					/>
				</DropdownFilter>
				<DropdownFilter
					label="Taille"
					activeLabel={filters.size || null}
					testId="filter-size"
				>
					<div className="flex flex-wrap gap-2">
						{SIZES.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => set("size", filters.size === s ? null : s)}
								className={`${optionBtn(filters.size === s)} min-w-[44px]`}
							>
								{s}
							</button>
						))}
					</div>
				</DropdownFilter>
				<DropdownFilter
					label="Prix"
					activeLabel={
						filters.max_price && filters.max_price < MAX_PRICE
							? `≤ ${filters.max_price} CHF`
							: null
					}
					testId="filter-price"
				>
					<p className="text-[13px] text-baume-charcoal mb-4">
						Jusqu'à{" "}
						<span className="font-semibold text-baume-burgundy">
							{filters.max_price || MAX_PRICE} CHF
						</span>
					</p>
					<Slider
						value={[filters.max_price || MAX_PRICE]}
						onValueChange={(v) => set("max_price", v[0])}
						min={10}
						max={MAX_PRICE}
						step={5}
						className="w-[240px] [&_[role=slider]]:bg-baume-burgundy [&_[role=slider]]:border-baume-burgundy"
					/>
				</DropdownFilter>
				<button
					type="button"
					onClick={() => set("available", filters.available ? null : true)}
					className={pill(filters.available === true)}
					aria-pressed={filters.available === true}
				>
					{filters.available && <Check className="h-4 w-4" />}
					Disponibles
				</button>
				{activeCount > 0 && (
					<button
						type="button"
						onClick={onReset}
						className="h-10 px-4 inline-flex items-center gap-2 rounded-full text-[13px] font-semibold text-baume-burgundy hover:bg-baume-burgundy/5"
						data-testid="filter-reset"
					>
						<RotateCcw className="h-4 w-4" /> Réinitialiser
					</button>
				)}
			</div>

			{/* 2 bis. Bouton « Filtres » — mobile */}
			<div className="lg:hidden">
				<Sheet open={openMobile} onOpenChange={setOpenMobile}>
					<SheetTrigger asChild>
						<button
							data-testid="mobile-filter-trigger"
							className={pill(activeCount > 0)}
						>
							<SlidersHorizontal className="h-4 w-4" /> Filtres
							{activeCount > 0 && ` (${activeCount})`}
						</button>
					</SheetTrigger>
					<SheetContent
						side="bottom"
						className="bg-baume-ivory h-[85vh] p-0 flex flex-col rounded-t-[32px]"
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
								needs={dropdownNeeds}
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

			{/* 3. Puces des filtres actifs */}
			{activeCount > 0 && (
				<div className="flex flex-wrap gap-2" data-testid="active-filters">
					{chips.map((c) => (
						<button
							key={c.k}
							type="button"
							onClick={() => set(c.k, null)}
							className="h-8 pl-3 pr-2 inline-flex items-center gap-1.5 rounded-full bg-baume-burgundy/10 text-baume-burgundy text-[12px] font-semibold hover:bg-baume-burgundy/15"
							aria-label={`Retirer le filtre ${c.label}`}
						>
							{c.label}
							<X className="h-3.5 w-3.5" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}
