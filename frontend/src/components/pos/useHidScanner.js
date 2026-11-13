import { useEffect, useRef } from "react";

/**
 * Écoute une douchette code-barres USB / Bluetooth (mode clavier).
 * Une douchette « tape » les caractères très vite puis envoie Entrée :
 * on regroupe les frappes rapprochées (< 60 ms) et on déclenche onScan.
 *
 * Les champs de saisie gèrent eux-mêmes leur touche Entrée : on ignore
 * donc les frappes lorsqu'un champ a le focus.
 */
export default function useHidScanner(onScan, enabled = true) {
	const buffer = useRef("");
	const lastKeyAt = useRef(0);
	const handler = useRef(onScan);

	useEffect(() => {
		handler.current = onScan;
	}, [onScan]);

	useEffect(() => {
		if (!enabled) return undefined;

		const onKeyDown = (e) => {
			const target = e.target;
			const tag = target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
				return;
			}

			const now = Date.now();

			if (e.key === "Enter") {
				const code = buffer.current.trim();
				buffer.current = "";
				if (code.length >= 3) {
					e.preventDefault();
					handler.current?.(code);
				}
				return;
			}

			if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

			if (now - lastKeyAt.current > 60) buffer.current = "";
			buffer.current += e.key;
			lastKeyAt.current = now;
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);
}
