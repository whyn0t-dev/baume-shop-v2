import React, { useEffect, useState } from "react";
import { getCategories } from "../lib/api";

// Champs d'administration reliés aux vraies catégories du site :
// - la catégorie produit (filtre « Shop par produit ») ;
// - les besoins (filtre « Shop par besoin »).
// Les valeurs enregistrées sont les slugs, exactement ce que les filtres du shop recherchent.

const fieldLabel = "block mb-2 text-[13px] font-semibold text-baume-muted";

function useCategories(kind) {
	const [items, setItems] = useState([]);
	useEffect(() => {
		let alive = true;
		getCategories(kind)
			.then((data) => alive && setItems(Array.isArray(data) ? data : []))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [kind]);
	return items;
}

export function ProductCategorySelect({ value, onChange, label = "Catégorie" }) {
	const cats = useCategories("produit");
	const known = cats.some((c) => c.slug === value);
	return (
		<label className="block">
			<span className={fieldLabel}>{label}</span>
			<select
				value={value || ""}
				onChange={(e) => onChange(e.target.value)}
				className="h-12 w-full rounded-2xl border border-baume-border bg-baume-white px-4 text-[14px] outline-none focus:ring-2 focus:ring-baume-taupe"
			>
				<option value="">— Choisir une catégorie —</option>
				{value && !known && cats.length > 0 ? (
					<option value={value}>{value} (catégorie inconnue du shop)</option>
				) : null}
				{cats.map((c) => (
					<option key={c.slug} value={c.slug}>
						{c.name}
					</option>
				))}
			</select>
		</label>
	);
}

export function NeedsPicker({ value, onChange, className = "" }) {
	const needs = useCategories("besoin");
	const selected = Array.isArray(value) ? value : [];
	const slugs = new Set(needs.map((n) => n.slug));
	const otherTags = needs.length ? selected.filter((v) => !slugs.has(v)) : [];

	function toggle(slug) {
		onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
	}

	return (
		<div className={className}>
			<span className={fieldLabel}>Besoins (Shop par besoin)</span>
			<div className="flex flex-wrap gap-2">
				{needs.map((n) => {
					const on = selected.includes(n.slug);
					return (
						<button
							key={n.slug}
							type="button"
							onClick={() => toggle(n.slug)}
							aria-pressed={on}
							className={`h-10 px-4 rounded-full border text-[13px] font-semibold transition-colors ${
								on
									? "bg-baume-burgundy border-baume-burgundy text-baume-white"
									: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy"
							}`}
						>
							{n.name}
						</button>
					);
				})}
				{needs.length === 0 ? (
					<span className="text-[13px] text-baume-muted">Chargement des besoins…</span>
				) : null}
			</div>
			{otherTags.length ? (
				<div className="mt-3">
					<span className="block mb-1 text-[12px] text-baume-muted">
						Autres étiquettes (non utilisées par le filtre « Shop par besoin ») :
					</span>
					<div className="flex flex-wrap gap-2">
						{otherTags.map((t) => (
							<span
								key={t}
								className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full bg-baume-ivory border border-baume-border text-[12px] text-baume-charcoal"
							>
								{t}
								<button
									type="button"
									aria-label={`Retirer ${t}`}
									onClick={() => onChange(selected.filter((s) => s !== t))}
									className="h-6 w-6 rounded-full hover:bg-baume-border"
								>
									×
								</button>
							</span>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
