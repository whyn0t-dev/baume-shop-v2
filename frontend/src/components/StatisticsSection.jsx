import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
	LayoutDashboard,
	BarChart3,
	Package,
	FileText,
	CalendarDays,
	Wallet,
	TrendingUp,
	TrendingDown,
	Boxes,
	Percent,
	RefreshCw,
	Clock3,
	AlertTriangle,
	ShoppingCart,
	Truck,
	Mail,
	Download,
	Info,
} from "lucide-react";

const TABS = [
	{ key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
	{ key: "sales", label: "Ventes & rentabilité", icon: BarChart3 },
	{ key: "inventory", label: "Stocks & réapprovisionnement", icon: Package },
	{ key: "reports", label: "Rapports", icon: FileText },
];

const PERIODS = [
	{ value: "month", label: "Ce mois" },
	{ value: "previous_month", label: "Mois précédent" },
	{ value: "last_30_days", label: "30 derniers jours" },
	{ value: "year", label: "Cette année" },
];

function StatCard({ title, description, icon: Icon, unit }) {
	return (
		<div className="rounded-2xl border border-baume-border bg-baume-ivory/40 p-5">
			<div className="flex items-start justify-between gap-3">
				<p className="text-[11px] font-bold uppercase tracking-wider text-baume-charcoal/60">
					{title}
				</p>
				<Icon className="h-5 w-5 shrink-0 text-baume-burgundy" />
			</div>

			<div className="mt-4 flex items-baseline gap-2">
				<span className="font-editorial text-[32px] text-baume-charcoal">
					—
				</span>
				{unit && (
					<span className="text-[12px] text-baume-charcoal/50">{unit}</span>
				)}
			</div>

			<p className="mt-2 text-[12px] leading-5 text-baume-charcoal/55">
				{description}
			</p>
		</div>
	);
}

function SectionCard({ title, description, icon: Icon, children }) {
	return (
		<section className="rounded-2xl border border-baume-border bg-baume-white p-5 lg:p-6">
			<div className="flex items-start gap-3">
				<Icon className="h-5 w-5 mt-1 shrink-0 text-baume-burgundy" />
				<div>
					<h4 className="font-editorial text-[23px] text-baume-charcoal">
						{title}
					</h4>
					{description && (
						<p className="mt-1 text-[12px] leading-5 text-baume-charcoal/55">
							{description}
						</p>
					)}
				</div>
			</div>
			<div className="mt-5">{children}</div>
		</section>
	);
}

function EmptyState({ message }) {
	return (
		<div className="rounded-xl border border-dashed border-baume-border bg-baume-ivory/40 px-5 py-12 text-center">
			<p className="text-[13px] text-baume-charcoal/55">{message}</p>
		</div>
	);
}

function EmptyTable({ columns, message }) {
	return (
		<div className="overflow-x-auto rounded-xl border border-baume-border">
			<table className="w-full text-left text-[13px]">
				<thead className="bg-baume-ivory/70">
					<tr>
						{columns.map((column) => (
							<th
								key={column}
								className="px-4 py-3 whitespace-nowrap font-semibold text-baume-charcoal/70"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
			</table>
			<div className="px-5 py-10 text-center text-[13px] text-baume-charcoal/50">
				{message}
			</div>
		</div>
	);
}

function OverviewView() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					title="Chiffre d'affaires net HT"
					description="Ventes après remises et remboursements"
					icon={Wallet}
					unit="CHF"
				/>
				<StatCard
					title="Marge brute"
					description="CA net HT moins coût des produits vendus"
					icon={TrendingUp}
					unit="CHF"
				/>
				<StatCard
					title="Valeur du stock"
					description="Stock disponible valorisé au prix d'achat"
					icon={Boxes}
					unit="CHF"
				/>
				<StatCard
					title="Taux d'écoulement"
					description="Part du stock disponible vendue sur la période"
					icon={Percent}
					unit="%"
				/>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
				<SectionCard
					title="Produits les plus vendus"
					description="Classement par quantité vendue nette."
					icon={TrendingUp}
				>
					<EmptyTable
						columns={["Produit", "Marque", "Vendus", "CA", "Écoulement"]}
						message="Les meilleures ventes apparaîtront ici."
					/>
				</SectionCard>

				<SectionCard
					title="Produits les moins vendus"
					description="Produits actifs, y compris ceux sans ventes."
					icon={TrendingDown}
				>
					<EmptyTable
						columns={["Produit", "Stock", "Vendus", "Écoulement"]}
						message="Les produits à faible rotation apparaîtront ici."
					/>
				</SectionCard>
			</div>

			<SectionCard
				title="Évolution des ventes"
				description="Chiffre d'affaires et quantités vendues au fil du temps."
				icon={BarChart3}
			>
				<EmptyState message="Le graphique des ventes apparaîtra ici." />
			</SectionCard>

			<SectionCard
				title="Alertes de gestion"
				description="Ruptures, stocks faibles, surstocks et produits sans ventes."
				icon={AlertTriangle}
			>
				<EmptyState message="Les alertes seront calculées à partir des données réelles." />
			</SectionCard>
		</div>
	);
}

function SalesView() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					title="Unités vendues nettes"
					description="Ventes diminuées des retours"
					icon={ShoppingCart}
				/>
				<StatCard
					title="Coût des produits vendus"
					description="Coût d'achat des unités vendues"
					icon={Wallet}
					unit="CHF"
				/>
				<StatCard
					title="Coefficient multiplicateur"
					description="Prix de vente HT / prix d'achat HT"
					icon={BarChart3}
				/>
				<StatCard
					title="Taux de marque"
					description="Marge brute / CA net HT"
					icon={Percent}
					unit="%"
				/>
			</div>

			<SectionCard
				title="Rentabilité par produit"
				description="Comparer les ventes, les coûts et les marges."
				icon={TrendingUp}
			>
				<EmptyTable
					columns={[
						"Produit",
						"Marque",
						"Quantité",
						"CA net HT",
						"Coût",
						"Marge",
						"Taux de marque",
						"Coefficient",
					]}
					message="Les résultats par produit apparaîtront ici."
				/>
			</SectionCard>

			<SectionCard
				title="Ventes par marque"
				description="Quantités, chiffre d'affaires et marge par marque."
				icon={BarChart3}
			>
				<EmptyState message="Le graphique des marques apparaîtra ici." />
			</SectionCard>

			<SectionCard
				title="Remises et remboursements"
				description="Suivre leur incidence sur le chiffre d'affaires."
				icon={RefreshCw}
			>
				<EmptyTable
					columns={["Indicateur", "Montant", "Part du CA"]}
					message="Les remises et remboursements apparaîtront ici."
				/>
			</SectionCard>
		</div>
	);
}

function InventoryView() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					title="Stock initial"
					description="Unités au début de la période"
					icon={Package}
				/>
				<StatCard
					title="Stock final"
					description="Unités à la fin de la période"
					icon={Boxes}
				/>
				<StatCard
					title="Rotation du stock"
					description="Coût des ventes / stock moyen valorisé"
					icon={RefreshCw}
				/>
				<StatCard
					title="Couverture du stock"
					description="Nombre estimé de jours avant épuisement"
					icon={Clock3}
					unit="jours"
				/>
			</div>

			<SectionCard
				title="Mouvements de stock"
				description="Reconstituer le stock initial, les entrées, les sorties et le stock final."
				icon={Package}
			>
				<EmptyTable
					columns={[
						"Produit / variante",
						"Stock initial",
						"Entrées",
						"Ventes",
						"Autres sorties",
						"Ajustements",
						"Stock final",
					]}
					message="Les mouvements de stock apparaîtront ici."
				/>
			</SectionCard>

			<SectionCard
				title="Taux d'écoulement et couverture"
				description="Identifier les produits qui se vendent rapidement ou restent immobilisés."
				icon={BarChart3}
			>
				<EmptyTable
					columns={[
						"Produit",
						"Stock disponible",
						"Vendus",
						"Écoulement",
						"Ventes / jour",
						"Couverture",
					]}
					message="L'analyse des stocks apparaîtra ici."
				/>
			</SectionCard>

			<SectionCard
				title="Réapprovisionnement"
				description="Quantités à examiner selon les ventes, les délais fournisseurs et le stock de sécurité."
				icon={Truck}
			>
				<EmptyTable
					columns={[
						"Produit",
						"Stock actuel",
						"En commande",
						"Délai",
						"Point de commande",
						"Quantité suggérée",
					]}
					message="Les suggestions de réapprovisionnement apparaîtront ici."
				/>
			</SectionCard>

			<SectionCard
				title="Produits dormants et surstocks"
				description="Repérer les produits dont le stock reste élevé par rapport aux ventes."
				icon={AlertTriangle}
			>
				<EmptyState message="Les produits à surveiller apparaîtront ici." />
			</SectionCard>
		</div>
	);
}

function ReportsView() {
	return (
		<div className="space-y-6">
			<SectionCard
				title="Rapport mensuel par marque"
				description="Récapitulatif des ventes, marges et quantités pour chaque marque."
				icon={FileText}
			>
				<EmptyTable
					columns={[
						"Marque",
						"Unités vendues",
						"CA net HT",
						"Coût",
						"Marge brute",
						"Stock final",
					]}
					message="Le rapport mensuel apparaîtra ici."
				/>
			</SectionCard>

			<SectionCard
				title="Envoi automatique par email"
				description="Rapport du mois précédent, envoyé aux destinataires autorisés."
				icon={Mail}
			>
				<div className="rounded-xl border border-baume-border bg-baume-ivory/40 p-5">
					<p className="text-[13px] text-baume-charcoal/65">
						L'envoi automatique sera configuré après la mise en place des
						calculs et la validation du rapport.
					</p>
					<span className="inline-flex mt-4 px-3 py-1 rounded-full border border-baume-border text-[12px] font-semibold text-baume-charcoal/60">
						Non configuré
					</span>
				</div>
			</SectionCard>

			<SectionCard
				title="Export des statistiques"
				description="Téléchargement des rapports de ventes et de stocks."
				icon={Download}
			>
				<EmptyState message="Les exports CSV seront disponibles après la connexion au backend." />
			</SectionCard>
		</div>
	);
}

export default function StatisticsSection() {
	const [activeTab, setActiveTab] = useState("overview");
	const [period, setPeriod] = useState("month");

	// ============================================================
	// BAUME — CHARGEMENT DES STATISTIQUES DE VENTES
	// ============================================================

	const [salesData, setSalesData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// ============================================================
	// BAUME — CHARGEMENT DES STATISTIQUES DE VENTES
	// ============================================================

	useEffect(() => {
		let cancelled = false;

		async function loadStatistics() {
			setLoading(true);
			setError(null);

			try {
				const response = await api.get("/ecom/admin/statistics/sales", {
					params: { period },
				});

				if (!cancelled) {
					setSalesData(response.data);
				}
			} catch (err) {
				if (!cancelled) {
					const status = err.response?.status;

					setError(
						status
							? `Impossible de charger les statistiques (HTTP ${status})`
							: err.message || "Erreur de chargement des statistiques",
					);

					setSalesData(null);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadStatistics();

		return () => {
			cancelled = true;
		};
	}, [period]);

	return (
		<div className="p-5 lg:p-8 space-y-7">
			<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
				<div>
					<h3 className="font-editorial text-[28px] text-baume-charcoal">
						Statistiques & rapports
					</h3>
					<p className="mt-2 text-[13px] text-baume-charcoal/60">
						Analyse des ventes, de la rentabilité et du réapprovisionnement.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<CalendarDays className="h-4 w-4 text-baume-burgundy" />
					<select
						value={period}
						onChange={(e) => setPeriod(e.target.value)}
						className="h-11 px-4 rounded-full border border-baume-border bg-baume-white text-[13px] font-semibold text-baume-charcoal outline-none"
					>
						{PERIODS.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="flex items-start gap-3 rounded-xl border border-baume-border bg-baume-ivory/50 p-4">
				<Info className="h-5 w-5 shrink-0 text-baume-burgundy" />
				<p className="text-[12px] leading-5 text-baume-charcoal/65">
					Structure du dashboard prête. Les données seront connectées
					progressivement à Supabase. Aucun chiffre fictif n'est affiché.
				</p>
			</div>

			<div className="flex flex-wrap gap-2 border-b border-baume-border pb-4">
				{loading && (
					<p className="text-sm text-baume-charcoal/60">
						Chargement des statistiques...
					</p>
				)}

				{error && <p className="text-sm text-red-600">{error}</p>}

				{salesData && (
					<p className="text-sm text-green-700">
						Statistiques chargées pour la période sélectionnée.
					</p>
				)}
				{TABS.map((tab) => {
					const Icon = tab.icon;
					const selected = activeTab === tab.key;

					return (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition ${
								selected
									? "bg-baume-burgundy text-baume-white"
									: "border border-baume-border text-baume-charcoal hover:bg-baume-ivory"
							}`}
						>
							<Icon className="h-4 w-4" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{activeTab === "overview" && <OverviewView />}
			{activeTab === "sales" && <SalesView />}
			{activeTab === "inventory" && <InventoryView />}
			{activeTab === "reports" && <ReportsView />}
		</div>
	);
}
