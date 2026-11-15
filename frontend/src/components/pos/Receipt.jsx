import React from "react";
import { createPortal } from "react-dom";
import { formatChf } from "../../lib/posApi";
import { BaumeLogo } from "../BaumeLogo";

// Coordonnées imprimées en tête du ticket.
export const STORE_INFO = {
	name: "BAUME",
	lines: ["Rue du Rhône 15", "1204 Genève"],
	footer: "Merci de votre visite !",
};

const METHOD_LABELS = {
	cash: "Espèces",
	card: "Carte / TWINT",
};

// Ticket 80 mm : à l'impression, seul le ticket est visible.
const PRINT_CSS = `
@media print {
  @page { size: 80mm auto; margin: 3mm; }
  html, body { background: #fff !important; }
  body > *:not(.pos-receipt-root) { display: none !important; }
  .pos-receipt-root { display: block !important; }
}
`;

function itemName(it) {
	return it.name || it.product_title || it.title || "Article";
}

function itemUnit(it) {
	return Number(it.unit_price ?? it.price ?? 0);
}

function itemTotal(it) {
	return Number(it.total_price ?? it.total ?? itemUnit(it) * Number(it.quantity || 1));
}

export default function Receipt({ receipt }) {
	if (!receipt) return null;

	const { order = {}, items = [], payment = {}, customer_name: customerName } = receipt;
	const date = order.created_at ? new Date(order.created_at) : new Date();
	const total = Number(order.total ?? payment.amount ?? items.reduce((s, it) => s + itemTotal(it), 0));
	const count = items.reduce((s, it) => s + Number(it.quantity || 0), 0);

	return createPortal(
		<div className="pos-receipt-root hidden">
			<style>{PRINT_CSS}</style>
			<div
				style={{
					width: "72mm",
					fontFamily: "'Courier New', ui-monospace, monospace",
					fontSize: "11.5px",
					lineHeight: 1.35,
					color: "#000",
				}}
			>
				<div style={{ textAlign: "center", marginBottom: 8 }}>
					<BaumeLogo title={STORE_INFO.name} style={{ display: "block", width: "44mm", height: "auto", margin: "0 auto 6px", color: "#000" }} />
					{STORE_INFO.lines.map((l) => (
						<div key={l}>{l}</div>
					))}
				</div>

				<div>{date.toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}</div>
				{order.order_number && <div>Ticket n° {order.order_number}</div>}
				{customerName && customerName !== "Client boutique" && <div>Client : {customerName}</div>}

				<Divider />

				{items.map((it, i) => (
					<div key={`${it.variant_id || itemName(it)}-${i}`} style={{ marginBottom: 4 }}>
						<div style={{ fontWeight: 600 }}>
							{itemName(it)}
							{it.size ? ` · ${it.size}` : ""}
						</div>
						<Row
							left={`${it.quantity} × ${formatChf(itemUnit(it))}`}
							right={formatChf(itemTotal(it))}
						/>
					</div>
				))}

				<Divider />

				<Row left={`${count} article${count > 1 ? "s" : ""}`} right="" />
				<Row left={<strong style={{ fontSize: 14 }}>TOTAL</strong>} right={<strong style={{ fontSize: 14 }}>{formatChf(total)}</strong>} />
				<div style={{ fontSize: 10 }}>Prix TTC</div>

				<Divider />

				<Row left="Paiement" right={METHOD_LABELS[payment.method] || payment.method || "—"} />
				{payment.method === "cash" && payment.cash_received != null && (
					<>
						<Row left="Reçu" right={formatChf(payment.cash_received)} />
						<Row left="Rendu" right={formatChf(payment.change_due)} />
					</>
				)}

				<div style={{ textAlign: "center", marginTop: 12 }}>{STORE_INFO.footer}</div>
			</div>
		</div>,
		document.body,
	);
}

function Row({ left, right }) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
			<span>{left}</span>
			<span style={{ whiteSpace: "nowrap" }}>{right}</span>
		</div>
	);
}

function Divider() {
	return <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />;
}
