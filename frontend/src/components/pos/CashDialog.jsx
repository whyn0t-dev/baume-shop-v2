import React, { useEffect, useMemo, useState } from "react";
import { Banknote, Delete, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { formatChf, roundChf } from "../../lib/posApi";

const NOTES = [10, 20, 50, 100, 200];

/**
 * Encaissement en espèces : saisie du montant reçu et calcul du rendu.
 * Le montant est saisi en centimes (pavé numérique type caisse).
 */
export default function CashDialog({ open, total, submitting, error, onClose, onConfirm }) {
	const [cents, setCents] = useState("");

	useEffect(() => {
		if (open) setCents("");
	}, [open]);

	const received = cents ? Number(cents) / 100 : 0;
	const change = roundChf(received - total);
	const enough = received + 1e-9 >= total;

	const quickAmounts = useMemo(() => {
		const list = [total];
		NOTES.forEach((n) => {
			const rounded = Math.ceil(total / n) * n;
			if (rounded > total && !list.includes(rounded)) list.push(rounded);
		});
		return list.sort((a, b) => a - b).slice(0, 5);
	}, [total]);

	const press = (key) => {
		if (submitting) return;
		if (key === "back") return setCents((c) => c.slice(0, -1));
		if (key === "clear") return setCents("");
		setCents((c) => (c + key).replace(/^0+/, "").slice(0, 8));
	};

	const setAmount = (value) => setCents(String(Math.round(value * 100)));

	return (
		<Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
			<DialogContent className="max-w-lg bg-white">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-baume-charcoal">
						<Banknote className="h-5 w-5" /> Paiement en espèces
					</DialogTitle>
					<DialogDescription>
						À encaisser : <strong className="text-baume-charcoal">{formatChf(total)}</strong>
					</DialogDescription>
				</DialogHeader>

				<div className="rounded-xl border border-baume-border bg-[#FBF7F2] p-4 text-right">
					<div className="text-[13px] text-neutral-500">Montant reçu</div>
					<div className="text-[34px] font-semibold tabular-nums text-baume-charcoal">
						{formatChf(received)}
					</div>
					<div
						className={`text-[17px] font-medium tabular-nums ${
							enough ? "text-emerald-700" : "text-neutral-400"
						}`}
					>
						{enough ? `Rendu : ${formatChf(change)}` : `Manque : ${formatChf(roundChf(total - received))}`}
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{quickAmounts.map((amount, i) => (
						<button
							key={amount}
							type="button"
							onClick={() => setAmount(amount)}
							className="min-h-[48px] flex-1 rounded-lg border border-baume-border bg-white px-3 text-[15px] font-medium text-baume-charcoal active:bg-neutral-100"
						>
							{i === 0 ? "Exact" : formatChf(amount)}
						</button>
					))}
				</div>

				<div className="grid grid-cols-3 gap-2">
					{["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((k) => (
						<button
							key={k}
							type="button"
							onClick={() => press(k)}
							className="flex min-h-[56px] items-center justify-center rounded-lg bg-neutral-100 text-[22px] font-medium text-baume-charcoal active:bg-neutral-200"
						>
							{k === "back" ? <Delete className="h-6 w-6" /> : k === "clear" ? "C" : k}
						</button>
					))}
				</div>

				{error && <p className="rounded-lg bg-red-50 p-3 text-[14px] text-red-700">{error}</p>}

				<button
					type="button"
					disabled={!enough || submitting}
					onClick={() => onConfirm(received)}
					className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-baume-burgundy text-[18px] font-semibold text-white disabled:opacity-40"
				>
					{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Banknote className="h-5 w-5" />}
					{submitting ? "Enregistrement…" : "Valider l'encaissement"}
				</button>
			</DialogContent>
		</Dialog>
	);
}
