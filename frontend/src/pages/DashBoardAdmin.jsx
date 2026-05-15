import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
	Package,
	ShoppingCart,
	Users,
	Settings,
	Percent,
	Loader2,
	Trash2,
	RefreshCw,
	ShieldCheck,
	Pencil,
	Plus,
	CalendarDays,
	Star,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useCallback } from "react";
import {
	getAdminTable,
	deleteAdminItem,
	formatApiError,
	api,
} from "../lib/api";

const SECTIONS = [
	{ key: "products", label: "Produits", icon: Package },
	{ key: "workshops", label: "Ateliers", icon: CalendarDays },
	{ key: "workshop_bookings", label: "Réservations", icon: CalendarDays },
	{ key: "orders", label: "Commandes", icon: ShoppingCart },
	{ key: "profiles", label: "Utilisateurs", icon: Users },
	{ key: "discounts", label: "Réductions", icon: Percent },
	{ key: "store_settings", label: "Paramètres boutique", icon: Settings },
	{ key: "reviews", label: "Avis clients", icon: Star },
];

export default function DashBoardAdmin() {
	const { user, status } = useAuth();
	const [active, setActive] = useState("products");
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);

	const isAdmin = user?.role === "admin";

	const loadData = useCallback(
		async (table = active) => {
			setLoading(true);

			try {
				const data = await getAdminTable(table, 300);
				setRows(Array.isArray(data) ? data : []);
			} catch (err) {
				toast.error("Erreur admin", { description: formatApiError(err) });
				setRows([]);
			} finally {
				setLoading(false);
			}
		},
		[active],
	);

	useEffect(() => {
		if (status === "authenticated" && isAdmin) {
			loadData(active);
		}
	}, [active, status, isAdmin, loadData]);

	const handleDelete = async (id) => {
		if (!window.confirm("Supprimer cet élément ?")) return;

		try {
			await deleteAdminItem(active, id);
			toast.success("Élément supprimé");
			loadData(active);
		} catch (err) {
			toast.error("Suppression impossible", {
				description: formatApiError(err),
			});
		}
	};

	if (status === "loading") {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	if (status !== "authenticated") {
		return <Navigate to="/connexion?redirect=/admin" replace />;
	}

	if (!isAdmin) {
		return (
			<div className="min-h-screen bg-baume-ivory px-6 py-24 text-center">
				<ShieldCheck className="h-10 w-10 mx-auto text-baume-burgundy mb-4" />
				<h1 className="font-editorial text-[42px] text-baume-charcoal">
					Accès réservé
				</h1>
				<p className="mt-3 text-baume-charcoal/70">
					Cette page est réservée aux administrateurs.
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-baume-ivory">
			<div className="px-6 lg:px-10 py-8 border-b border-baume-border bg-baume-white">
				<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
					Admin Baume
				</p>

				<div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
					<div>
						<h1 className="font-editorial text-[42px] md:text-[56px] text-baume-charcoal leading-none">
							Dashboard
						</h1>
						<p className="mt-3 text-baume-charcoal/65">
							Connecté en tant que {user.first_name || user.email}
						</p>
					</div>

					<button
						onClick={() => loadData(active)}
						className="h-11 px-5 rounded-full border border-baume-border bg-baume-white text-baume-charcoal font-semibold text-[14px] inline-flex items-center gap-2 hover:border-baume-burgundy"
					>
						<RefreshCw className="h-4 w-4" />
						Rafraîchir
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
				<aside className="bg-baume-white border-r border-baume-border p-5 lg:min-h-[calc(100vh-145px)]">
					<nav className="space-y-2">
						{SECTIONS.map((section) => {
							const Icon = section.icon;
							const selected = active === section.key;

							return (
								<button
									key={section.key}
									onClick={() => setActive(section.key)}
									className={`w-full h-12 px-4 rounded-2xl flex items-center gap-3 text-[14px] font-semibold transition ${
										selected
											? "bg-baume-burgundy text-baume-white"
											: "text-baume-charcoal hover:bg-baume-ivory"
									}`}
								>
									<Icon className="h-4 w-4" />
									{section.label}
								</button>
							);
						})}
					</nav>
				</aside>

				<main className="p-5 lg:p-8">
					<div className="rounded-3xl border border-baume-border bg-baume-white overflow-hidden">
						<div className="px-5 py-4 border-b border-baume-border flex items-center justify-between gap-4">
							<h2 className="font-editorial text-[30px] text-baume-charcoal">
								{SECTIONS.find((s) => s.key === active)?.label}
							</h2>

							<div className="flex items-center gap-3">
								<span className="text-[13px] text-baume-charcoal/60">
									{rows.length} élément{rows.length > 1 ? "s" : ""}
								</span>

								{active === "products" && (
									<Link
										to="/admin/produits/nouveau"
										className="h-10 px-4 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
									>
										<Plus className="h-4 w-4" />
										Ajouter un produit
									</Link>
								)}

								{active === "workshops" && (
									<Link
										to="/admin/ateliers/nouveau"
										className="h-10 px-4 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
									>
										<Plus className="h-4 w-4" />
										Ajouter un atelier
									</Link>
								)}
							</div>
						</div>

						{loading ? (
							<div className="py-24 flex justify-center">
								<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
							</div>
						) : rows.length === 0 ? (
							<div className="p-10 text-center text-baume-charcoal/65">
								Aucun élément trouvé.
							</div>
						) : (
							<AdminTable table={active} rows={rows} onDelete={handleDelete} />
						)}
					</div>
				</main>
			</div>
		</div>
	);
}

function AdminTable({ table, rows, onDelete }) {
	if (table === "products") {
		return (
			<Table
				columns={["Nom", "Catégorie", "Prix", "Stock", "Statut", "Actions"]}
				rows={rows.map((p) => [
					p.name || p.title,
					p.product_category,
					`${Number(p.price || 0).toFixed(2)} ${p.currency || "CHF"}`,
					p.stock ?? 0,
					p.status,
					<div className="flex items-center gap-2">
						<Link
							to={`/admin/produits/${p.id}/modifier`}
							className="h-9 w-9 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition"
							title="Modifier"
						>
							<Pencil className="h-4 w-4" />
						</Link>

						<DeleteButton onClick={() => onDelete(p.id)} />
					</div>,
				])}
			/>
		);
	}

	if (table === "workshops") {
		return (
			<Table
				columns={[
					"Titre",
					"Experte",
					"Date",
					"Prix",
					"Places",
					"Actif",
					"Actions",
				]}
				rows={rows.map((w) => [
					w.title || "-",
					w.expert_name || "-",
					w.starts_at ? new Date(w.starts_at).toLocaleString("fr-CH") : "-",
					`${Number(w.price || 0).toFixed(2)} ${w.currency || "CHF"}`,
					`${Number(w.reserved_count || 0)} / ${Number(w.capacity || 0)}`,
					w.active ? "Oui" : "Non",
					<div className="flex items-center gap-2">
						<Link
							to={`/admin/ateliers/${w.id}/modifier`}
							className="h-9 w-9 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition"
							title="Modifier"
						>
							<Pencil className="h-4 w-4" />
						</Link>

						<DeleteButton onClick={() => onDelete(w.id)} />
					</div>,
				])}
			/>
		);
	}

	if (table === "workshop_bookings") {
		return (
			<Table
				columns={["Client", "Email", "Places", "Montant", "Statut", "Date"]}
				rows={rows.map((b) => [
					`${b.first_name || ""} ${b.last_name || ""}`.trim() || "-",
					b.email || "-",
					b.quantity || 1,
					`${Number(b.amount || 0).toFixed(2)} ${b.currency || "CHF"}`,
					<StatusBadge status={b.status} />,
					b.created_at
						? new Date(b.created_at).toLocaleDateString("fr-CH")
						: "-",
				])}
			/>
		);
	}

	if (table === "orders") {
		return (
			<Table
				columns={["Commande", "Email", "Total", "Statut", "Date", "Actions"]}
				rows={rows.map((o) => [
					`#${String(o.id).slice(0, 8).toUpperCase()}`,
					o.email || o.customer_email || "-",
					`${Number(o.total || o.amount || 0).toFixed(2)} ${o.currency || "CHF"}`,
					<StatusBadge status={o.status} />,
					o.created_at
						? new Date(o.created_at).toLocaleDateString("fr-CH")
						: "-",
					<Link
						key={`view-${o.id}`}
						to={`/admin/orders/${o.id}`}
						className="h-9 px-4 inline-flex items-center justify-center rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:opacity-90 transition"
					>
						Voir la commande
					</Link>,
				])}
			/>
		);
	}

	if (table === "profiles") {
		return (
			<Table
				columns={["Email", "Nom", "Rôle", "Créé le"]}
				rows={rows.map((u) => [
					u.email || "-",
					`${u.first_name || ""} ${u.last_name || ""}`.trim() || "-",
					u.role || "customer",
					u.created_at
						? new Date(u.created_at).toLocaleDateString("fr-CH")
						: "-",
				])}
			/>
		);
	}

	if (table === "discounts") {
		return (
			<Table
				columns={["Code", "Type", "Valeur", "Actif", "Actions"]}
				rows={rows.map((d) => [
					d.code,
					d.type || "-",
					d.value ?? "-",
					d.active ? "Oui" : "Non",
					<DeleteButton onClick={() => onDelete(d.id)} />,
				])}
			/>
		);
	}

	if (table === "store_settings") {
		return (
			<Table
				columns={["Clé", "Valeur"]}
				rows={rows.map((s) => [
					s.key,
					typeof s.value === "object"
						? JSON.stringify(s.value)
						: String(s.value),
				])}
			/>
		);
	}

	if (table === "reviews") {
		return <ReviewsSection rows={rows} onDelete={onDelete} />;
	}

	return (
		<Table
			columns={["ID", "Données"]}
			rows={rows.map((r) => [r.id, JSON.stringify(r)])}
		/>
	);
}
function ReviewsSection({ rows, onDelete }) {
	const [productMap, setProductMap] = useState({});

	useEffect(() => {
		getAdminTable("products", 200)
			.then((prods) => {
				const m = {};
				prods.forEach((p) => {
					m[p.id] = p.name || p.title;
				});
				setProductMap(m);
			})
			.catch(() => {});
	}, []);
	const [filter, setFilter] = useState("all");
	const [sort, setSort] = useState("recent");

	const FILTERS = [
		{ key: "all", label: "Tous" },
		{ key: "published", label: "Publiés" },
		{ key: "pending", label: "En attente" },
		{ key: "rejected", label: "Rejetés" },
		{ key: "5", label: "⭐⭐⭐⭐⭐" },
		{ key: "4", label: "⭐⭐⭐⭐" },
		{ key: "3", label: "⭐⭐⭐" },
		{ key: "1-2", label: "⭐⭐ et moins" },
	];

	const SORTS = [
		{ key: "recent", label: "Plus récents" },
		{ key: "oldest", label: "Plus anciens" },
		{ key: "rating_desc", label: "Meilleures notes" },
		{ key: "rating_asc", label: "Notes les plus basses" },
	];

	const filtered = rows
		.filter((r) => {
			if (filter === "all") return true;
			if (filter === "published") return r.status === "published";
			if (filter === "pending") return r.status === "pending";
			if (filter === "rejected") return r.status === "rejected";
			if (filter === "5") return r.rating === 5;
			if (filter === "4") return r.rating >= 4 && r.rating < 5;
			if (filter === "3") return r.rating >= 3 && r.rating < 4;
			if (filter === "1-2") return r.rating < 3;
			return true;
		})
		.sort((a, b) => {
			if (sort === "recent")
				return new Date(b.created_at) - new Date(a.created_at);
			if (sort === "oldest")
				return new Date(a.created_at) - new Date(b.created_at);
			if (sort === "rating_desc") return b.rating - a.rating;
			if (sort === "rating_asc") return a.rating - b.rating;
			return 0;
		});

	// Stats globales
	const avg = rows.length
		? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1)
		: "–";
	const countByStatus = (s) => rows.filter((r) => r.status === s).length;

	return (
		<div className="p-5 space-y-6">
			{/* Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[
					{ label: "Total avis", value: rows.length },
					{ label: "Note moyenne", value: avg + " / 5" },
					{
						label: "En attente",
						value: countByStatus("pending"),
						highlight: true,
					},
					{ label: "Publiés", value: countByStatus("published") },
				].map((stat) => (
					<div
						key={stat.label}
						className={`rounded-2xl border p-4 ${stat.highlight ? "border-baume-burgundy/30 bg-baume-burgundy/5" : "border-baume-border bg-baume-ivory/50"}`}
					>
						<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold">
							{stat.label}
						</p>
						<p
							className={`text-[28px] font-editorial mt-1 ${stat.highlight ? "text-baume-burgundy" : "text-baume-charcoal"}`}
						>
							{stat.value}
						</p>
					</div>
				))}
			</div>

			{/* Filtres + tri */}
			<div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
				<div className="flex flex-wrap gap-2">
					{FILTERS.map((f) => (
						<button
							key={f.key}
							onClick={() => setFilter(f.key)}
							className={`h-8 px-3 rounded-full text-[12px] font-semibold border transition-all ${
								filter === f.key
									? "bg-baume-burgundy text-baume-white border-baume-burgundy"
									: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
				<select
					value={sort}
					onChange={(e) => setSort(e.target.value)}
					className="h-9 px-3 rounded-full border border-baume-border bg-baume-white text-[13px] text-baume-charcoal font-medium"
				>
					{SORTS.map((s) => (
						<option key={s.key} value={s.key}>
							{s.label}
						</option>
					))}
				</select>
			</div>

			{/* Liste */}
			{filtered.length === 0 ? (
				<p className="text-center text-baume-charcoal/50 py-10">
					Aucun avis pour ce filtre.
				</p>
			) : (
				<div className="space-y-3">
					{filtered.map((r) => (
						<ReviewAdminCard key={r.id} review={r} onDelete={onDelete} />
					))}
				</div>
			)}
		</div>
	);
}

function ReviewAdminCard({ review: r, onDelete }) {
	const [moderating, setModerating] = useState(false);

	const moderate = async (status) => {
		setModerating(true);
		try {
			await api.patch(`/ecom/admin/reviews/${r.id}/moderate`, { status });
			toast.success(status === "published" ? "Avis publié" : "Avis rejeté");
			// Recharge via le parent — simple reload
			window.location.reload();
		} catch (err) {
			toast.error("Erreur", { description: formatApiError(err) });
		} finally {
			setModerating(false);
		}
	};

	const STATUS_STYLE = {
		published: "bg-emerald-100 text-emerald-800 border-emerald-200",
		pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
		rejected: "bg-red-100 text-red-800 border-red-200",
	};

	const STATUS_LABEL = {
		published: "Publié",
		pending: "En attente",
		rejected: "Rejeté",
	};

	return (
		<div className="rounded-2xl border border-baume-border bg-baume-white p-5 flex flex-col sm:flex-row gap-4">
			{/* Note + statut */}
			<div className="shrink-0 flex flex-col items-center gap-2 w-20">
				<div className="text-[28px] font-editorial text-baume-charcoal leading-none">
					{r.rating}
				</div>
				<div className="flex gap-0.5">
					{Array.from({ length: 5 }).map((_, i) => (
						<span
							key={i}
							className={`text-[12px] ${i < Math.round(r.rating) ? "text-baume-burgundy" : "text-baume-border"}`}
						>
							★
						</span>
					))}
				</div>
				<span
					className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_STYLE[r.status] || STATUS_STYLE.pending}`}
				>
					{STATUS_LABEL[r.status] || r.status}
				</span>
			</div>

			{/* Contenu */}
			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between gap-2 flex-wrap">
					<div>
						<p className="font-semibold text-baume-charcoal text-[14px]">
							{r.title}
						</p>
						<p className="text-[12px] text-baume-charcoal/50 mt-0.5">
							{r.author} ·{" "}
							{r.created_at
								? new Date(r.created_at).toLocaleDateString("fr-CH")
								: "–"}
							{r.verified_purchase && (
								<span className="ml-2 text-emerald-600 font-semibold">
									✓ Achat vérifié
								</span>
							)}
						</p>
					</div>
					<p className="text-[11px] text-baume-charcoal/40 font-mono shrink-0">
						{String(r.product_id).slice(0, 8)}…
					</p>
				</div>
				<p className="mt-2 text-[13px] leading-[21px] text-baume-charcoal/70">
					{r.body}
				</p>
			</div>

			{/* Actions */}
			<div className="shrink-0 flex sm:flex-col gap-2 justify-end">
				{r.status !== "published" && (
					<button
						onClick={() => moderate("published")}
						disabled={moderating}
						className="h-8 px-3 rounded-full bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
					>
						Publier
					</button>
				)}
				{r.status !== "rejected" && (
					<button
						onClick={() => moderate("rejected")}
						disabled={moderating}
						className="h-8 px-3 rounded-full border border-baume-border text-baume-charcoal text-[12px] font-semibold hover:bg-baume-ivory transition disabled:opacity-50"
					>
						Rejeter
					</button>
				)}
				<DeleteButton onClick={() => onDelete(r.id)} />
			</div>
		</div>
	);
}

function Table({ columns, rows }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-[14px]">
				<thead className="bg-baume-ivory text-baume-charcoal/70">
					<tr>
						{columns.map((c) => (
							<th key={c} className="px-5 py-3 font-semibold whitespace-nowrap">
								{c}
							</th>
						))}
					</tr>
				</thead>

				<tbody>
					{rows.map((row, i) => (
						<tr key={i} className="border-t border-baume-border">
							{row.map((cell, j) => (
								<td key={j} className="px-5 py-4 text-baume-charcoal align-top">
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DeleteButton({ onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			title="Supprimer"
			className="h-9 w-9 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-burgundy hover:bg-baume-burgundy hover:text-baume-white transition"
		>
			<Trash2 className="h-4 w-4" />
		</button>
	);
}

function StatusBadge({ status }) {
	const map = {
		pending: {
			label: "Non traitée",
			class: "bg-yellow-100 text-yellow-900 border-yellow-200",
		},
		processing: {
			label: "En traitement",
			class: "bg-blue-100 text-blue-900 border-blue-200",
		},
		shipped: {
			label: "Expédiée",
			class: "bg-purple-100 text-purple-900 border-purple-200",
		},
		delivered: {
			label: "Livrée",
			class: "bg-emerald-100 text-emerald-900 border-emerald-200",
		},
		cancelled: {
			label: "Annulée",
			class: "bg-red-100 text-red-900 border-red-200",
		},
		refunded: {
			label: "Remboursée",
			class: "bg-gray-200 text-gray-800 border-gray-300",
		},
	};

	const s = map[status] || map.pending;

	return (
		<span
			className={`inline-flex items-center rounded-md border px-2 py-1 text-[12px] font-medium ${s.class}`}
		>
			{s.label}
		</span>
	);
}
