import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, ArrowRight, X } from "lucide-react";
import { api, formatApiError } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Liste des clientes (onglet « Clients » du tableau de bord)
// Chaque ligne ouvre la fiche client complète : /admin/clients/:profileId
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_STYLES = {
	vip: "bg-baume-burgundy text-white",
	fidele: "bg-baume-burgundy/15 text-baume-burgundy",
	reguliere: "bg-emerald-50 text-emerald-700",
	nouvelle: "bg-blue-50 text-blue-700",
	prospect: "bg-gray-100 text-gray-600",
};

const chf = (v) =>
	`${new Intl.NumberFormat("fr-CH", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Number(v || 0))} CHF`;

const dateFr = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-CH") : "—");

const SORTS = [
	{ key: "recent", label: "Inscription récente" },
	{ key: "spent", label: "Dépense totale" },
	{ key: "orders", label: "Nb de commandes" },
	{ key: "last", label: "Dernière commande" },
];

export default function CustomersSection() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState("spent");
	const [status, setStatus] = useState("all");

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.get("/ecom/admin/customers", {
				params: query ? { search: query } : {},
			});
			setRows(Array.isArray(res.data) ? res.data : []);
		} catch (err) {
			setError(formatApiError(err));
		} finally {
			setLoading(false);
		}
	}, [query]);

	useEffect(() => {
		load();
	}, [load]);

	// Recherche différée (300 ms)
	useEffect(() => {
		const t = setTimeout(() => setQuery(search.trim()), 300);
		return () => clearTimeout(t);
	}, [search]);

	const visible = useMemo(() => {
		const list = rows.filter(
			(r) => status === "all" || r.loyalty_status?.key === status,
		);
		const sorters = {
			recent: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
			spent: (a, b) => b.net_spent - a.net_spent,
			orders: (a, b) => b.orders_count - a.orders_count,
			last: (a, b) =>
				(b.last_order_at || "").localeCompare(a.last_order_at || ""),
		};
		return [...list].sort(sorters[sort]);
	}, [rows, sort, status]);

	const totals = useMemo(
		() => ({
			clients: rows.filter((r) => r.orders_count > 0).length,
			revenue: rows.reduce((s, r) => s + Number(r.net_spent || 0), 0),
			vip: rows.filter((r) => ["vip", "fidele"].includes(r.loyalty_status?.key))
				.length,
		}),
		[rows],
	);

	return (
		<div className="p-5 lg:p-8 space-y-6">
			<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
				<div>
					<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
						Fichier client
					</p>
					<h2 className="font-editorial text-[28px] text-baume-charcoal mt-1">
						Clientes
					</h2>
					<p className="text-[13px] text-baume-charcoal/60 mt-1">
						{rows.length} compte(s) · {totals.clients} cliente(s) ayant
						commandé · {totals.vip} fidèle(s)/VIP · {chf(totals.revenue)} de
						dépenses nettes
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-baume-charcoal/40" />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Nom, prénom ou email…"
							className="h-10 pl-9 pr-8 w-64 rounded-full border border-baume-border bg-baume-white text-[13px] outline-none focus:ring-2 focus:ring-baume-taupe"
						/>
						{search && (
							<button
								onClick={() => setSearch("")}
								className="absolute right-3 top-1/2 -translate-y-1/2"
								aria-label="Effacer"
							>
								<X className="h-3.5 w-3.5 text-baume-charcoal/40" />
							</button>
						)}
					</div>
					<select
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						className="h-10 px-4 rounded-full border border-baume-border bg-baume-white text-[13px]"
					>
						<option value="all">Tous les statuts</option>
						<option value="vip">VIP</option>
						<option value="fidele">Fidèle</option>
						<option value="reguliere">Régulière</option>
						<option value="nouvelle">Nouvelle cliente</option>
						<option value="prospect">Sans achat</option>
					</select>
					<select
						value={sort}
						onChange={(e) => setSort(e.target.value)}
						className="h-10 px-4 rounded-full border border-baume-border bg-baume-white text-[13px]"
					>
						{SORTS.map((s) => (
							<option key={s.key} value={s.key}>
								Trier : {s.label}
							</option>
						))}
					</select>
				</div>
			</div>

			{loading ? (
				<div className="py-20 flex justify-center">
					<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
				</div>
			) : error ? (
				<p className="p-8 text-center text-red-600 text-[14px]">{error}</p>
			) : visible.length === 0 ? (
				<p className="p-8 text-center text-baume-charcoal/60 text-[14px]">
					Aucune cliente trouvée.
				</p>
			) : (
				<div className="overflow-x-auto rounded-2xl border border-baume-border bg-baume-white">
					<table className="w-full text-[13px]">
						<thead className="bg-baume-ivory/60 text-baume-charcoal/60">
							<tr>
								<th className="px-5 py-3 text-left font-semibold">Cliente</th>
								<th className="px-5 py-3 text-left font-semibold">Statut</th>
								<th className="px-5 py-3 text-right font-semibold">Commandes</th>
								<th className="px-5 py-3 text-right font-semibold">Dépense nette</th>
								<th className="px-5 py-3 text-right font-semibold">Points</th>
								<th className="px-5 py-3 text-left font-semibold">Dernière commande</th>
								<th className="px-5 py-3" />
							</tr>
						</thead>
						<tbody className="divide-y divide-baume-border">
							{visible.map((r) => (
								<tr key={r.id} className="hover:bg-baume-ivory/40">
									<td className="px-5 py-3">
										<p className="font-semibold text-baume-charcoal">
											{`${r.first_name || ""} ${r.last_name || ""}`.trim() ||
												"—"}
											{r.role === "admin" && (
												<span className="ml-2 text-[10px] uppercase tracking-wider text-baume-burgundy">
													admin
												</span>
											)}
										</p>
										<p className="text-[12px] text-baume-charcoal/50">{r.email}</p>
									</td>
									<td className="px-5 py-3">
										<span
											className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${
												STATUS_STYLES[r.loyalty_status?.key] || STATUS_STYLES.prospect
											}`}
										>
											{r.loyalty_status?.label || "—"}
										</span>
									</td>
									<td className="px-5 py-3 text-right tabular-nums">
										{r.orders_count}
									</td>
									<td className="px-5 py-3 text-right tabular-nums font-semibold">
										{chf(r.net_spent)}
									</td>
									<td className="px-5 py-3 text-right tabular-nums">
										{r.loyalty_points}
									</td>
									<td className="px-5 py-3">{dateFr(r.last_order_at)}</td>
									<td className="px-5 py-3 text-right">
										<Link
											to={`/admin/clients/${r.id}`}
											className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full bg-baume-burgundy text-white text-[12px] font-semibold hover:opacity-90"
										>
											Fiche client <ArrowRight className="h-3.5 w-3.5" />
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
