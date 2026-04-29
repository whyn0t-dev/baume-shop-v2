import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Package,
  ShieldCheck,
  Tag,
  Truck,
  User,
} from "lucide-react";
import { getOrder } from "../lib/api";
import { getAdminOrder } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function OrderItems() {
  const { orderId } = useParams();
  const { user, status } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin =
    user?.role === "admin" ||
    user?.is_admin === true ||
    user?.isAdmin === true;

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;

    setLoading(true);
    getOrder(orderId)
      .then((data) => setOrder(data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId, status, isAdmin]);

  if (status === "loading" || loading) return <Loading />;

  if (status !== "authenticated" || !isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f1f1f1] p-8">
        <p>Commande introuvable.</p>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency || "CHF").toUpperCase();
  const shippingAddress =
    typeof order.shipping_address === "object" && order.shipping_address
      ? order.shipping_address
      : {};
  const billingAddress =
    typeof order.billing_address === "object" && order.billing_address
      ? order.billing_address
      : {};

  const orderNumber = order.order_number
    ? `#BS-${order.order_number}`
    : `#${String(order.id).slice(0, 8).toUpperCase()}`;

  const customerName =
    shippingAddress.name ||
    order.customer_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Client";

  return (
    <div className="min-h-screen bg-[#f1f1f1] text-[#303030]">
      <header className="sticky top-0 z-10 border-b border-[#d4d4d4] bg-[#f1f1f1]/95 backdrop-blur px-4 md:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-[13px] text-[#555] hover:text-black mb-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Commandes
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold">{orderNumber}</h1>
              <Badge tone="gray">Payée</Badge>
              <Badge tone="yellow">Non traitée</Badge>
            </div>

            <p className="text-[12px] text-[#6b6b6b] mt-1">
              {order.created_at
                ? new Date(order.created_at).toLocaleString("fr-CH")
                : "Date inconnue"}{" "}
              provenant de Boutique en ligne
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton>Rembourser</ActionButton>
            <ActionButton>Modifier</ActionButton>
            <ActionButton>
              Imprimer <ChevronDown className="h-3.5 w-3.5" />
            </ActionButton>
            <ActionButton>
              Autres actions <ChevronDown className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="yellow">
                  <Package className="h-3.5 w-3.5" />
                  Non traité ({items.length})
                </Badge>
                <Badge tone="gray">
                  <MapPin className="h-3.5 w-3.5" />
                  Baume, 2 Rue de la Mairie
                </Badge>
              </div>
              <MoreHorizontal className="h-5 w-5 text-[#666]" />
            </div>

            <div className="rounded-lg border border-[#ddd] bg-white mb-3 px-4 py-3 flex items-center gap-2 text-[13px]">
              <Truck className="h-4 w-4" />
              Livraison standard
            </div>

            <div className="rounded-lg border border-[#ddd] overflow-hidden bg-white">
              {items.length === 0 ? (
                <div className="p-5 text-[13px] text-[#777]">
                  Aucun article trouvé pour cette commande.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex items-center gap-3 border-b border-[#eee] last:border-b-0"
                  >
                    <div className="h-12 w-12 rounded-md bg-[#f6f6f6] border border-[#e5e5e5] flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-[#777]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">
                        {item.product_title}
                      </p>
                      <p className="text-[12px] text-[#777]">
                        {item.variant_title || item.sku || "—"}
                      </p>
                    </div>

                    <div className="text-[13px] text-right whitespace-nowrap">
                      {Number(item.unit_price || 0).toFixed(2)} {currency} ×{" "}
                      <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-[#eee] px-1">
                        {item.quantity || 1}
                      </span>
                    </div>

                    <div className="text-[13px] text-right w-24">
                      {Number(item.total_price || 0).toFixed(2)} {currency}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-3">
              <button className="h-9 px-4 rounded-md bg-[#303030] text-white text-[13px] font-semibold inline-flex items-center gap-2">
                Marquer comme traité
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </Panel>

          <Panel>
            <Badge tone="gray">
              <CreditCard className="h-3.5 w-3.5" />
              Payée
            </Badge>

            <div className="mt-4 rounded-lg border border-[#ddd] overflow-hidden bg-white">
              <SummaryLine
                label="Sous-total"
                detail={`${items.length} article${items.length > 1 ? "s" : ""}`}
                value={`${Number(order.subtotal || 0).toFixed(2)} ${currency}`}
              />
              {Number(order.discount_total || 0) > 0 && (
                <SummaryLine
                  label="Réduction"
                  detail="Code réduction"
                  value={`-${Number(order.discount_total || 0).toFixed(2)} ${currency}`}
                />
              )}
              <SummaryLine
                label="Expédition"
                detail="Livraison standard"
                value={`${Number(order.shipping_total || 0).toFixed(2)} ${currency}`}
              />
              <SummaryLine
                label="Taxes"
                detail="Incluses"
                value={`${Number(order.tax_total || 0).toFixed(2)} ${currency}`}
              />
              <SummaryLine
                label="Total"
                value={`${Number(order.total || 0).toFixed(2)} ${currency}`}
                strong
              />
              <SummaryLine
                label="Payé"
                value={`${Number(order.total || 0).toFixed(2)} ${currency}`}
              />
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">Champs méta</h2>
              <button className="text-[13px] text-[#555]">Tout afficher</button>
            </div>
            <p className="mt-5 text-[13px] text-[#777]">
              Aucun champ méta épinglé
            </p>
          </Panel>

          <div>
            <h2 className="text-[14px] font-semibold mb-3">Calendrier</h2>

            <Panel>
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-600 text-white flex items-center justify-center font-semibold">
                  {user?.first_name?.[0] || "A"}
                </div>
                <div className="flex-1">
                  <div className="rounded-lg bg-[#fafafa] border border-[#e5e5e5] px-4 py-3 text-[13px] text-[#777]">
                    Laisser un commentaire...
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[#777]">
                    <MessageSquare className="h-4 w-4" />
                    <Tag className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Panel>

            <div className="mt-5 pl-7 border-l border-[#d5d5d5] space-y-5">
              <TimelineItem>
                La confirmation n° {orderNumber} a été générée pour cette
                commande.
              </TimelineItem>
              <TimelineItem>
                Un paiement de {Number(order.total || 0).toFixed(2)} {currency} a
                été traité.
              </TimelineItem>
              <TimelineItem>
                {customerName} a passé cette commande sur Online Store.
              </TimelineItem>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <SidePanel title="Notes">
            <p className="text-[13px] text-[#777]">
              {order.notes || "Aucune note du client"}
            </p>
          </SidePanel>

          <SidePanel title="Client">
            <p className="text-[13px] font-semibold text-blue-600">
              {customerName}
            </p>
            <p className="text-[13px] text-blue-600 mt-1">1 commande</p>

            <BlockTitle>Coordonnées</BlockTitle>
            <p className="text-[13px] text-[#555]">{order.email || "Aucun e-mail fourni"}</p>
            <p className="text-[13px] text-[#555]">{shippingAddress.phone || "Téléphone non fourni"}</p>

            <BlockTitle>Adresse d’expédition</BlockTitle>
            <Address address={shippingAddress} fallbackName={customerName} />

            <BlockTitle>Adresse de facturation</BlockTitle>
            {Object.keys(billingAddress).length > 0 ? (
              <Address address={billingAddress} fallbackName={customerName} />
            ) : (
              <p className="text-[13px] text-[#555]">
                Identique à l’adresse d’expédition
              </p>
            )}
          </SidePanel>

          <SidePanel title="Résumé de la conversion">
            <InfoLine icon={BadgeCheck}>Il s’agit de sa 1ère commande.</InfoLine>
            <InfoLine icon={Clock}>1re visite à partir de Instagram</InfoLine>
            <InfoLine icon={Clock}>2 visites sur 1 jour</InfoLine>
            <button className="mt-3 text-[13px] text-blue-600">
              Voir les détails de la conversion
            </button>
          </SidePanel>

          <SidePanel title="Risque de la commande">
            <div className="h-2 rounded-full bg-[#e5e5e5] overflow-hidden mb-3">
              <div className="h-full w-1/3 bg-emerald-600" />
            </div>
            <div className="grid grid-cols-3 text-[12px] text-[#555] mb-3">
              <span>Faible</span>
              <span className="text-center">Moyen</span>
              <span className="text-right">Élevé</span>
            </div>
            <p className="text-[13px] text-[#555]">
              Le risque de rétrofacturation est faible. Vous pouvez traiter cette
              commande.
            </p>
          </SidePanel>

          <SidePanel title="Balises">
            <input className="w-full h-9 rounded-md border border-[#bbb] bg-white px-3 text-[13px]" />
          </SidePanel>
        </aside>
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-[#f1f1f1] flex items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
    </div>
  );
}

function Panel({ children }) {
  return (
    <section className="rounded-xl border border-[#d8d8d8] bg-white p-4 shadow-sm">
      {children}
    </section>
  );
}

function SidePanel({ title, children }) {
  return (
    <section className="rounded-xl border border-[#d8d8d8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <MoreHorizontal className="h-4 w-4 text-[#777]" />
      </div>
      {children}
    </section>
  );
}

function Badge({ children, tone = "gray" }) {
  const styles =
    tone === "yellow"
      ? "bg-yellow-100 text-yellow-900 border-yellow-200"
      : "bg-[#eeeeee] text-[#444] border-[#dddddd]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

function ActionButton({ children }) {
  return (
    <button className="h-9 px-4 rounded-lg bg-[#e4e4e4] hover:bg-[#dcdcdc] text-[13px] font-medium inline-flex items-center gap-1">
      {children}
    </button>
  );
}

function SummaryLine({ label, detail, value, strong = false }) {
  return (
    <div className="grid grid-cols-[120px_1fr_auto] gap-4 px-4 py-2 border-b border-[#eee] last:border-b-0 text-[13px]">
      <span className={strong ? "font-semibold" : ""}>{label}</span>
      <span className="text-[#555]">{detail}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function BlockTitle({ children }) {
  return (
    <p className="text-[12px] font-semibold text-[#555] mt-4 mb-1">
      {children}
    </p>
  );
}

function Address({ address, fallbackName }) {
  return (
    <div className="text-[13px] text-[#555] leading-5">
      <p>{address.name || fallbackName || "Nom non renseigné"}</p>
      <p>{address.line1 || address.address || "Adresse non renseignée"}</p>
      <p>
        {[address.postal_code, address.city].filter(Boolean).join(" ") || ""}
      </p>
      <p>{address.country || ""}</p>
    </div>
  );
}

function InfoLine({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[#555] py-1">
      <Icon className="h-4 w-4 text-[#666]" />
      <span>{children}</span>
    </div>
  );
}

function TimelineItem({ children }) {
  return (
    <div className="relative text-[13px] text-[#555]">
      <span className="absolute -left-[33px] top-1 h-3 w-3 rounded-full bg-[#777] border-2 border-[#f1f1f1]" />
      <p>{children}</p>
    </div>
  );
}