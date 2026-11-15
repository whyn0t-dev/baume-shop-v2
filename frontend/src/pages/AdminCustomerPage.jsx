import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
	ArrowLeft,
	Loader2,
	Mail,
	Phone,
	MapPin,
	ShoppingBag,
	Wallet,
	RotateCcw,
	Star,
	Gift,
	Repeat,
	CalendarDays,
	Tag,
	Send,
	Save,
	Users,
	Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "../lib/api";
import { STATUS_STYLES } from "../components/CustomersSection";

// ─────────────────────────────────────────────────────────────────────────────
// Fiche client — /admin/clients/:profileId
// Identité · indicateurs · historique (achats, remboursements, retours)
// · habitudes d'achat · fidélité · offres et emails envoyés · notes internes
// ─────────────────────────────────────────────────────────────────────────────

const chf = (v) =>
	v == null
		? "—"
		: `${new Intl.NumberFormat("fr-CH", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}).format(Number(v))} CHF`;
const dateFr = (iso) =>
	iso
		? new Date(iso).toLocaleDateString("fr-CH", {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: "—";

const ORDER_STATUS = {
	paid: ["Payée", "bg-emerald-100 text-emerald-700"],
	processing: ["En préparation", "bg-blue-100 text-blue-700"],
	shipped: ["Expédiée", "bg-purple-100 text-purple-700"],
	delivered: ["Livrée", "bg-baume-burgundy/10 text-baume-burgundy"],
	refunded: ["Remboursée", "bg-gray-100 text-gray-600"],
	cancelled: ["Annulée", "bg-red-100 text-red-700"],
	pending: ["En attente", "bg-yellow-100 text-yellow-700"],
};

const OFFER_LABELS = {
	post_purchase_30d: "Merci J+30 (avis + code)",
	replenish: "Réassort",
	winback: "Relance (inactive)",
	loyal: "Remerciement fidélité",
	manual: "Offre manuelle",
};

function Card({ title, icon: Icon, children, action, className = "" }) {
	return (
		<section
			className={`rounded-[24px] border border-baume-border bg-baume-white ${className}`}
		>
			<div className="px-5 py-4 border-b border-baume-border flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					{Icon && <Icon className="h-4 w-4 text-baume-burgundy" />}
					<h2 className="font-semibold text-[15px] text-baume-charcoal">{title}</h2>
				</div>
				{action}
			</div>
			<div className="p-5">{children}</div>
		</section>
	);
}

function Kpi({ label, value, sub }) {
	return (
		<div className="rounded-2xl border border-baume-border bg-baume-white p-4">
			<p className="text-[10px] uppercase tracking-[0.18em] text-baume-muted font-semibold">
				{label}
			</p>
			<p className="mt-1 font-editorial text-[24px] text-baume-charcoal leading-tight">
				{value}
			</p>
			{sub && <p className="text-[11px] text-baume-muted mt-0.5">{sub}</p>}
		</div>
	);
}

function Empty({ children }) {
	return <p className="text-[13px] text-baume-muted">{children}</p>;
}

function Bars({ items, labelMap = {} }) {
	if (!items?.length) return <Empty>Pas encore de données.</Empty>;
	const max = Math.max(...items.map((i) => i.quantity), 1);
	return (
		<ul className="space-y-2.5">
			{items.slice(0, 6).map((i) => (
				<li key={i.key}>
					<div className="flex justify-between text-[12px] mb-1">
						<span className="text-baume-charcoal">{labelMap[i.key] || i.key}</span>
						<span className="text-baume-muted tabular-nums">{i.quantity}</span>
					</div>
					<div className="h-1.5 rounded-full bg-baume-ivory overflow-hidden">
						<div
							className="h-full rounded-full bg-baume-burgundy"
							style={{ width: `${(i.quantity / max) * 100}%` }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}

export default function AdminCustomerPage() {
	const { profileId } = useParams();
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [categories, setCategories] = useState({});

	const [notes, setNotes] = useState("");
	const [tags, setTags] = useState("");
	const [optOut, setOptOut] = useState(false);
	const [saving, setSaving] = useState(false);

	const [offer, setOffer] = useState({ percent: 10, validity_days: 21, message: "" });
	const [sendingOffer, setSendingOffer] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.get(`/ecom/admin/customers/${profileId}`);
			setData(res.data);
			setNotes(res.data.customer?.admin_notes || "");
			setTags((res.data.customer?.tags || []).join(", "));
			setOptOut(!!res.data.customer?.marketing_opt_out);
		} catch (err) {
			setError(formatApiError(err));
		} finally {
			setLoading(false);
		}
	}, [profileId]);

	useEffect(() => {
		load();
		api
			.get("/categories", { params: { kind: "produit" } })
			.then((r) =>
				setCategories(
					Object.fromEntries((r.data || []).map((c) => [c.slug, c.name])),
				),
			)
			.catch(() => {});
	}, [load]);

	const saveNotes = async () => {
		setSaving(true);
		try {
			await api.patch(`/ecom/admin/customers/${profileId}`, {
				admin_notes: notes,
				tags: tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				marketing_opt_out: optOut,
			});
			toast.success("Fiche client enregistrée");
		} catch (err) {
			toast.error("Enregistrement impossible", { description: formatApiError(err) });
		} finally {
			setSaving(false);
		}
	};

	const sendOffer = async () => {
		if (
			!window.confirm(
				`Envoyer une offre de −${offer.percent} % (valable ${offer.validity_days} jours) par email ?`,
			)
		)
			return;
		setSendingOffer(true);
		try {
			const res = await api.post(`/ecom/admin/customers/${profileId}/offer`, {
				percent: Number(offer.percent),
				validity_days: Number(offer.validity_days),
				message: offer.message || null,
			});
			toast.success("Offre envoyée", { description: `Code ${res.data?.code || ""}` });
			load();
		} catch (err) {
			toast.error("Envoi impossible", { description: formatApiError(err) });
		} finally {
			setSendingOffer(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	if (error || !data) {
		return (
			<main className="min-h-screen bg-baume-ivory px-6 py-16 text-center">
				<p className="text-red-600">{error || "Cliente introuvable"}</p>
				<Link to="/admin" className="mt-6 inline-block text-baume-burgundy underline">
					Retour au tableau de bord
				</Link>
			</main>
		);
	}

	const { profile, stats, loyalty, habits } = data;
	const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;
	const allOffers = [
		...(data.followups || []).map((f) => ({
			id: f.id,
			kind: f.kind || "post_purchase_30d",
			code: f.discount_code,
			percent: f.discount_percent,
			status: f.status,
			date: f.sent_at || f.created_at,
			expires_at: f.expires_at,
		})),
		...(data.offers || []).map((o) => ({
			id: o.id,
			kind: o.rule,
			code: o.discount_code,
			percent: o.discount_percent,
			status: o.status,
			date: o.sent_at || o.created_at,
			expires_at: o.expires_at,
		})),
	].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
	const usedCodes = new Set(
		(data.discounts || []).filter((d) => d.used_count > 0).map((d) => d.code),
	);

	return (
		<main className="min-h-screen bg-baume-ivory">
			<div className="max-w-[1400px] mx-auto px-5 md:px-8 py-8 space-y-6">
				<Link
					to="/admin"
					className="inline-flex items-center gap-2 text-[13px] font-semibold text-baume-burgundy"
				>
					<ArrowLeft className="h-4 w-4" /> Tableau de bord
				</Link>

				{/* ── En-tête identité ── */}
				<header className="rounded-[28px] border border-baume-border bg-baume-white p-6 md:p-8 flex flex-col lg:flex-row lg:items-center gap-6">
					<div className="h-16 w-16 shrink-0 rounded-full bg-baume-burgundy text-white flex items-center justify-center font-editorial text-[26px]">
						{(profile.first_name || profile.email || "?").charAt(0).toUpperCase()}
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex flex-wrap items-center gap-3">
							<h1 className="font-editorial text-[32px] text-baume-charcoal leading-tight">
								{fullName}
							</h1>
							<span
								className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold ${
									STATUS_STYLES[loyalty.status?.key] || STATUS_STYLES.prospect
								}`}
							>
								{loyalty.status?.label}
							</span>
							{(data.customer?.tags || []).map((t) => (
								<span
									key={t}
									className="inline-flex px-2.5 py-1 rounded-full border border-baume-border text-[11px] text-baume-muted"
								>
									{t}
								</span>
							))}
						</div>
						<div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-baume-muted">
							<span className="inline-flex items-center gap-1.5">
								<Mail className="h-3.5 w-3.5" /> {profile.email}
							</span>
							{(profile.phone || data.customer?.phone) && (
								<span className="inline-flex items-center gap-1.5">
									<Phone className="h-3.5 w-3.5" />{" "}
									{profile.phone || data.customer?.phone}
								</span>
							)}
							<span className="inline-flex items-center gap-1.5">
								<CalendarDays className="h-3.5 w-3.5" /> Cliente depuis le{" "}
								{dateFr(profile.created_at)}
							</span>
							<span>
								Newsletter :{" "}
								<strong>
									{data.newsletter?.status === "active" ? "inscrite" : "non inscrite"}
								</strong>
							</span>
							{data.customer?.marketing_opt_out && (
								<span className="text-red-600 font-semibold">Refuse les offres</span>
							)}
						</div>
					</div>
				</header>

				{/* ── Indicateurs ── */}
				<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
					<Kpi
						label="Dépense nette"
						value={chf(stats.net_spent)}
						sub={`Brut ${chf(stats.gross_spent)}`}
					/>
					<Kpi
						label="Commandes payées"
						value={stats.paid_orders_count}
						sub={`${stats.orders_count} au total`}
					/>
					<Kpi label="Panier moyen" value={chf(stats.average_basket)} />
					<Kpi
						label="Remboursé"
						value={chf(stats.refunded_total)}
						sub={`${stats.returns_count} retour(s)`}
					/>
					<Kpi
						label="Fréquence d'achat"
						value={
							stats.purchase_frequency_days != null
								? `${stats.purchase_frequency_days} j`
								: "—"
						}
						sub="entre deux commandes"
					/>
					<Kpi
						label="Points fidélité"
						value={loyalty.points}
						sub={`${loyalty.total_earned} gagnés au total`}
					/>
				</div>

				<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
					{/* ── Colonne principale ── */}
					<div className="xl:col-span-2 space-y-6">
						<Card title="Habitudes d'achat" icon={Sparkles}>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div>
									<p className="text-[11px] uppercase tracking-[0.16em] text-baume-muted font-semibold mb-3">
										Catégories préférées
									</p>
									<Bars items={habits.categories} labelMap={categories} />
								</div>
								<div>
									<p className="text-[11px] uppercase tracking-[0.16em] text-baume-muted font-semibold mb-3">
										Marques
									</p>
									<Bars items={habits.brands} />
								</div>
								<div>
									<p className="text-[11px] uppercase tracking-[0.16em] text-baume-muted font-semibold mb-3">
										Tailles achetées
									</p>
									<Bars items={habits.sizes} />
								</div>
							</div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-baume-muted font-semibold mt-6 mb-3">
								Produits les plus achetés
							</p>
							{habits.top_products?.length ? (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{habits.top_products.slice(0, 8).map((p) => (
										<div
											key={p.product_id || p.name}
											className="flex items-center gap-3 rounded-2xl border border-baume-border p-3"
										>
											{p.image ? (
												<img
													src={p.image}
													alt=""
													className="h-12 w-12 rounded-xl object-cover bg-baume-ivory"
												/>
											) : (
												<div className="h-12 w-12 rounded-xl bg-baume-ivory" />
											)}
											<div className="min-w-0 flex-1">
												<p className="text-[13px] font-semibold text-baume-charcoal truncate">
													{p.name}
												</p>
												<p className="text-[11px] text-baume-muted">
													{p.quantity} unité(s) · {p.orders} commande(s) · dernier
													achat {dateFr(p.last_bought_at)}
												</p>
											</div>
											<span className="text-[12px] font-semibold tabular-nums">
												{chf(p.spent)}
											</span>
										</div>
									))}
								</div>
							) : (
								<Empty>Aucun achat pour l'instant.</Empty>
							)}
						</Card>

						<Card title="Historique des commandes" icon={ShoppingBag}>
							{data.orders?.length ? (
								<div className="overflow-x-auto -mx-5">
									<table className="w-full text-[13px]">
										<thead className="text-baume-muted">
											<tr>
												<th className="px-5 py-2 text-left font-semibold">Date</th>
												<th className="px-5 py-2 text-left font-semibold">Commande</th>
												<th className="px-5 py-2 text-left font-semibold">Articles</th>
												<th className="px-5 py-2 text-left font-semibold">Statut</th>
												<th className="px-5 py-2 text-right font-semibold">Total</th>
												<th className="px-5 py-2 text-right font-semibold">Remboursé</th>
												<th className="px-5 py-2" />
											</tr>
										</thead>
										<tbody className="divide-y divide-baume-border">
											{data.orders.map((o) => {
												const [label, cls] = ORDER_STATUS[o.status] || [o.status, "bg-gray-100 text-gray-600"];
												const refunded = (o.refunds || []).reduce(
													(s, r) => s + Number(r.amount || 0),
													0,
												);
												return (
													<tr key={o.id}>
														<td className="px-5 py-3 whitespace-nowrap">{dateFr(o.created_at)}</td>
														<td className="px-5 py-3 font-mono text-[12px]">
															{o.order_number || o.id.slice(0, 8)}
															{o.channel === "pos" && (
																<span className="ml-2 text-[10px] uppercase text-baume-burgundy">
																	boutique
																</span>
															)}
														</td>
														<td className="px-5 py-3 text-baume-muted">
															{(o.order_items || [])
																.map((i) => `${i.quantity}× ${i.product_title || i.name || "article"}`)
																.join(", ")
																.slice(0, 90) || "—"}
														</td>
														<td className="px-5 py-3">
															<span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
																{label}
															</span>
														</td>
														<td className="px-5 py-3 text-right tabular-nums">{chf(o.total)}</td>
														<td className="px-5 py-3 text-right tabular-nums text-red-600">
															{refunded > 0 ? chf(refunded) : "—"}
														</td>
														<td className="px-5 py-3 text-right">
															<Link
																to={`/admin/orders/${o.id}`}
																className="text-[12px] font-semibold text-baume-burgundy hover:underline"
															>
																Voir
															</Link>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : (
								<Empty>Aucune commande.</Empty>
							)}
						</Card>

						<Card title="Offres et emails automatiques" icon={Gift}>
							{allOffers.length ? (
								<ul className="divide-y divide-baume-border">
									{allOffers.map((o) => (
										<li key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
											<div>
												<p className="text-[13px] font-semibold text-baume-charcoal">
													{OFFER_LABELS[o.kind] || o.kind}
													{o.percent ? ` · −${o.percent} %` : ""}
												</p>
												<p className="text-[11px] text-baume-muted">
													{dateFr(o.date)}
													{o.code && (
														<>
															{" · "}
															<span className="font-mono">{o.code}</span>
														</>
													)}
													{o.expires_at && ` · expire le ${dateFr(o.expires_at)}`}
												</p>
											</div>
											<span
												className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
													usedCodes.has(o.code)
														? "bg-emerald-100 text-emerald-700"
														: o.status === "sent"
															? "bg-baume-ivory text-baume-burgundy"
															: "bg-gray-100 text-gray-600"
												}`}
											>
												{usedCodes.has(o.code)
													? "Code utilisé"
													: o.status === "sent"
														? "Envoyé"
														: o.status}
											</span>
										</li>
									))}
								</ul>
							) : (
								<Empty>
									Aucune offre envoyée pour l'instant. L'email « Merci J+30 » part
									automatiquement un mois après chaque commande ; les offres
									personnalisées sont envoyées chaque lundi selon ses achats.
								</Empty>
							)}
						</Card>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Card title="Retours" icon={RotateCcw}>
								{data.returns?.length ? (
									<ul className="space-y-2 text-[13px]">
										{data.returns.map((r) => (
											<li key={r.id} className="flex justify-between gap-2">
												<span>{dateFr(r.created_at)} · {r.reason || "Retour"}</span>
												<span className="font-semibold">{r.status}</span>
											</li>
										))}
									</ul>
								) : (
									<Empty>Aucun retour.</Empty>
								)}
							</Card>
							<Card title="Avis laissés" icon={Star}>
								{data.reviews?.length ? (
									<ul className="space-y-2 text-[13px]">
										{data.reviews.map((r) => (
											<li key={r.id} className="flex justify-between gap-2">
												<span className="truncate">
													{"★".repeat(Math.round(r.rating))} {r.title}
												</span>
												<span className="text-baume-muted shrink-0">{r.status}</span>
											</li>
										))}
									</ul>
								) : (
									<Empty>Aucun avis.</Empty>
								)}
							</Card>
						</div>
					</div>

					{/* ── Colonne latérale ── */}
					<div className="space-y-6">
						<Card title="Envoyer une offre personnalisée" icon={Send}>
							<p className="text-[12px] text-baume-muted mb-4">
								Code personnel à usage unique + 3 produits de sa catégorie
								préférée qu'elle n'a pas encore achetés.
							</p>
							<div className="grid grid-cols-2 gap-3">
								<label className="block">
									<span className="text-[11px] font-semibold text-baume-muted">
										Réduction
									</span>
									<select
										value={offer.percent}
										onChange={(e) => setOffer({ ...offer, percent: e.target.value })}
										className="mt-1 h-10 w-full rounded-xl border border-baume-border px-3 text-[13px]"
									>
										{[5, 10, 15, 20].map((p) => (
											<option key={p} value={p}>
												−{p} %
											</option>
										))}
									</select>
								</label>
								<label className="block">
									<span className="text-[11px] font-semibold text-baume-muted">
										Validité
									</span>
									<select
										value={offer.validity_days}
										onChange={(e) => setOffer({ ...offer, validity_days: e.target.value })}
										className="mt-1 h-10 w-full rounded-xl border border-baume-border px-3 text-[13px]"
									>
										{[7, 14, 21, 30].map((d) => (
											<option key={d} value={d}>
												{d} jours
											</option>
										))}
									</select>
								</label>
							</div>
							<textarea
								value={offer.message}
								onChange={(e) => setOffer({ ...offer, message: e.target.value })}
								placeholder="Message personnel (facultatif)"
								rows={3}
								className="mt-3 w-full rounded-xl border border-baume-border px-3 py-2 text-[13px] resize-none"
							/>
							<button
								type="button"
								onClick={sendOffer}
								disabled={sendingOffer || data.customer?.marketing_opt_out}
								className="mt-3 w-full h-11 rounded-full bg-baume-burgundy text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
							>
								<Send className="h-4 w-4" />
								{sendingOffer ? "Envoi…" : "Envoyer l'offre"}
							</button>
						</Card>

						<Card title="Notes internes" icon={Tag}>
							<label className="block text-[11px] font-semibold text-baume-muted">
								Étiquettes (séparées par des virgules)
							</label>
							<input
								value={tags}
								onChange={(e) => setTags(e.target.value)}
								placeholder="ex. post-partum, boutique Genève"
								className="mt-1 h-10 w-full rounded-xl border border-baume-border px-3 text-[13px]"
							/>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								rows={5}
								placeholder="Préférences, échanges en boutique, remarques…"
								className="mt-3 w-full rounded-xl border border-baume-border px-3 py-2 text-[13px] resize-none"
							/>
							<label className="mt-3 flex items-center gap-2 text-[13px]">
								<input
									type="checkbox"
									checked={optOut}
									onChange={(e) => setOptOut(e.target.checked)}
								/>
								Ne plus envoyer d'offres marketing
							</label>
							<button
								type="button"
								onClick={saveNotes}
								disabled={saving}
								className="mt-4 w-full h-10 rounded-full border border-baume-burgundy text-baume-burgundy text-[13px] font-semibold inline-flex items-center justify-center gap-2"
							>
								<Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
							</button>
						</Card>

						<Card title="Fidélité" icon={Wallet}>
							<p className="text-[13px]">
								<strong>{loyalty.points}</strong> points disponibles ·{" "}
								{loyalty.total_spent} utilisés
							</p>
							<ul className="mt-3 space-y-1.5 max-h-56 overflow-y-auto text-[12px]">
								{(loyalty.transactions || []).map((t) => (
									<li key={t.id} className="flex justify-between gap-2">
										<span className="truncate text-baume-muted">
											{dateFr(t.created_at)} · {t.reason}
										</span>
										<span
											className={`tabular-nums font-semibold ${
												t.points < 0 || t.type === "spend" ? "text-red-600" : "text-emerald-700"
											}`}
										>
											{t.points > 0 && t.type !== "spend" ? "+" : ""}
											{t.points}
										</span>
									</li>
								))}
							</ul>
						</Card>

						<Card title="Adresses" icon={MapPin}>
							{data.addresses?.length ? (
								<ul className="space-y-3 text-[13px]">
									{data.addresses.map((a) => (
										<li key={a.id}>
											{a.address_line1}
											{a.address_line2 ? `, ${a.address_line2}` : ""}
											<br />
											{a.postal_code} {a.city} · {a.country}
											{a.is_default && (
												<span className="ml-2 text-[10px] uppercase text-baume-burgundy">
													par défaut
												</span>
											)}
										</li>
									))}
								</ul>
							) : (
								<Empty>Aucune adresse enregistrée.</Empty>
							)}
						</Card>

						<Card title="Parrainage" icon={Users}>
							{data.referrals?.length ? (
								<ul className="space-y-1.5 text-[12px]">
									{data.referrals.map((r) => (
										<li key={r.id} className="flex justify-between gap-2">
											<span className="truncate">{r.referee_email}</span>
											<span className="font-semibold">{r.status}</span>
										</li>
									))}
								</ul>
							) : (
								<Empty>Aucun parrainage.</Empty>
							)}
						</Card>

						<Card title="Ateliers & quiz" icon={Repeat}>
							<p className="text-[13px]">
								{data.workshops?.length || 0} réservation(s) d'atelier
							</p>
							{data.quiz?.[0]?.recommended_categories?.length > 0 && (
								<p className="mt-2 text-[12px] text-baume-muted">
									Dernier quiz :{" "}
									{data.quiz[0].recommended_categories
										.map((c) => categories[c] || c)
										.join(", ")}
								</p>
							)}
						</Card>
					</div>
				</div>
			</div>
		</main>
	);
}
