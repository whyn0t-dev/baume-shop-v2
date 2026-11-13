import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
	ArrowLeft,
	Lock,
	Power,
	Banknote,
	Camera,
	CheckCircle2,
	Loader2,
	Mail,
	Minus,
	Plus,
	Printer,
	QrCode,
	RefreshCw,
	ScanLine,
	Search,
	ShoppingBag,
	Trash2,
	User,
	X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import BarcodeScanner from "../components/BarcodeScanner";
import CashDialog from "../components/pos/CashDialog";
import QrPaymentDialog from "../components/pos/QrPaymentDialog";
import CustomerDialog from "../components/pos/CustomerDialog";
import OrdersPanel from "../components/pos/OrdersPanel";
import Receipt from "../components/pos/Receipt";
import useHidScanner from "../components/pos/useHidScanner";
import {
	formatChf,
	newSaleId,
	posCashCheckout,
	posCatalog,
	posCustomer,
	posError,
	posLookupCustomer,
	roundChf,
} from "../lib/posApi";
import { activatePos, deactivatePos, getPosUser, isPosActive, startPosKeepAlive } from "../lib/posSession";

const AUTO_PRINT_KEY = "baume_pos_auto_print";

function readAutoPrint() {
	try {
		return localStorage.getItem(AUTO_PRINT_KEY) !== "false";
	} catch {
		return true;
	}
}

const norm = (v) => String(v ?? "").trim().toLowerCase();

function categoriesOf(product) {
	const c = product.category;
	if (!c) return [];
	return (Array.isArray(c) ? c : [c]).map(String).filter(Boolean);
}

function sellableVariants(product) {
	return (product.variants || []).filter((v) => v.active);
}

function variantPrice(product, variant) {
	return Number(variant?.price ?? product.price ?? 0);
}

function variantLabel(variant) {
	const t = variant?.title;
	return t && t.toLowerCase() !== "default" && t.toLowerCase() !== "default title" ? t : "";
}

export default function CaissePage() {
	const [active, setActive] = useState(isPosActive);

	useEffect(() => {
		const sync = () => setActive(isPosActive());
		window.addEventListener("baume-pos-session", sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener("baume-pos-session", sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	useEffect(() => (active ? startPosKeepAlive() : undefined), [active]);

	return active ? <PosTerminal /> : <PosActivation />;
}

/** Écran d'activation : un administrateur ouvre la caisse sur cet appareil. */
function PosActivation() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const submit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			await activatePos(email.trim(), password);
		} catch (err) {
			setError(
				err?.posForbidden
					? err.message
					: err?.response?.status === 401
						? "E-mail ou mot de passe incorrect."
						: posError(err, "Activation impossible. Vérifiez la connexion."),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-[#FBF7F2] p-4 text-baume-charcoal">
			<form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-baume-border bg-white p-6 shadow-sm">
				<div className="text-center">
					<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4ECE4]">
						<Lock className="h-5 w-5 text-baume-burgundy" />
					</span>
					<h1 className="text-[22px] font-semibold tracking-wide">BAUME · Caisse</h1>
					<p className="mt-1 text-[14px] text-neutral-500">
						Activez la caisse avec un compte administrateur. Elle restera connectée sur cet appareil jusqu'à
						sa désactivation.
					</p>
				</div>
				<input
					type="email"
					autoComplete="username"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="E-mail administrateur"
					className="h-12 w-full rounded-lg border border-baume-border px-3 text-[16px] outline-none focus:border-baume-burgundy"
				/>
				<input
					type="password"
					autoComplete="current-password"
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Mot de passe"
					className="h-12 w-full rounded-lg border border-baume-border px-3 text-[16px] outline-none focus:border-baume-burgundy"
				/>
				{error && <p className="rounded-lg bg-red-50 p-3 text-[14px] text-red-700">{error}</p>}
				<button
					type="submit"
					disabled={loading}
					className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-baume-burgundy text-[16px] font-semibold text-white disabled:opacity-50"
				>
					{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Power className="h-5 w-5" />}
					Activer la caisse
				</button>
				<Link to="/" className="block text-center text-[13px] text-neutral-500 underline-offset-2 hover:underline">
					Retour au site
				</Link>
			</form>
		</div>
	);
}

function PosTerminal() {
	const [tab, setTab] = useState("sale");
	const [catalog, setCatalog] = useState([]);
	const [loadingCatalog, setLoadingCatalog] = useState(true);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");

	const [cart, setCart] = useState([]);
	const [customer, setCustomer] = useState(null);
	const [receiptEmail, setReceiptEmail] = useState("");

	const [variantProduct, setVariantProduct] = useState(null);
	const [customerOpen, setCustomerOpen] = useState(false);
	const [cameraOpen, setCameraOpen] = useState(false);

	const [cashOpen, setCashOpen] = useState(false);
	const [cashSubmitting, setCashSubmitting] = useState(false);
	const [cashError, setCashError] = useState("");
	const saleIdRef = useRef(null);

	const [qrOpen, setQrOpen] = useState(false);
	const [qrPayload, setQrPayload] = useState(null);

	const [receipt, setReceipt] = useState(null);
	const [doneSale, setDoneSale] = useState(null);
	const [autoPrint, setAutoPrint] = useState(readAutoPrint);

	const searchRef = useRef(null);
	const posOperator = useMemo(() => {
		const u = getPosUser();
		return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : "";
	}, []);

	// ── Catalogue ──
	const loadCatalog = useCallback(async () => {
		setLoadingCatalog(true);
		try {
			const data = await posCatalog();
			setCatalog((data?.products || []).filter((p) => p.status === "active"));
		} catch (err) {
			toast.error(posError(err, "Catalogue indisponible."));
		} finally {
			setLoadingCatalog(false);
		}
	}, []);

	useEffect(() => {
		loadCatalog();
	}, [loadCatalog]);

	const categories = useMemo(() => {
		const set = new Set();
		catalog.forEach((p) => categoriesOf(p).forEach((c) => set.add(c)));
		return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
	}, [catalog]);

	const filtered = useMemo(() => {
		const q = norm(search);
		return catalog.filter((p) => {
			if (category !== "all" && !categoriesOf(p).includes(category)) return false;
			if (!q) return true;
			if (norm(p.name).includes(q)) return true;
			return (p.variants || []).some(
				(v) => norm(v.sku) === q || norm(v.barcode) === q || norm(v.title).includes(q),
			);
		});
	}, [catalog, search, category]);

	// ── Panier ──
	const qtyInCart = useCallback(
		(variantId) => cart.find((l) => l.variant_id === variantId)?.quantity || 0,
		[cart],
	);

	const addVariant = useCallback(
		(product, variant) => {
			if (!variant?.active || !variant.available || variant.stock <= 0) {
				toast.error("Article en rupture de stock", { description: product.name });
				return;
			}
			if (qtyInCart(variant.id) >= variant.stock) {
				toast.error(`Stock maximum atteint (${variant.stock})`, { description: product.name });
				return;
			}
			setCart((prev) => {
				const existing = prev.find((l) => l.variant_id === variant.id);
				if (existing) {
					return prev.map((l) => (l.variant_id === variant.id ? { ...l, quantity: l.quantity + 1 } : l));
				}
				return [
					...prev,
					{
						product_id: product.id,
						variant_id: variant.id,
						name: product.name,
						variant: variantLabel(variant),
						image: product.image,
						price: variantPrice(product, variant),
						stock: variant.stock,
						quantity: 1,
					},
				];
			});
		},
		[qtyInCart],
	);

	const pickProduct = (product) => {
		const variants = sellableVariants(product);
		if (variants.length === 1) addVariant(product, variants[0]);
		else if (variants.length > 1) setVariantProduct(product);
		else toast.error("Aucune variante vendable pour ce produit.");
	};

	const changeQty = (variantId, delta) => {
		setCart((prev) =>
			prev
				.map((l) => {
					if (l.variant_id !== variantId) return l;
					const next = l.quantity + delta;
					if (next > l.stock) {
						toast.error(`Stock maximum atteint (${l.stock})`);
						return l;
					}
					return { ...l, quantity: next };
				})
				.filter((l) => l.quantity > 0),
		);
	};

	const total = useMemo(() => roundChf(cart.reduce((s, l) => s + l.price * l.quantity, 0)), [cart]);
	const itemsCount = cart.reduce((s, l) => s + l.quantity, 0);

	const resetSale = () => {
		setCart([]);
		setCustomer(null);
		setReceiptEmail("");
		saleIdRef.current = null;
	};

	// ── Client ──
	const selectCustomer = async (c) => {
		setCustomerOpen(false);
		setCustomer(c);
		try {
			setCustomer(await posCustomer(c.id));
		} catch {
			// Les points fidélité ne s'afficheront pas, la vente reste possible.
		}
	};

	// ── Scan (douchette, caméra ou saisie) ──
	const handleCode = useCallback(
		async (raw) => {
			const code = String(raw || "").trim();
			if (!code) return;

			// Carte fidélité Baume : « BAUME:email ».
			if (code.toUpperCase().startsWith("BAUME:")) {
				try {
					const c = await posLookupCustomer(code.slice(6));
					setCustomer(c);
					toast.success(`Client : ${[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}`);
				} catch (err) {
					toast.error(posError(err, "Carte fidélité non reconnue."));
				}
				return;
			}

			const q = norm(code);
			for (const product of catalog) {
				const variant = (product.variants || []).find(
					(v) => v.active && (norm(v.barcode) === q || norm(v.sku) === q),
				);
				if (variant) {
					addVariant(product, variant);
					toast.success(product.name, { description: variantLabel(variant) || undefined, duration: 1200 });
					return;
				}
			}
			toast.error("Code inconnu", { description: code });
		},
		[catalog, addVariant],
	);

	const anyDialogOpen = cashOpen || qrOpen || customerOpen || cameraOpen || !!variantProduct || !!doneSale;
	useHidScanner(handleCode, tab === "sale" && !anyDialogOpen);

	const onSearchKeyDown = (e) => {
		if (e.key !== "Enter") return;
		e.preventDefault();
		const q = norm(search);
		if (!q) return;
		const exact = catalog.some((p) => (p.variants || []).some((v) => norm(v.barcode) === q || norm(v.sku) === q));
		if (exact) {
			handleCode(search);
			setSearch("");
		} else if (filtered.length === 1) {
			pickProduct(filtered[0]);
			setSearch("");
		}
	};

	// ── Paiement ──
	const saleItems = () => cart.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity }));

	const saleBase = () => ({
		items: saleItems(),
		customer_profile_id: customer?.id || null,
		email: receiptEmail.trim() || null,
	});

	const customerName = customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : "";

	const finishSale = useCallback(
		(data) => {
			setReceipt(data);
			setDoneSale(data);
			resetSale();
			loadCatalog();
			if (autoPrint) setTimeout(() => window.print(), 300);
		},
		[autoPrint, loadCatalog],
	);

	const openCash = () => {
		if (!saleIdRef.current) saleIdRef.current = newSaleId();
		setCashError("");
		setCashOpen(true);
	};

	const confirmCash = async (received) => {
		setCashSubmitting(true);
		setCashError("");
		try {
			const data = await posCashCheckout({
				...saleBase(),
				cash_received: received.toFixed(2),
				client_sale_id: saleIdRef.current,
			});
			setCashOpen(false);
			finishSale(data);
		} catch (err) {
			setCashError(posError(err, "Encaissement impossible. Réessayez."));
		} finally {
			setCashSubmitting(false);
		}
	};

	const openQr = () => {
		setQrPayload(saleBase());
		setQrOpen(true);
	};

	const onQrPaid = useCallback(
		(data) => {
			setQrOpen(false);
			finishSale(data);
		},
		[finishSale],
	);

	const printReceipt = (data) => {
		setReceipt(data);
		setTimeout(() => window.print(), 200);
	};

	const toggleAutoPrint = () => {
		setAutoPrint((v) => {
			try {
				localStorage.setItem(AUTO_PRINT_KEY, String(!v));
			} catch {
				/* stockage indisponible */
			}
			return !v;
		});
	};

	// ── Rendu ──
	return (
		<div className="flex h-[100dvh] flex-col bg-[#FBF7F2] text-baume-charcoal select-none">
			{/* Barre supérieure */}
			<header className="flex h-16 shrink-0 items-center gap-3 border-b border-baume-border bg-white px-4">
				<Link to="/admin" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-100" title="Retour à l'admin">
					<ArrowLeft className="h-5 w-5" />
				</Link>
				<div className="text-[18px] font-semibold tracking-wide">
					BAUME <span className="font-normal text-neutral-500">· Caisse</span>
				</div>

				<nav className="ml-4 flex rounded-lg bg-neutral-100 p-1">
					{[
						["sale", "Vente"],
						["orders", "Ventes du jour"],
					].map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => setTab(key)}
							className={`min-h-[40px] rounded-md px-4 text-[15px] font-medium ${
								tab === key ? "bg-white shadow-sm" : "text-neutral-600"
							}`}
						>
							{label}
						</button>
					))}
				</nav>

				<div className="ml-auto flex items-center gap-2">
					<span className="hidden text-[13px] text-neutral-500 lg:inline">{posOperator}</span>
					<button
						type="button"
						onClick={toggleAutoPrint}
						className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-[14px] ${
							autoPrint ? "border-baume-burgundy text-baume-burgundy" : "border-baume-border text-neutral-500"
						}`}
						title="Imprimer automatiquement le ticket après chaque vente"
					>
						<Printer className="h-4 w-4" /> Ticket auto {autoPrint ? "activé" : "désactivé"}
					</button>
					{tab === "sale" && (
						<button
							type="button"
							onClick={loadCatalog}
							className="flex h-11 w-11 items-center justify-center rounded-lg border border-baume-border"
							title="Actualiser le catalogue et les stocks"
						>
							<RefreshCw className={`h-4 w-4 ${loadingCatalog ? "animate-spin" : ""}`} />
						</button>
					)}
					<button
						type="button"
						onClick={() => {
							if (window.confirm("Désactiver la caisse sur cet appareil ? Il faudra la réactiver avec un compte administrateur.")) {
								deactivatePos();
							}
						}}
						className="flex min-h-[44px] items-center gap-2 rounded-lg border border-red-200 px-3 text-[14px] text-red-700"
						title="Désactiver la caisse"
					>
						<Power className="h-4 w-4" />
						<span className="hidden md:inline">Désactiver</span>
					</button>
				</div>
			</header>

			{tab === "orders" ? (
				<div className="flex-1 overflow-y-auto">
					<OrdersPanel onPrintReceipt={printReceipt} />
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col md:flex-row">
					{/* Catalogue */}
					<section className="flex min-h-0 flex-1 flex-col">
						<div className="flex shrink-0 gap-2 p-3">
							<div className="relative flex-1">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
								<input
									ref={searchRef}
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									onKeyDown={onSearchKeyDown}
									placeholder="Rechercher ou scanner un article"
									className="h-12 w-full rounded-xl border border-baume-border bg-white pl-10 pr-10 text-[16px] outline-none select-text focus:border-baume-burgundy"
								/>
								{search && (
									<button
										type="button"
										onClick={() => setSearch("")}
										className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full hover:bg-neutral-100"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>
							<button
								type="button"
								onClick={() => setCameraOpen(true)}
								className="flex h-12 items-center gap-2 rounded-xl border border-baume-border bg-white px-4 text-[15px]"
								title="Scanner avec la caméra"
							>
								<Camera className="h-5 w-5" />
								<span className="hidden lg:inline">Caméra</span>
							</button>
						</div>

						{categories.length > 0 && (
							<div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2">
								{["all", ...categories].map((c) => (
									<button
										key={c}
										type="button"
										onClick={() => setCategory(c)}
										className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[14px] capitalize ${
											category === c
												? "border-baume-burgundy bg-baume-burgundy text-white"
												: "border-baume-border bg-white"
										}`}
									>
										{c === "all" ? "Tout" : c}
									</button>
								))}
							</div>
						)}

						<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
							{loadingCatalog && catalog.length === 0 ? (
								<div className="flex justify-center py-20">
									<Loader2 className="h-8 w-8 animate-spin text-baume-burgundy" />
								</div>
							) : filtered.length === 0 ? (
								<p className="py-20 text-center text-neutral-500">Aucun article.</p>
							) : (
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
									{filtered.map((p) => {
										const variants = sellableVariants(p);
										const stock = variants.reduce((s, v) => s + (v.stock || 0), 0);
										const prices = variants.map((v) => variantPrice(p, v));
										const minPrice = prices.length ? Math.min(...prices) : Number(p.price || 0);
										const out = stock <= 0;
										return (
											<button
												key={p.id}
												type="button"
												onClick={() => pickProduct(p)}
												className={`flex flex-col overflow-hidden rounded-xl border border-baume-border bg-white text-left transition active:scale-[0.98] ${
													out ? "opacity-50" : ""
												}`}
											>
												<div className="aspect-[4/3] w-full bg-[#F4ECE4]">
													{p.image ? (
														<img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
													) : (
														<div className="flex h-full items-center justify-center">
															<ShoppingBag className="h-8 w-8 text-baume-taupe" />
														</div>
													)}
												</div>
												<div className="flex flex-1 flex-col p-3">
													<span className="line-clamp-2 text-[14px] font-medium leading-snug">{p.name}</span>
													<span className="mt-auto flex items-end justify-between pt-2">
														<span className="text-[16px] font-semibold tabular-nums">
															{variants.length > 1 ? "dès " : ""}
															{formatChf(minPrice)}
														</span>
														<span className={`text-[12px] ${out ? "text-red-600" : stock <= 3 ? "text-amber-600" : "text-neutral-500"}`}>
															{out ? "Rupture" : `Stock ${stock}`}
														</span>
													</span>
												</div>
											</button>
										);
									})}
								</div>
							)}
						</div>
					</section>

					{/* Panier */}
					<aside className="flex max-h-[55vh] w-full shrink-0 flex-col border-t border-baume-border bg-white md:max-h-none md:w-[380px] md:border-l md:border-t-0 lg:w-[420px]">
						<div className="shrink-0 border-b border-neutral-100 p-3">
							{customer ? (
								<div className="flex items-center gap-3 rounded-xl bg-[#F4ECE4] p-3">
									<User className="h-5 w-5 shrink-0 text-baume-burgundy" />
									<div className="min-w-0 flex-1">
										<div className="truncate text-[15px] font-medium">{customerName || customer.email}</div>
										<div className="truncate text-[13px] text-neutral-600">
											{customer.loyalty ? `${customer.loyalty.points} points fidélité` : customer.email}
										</div>
									</div>
									<button
										type="button"
										onClick={() => setCustomer(null)}
										className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/70"
										title="Retirer le client"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							) : (
								<div className="space-y-2">
									<button
										type="button"
										onClick={() => setCustomerOpen(true)}
										className="flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-dashed border-baume-border px-3 text-[15px] text-neutral-600"
									>
										<User className="h-5 w-5" /> Associer un client
										<span className="ml-auto flex items-center gap-1 text-[12px] text-neutral-400">
											<ScanLine className="h-4 w-4" /> ou scanner sa carte
										</span>
									</button>
									<div className="relative">
										<Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
										<input
											type="email"
											value={receiptEmail}
											onChange={(e) => setReceiptEmail(e.target.value)}
											placeholder="E-mail pour le reçu (facultatif)"
											className="h-11 w-full rounded-lg border border-baume-border pl-9 pr-3 text-[15px] outline-none select-text focus:border-baume-burgundy"
										/>
									</div>
								</div>
							)}
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto">
							{cart.length === 0 ? (
								<div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-6 text-center text-neutral-400">
									<ScanLine className="h-8 w-8" />
									<p className="text-[14px]">Touchez un article ou scannez son code-barres.</p>
								</div>
							) : (
								<ul className="divide-y divide-neutral-100">
									{cart.map((l) => (
										<li key={l.variant_id} className="flex items-center gap-3 px-3 py-2">
											<div className="min-w-0 flex-1">
												<div className="truncate text-[15px] font-medium">{l.name}</div>
												<div className="text-[13px] text-neutral-500">
													{l.variant ? `${l.variant} · ` : ""}
													{formatChf(l.price)}
												</div>
											</div>
											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => changeQty(l.variant_id, -1)}
													className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 active:bg-neutral-200"
												>
													{l.quantity === 1 ? <Trash2 className="h-4 w-4 text-red-600" /> : <Minus className="h-4 w-4" />}
												</button>
												<span className="w-8 text-center text-[16px] font-semibold tabular-nums">{l.quantity}</span>
												<button
													type="button"
													onClick={() => changeQty(l.variant_id, 1)}
													className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 active:bg-neutral-200"
												>
													<Plus className="h-4 w-4" />
												</button>
											</div>
											<div className="w-20 text-right text-[15px] font-semibold tabular-nums">
												{formatChf(l.price * l.quantity)}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>

						<div className="shrink-0 space-y-3 border-t border-baume-border p-3">
							<div className="flex items-end justify-between">
								<div>
									<div className="text-[13px] text-neutral-500">
										{itemsCount} article{itemsCount > 1 ? "s" : ""}
									</div>
									{cart.length > 0 && (
										<button type="button" onClick={resetSale} className="text-[13px] text-red-600 underline-offset-2 hover:underline">
											Vider la vente
										</button>
									)}
								</div>
								<div className="text-[30px] font-semibold tabular-nums">{formatChf(total)}</div>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									disabled={cart.length === 0}
									onClick={openCash}
									className="flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 border-baume-burgundy text-[16px] font-semibold text-baume-burgundy disabled:opacity-30"
								>
									<Banknote className="mb-0.5 h-6 w-6" /> Espèces
								</button>
								<button
									type="button"
									disabled={cart.length === 0}
									onClick={openQr}
									className="flex min-h-[64px] flex-col items-center justify-center rounded-xl bg-baume-burgundy text-[16px] font-semibold text-white disabled:opacity-30"
								>
									<QrCode className="mb-0.5 h-6 w-6" /> Carte / TWINT
								</button>
							</div>
						</div>
					</aside>
				</div>
			)}

			{/* Choix de variante */}
			<Dialog open={!!variantProduct} onOpenChange={(v) => !v && setVariantProduct(null)}>
				<DialogContent className="max-w-md bg-white">
					<DialogHeader>
						<DialogTitle className="text-baume-charcoal">{variantProduct?.name}</DialogTitle>
						<DialogDescription>Choisissez la variante.</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						{variantProduct &&
							sellableVariants(variantProduct).map((v) => {
								const out = !v.available || v.stock <= 0;
								return (
									<button
										key={v.id}
										type="button"
										disabled={out}
										onClick={() => {
											addVariant(variantProduct, v);
											setVariantProduct(null);
										}}
										className="flex min-h-[56px] w-full items-center justify-between rounded-xl border border-baume-border px-4 text-left disabled:opacity-40"
									>
										<span className="text-[15px] font-medium">{variantLabel(v) || v.sku || "Standard"}</span>
										<span className="text-right">
											<span className="block text-[15px] font-semibold tabular-nums">
												{formatChf(variantPrice(variantProduct, v))}
											</span>
											<span className="block text-[12px] text-neutral-500">{out ? "Rupture" : `Stock ${v.stock}`}</span>
										</span>
									</button>
								);
							})}
					</div>
				</DialogContent>
			</Dialog>

			{/* Scan caméra */}
			<Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
				<DialogContent className="max-w-lg bg-white">
					<DialogHeader>
						<DialogTitle className="text-baume-charcoal">Scanner un code-barres</DialogTitle>
						<DialogDescription>Article ou carte fidélité.</DialogDescription>
					</DialogHeader>
					{cameraOpen && (
						<BarcodeScanner
							active={cameraOpen}
							onScan={(code) => {
								setCameraOpen(false);
								handleCode(code);
							}}
						/>
					)}
				</DialogContent>
			</Dialog>

			<CustomerDialog open={customerOpen} onClose={() => setCustomerOpen(false)} onSelect={selectCustomer} />

			<CashDialog
				open={cashOpen}
				total={total}
				submitting={cashSubmitting}
				error={cashError}
				onClose={() => setCashOpen(false)}
				onConfirm={confirmCash}
			/>

			{qrOpen && qrPayload && (
				<QrPaymentDialog
					open={qrOpen}
					payload={qrPayload}
					customerName={customerName}
					onClose={() => setQrOpen(false)}
					onPaid={onQrPaid}
				/>
			)}

			{/* Vente terminée */}
			<Dialog open={!!doneSale} onOpenChange={(v) => !v && setDoneSale(null)}>
				<DialogContent className="max-w-md bg-white text-center">
					<CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
					<DialogHeader>
						<DialogTitle className="text-center text-[22px] text-baume-charcoal">Vente encaissée</DialogTitle>
						<DialogDescription className="text-center">
							{doneSale?.order?.order_number ? `Commande n° ${doneSale.order.order_number} · ` : ""}
							{formatChf(doneSale?.order?.total ?? doneSale?.payment?.amount)}
						</DialogDescription>
					</DialogHeader>
					{doneSale?.payment?.method === "cash" && (
						<div className="rounded-xl bg-emerald-50 p-4">
							<div className="text-[14px] text-emerald-800">À rendre au client</div>
							<div className="text-[36px] font-semibold tabular-nums text-emerald-800">
								{formatChf(doneSale.payment.change_due)}
							</div>
						</div>
					)}
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={() => window.print()}
							className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-baume-border text-[16px] font-medium"
						>
							<Printer className="h-5 w-5" /> Ticket
						</button>
						<button
							type="button"
							onClick={() => {
								setDoneSale(null);
								searchRef.current?.focus();
							}}
							className="min-h-[56px] rounded-xl bg-baume-burgundy text-[16px] font-semibold text-white"
						>
							Nouvelle vente
						</button>
					</div>
				</DialogContent>
			</Dialog>

			<Receipt receipt={receipt} />
		</div>
	);
}
