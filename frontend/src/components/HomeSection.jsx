import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	ShoppingCart,
	Users,
	TrendingUp,
	Activity,
	Eye,
	ArrowRight,
	RefreshCw,
	Loader2,
	Package,
	Tag,
} from "lucide-react";
import { getAdminTable } from "../lib/api";

// ── Config PostHog ──────────────────────────────────────────────────────────
const POSTHOG_PERSONAL_KEY = process.env.REACT_APP_POSTHOG_PERSONAL_KEY;
const POSTHOG_HOST =
	process.env.REACT_APP_POSTHOG_HOST || "https://us.posthog.com";

// ── Filtre périodes ─────────────────────────────────────────────────────────
const PERIODS = [
	{ key: "today", label: "Aujourd'hui", days: 1 },
	{ key: "7d", label: "7 derniers jours", days: 7 },
	{ key: "30d", label: "30 derniers jours", days: 30 },
	{ key: "90d", label: "90 derniers jours", days: 90 },
];

function getDateRange(days) {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - days);
	return {
		start: start.toISOString().split("T")[0],
		end: end.toISOString().split("T")[0],
	};
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function filterByPeriod(items, days, dateKey = "created_at") {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	return items.filter((item) => new Date(item[dateKey]) >= cutoff);
}

function formatCurrency(amount, currency = "CHF") {
	return `${Number(amount || 0).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatNumber(n) {
	return new Intl.NumberFormat("fr-CH").format(n);
}

// ── Composants UI ───────────────────────────────────────────────────────────
function StatCard({
	icon: Icon,
	label,
	value,
	sub,
	color = "burgundy",
	loading,
}) {
	const colors = {
		burgundy:
			"bg-baume-burgundy/8 text-baume-burgundy border-baume-burgundy/20",
		emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
		blue: "bg-blue-50 text-blue-700 border-blue-200",
		amber: "bg-amber-50 text-amber-700 border-amber-200",
		purple: "bg-purple-50 text-purple-700 border-purple-200",
	};

	return (
		<div className="rounded-2xl border border-baume-border bg-baume-white p-5 flex items-start gap-4">
			<div
				className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}
			>
				<Icon className="h-5 w-5" />
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-[11px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold">
					{label}
				</p>
				{loading ? (
					<div className="mt-1 h-7 w-24 rounded-lg bg-baume-ivory animate-pulse" />
				) : (
					<p className="mt-0.5 text-[24px] font-editorial text-baume-charcoal leading-tight">
						{value}
					</p>
				)}
				{sub && (
					<p className="mt-0.5 text-[12px] text-baume-charcoal/50">{sub}</p>
				)}
			</div>
		</div>
	);
}

function StatusBadge({ status }) {
	const map = {
		paid: { label: "Payée", cls: "bg-emerald-100 text-emerald-700" },
		pending: { label: "En attente", cls: "bg-yellow-100 text-yellow-700" },
		processing: { label: "En traitement", cls: "bg-blue-100 text-blue-700" },
		shipped: { label: "Expédiée", cls: "bg-purple-100 text-purple-700" },
		delivered: {
			label: "Livrée",
			cls: "bg-baume-burgundy/10 text-baume-burgundy",
		},
		cancelled: { label: "Annulée", cls: "bg-red-100 text-red-700" },
		refunded: { label: "Remboursée", cls: "bg-gray-100 text-gray-600" },
	};
	const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
	return (
		<span
			className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.cls}`}
		>
			{s.label}
		</span>
	);
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function HomeSection() {
	const [period, setPeriod] = useState("7d");
	const [loading, setLoading] = useState(true);
	const [posthogLoading, setPosthogLoading] = useState(true);
	const [orders, setOrders] = useState([]);
	const [profiles, setProfiles] = useState([]);
	const [discounts, setDiscounts] = useState([]);

	// PostHog stats
	const [pageviews, setPageviews] = useState(null);
	const [uniqueVisitors, setUniqueVisitors] = useState(null);
	const [activeUsers, setActiveUsers] = useState(null);

	const selectedPeriod = PERIODS.find((p) => p.key === period) || PERIODS[1];

	// ── Chargement données DB ───────────────────────────────────────────────
	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const [ordersData, profilesData, discountsData] = await Promise.all([
				getAdminTable("orders", 500),
				getAdminTable("profiles", 500),
				getAdminTable("discounts", 200),
			]);
			setOrders(Array.isArray(ordersData) ? ordersData : []);
			setProfiles(Array.isArray(profilesData) ? profilesData : []);
			setDiscounts(Array.isArray(discountsData) ? discountsData : []);
		} catch (err) {
			console.error("Error loading dashboard data:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	// ── Chargement PostHog ──────────────────────────────────────────────────
	const loadPosthog = useCallback(async () => {
		setPosthogLoading(true);
		try {
			const res = await api.get(`/admin/analytics?period=${period}`);
			setPageviews(res.data.pageviews);
			setActiveUsers(res.data.active_users);
			setUniqueVisitors(res.data.unique_visitors || null);
		} catch (err) {
			console.error("PostHog error:", err);
		} finally {
			setPosthogLoading(false);
		}
	}, [period]);

	// ── Calculs période ─────────────────────────────────────────────────────
	const periodOrders = filterByPeriod(orders, selectedPeriod.days);
	const periodProfiles = filterByPeriod(profiles, selectedPeriod.days);
	const periodRevenue = periodOrders.reduce(
		(s, o) => s + Number(o.total || 0),
		0,
	);
	const avgOrder =
		periodOrders.length > 0 ? periodRevenue / periodOrders.length : 0;
	const discountUsage = discounts.reduce((s, d) => s + (d.used_count || 0), 0);

	// Commandes récentes (5 dernières)
	const recentOrders = [...orders]
		.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
		.slice(0, 5);

	return (
		<div className="p-5 lg:p-8 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
						Vue d'ensemble
					</p>
					<h2 className="font-editorial text-[28px] text-baume-charcoal mt-1">
						Tableau de bord
					</h2>
				</div>

				{/* Filtre période */}
				<div className="flex items-center gap-2 flex-wrap">
					{PERIODS.map((p) => (
						<button
							key={p.key}
							onClick={() => setPeriod(p.key)}
							className={`h-9 px-4 rounded-full text-[13px] font-semibold border transition-all ${
								period === p.key
									? "bg-baume-burgundy text-baume-white border-baume-burgundy"
									: "bg-baume-white border-baume-border text-baume-charcoal hover:border-baume-burgundy/50"
							}`}
						>
							{p.label}
						</button>
					))}
					<button
						onClick={() => {
							loadData();
							loadPosthog();
						}}
						className="h-9 w-9 rounded-full border border-baume-border bg-baume-white inline-flex items-center justify-center text-baume-charcoal hover:border-baume-burgundy transition"
					>
						<RefreshCw className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Stats principales */}
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					icon={ShoppingCart}
					label="Commandes"
					value={formatNumber(periodOrders.length)}
					sub={`sur ${selectedPeriod.label.toLowerCase()}`}
					color="burgundy"
					loading={loading}
				/>
				<StatCard
					icon={TrendingUp}
					label="Chiffre d'affaires"
					value={formatCurrency(periodRevenue)}
					sub={`Moy. ${formatCurrency(avgOrder)} / commande`}
					color="emerald"
					loading={loading}
				/>
				<StatCard
					icon={Users}
					label="Nouveaux clients"
					value={formatNumber(periodProfiles.length)}
					sub="comptes créés"
					color="blue"
					loading={loading}
				/>
				<StatCard
					icon={Tag}
					label="Codes promo utilisés"
					value={formatNumber(discountUsage)}
					sub="utilisations totales"
					color="amber"
					loading={loading}
				/>
			</div>

			{/* Stats PostHog */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<StatCard
					icon={Eye}
					label="Pages vues"
					value={pageviews !== null ? formatNumber(pageviews) : "—"}
					sub={selectedPeriod.label}
					color="purple"
					loading={posthogLoading}
				/>
				<StatCard
					icon={Users}
					label="Visiteurs uniques"
					value={uniqueVisitors !== null ? formatNumber(uniqueVisitors) : "—"}
					sub={selectedPeriod.label}
					color="blue"
					loading={posthogLoading}
				/>
				<div className="rounded-2xl border border-baume-border bg-baume-white p-5 flex items-start gap-4">
					<div className="h-10 w-10 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center shrink-0">
						<Activity className="h-5 w-5 text-emerald-700" />
					</div>
					<div className="flex-1">
						<p className="text-[11px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold">
							En ligne maintenant
						</p>
						{posthogLoading ? (
							<div className="mt-1 h-7 w-16 rounded-lg bg-baume-ivory animate-pulse" />
						) : (
							<div className="flex items-center gap-2 mt-0.5">
								<span className="text-[24px] font-editorial text-baume-charcoal leading-tight">
									{activeUsers !== null ? formatNumber(activeUsers) : "—"}
								</span>
								{activeUsers > 0 && (
									<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
								)}
							</div>
						)}
						<p className="mt-0.5 text-[12px] text-baume-charcoal/50">
							5 dernières minutes
						</p>
					</div>
				</div>
			</div>

			{/* Commandes récentes */}
			<div className="rounded-2xl border border-baume-border bg-baume-white overflow-hidden">
				<div className="px-5 py-4 border-b border-baume-border flex items-center justify-between">
					<h3 className="font-semibold text-[15px] text-baume-charcoal">
						Commandes récentes
					</h3>
					<Link
						to="/admin"
						onClick={() => {
							/* handled by parent setActive */
						}}
						className="text-[13px] text-baume-burgundy font-semibold inline-flex items-center gap-1 hover:underline underline-offset-4"
					>
						Voir tout <ArrowRight className="h-3.5 w-3.5" />
					</Link>
				</div>

				{loading ? (
					<div className="py-16 flex justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-baume-burgundy" />
					</div>
				) : recentOrders.length === 0 ? (
					<div className="py-12 text-center text-baume-charcoal/50 text-[13px]">
						Aucune commande pour l'instant
					</div>
				) : (
					<div className="divide-y divide-baume-border">
						{recentOrders.map((o) => (
							<div
								key={o.id}
								className="px-5 py-4 flex items-center gap-4 hover:bg-baume-ivory/40 transition"
							>
								<div className="h-10 w-10 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center shrink-0">
									<Package className="h-4 w-4" />
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-[13px] font-semibold text-baume-charcoal">
											#{String(o.id).slice(0, 8).toUpperCase()}
										</span>
										<StatusBadge status={o.status} />
									</div>
									<p className="text-[12px] text-baume-charcoal/55 mt-0.5 truncate">
										{o.email || "—"} ·{" "}
										{o.created_at
											? new Date(o.created_at).toLocaleDateString("fr-CH", {
													day: "numeric",
													month: "short",
													hour: "2-digit",
													minute: "2-digit",
												})
											: "—"}
									</p>
								</div>

								<div className="text-right shrink-0">
									<p className="font-semibold text-[14px] text-baume-charcoal">
										{formatCurrency(o.total, o.currency)}
									</p>
									<Link
										to={`/admin/orders/${o.id}`}
										className="text-[12px] text-baume-burgundy hover:underline underline-offset-2"
									>
										Voir →
									</Link>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Codes promo actifs */}
			{discounts.filter((d) => d.active).length > 0 && (
				<div className="rounded-2xl border border-baume-border bg-baume-white overflow-hidden">
					<div className="px-5 py-4 border-b border-baume-border">
						<h3 className="font-semibold text-[15px] text-baume-charcoal">
							Codes promo actifs
						</h3>
					</div>
					<div className="divide-y divide-baume-border">
						{discounts
							.filter((d) => d.active)
							.slice(0, 5)
							.map((d) => (
								<div
									key={d.id}
									className="px-5 py-3 flex items-center justify-between gap-4"
								>
									<div className="flex items-center gap-3">
										<span className="font-mono font-bold text-[13px] text-baume-charcoal bg-baume-ivory border border-baume-border px-2 py-0.5 rounded-lg">
											{d.code}
										</span>
										<span className="text-[13px] text-baume-burgundy font-semibold">
											{d.type === "percentage"
												? `−${d.value}%`
												: `−${Number(d.value).toFixed(2)} CHF`}
										</span>
									</div>
									<span className="text-[12px] text-baume-charcoal/50">
										{d.used_count || 0} utilisation
										{(d.used_count || 0) > 1 ? "s" : ""}
										{d.usage_limit ? ` / ${d.usage_limit}` : ""}
									</span>
								</div>
							))}
					</div>
				</div>
			)}
		</div>
	);
}
