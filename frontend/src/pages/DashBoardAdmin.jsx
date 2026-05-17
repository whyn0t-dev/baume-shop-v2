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
	X,
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

import { LayoutDashboard } from "lucide-react";
import HomeSection from "../components/HomeSection";

const SECTIONS = [
	{ key: "accueil", label: "Accueil", icon: LayoutDashboard },
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
	const [active, setActive] = useState("accueil");
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
		if (status === "authenticated" && isAdmin && active !== "accueil") {
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

					{active !== "accueil" && (
						<button
							onClick={() => loadData(active)}
							className="h-11 px-5 rounded-full border border-baume-border bg-baume-white text-baume-charcoal font-semibold text-[14px] inline-flex items-center gap-2 hover:border-baume-burgundy"
						>
							<RefreshCw className="h-4 w-4" />
							Rafraîchir
						</button>
					)}
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

						{loading && active !== "accueil" ? (
							<div className="py-24 flex justify-center">
								<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
							</div>
						) : rows.length === 0 &&
						  active !== "discounts" &&
						  active !== "accueil" ? (
							<div className="p-10 text-center text-baume-charcoal/65">
								Aucun élément trouvé.
							</div>
						) : (
							<AdminTable
								table={active}
								rows={rows}
								onDelete={handleDelete}
								onRefresh={() => loadData(active)}
							/>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}

function AdminTable({ table, rows, onDelete, onRefresh }) {
	if (table === "accueil") {
		return <HomeSection />;
	}
	if (table === "products") {
		return (
			<Table
				columns={["Nom", "Catégorie", "Prix", "Stock", "Statut", "Actions"]}
				rows={rows.map((p) => [
					p.name || p.title,
					p.product_category,
					`${Number(p.price || 0).toFixed(2)} ${p.currency || "CHF"}`,
					p.stock ?? 0,
					// ← remplacer p.statut + le bloc available par ceci
					{
						draft: (
							<span className="text-[12px] px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 font-medium">
								Brouillon
							</span>
						),
						active: (
							<span className="text-[12px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium">
								Actif
							</span>
						),
						archived: (
							<span className="text-[12px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium">
								Archivé
							</span>
						),
					}[p.status] || (
						<span className="text-[12px] text-baume-charcoal/40">
							{p.status || "—"}
						</span>
					),
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
						? new Date(o.created_at).toLocaleString("fr-CH", {
								day: "2-digit",
								month: "2-digit",
								year: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})
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
			<DiscountsSection rows={rows} onDelete={onDelete} onRefresh={onRefresh} />
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

function DiscountsSection({ rows, onDelete, onRefresh }) {
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState(null);

	const handleEdit = (discount) => {
		setEditing(discount);
		setShowForm(true);
	};
	const handleClose = () => {
		setEditing(null);
		setShowForm(false);
	};
	const handleSaved = () => {
		handleClose();
		onRefresh();
	};

	const active = rows.filter((d) => d.active).length;
	const totalUsed = rows.reduce((s, d) => s + (d.used_count || 0), 0);

	return (
		<div className="p-5 space-y-6">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[
					{ label: "Total codes", value: rows.length },
					{ label: "Actifs", value: active },
					{ label: "Inactifs", value: rows.length - active },
					{ label: "Utilisations totales", value: totalUsed },
				].map((s) => (
					<div
						key={s.label}
						className="rounded-2xl border border-baume-border bg-baume-ivory/50 p-4"
					>
						<p className="text-[11px] uppercase tracking-wider text-baume-charcoal/50 font-semibold">
							{s.label}
						</p>
						<p className="text-[28px] font-editorial mt-1 text-baume-charcoal">
							{s.value}
						</p>
					</div>
				))}
			</div>

			{!showForm && (
				<button
					onClick={() => setShowForm(true)}
					className="h-10 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-baume-burgundyDark transition"
				>
					<Plus className="h-4 w-4" /> Créer un code promo
				</button>
			)}

			{showForm && (
				<DiscountForm
					discount={editing}
					onSaved={handleSaved}
					onCancel={handleClose}
				/>
			)}

			{rows.length === 0 ? (
				<p className="text-center text-baume-charcoal/50 py-10">
					Aucun code promo créé.
				</p>
			) : (
				<div className="space-y-3">
					{rows.map((d) => (
						<DiscountCard
							key={d.id}
							discount={d}
							onEdit={() => handleEdit(d)}
							onDelete={() => onDelete(d.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function DiscountCard({ discount: d, onEdit, onDelete }) {
	const isExpired = d.ends_at && new Date(d.ends_at) < new Date();
	const isNotStarted = d.starts_at && new Date(d.starts_at) > new Date();
	const isExhausted = d.usage_limit && (d.used_count || 0) >= d.usage_limit;

	const statusLabel = !d.active
		? {
				label: "Inactif",
				cls: "bg-baume-border/50 text-baume-charcoal/50 border-baume-border",
			}
		: isExpired
			? { label: "Expiré", cls: "bg-red-100 text-red-700 border-red-200" }
			: isNotStarted
				? {
						label: "Pas encore actif",
						cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
					}
				: isExhausted
					? {
							label: "Épuisé",
							cls: "bg-orange-100 text-orange-700 border-orange-200",
						}
					: {
							label: "Actif",
							cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
						};

	return (
		<div className="rounded-2xl border border-baume-border bg-baume-white p-5 flex flex-col sm:flex-row gap-4 items-start">
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-3 flex-wrap">
					<span className="font-mono font-bold text-[16px] text-baume-charcoal bg-baume-ivory border border-baume-border px-3 py-1 rounded-lg">
						{d.code}
					</span>
					<span
						className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${statusLabel.cls}`}
					>
						{statusLabel.label}
					</span>
					<span className="text-[13px] font-semibold text-baume-burgundy">
						{d.type === "percentage"
							? `−${d.value}%`
							: `−${Number(d.value).toFixed(2)} CHF`}
					</span>
				</div>
				<div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-baume-charcoal/55">
					<span>
						Utilisations :{" "}
						<strong className="text-baume-charcoal">{d.used_count || 0}</strong>
						{d.usage_limit ? ` / ${d.usage_limit}` : " (illimitées)"}
					</span>
					{d.starts_at && (
						<span>
							Début :{" "}
							<strong className="text-baume-charcoal">
								{new Date(d.starts_at).toLocaleDateString("fr-CH")}
							</strong>
						</span>
					)}
					{d.ends_at && (
						<span>
							Fin :{" "}
							<strong className="text-baume-charcoal">
								{new Date(d.ends_at).toLocaleDateString("fr-CH")}
							</strong>
						</span>
					)}
					{d.min_order_amount && (
						<span>
							Min. commande :{" "}
							<strong className="text-baume-charcoal">
								{Number(d.min_order_amount).toFixed(2)} CHF
							</strong>
						</span>
					)}
					{d.description && (
						<span>
							Note :{" "}
							<strong className="text-baume-charcoal">{d.description}</strong>
						</span>
					)}
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<button
					onClick={onEdit}
					title="Modifier"
					className="h-9 w-9 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition"
				>
					<Pencil className="h-4 w-4" />
				</button>
				<DeleteButton onClick={onDelete} />
			</div>
		</div>
	);
}

function DiscountForm({ discount, onSaved, onCancel }) {
	const isEditing = !!discount;
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [form, setForm] = useState({
		code: discount?.code || "",
		type: discount?.type || "percentage",
		value: discount?.value ?? "",
		active: discount?.active ?? true,
		starts_at: discount?.starts_at ? discount.starts_at.slice(0, 16) : "",
		ends_at: discount?.ends_at ? discount.ends_at.slice(0, 16) : "",
		usage_limit: discount?.usage_limit ?? "",
		min_order_amount: discount?.min_order_amount ?? "",
		description: discount?.description || "",
	});

	const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		if (!form.code.trim()) return setError("Le code est obligatoire.");
		if (!form.value || Number(form.value) <= 0)
			return setError("La valeur doit être supérieure à 0.");
		if (form.type === "percentage" && Number(form.value) > 100)
			return setError("Un pourcentage ne peut pas dépasser 100.");
		setSaving(true);
		const payload = {
			code: form.code.trim().toUpperCase(),
			type: form.type,
			value: Number(form.value),
			active: form.active,
			starts_at: form.starts_at || null,
			ends_at: form.ends_at || null,
			usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
			min_order_amount: form.min_order_amount
				? Number(form.min_order_amount)
				: null,
			description: form.description || null,
		};
		try {
			if (isEditing) {
				await api.patch(`/ecom/admin/discounts/${discount.id}`, payload);
			} else {
				await api.post("/ecom/admin/discounts", payload);
			}
			onSaved();
		} catch (err) {
			setError(formatApiError(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-3xl border border-baume-burgundy/30 bg-baume-white p-6 md:p-7 space-y-5"
		>
			<div className="flex items-center justify-between">
				<p className="font-editorial text-[24px] text-baume-charcoal">
					{isEditing ? "Modifier le code" : "Nouveau code promo"}
				</p>
				<button
					type="button"
					onClick={onCancel}
					className="h-8 w-8 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal/50 hover:bg-baume-ivory"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			{error && (
				<p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
					{error}
				</p>
			)}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<DiscountField label="Code promo *">
					<input
						type="text"
						value={form.code}
						onChange={(e) => set("code", e.target.value.toUpperCase())}
						placeholder="BAUME10"
						className="discount-input font-mono"
						required
					/>
				</DiscountField>
				<DiscountField label="Type *">
					<select
						value={form.type}
						onChange={(e) => set("type", e.target.value)}
						className="discount-input"
					>
						<option value="percentage">Pourcentage (%)</option>
						<option value="fixed">Montant fixe (CHF)</option>
					</select>
				</DiscountField>
				<DiscountField
					label={`Valeur * ${form.type === "percentage" ? "(%)" : "(CHF)"}`}
				>
					<input
						type="number"
						value={form.value}
						onChange={(e) => set("value", e.target.value)}
						placeholder={form.type === "percentage" ? "10" : "5.00"}
						min="0.01"
						max={form.type === "percentage" ? "100" : undefined}
						step="0.01"
						className="discount-input"
						required
					/>
				</DiscountField>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<DiscountField label="Date de début (optionnel)">
					<input
						type="datetime-local"
						value={form.starts_at}
						onChange={(e) => set("starts_at", e.target.value)}
						className="discount-input"
					/>
					<p className="text-[11px] text-baume-charcoal/45 mt-1">
						Laisser vide = actif immédiatement
					</p>
				</DiscountField>
				<DiscountField label="Date d'expiration (optionnel)">
					<input
						type="datetime-local"
						value={form.ends_at}
						onChange={(e) => set("ends_at", e.target.value)}
						className="discount-input"
					/>
					<p className="text-[11px] text-baume-charcoal/45 mt-1">
						Laisser vide = pas d'expiration
					</p>
				</DiscountField>
			</div>

			<div className="rounded-2xl border border-baume-border bg-baume-ivory/40 p-4 space-y-4">
				<p className="text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold">
					Conditions d'application
				</p>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<DiscountField label="Limite d'utilisation (optionnel)">
						<input
							type="number"
							value={form.usage_limit}
							onChange={(e) => set("usage_limit", e.target.value)}
							placeholder="Ex : 100"
							min="1"
							step="1"
							className="discount-input"
						/>
						<p className="text-[11px] text-baume-charcoal/45 mt-1">
							Nombre max d'utilisations
						</p>
					</DiscountField>
					<DiscountField label="Montant minimum de commande (CHF)">
						<input
							type="number"
							value={form.min_order_amount}
							onChange={(e) => set("min_order_amount", e.target.value)}
							placeholder="Ex : 50.00"
							min="0"
							step="0.01"
							className="discount-input"
						/>
						<p className="text-[11px] text-baume-charcoal/45 mt-1">
							Laisser vide = aucun minimum
						</p>
					</DiscountField>
				</div>
			</div>

			<DiscountField label="Note interne (optionnel)">
				<input
					type="text"
					value={form.description}
					onChange={(e) => set("description", e.target.value)}
					placeholder="Ex : Code newsletter mai 2025"
					className="discount-input"
				/>
			</DiscountField>

			<label className="flex items-center gap-3 cursor-pointer select-none">
				<div
					onClick={() => set("active", !form.active)}
					className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${form.active ? "bg-baume-burgundy" : "bg-baume-border"}`}
				>
					<span
						className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-5" : "translate-x-0.5"}`}
					/>
				</div>
				<span className="text-[14px] font-medium text-baume-charcoal">
					Code actif
				</span>
			</label>

			{form.code && form.value && Number(form.value) > 0 && (
				<div className="rounded-xl bg-baume-ivory border border-baume-border p-4 text-[13px] text-baume-charcoal/70">
					<p className="font-semibold text-baume-charcoal mb-1">Aperçu</p>
					<p>
						Le code{" "}
						<span className="font-mono font-bold text-baume-burgundy">
							{form.code}
						</span>{" "}
						offre{" "}
						{form.type === "percentage"
							? `${form.value}% de réduction`
							: `${Number(form.value).toFixed(2)} CHF de réduction`}
						{form.min_order_amount
							? ` pour toute commande d'au moins ${Number(form.min_order_amount).toFixed(2)} CHF`
							: ""}
						{form.ends_at
							? `, valable jusqu'au ${new Date(form.ends_at).toLocaleDateString("fr-CH")}`
							: ""}
						{form.usage_limit
							? `, limité à ${form.usage_limit} utilisation${Number(form.usage_limit) > 1 ? "s" : ""}`
							: ""}
						.
					</p>
				</div>
			)}

			<div className="flex items-center gap-3 pt-2">
				<button
					type="submit"
					disabled={saving}
					className="h-11 px-7 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center gap-2 transition"
				>
					{saving && <Loader2 className="h-4 w-4 animate-spin" />}
					{isEditing ? "Enregistrer" : "Créer le code"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="h-11 px-5 rounded-full border border-baume-border text-baume-charcoal font-semibold text-[14px] hover:bg-baume-ivory transition"
				>
					Annuler
				</button>
			</div>
		</form>
	);
}

function DiscountField({ label, children }) {
	return (
		<div className="flex flex-col gap-1.5">
			<label className="text-[12px] font-semibold text-baume-charcoal/70 uppercase tracking-[0.12em]">
				{label}
			</label>
			{children}
		</div>
	);
}
