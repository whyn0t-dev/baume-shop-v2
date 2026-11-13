import React, { useEffect, useState } from "react";
import { Loader2, Search, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { posError, posSearchCustomers } from "../../lib/posApi";

/** Recherche d'un client Baume (nom, prénom ou e-mail). */
export default function CustomerDialog({ open, onClose, onSelect }) {
	const [term, setTerm] = useState("");
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (open) {
			setTerm("");
			setResults([]);
			setError("");
		}
	}, [open]);

	useEffect(() => {
		if (!open) return undefined;
		const value = term.trim();
		if (value.length < 2) {
			setResults([]);
			return undefined;
		}
		let cancelled = false;
		const id = setTimeout(async () => {
			setLoading(true);
			try {
				const data = await posSearchCustomers(value);
				if (!cancelled) {
					setResults(Array.isArray(data) ? data : []);
					setError("");
				}
			} catch (err) {
				if (!cancelled) setError(posError(err, "Recherche impossible."));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(id);
		};
	}, [term, open]);

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-lg bg-white">
				<DialogHeader>
					<DialogTitle className="text-baume-charcoal">Associer un client</DialogTitle>
					<DialogDescription>
						Recherchez par nom ou e-mail, ou scannez la carte fidélité du client.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
					<input
						autoFocus
						value={term}
						onChange={(e) => setTerm(e.target.value)}
						placeholder="Nom, prénom ou e-mail"
						className="h-12 w-full rounded-lg border border-baume-border pl-10 pr-3 text-[16px] outline-none focus:border-baume-burgundy"
					/>
					{loading && (
						<Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-neutral-400" />
					)}
				</div>

				{error && <p className="text-[14px] text-red-700">{error}</p>}

				<div className="max-h-[50vh] space-y-1 overflow-y-auto">
					{results.map((c) => {
						const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
						return (
							<button
								key={c.id}
								type="button"
								onClick={() => onSelect(c)}
								className="flex min-h-[56px] w-full items-center gap-3 rounded-lg px-3 text-left active:bg-neutral-100 hover:bg-neutral-50"
							>
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4ECE4]">
									<User className="h-4 w-4 text-baume-burgundy" />
								</span>
								<span className="min-w-0">
									<span className="block truncate text-[15px] font-medium text-baume-charcoal">
										{name || c.email}
									</span>
									{name && <span className="block truncate text-[13px] text-neutral-500">{c.email}</span>}
								</span>
							</button>
						);
					})}
					{term.trim().length >= 2 && !loading && results.length === 0 && !error && (
						<p className="py-6 text-center text-[14px] text-neutral-500">Aucun client trouvé.</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
