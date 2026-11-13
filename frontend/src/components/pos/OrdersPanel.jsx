import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Loader2, Printer, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatChf, posError, posOrders, posReceipt, roundChf } from "../../lib/posApi";

const COUNTED_STATUSES = ["paid", "processing", "shipped", "delivered"];

const STATUS_LABELS = {
	paid: "Payée",
	processing: "En préparation",
	shipped: "Expédiée",
	delivered: "Remise",
	refunded: "Remboursée",
	cancelled: "Annulée",
};

const isCash = (o) => String(o.stripe_checkout_session_id || "").startsWith("pos_cash_");

function sameDay(a, b) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ventes en boutique : récapitulatif du jour et réimpression des tickets. */
export default function OrdersPanel({ onPrintReceipt }) {
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [printingId, setPrintingId] = useState(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await posOrders(300);
			setOrders((Array.isArray(data) ? data : []).filter((o) => o.channel === "pos"));
		} catch (err) {
			toast.error(posError(err, "Impossible de charger les ventes."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const today = useMemo(() => {
		const now = new Date();
		const list = orders.filter(
			(o) => o.created_at && sameDay(new Date(o.created_at), now) && COUNTED_STATUSES.includes(o.status),
		);
		const sum = (arr) => roundChf(arr.reduce((s, o) => s + Number(o.total || 0), 0));
		return {
			count: list.length,
			total: sum(list),
			cash: sum(list.filter(isCash)),
			card: sum(list.filter((o) => !isCash(o))),
		};
	}, [orders]);

	const reprint = async (order) => {
		setPrintingId(order.id);
		try {
			onPrintReceipt(await posReceipt(order.id));
		} catch (err) {
			toast.error(posError(err, "Ticket indisponible."));
		} finally {
			setPrintingId(null);
		}
	};

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-[20px] font-semibold text-baume-charcoal">Ventes en boutique</h2>
				<button
					type="button"
					onClick={load}
					className="flex min-h-[44px] items-center gap-2 rounded-lg border border-baume-border bg-white px-4 text-[14px]"
				>
					<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
				</button>
			</div>

			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Ventes du jour" value={today.count} />
				<Stat label="Total du jour" value={formatChf(today.total)} />
				<Stat label="Espèces" value={formatChf(today.cash)} />
				<Stat label="Carte / TWINT" value={formatChf(today.card)} />
			</div>

			{loading && orders.length === 0 ? (
				<div className="flex justify-center py-16">
					<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
				</div>
			) : orders.length === 0 ? (
				<p className="py-16 text-center text-neutral-500">Aucune vente en boutique pour le moment.</p>
			) : (
				<div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-baume-border bg-white">
					{orders.map((o) => {
						const date = o.created_at ? new Date(o.created_at) : null;
						const cash = isCash(o);
						return (
							<div key={o.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2">
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4ECE4]">
									{cash ? (
										<Banknote className="h-4 w-4 text-baume-burgundy" />
									) : (
										<QrCode className="h-4 w-4 text-baume-burgundy" />
									)}
								</span>
								<div className="min-w-0 flex-1">
									<div className="text-[15px] font-medium text-baume-charcoal">
										{o.order_number ? `N° ${o.order_number}` : "Vente"} · {formatChf(o.total)}
									</div>
									<div className="text-[13px] text-neutral-500">
										{date?.toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })} ·{" "}
										{cash ? "Espèces" : "Carte / TWINT"} · {STATUS_LABELS[o.status] || o.status}
									</div>
								</div>
								<button
									type="button"
									onClick={() => reprint(o)}
									disabled={printingId === o.id}
									className="flex min-h-[44px] items-center gap-2 rounded-lg border border-baume-border px-3 text-[14px] disabled:opacity-50"
								>
									{printingId === o.id ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Printer className="h-4 w-4" />
									)}
									Ticket
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function Stat({ label, value }) {
	return (
		<div className="rounded-xl border border-baume-border bg-white p-4">
			<div className="text-[13px] text-neutral-500">{label}</div>
			<div className="mt-1 text-[20px] font-semibold tabular-nums text-baume-charcoal">{value}</div>
		</div>
	);
}
