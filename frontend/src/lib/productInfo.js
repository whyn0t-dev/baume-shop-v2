// Conversion des champs « L'essentiel » d'une fiche produit
// (texte saisi dans l'admin ⇄ données enregistrées).

/** "Sans PFAS\nFabriqué en France" → ["Sans PFAS", "Fabriqué en France"] */
export function parseLines(text) {
	return String(text || "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
}

/** "Matière : coton bio\nContenance : 50 ml" → [{label, value}, …] */
export function parseSpecs(text) {
	return parseLines(text)
		.map((line) => {
			const idx = line.indexOf(":");
			if (idx === -1) return { label: line, value: "" };
			return {
				label: line.slice(0, idx).trim(),
				value: line.slice(idx + 1).trim(),
			};
		})
		.filter((s) => s.label);
}

export function specsToText(specs) {
	return (Array.isArray(specs) ? specs : [])
		.map((s) => (s?.value ? `${s.label} : ${s.value}` : s?.label || ""))
		.filter(Boolean)
		.join("\n");
}

export function linesToText(list) {
	return (Array.isArray(list) ? list : []).filter(Boolean).join("\n");
}
