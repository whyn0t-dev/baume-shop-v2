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
const formatAmount = (value, digits = 2) =>
	value == null || !Number.isFinite(Number(value))
		? null
		: new Intl.NumberFormat("fr-CH", {
				minimumFractionDigits: digits,
				maximumFractionDigits: digits,
			}).format(Number(value));

function StatCard({ title, description, icon: Icon, unit, value }) {
	return (
		<div className="rounded-2xl border border-baume-border bg-baume-ivory/40 p-5">
			<div className="flex items-start justify-between gap-3">
				<p className="text-[11px] font-bold uppercase tracking-wider text-baume-muted">
					{title}
				</p>
				<Icon className="h-5 w-5 shrink-0 text-baume-burgundy" />
			</div>
			<div className="mt-4 flex items-baseline gap-2">
				<span className="font-editorial text-[32px] text-baume-charcoal">
					{value ?? "—"}
				</span>
				{unit && (
					<span className="text-[12px] text-baume-muted">{unit}</span>
				)}
			</div>
			<p className="mt-2 text-[12px] leading-5 text-baume-muted">
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
						<p className="mt-1 text-[12px] leading-5 text-baume-muted">
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
			<p className="text-[13px] text-baume-muted">{message}</p>
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
								className="px-4 py-3 whitespace-nowrap font-semibold text-baume-muted"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
			</table>
			<div className="px-5 py-10 text-center text-[13px] text-baume-muted">
				{message}
			</div>
		</div>
	);
}
// ============================================================
// BAUME — TABLEAU DES VENTES RÉELLES
// ============================================================
// ── Tableau générique (rentabilité produits / marques) ──────────────────────
function DataTable({ columns, rows, empty }) {
	if (!rows || rows.length === 0) {
		return <EmptyState message={empty} />;
	}
	return (
		<div className="overflow-x-auto rounded-xl border border-baume-border">
			<table className="w-full text-[13px]">
				<thead className="bg-baume-ivory/60 text-baume-muted">
					<tr>
						{columns.map((c) => (
							<th
								key={c.key}
								className={`px-4 py-3 font-semibold whitespace-nowrap ${
									c.align === "right" ? "text-right" : "text-left"
								}`}
							>
								{c.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-baume-border">
					{rows.map((r, i) => (
						<tr key={r.key || i} className="bg-baume-white">
							{columns.map((c) => (
								<td
									key={c.key}
									className={`px-4 py-3 whitespace-nowrap ${
										c.align === "right" ? "text-right tabular-nums" : ""
									}`}
								>
									{c.render ? c.render(r) : (r[c.key] ?? "—")}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

const chfOrDash = (v) => {
	const f = formatAmount(v);
	return f == null ? "—" : `${f} CHF`;
};

function downloadCsv(filename, columns, rows) {
	const esc = (v) => {
		const str = v == null ? "" : String(v);
		return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
	};
	const lines = [
		columns.map((c) => esc(c.label)).join(";"),
		...rows.map((r) => columns.map((c) => esc(r[c.key])).join(";")),
	];
	const blob = new Blob(["\ufeff" + lines.join("\n")], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

const PRODUCT_COLUMNS = [
	{ key: "name", label: "Produit" },
	{ key: "vendor", label: "Marque" },
	{ key: "quantity_sold_gross", label: "Quantité", align: "right" },
	{
		key: "revenue_after_discounts",
		label: "CA après remises",
		align: "right",
		render: (r) => chfOrDash(r.revenue_after_discounts),
	},
	{
		key: "cogs_estimated",
		label: "Coût",
		align: "right",
		render: (r) => chfOrDash(r.cogs_estimated),
	},
	{
		key: "gross_margin_estimated",
		label: "Marge brute",
		align: "right",
		render: (r) => chfOrDash(r.gross_margin_estimated),
	},
	{
		key: "margin_rate",
		label: "Taux de marque",
		align: "right",
		render: (r) =>
			r.margin_rate == null ? "—" : `${formatAmount(r.margin_rate, 1)} %`,
	},
	{
		key: "coefficient",
		label: "Coefficient",
		align: "right",
		render: (r) => (r.coefficient == null ? "—" : formatAmount(r.coefficient)),
	},
];

const BRAND_COLUMNS = [
	{ key: "vendor", label: "Marque" },
	{ key: "products_count", label: "Produits", align: "right" },
	{ key: "units_sold", label: "Unités vendues", align: "right" },
	{
		key: "revenue_after_discounts",
		label: "CA après remises",
		align: "right",
		render: (r) => chfOrDash(r.revenue_after_discounts),
	},
	{
		key: "cogs_estimated",
		label: "Coût",
		align: "right",
		render: (r) => chfOrDash(r.cogs_estimated),
	},
	{
		key: "gross_margin_estimated",
		label: "Marge brute",
		align: "right",
		render: (r) => chfOrDash(r.gross_margin_estimated),
	},
	{
		key: "gross_margin_rate",
		label: "Taux",
		align: "right",
		render: (r) =>
			r.gross_margin_rate == null
				? "—"
				: `${formatAmount(r.gross_margin_rate, 1)} %`,
	},
];

function enrichProducts(products = []) {
	return products
		.filter((p) => p.quantity_sold_gross > 0)
		.map((p) => {
			const rev = Number(p.revenue_after_discounts);
			const cost = p.cogs_estimated == null ? null : Number(p.cogs_estimated);
			const margin =
				p.gross_margin_estimated == null ? null : Number(p.gross_margin_estimated);
			return {
				...p,
				key: p.product_id,
				margin_rate: margin != null && rev > 0 ? (margin / rev) * 100 : null,
				coefficient: cost != null && cost > 0 ? rev / cost : null,
			};
		})
		.sort((a, b) => Number(b.revenue_after_discounts) - Number(a.revenue_after_discounts));
}

function SalesTable({ products, currency = "CHF", loading, type }) {
	const isBest = type === "best";
	const columns = isBest
		? ["Produit", "Marque", "Vendus", "CA après remises"]
		: ["Produit", "Marque", "Vendus"];
	const formatMoney = (value) =>
		new Intl.NumberFormat("fr-CH", {
			style: "currency",
			currency,
		}).format(value);
	return (
		<div className="overflow-x-auto rounded-xl border border-baume-border">
			<table className="w-full text-left text-[13px]">
				<thead className="bg-baume-ivory/70">
					<tr>
						{columns.map((column) => (
							<th
								key={column}
								className="px-4 py-3 whitespace-nowrap font-semibold text-baume-muted"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{products.map((product) => (
						<tr
							key={product.product_id}
							className="border-t border-baume-border"
						>
							<td className="px-4 py-3">{product.name || "Produit inconnu"}</td>
							<td className="px-4 py-3">{product.vendor || "Sans marque"}</td>
							<td className="px-4 py-3">
								{product.quantity_sold_gross ?? "—"}
							</td>
							{isBest && (
								<td className="px-4 py-3">
									{product.revenue_after_discounts != null
										? formatMoney(product.revenue_after_discounts)
										: "—"}
								</td>
							)}
						</tr>
					))}
				</tbody>
			</table>
			{products.length === 0 && (
				<div className="px-5 py-10 text-center text-[13px] text-baume-muted">
					{loading ? "Chargement..." : "Aucune donnée pour cette période."}
				</div>
			)}
		</div>
	);
}
function OverviewView({ salesData, loading }) {
	const currencies = salesData?.currencies || {};
	const chf = currencies.CHF || null;
	const bestSellers = chf?.best_sellers || [];
	const leastSellers = chf?.least_sellers || [];
	const metrics = chf?.metrics || {};
	const inventory = salesData?.inventory || {};
	const stockRotation = salesData?.stock_rotation || {};
	const sellThrough = salesData?.sell_through || {};

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					title="CA produits après remises"
					description="Avant remboursements et déduction de la TVA"
					icon={Wallet}
					unit="CHF"
					value={
						chf && metrics.product_revenue_after_discounts != null
							? new Intl.NumberFormat("fr-CH", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								}).format(metrics.product_revenue_after_discounts)
							: null
					}
				/>
				<StatCard
					title="Unités vendues brutes"
					description="Quantités vendues avant déduction des retours"
					icon={ShoppingCart}
					value={chf ? metrics.units_sold_gross : null}
				/>
				<StatCard
					title="Marge brute"
					description="CA produits après remises − coût d'achat des unités vendues (avant TVA et remboursements)."
					icon={TrendingUp}
					unit="CHF"
					value={formatAmount(metrics.gross_margin_estimated)}
				/>
				<StatCard
					title="Valeur du stock estimée"
					description="Stock actuel × coût d'achat simulé, toutes variantes actives."
					icon={Boxes}
					unit="CHF"
					value={formatAmount(inventory.stock_cost_value)}
				/>

				<StatCard
					title="Taux d'écoulement"
					description={
						sellThrough.rate_percent == null
							? "En attente d'un historique complet des stocks, des réceptions et des retours."
							: "Part des unités disponibles vendues sur la période sélectionnée."
					}
					icon={Percent}
					unit="%"
					value={
						sellThrough.rate_percent == null
							? null
							: formatAmount(sellThrough.rate_percent, 1)
					}
				/>
			</div>
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
				<SectionCard
					title="Produits les plus vendus"
					description="Classement par quantité vendue avant déduction des retours."
					icon={TrendingUp}
				>
					<SalesTable
						products={bestSellers}
						currency="CHF"
						loading={loading}
						type="best"
					/>
				</SectionCard>
				<SectionCard
					title="Produits les moins vendus"
					description="Produits actifs, y compris ceux sans ventes."
					icon={TrendingDown}
				>
					<SalesTable
						products={leastSellers}
						currency="CHF"
						loading={loading}
						type="least"
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
function SalesView({ salesData }) {
	const metrics = salesData?.currencies?.CHF?.metrics || {};
	const missingCostItems = Array.isArray(metrics.missing_cost_items)
		? metrics.missing_cost_items
		: [];
	const inventory = salesData?.inventory || {};
	const revenue = metrics.product_revenue_after_discounts;
	const cogs = metrics.cogs_estimated;
	const margin = metrics.gross_margin_estimated;
	const markup =
		cogs != null && Number(cogs) > 0 && revenue != null
			? Number(revenue) / Number(cogs)
			: null;
	const marginRate =
		margin != null && revenue != null && Number(revenue) > 0
			? (Number(margin) / Number(revenue)) * 100
			: null;
	const productRows = enrichProducts(salesData?.currencies?.CHF?.products);
	const brandRows = salesData?.currencies?.CHF?.brands || [];
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
				<StatCard
					title="Unités vendues nettes"
					description="Ventes diminuées des retours"
					icon={ShoppingCart}
				/>
				<StatCard
					title="Coût des produits vendus estimé"
					description="Coût d'achat actuel simulé × unités vendues brutes."
					icon={Wallet}
					unit="CHF"
					value={formatAmount(cogs)}
				/>
				<StatCard
					title="Marge brute"
					description="CA après remises − coût des produits vendus, avant TVA et remboursements."
					icon={TrendingUp}
					unit="CHF"
					value={formatAmount(margin)}
				/>
				<StatCard
					title="Coefficient indicatif"
					description="CA après remises / coût simulé des unités vendues, hors ajustements de TVA."
					icon={BarChart3}
					value={formatAmount(markup)}
				/>
				<StatCard
					title="Taux de marque indicatif"
					description="Marge estimée / CA produits après remises, avant TVA et remboursements."
					icon={Percent}
					unit="%"
					value={formatAmount(marginRate, 1)}
				/>
			</div>
			<SectionCard
				title="Coûts fournisseurs et frais simulés"
				description="Données des variantes actuellement enregistrées dans Supabase. Les montants des ventes sont calculés sur les unités vendues brutes."
				icon={Wallet}
			>
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
					<StatCard
						title="Achats fournisseurs des ventes"
						description="Quantités vendues × prix fournisseur simulé."
						icon={Wallet}
						unit="CHF"
						value={formatAmount(metrics.supplier_cost_estimated)}
					/>
					<StatCard
						title="Frais d'acquisition des ventes"
						description="Quantités vendues × frais unitaires simulés."
						icon={Truck}
						unit="CHF"
						value={formatAmount(metrics.acquisition_fees_estimated)}
					/>
					<StatCard
						title="Valeur fournisseur du stock"
						description="Stock actuel × prix fournisseur simulé."
						icon={Boxes}
						unit="CHF"
						value={formatAmount(inventory.supplier_stock_value)}
					/>
				</div>
				{metrics.units_missing_cost > 0 && (
					<p className="mt-3 text-sm text-red-600">
						{metrics.units_missing_cost} unité(s) vendue(s) sans coût complet :
						les montants correspondants restent indisponibles.
					</p>
				)}
				{missingCostItems.length > 0 && (
					<div className="mt-5 overflow-x-auto rounded-xl border border-red-200">
						<div className="bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
							Détail des lignes vendues sans coût complet
						</div>

						<table className="w-full text-left text-[12px]">
							<thead className="bg-baume-ivory/70">
								<tr>
									<th className="px-4 py-3">Produit</th>
									<th className="px-4 py-3">Variante</th>
									<th className="px-4 py-3">Quantité</th>
									<th className="px-4 py-3">Problème détecté</th>
								</tr>
							</thead>

							<tbody>
								{missingCostItems.map((item, index) => (
									<tr
										key={
											item.order_item_id ||
											`${item.variant_id || "sans-variante"}-${index}`
										}
										className="border-t border-baume-border"
									>
										<td className="px-4 py-3">
											{item.product_title ||
												item.product_id ||
												"Produit inconnu"}
										</td>

										<td className="px-4 py-3 font-mono">
											{item.variant_id || "Non renseignée"}
										</td>

										<td className="px-4 py-3">{item.quantity ?? "—"}</td>

										<td className="px-4 py-3 text-red-700">
											{(item.missing_fields || [])
												.map(
													(field) =>
														({
															variant_not_found_or_variant_id_missing:
																"Variante introuvable ou identifiant absent",
															supplier_currency_not_chf:
																"Devise fournisseur différente du CHF",
															supplier_price: "Prix fournisseur absent",
															acquisition_fees: "Frais d'acquisition absents",
															cost_price: "Coût d'achat absent",
															order_currency_not_chf:
																"Commande dans une autre devise",
														})[field] || field,
												)
												.join(", ") || "Coût incomplet"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</SectionCard>
			<SectionCard
				title="Rentabilité par produit"
				description="Comparer les ventes, les coûts et les marges brutes."
				icon={TrendingUp}
			>
				<DataTable
					columns={PRODUCT_COLUMNS}
					rows={productRows}
					empty="Aucune vente sur la période sélectionnée."
				/>
			</SectionCard>
			<SectionCard
				title="Ventes par marque"
				description="Quantités, chiffre d'affaires et marge par marque."
				icon={BarChart3}
			>
				<DataTable
					columns={BRAND_COLUMNS}
					rows={brandRows.map((b) => ({ ...b, key: b.vendor }))}
					empty="Aucune donnée de marque sur la période."
				/>
			</SectionCard>
			<SectionCard
				title="Remises et remboursements"
				description="Suivre leur incidence sur le chiffre d'affaires."
				icon={RefreshCw}
			>
				<DataTable
					columns={[
						{ key: "label", label: "Indicateur" },
						{
							key: "amount",
							label: "Montant",
							align: "right",
							render: (r) => chfOrDash(r.amount),
						},
						{
							key: "share",
							label: "Part du CA brut",
							align: "right",
							render: (r) =>
								r.share == null ? "—" : `${formatAmount(r.share, 1)} %`,
						},
					]}
					rows={
						metrics.product_revenue_gross != null
							? [
									{
										key: "discounts",
										label: "Remises accordées",
										amount: metrics.discounts_allocated,
										share:
											Number(metrics.product_revenue_gross) > 0
												? (Number(metrics.discounts_allocated) /
														Number(metrics.product_revenue_gross)) *
													100
												: null,
									},
								]
							: []
					}
					empty="Les remises apparaîtront ici. Les remboursements ne sont pas encore déduits."
				/>
			</SectionCard>
		</div>
	);
}
function InventoryView({ salesData }) {
	const inventory = salesData?.inventory || {};
	const stockHistory = salesData?.stock_history || {};
	const stockCoverage = salesData?.stock_coverage || {};
	const coverageVariants = stockCoverage.variants || [];
	const stockRotation = salesData?.stock_rotation || {};

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					title="Stock initial"
					description={
						stockHistory.initial_date
							? `Stock relevé le ${new Date(
									`${stockHistory.initial_date}T12:00:00`,
								).toLocaleDateString("fr-CH")}`
							: "Aucun relevé disponible pour le début de cette période."
					}
					icon={Package}
					unit="unités"
					value={
						stockHistory.initial == null
							? null
							: formatAmount(stockHistory.initial, 0)
					}
				/>
				<StatCard
					title="Stock actuel"
					description="Unités actuelles des variantes actives, non reconstituées à la fin de la période."
					icon={Boxes}
					value={
						inventory.stock_units == null
							? null
							: formatAmount(inventory.stock_units, 0)
					}
				/>
				<StatCard
					title="Stock final"
					description={
						stockHistory.final_date
							? `Stock relevé le ${new Date(
									`${stockHistory.final_date}T12:00:00`,
								).toLocaleDateString("fr-CH")}`
							: "Aucun relevé de clôture disponible pour cette période."
					}
					icon={Boxes}
					unit="unités"
					value={
						stockHistory.final == null
							? null
							: formatAmount(stockHistory.final, 0)
					}
				/>

				<StatCard
					title="Rotation du stock"
					description={
						stockRotation.status === "estimated"
							? "Coût estimé des ventes / valeur moyenne du stock sur la période sélectionnée."
							: "Historique ou valorisation insuffisants pour calculer la rotation."
					}
					icon={RefreshCw}
					unit="fois"
					value={
						stockRotation.estimated == null
							? null
							: formatAmount(stockRotation.estimated, 3)
					}
				/>

				<StatCard
					title="Couverture du stock"
					description="Estimation sur les 30 derniers jours, uniquement pour les variantes ayant enregistré des ventes récentes."
					icon={Clock3}
					unit="jours"
					value={
						stockCoverage.global_coverage_days == null
							? null
							: formatAmount(stockCoverage.global_coverage_days, 1)
					}
				/>
			</div>
			<SectionCard
				title="Valorisation actuelle du stock"
				description="Valorisation à partir de product_variants.stock, indépendamment de la période sélectionnée."
				icon={Boxes}
			>
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
					<StatCard
						title="Coût total simulé du stock"
						description="Prix fournisseur et frais d'acquisition unitaires inclus."
						icon={Wallet}
						unit="CHF"
						value={formatAmount(inventory.stock_cost_value)}
					/>
					<StatCard
						title="Valeur fournisseur simulée"
						description="Stock actuel × prix fournisseur unitaire."
						icon={Package}
						unit="CHF"
						value={formatAmount(inventory.supplier_stock_value)}
					/>
					<StatCard
						title="Frais d'acquisition simulés"
						description="Stock actuel × frais d'acquisition unitaires."
						icon={Truck}
						unit="CHF"
						value={formatAmount(inventory.acquisition_fees_stock_value)}
					/>
				</div>
				{inventory.variants_missing_cost > 0 && (
					<p className="mt-3 text-sm text-red-600">
						{inventory.variants_missing_cost} variante(s) sans coût complet ;
						valorisation totale indisponible.
					</p>
				)}
			</SectionCard>
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
				{coverageVariants.length === 0 ? (
					<EmptyState message="Aucune donnée de couverture disponible." />
				) : (
					<div className="overflow-x-auto rounded-xl border border-baume-border">
						<table className="w-full text-left text-[13px]">
							<thead className="bg-baume-ivory/70">
								<tr>
									<th className="px-4 py-3">Produit / variante</th>
									<th className="px-4 py-3">Stock actuel</th>
									<th className="px-4 py-3">Vendus / 30 j</th>
									<th className="px-4 py-3">Ventes / jour</th>
									<th className="px-4 py-3">Couverture</th>
									<th className="px-4 py-3">Situation</th>
								</tr>
							</thead>

							<tbody>
								{coverageVariants.map((variant) => (
									<tr
										key={variant.variant_id}
										className="border-t border-baume-border"
									>
										<td className="px-4 py-3">
											<div className="font-semibold">
												{variant.product_name}
											</div>
											<div className="mt-1 font-mono text-[10px] text-baume-muted">
												{variant.variant_id}
											</div>
										</td>

										<td className="px-4 py-3">{variant.stock_units}</td>

										<td className="px-4 py-3">{variant.units_sold_30d}</td>

										<td className="px-4 py-3">
											{formatAmount(variant.daily_sales, 3)}
										</td>

										<td className="px-4 py-3">
											{variant.coverage_days == null
												? "—"
												: `${formatAmount(variant.coverage_days, 1)} jours`}
										</td>

										<td className="px-4 py-3">
											{variant.status === "no_recent_sales"
												? "Aucune vente récente"
												: variant.status === "out_of_stock"
													? "Rupture"
													: variant.status === "under_30_days"
														? "Moins de 30 jours"
														: "Plus de 30 jours"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
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
function ReportsView({ salesData, period }) {
	const [sending, setSending] = useState(false);
	const [sendResult, setSendResult] = useState(null);
	const metrics = salesData?.currencies?.CHF?.metrics || {};
	const brandRows = (salesData?.currencies?.CHF?.brands || []).map((b) => ({
		...b,
		key: b.vendor,
	}));
	const productRows = enrichProducts(salesData?.currencies?.CHF?.products);
	const periodLabel =
		PERIODS.find((p) => p.value === period)?.label || "Période sélectionnée";

	const sendTest = async () => {
		setSending(true);
		setSendResult(null);
		try {
			const res = await api.post("/ecom/admin/reports/monthly/send");
			setSendResult({
				ok: true,
				message: `Rapport envoyé à ${(res.data?.recipients || []).join(", ") || "l'administration"}.`,
			});
		} catch (err) {
			setSendResult({
				ok: false,
				message:
					err.response?.data?.detail ||
					"Envoi impossible. Vérifiez la fonction Supabase send-monthly-report.",
			});
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					title="CA après remises"
					description={periodLabel}
					icon={Wallet}
					unit="CHF"
					value={formatAmount(metrics.product_revenue_after_discounts)}
				/>
				<StatCard
					title="Coût des produits vendus"
					description="Coût d'achat des unités vendues"
					icon={Truck}
					unit="CHF"
					value={formatAmount(metrics.cogs_estimated)}
				/>
				<StatCard
					title="Marge brute"
					description="CA après remises − coût des produits vendus"
					icon={TrendingUp}
					unit="CHF"
					value={formatAmount(metrics.gross_margin_estimated)}
				/>
				<StatCard
					title="Taux de marge brute"
					description="Marge brute / CA après remises"
					icon={Percent}
					unit="%"
					value={formatAmount(metrics.gross_margin_rate, 1)}
				/>
			</div>
			<SectionCard
				title="Rapport par marque"
				description={`Ventes, coûts et marge brute par marque — ${periodLabel.toLowerCase()}.`}
				icon={FileText}
			>
				<DataTable
					columns={BRAND_COLUMNS}
					rows={brandRows}
					empty="Aucune vente sur la période sélectionnée."
				/>
			</SectionCard>
			<SectionCard
				title="Envoi automatique par email"
				description="Le 1er de chaque mois, le rapport du mois précédent (ventes, achats fournisseurs, marge brute, stocks, marques) est envoyé à l'administration."
				icon={Mail}
			>
				<div className="rounded-xl border border-baume-border bg-baume-ivory/40 p-5">
					<p className="text-[13px] text-baume-muted">
						Planifié chaque 1er du mois à 8h (heure de Genève) via une tâche
						cron Supabase et la fonction <code>send-monthly-report</code>.
						Destinataires : variable <code>REPORT_RECIPIENTS</code>.
					</p>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<span className="inline-flex px-3 py-1 rounded-full border border-baume-border text-[12px] font-semibold text-baume-burgundy">
							Mensuel · 1er du mois
						</span>
						<button
							type="button"
							onClick={sendTest}
							disabled={sending}
							className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-baume-burgundy text-white text-[12px] font-semibold disabled:opacity-50"
						>
							<Mail className="h-4 w-4" />
							{sending ? "Envoi…" : "Envoyer le rapport du mois précédent"}
						</button>
					</div>
					{sendResult && (
						<p
							className={`mt-3 text-[12px] ${
								sendResult.ok ? "text-emerald-700" : "text-red-600"
							}`}
						>
							{sendResult.message}
						</p>
					)}
				</div>
			</SectionCard>
			<SectionCard
				title="Export des statistiques"
				description="Téléchargement au format CSV (compatible Excel) de la période sélectionnée."
				icon={Download}
			>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						disabled={!productRows.length}
						onClick={() =>
							downloadCsv(
								`baume-produits-${period}.csv`,
								PRODUCT_COLUMNS,
								productRows,
							)
						}
						className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-baume-border text-[13px] font-semibold text-baume-charcoal hover:border-baume-burgundy/50 disabled:opacity-40"
					>
						<Download className="h-4 w-4" /> Rentabilité par produit
					</button>
					<button
						type="button"
						disabled={!brandRows.length}
						onClick={() =>
							downloadCsv(`baume-marques-${period}.csv`, BRAND_COLUMNS, brandRows)
						}
						className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-baume-border text-[13px] font-semibold text-baume-charcoal hover:border-baume-burgundy/50 disabled:opacity-40"
					>
						<Download className="h-4 w-4" /> Ventes par marque
					</button>
				</div>
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
	// ============================================================
	// BAUME — ACTUALISATION AUTOMATIQUE DES STATISTIQUES
	// ============================================================
	useEffect(() => {
		let cancelled = false;
		let requestInProgress = false;
		async function loadStatistics(showLoading = false) {
			if (requestInProgress) return;
			requestInProgress = true;
			if (showLoading) {
				setLoading(true);
			}
			try {
				const response = await api.get("/ecom/admin/statistics/sales", {
					params: { period },
				});
				if (!cancelled) {
					setSalesData(response.data);
					setError(null);
				}
			} catch (err) {
				if (!cancelled) {
					const status = err.response?.status;
					setError(
						status
							? `Impossible de charger les statistiques (HTTP ${status})`
							: err.message || "Erreur de chargement",
					);
				}
			} finally {
				requestInProgress = false;
				if (!cancelled) {
					setLoading(false);
				}
			}
		}
		loadStatistics(true);
		const interval = setInterval(() => {
			loadStatistics(false);
		}, 30000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [period]);
	return (
		<div className="p-5 lg:p-8 space-y-7">
			<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
				<div>
					<h3 className="font-editorial text-[28px] text-baume-charcoal">
						Statistiques & rapports
					</h3>
					<p className="mt-2 text-[13px] text-baume-muted">
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
				<p className="text-[12px] leading-5 text-baume-muted">
					Ventes issues de Supabase. Les prix fournisseurs, frais et coûts
					d'achat sont actuellement simulés : marges indicatives avant TVA,
					remboursements et retours. La valeur du stock reflète le stock actuel,
					pas le stock historique.
				</p>
			</div>
			<div className="flex flex-wrap gap-2 border-b border-baume-border pb-4">
				{loading && (
					<p className="text-sm text-baume-muted">
						Chargement des statistiques...
					</p>
				)}
				{error && <p className="text-sm text-red-600">{error}</p>}
				{salesData && !error && (
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
			{activeTab === "overview" && (
				<OverviewView salesData={salesData} loading={loading} />
			)}
			{activeTab === "sales" && <SalesView salesData={salesData} />}
			{activeTab === "inventory" && <InventoryView salesData={salesData} />}
			{activeTab === "reports" && (
				<ReportsView salesData={salesData} period={period} />
			)}
		</div>
	);
}
