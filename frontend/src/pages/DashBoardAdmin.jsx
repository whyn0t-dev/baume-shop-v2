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
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { getAdminTable, deleteAdminItem, formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useCallback } from "react";

const STATUS_LABELS = {
	pending: "Non traitée",
	processing: "En traitement",
	shipped: "Expédiée",
	delivered: "Livrée",
	cancelled: "Annulée",
	refunded: "Remboursée",
	paid: "Payée",
};

const SECTIONS = [
	{ key: "products", label: "Produits", icon: Package },
	{ key: "orders", label: "Commandes", icon: ShoppingCart },
	{ key: "profiles", label: "Utilisateurs", icon: Users },
	{ key: "discounts", label: "Réductions", icon: Percent },
	{ key: "store_settings", label: "Paramètres boutique", icon: Settings },
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
						<div className="px-5 py-4 border-b border-baume-border flex items-center justify-between">
							<h2 className="font-editorial text-[30px] text-baume-charcoal">
								{SECTIONS.find((s) => s.key === active)?.label}
							</h2>

							<span className="text-[13px] text-baume-charcoal/60">
								{rows.length} élément{rows.length > 1 ? "s" : ""}
							</span>
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
					<DeleteButton onClick={() => onDelete(p.id)} />,
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

	return (
		<Table
			columns={["ID", "Données"]}
			rows={rows.map((r) => [r.id, JSON.stringify(r)])}
		/>
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
			onClick={onClick}
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
