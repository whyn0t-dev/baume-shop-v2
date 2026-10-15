import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
	ArrowRight,
	Bell,
	Check,
	ChevronDown,
	ChevronRight,
	CircleHelp,
	ClipboardCopy,
	Gift,
	Heart,
	LayoutDashboard,
	Loader2,
	LogOut,
	Mail,
	MapPin,
	Menu,
	Package,
	PackageCheck,
	Pencil,
	RefreshCw,
	ShieldCheck,
	ShoppingBag,
	Sparkles,
	Star,
	Ticket,
	Truck,
	UserRound,
	Users,
	Wallet,
	X,
	Eye,
	EyeOff,
	KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import {
	api,
	formatApiError,
	getMyOrders,
	updateAccountEmail,
	updateAccountPassword,
} from "../lib/api";
import Breadcrumb from "../components/Breadcrumb";

/* Remplace intégralement ton ancien AccountPage.jsx par ce fichier.
 * Cette page utilise uniquement les API déjà présentes dans ton projet :
 * /orders/mine (via getMyOrders), /loyalty/me, /loyalty/convert,
 * /referral/me et saveProfile() depuis useAuth.
 * Les paramètres de sécurité non fournis par le backend ne sont pas simulés.
 */

const COUNTRIES = [
	["CH", "Suisse"],
	["FR", "France"],
	["BE", "Belgique"],
	["DE", "Allemagne"],
	["IT", "Italie"],
	["ES", "Espagne"],
	["AT", "Autriche"],
	["NL", "Pays-Bas"],
	["LU", "Luxembourg"],
];
const COUNTRY_NAMES = Object.fromEntries(COUNTRIES);
const PROFILE_EMPTY = {
	first_name: "",
	last_name: "",
	phone: "",
	address: "",
	postal_code: "",
	city: "",
	country: "CH",
};
const NAV = [
	{ id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
	{ id: "orders", label: "Mes commandes", icon: ShoppingBag },
	{ id: "profile", label: "Mes informations", icon: UserRound },
	{ id: "addresses", label: "Adresse de livraison", icon: MapPin },
	{ id: "loyalty", label: "Programme fidélité", icon: Star },
	{ id: "vouchers", label: "Mes bons d'achat", icon: Ticket },
	{ id: "referral", label: "Parrainage", icon: Users },
	{ id: "security", label: "Sécurité", icon: ShieldCheck },
	{ id: "help", label: "Aide & retours", icon: CircleHelp },
];
const CARD =
	"rounded-[24px] border border-baume-border bg-baume-white shadow-[0_8px_36px_rgba(75,42,39,0.035)]";
const OUTLINE =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-baume-burgundy/40 px-5 text-sm font-semibold text-baume-burgundy transition hover:bg-baume-burgundy/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baume-burgundy";
const SOLID =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-baume-burgundy px-6 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baume-burgundy";
const INPUT =
	"mt-2 min-h-12 w-full rounded-2xl border border-baume-border bg-white px-4 text-sm text-baume-charcoal outline-none transition focus:border-baume-burgundy focus:ring-2 focus:ring-baume-burgundy/15";

function money(value, currency = "CHF") {
	const amount = Number(value);
	return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(currency || "CHF").toUpperCase()}`;
}
function dateFR(value) {
	if (!value) return "Date indisponible";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? "Date indisponible"
		: date.toLocaleDateString("fr-CH", {
				day: "numeric",
				month: "long",
				year: "numeric",
			});
}
function orderItems(order) {
	const items = order?.order_items || order?.items;
	return Array.isArray(items) ? items : [];
}
function orderStatus(status) {
	const map = {
		initiated: ["En attente", "bg-amber-50 text-amber-800"],
		pending: ["En attente", "bg-amber-50 text-amber-800"],
		paid: ["Payée", "bg-emerald-50 text-emerald-800"],
		processing: ["En préparation", "bg-sky-50 text-sky-800"],
		shipped: ["Expédiée", "bg-indigo-50 text-indigo-800"],
		delivered: ["Livrée", "bg-emerald-50 text-emerald-800"],
		cancelled: ["Annulée", "bg-stone-100 text-stone-600"],
		refunded: ["Remboursée", "bg-stone-100 text-stone-600"],
		failed: ["Échouée", "bg-red-50 text-red-700"],
	};
	return (
		map[status] || [
			status || "Statut indisponible",
			"bg-stone-100 text-stone-600",
		]
	);
}
function trackingUrl(order) {
	if (!order?.tracking_number || !order?.carrier) return null;
	const code = encodeURIComponent(order.tracking_number);
	const providers = {
		laposte: `https://www.post.ch/fr/suivi?item=${code}`,
		chronopost: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLt=${code}`,
		dhl: `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${code}`,
		ups: `https://www.ups.com/track?tracknum=${code}`,
		fedex: `https://www.fedex.com/fedextrack/?trknbr=${code}`,
	};
	return providers[String(order.carrier).toLowerCase()] || null;
}
function Panel({ title, subtitle, action, children, className = "" }) {
	return (
		<section className={`${CARD} p-5 sm:p-7 ${className}`}>
			{(title || action) && (
				<header className="mb-6 flex flex-wrap items-start justify-between gap-3">
					<div>
						{title && (
							<h2 className="font-editorial text-[25px] leading-tight text-baume-charcoal sm:text-[29px]">
								{title}
							</h2>
						)}
						{subtitle && (
							<p className="mt-1.5 text-sm leading-relaxed text-baume-charcoal/60">
								{subtitle}
							</p>
						)}
					</div>
					{action}
				</header>
			)}
			{children}
		</section>
	);
}
function Empty({ icon: Icon = Package, title, text, action }) {
	return (
		<div className="rounded-[20px] border border-dashed border-baume-border bg-baume-ivory/50 px-6 py-12 text-center">
			<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-baume-burgundy">
				<Icon size={25} />
			</span>
			<h3 className="mt-5 font-editorial text-[24px] text-baume-charcoal">
				{title}
			</h3>
			{text && (
				<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-baume-charcoal/60">
					{text}
				</p>
			)}
			{action && <div className="mt-6">{action}</div>}
		</div>
	);
}
function Field({ label, htmlFor, children, hint }) {
	return (
		<div>
			<label
				htmlFor={htmlFor}
				className="text-[13px] font-semibold text-baume-charcoal"
			>
				{label}
			</label>
			{children}
			{hint && <p className="mt-1.5 text-xs text-baume-charcoal/50">{hint}</p>}
		</div>
	);
}
function Stat({ icon: Icon, eyebrow, value, detail, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`${CARD} group w-full p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-baume-burgundy`}
		>
			<div className="flex items-start justify-between gap-3">
				<span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7EBE7] text-baume-burgundy">
					<Icon size={22} />
				</span>
				<ChevronRight
					size={18}
					className="mt-1 text-baume-charcoal/35 transition group-hover:translate-x-1"
				/>
			</div>
			<p className="mt-5 text-sm text-baume-charcoal/60">{eyebrow}</p>
			<p className="mt-1 font-editorial text-[29px] leading-tight text-baume-charcoal">
				{value}
			</p>
			<p className="mt-2 text-xs text-baume-burgundy">{detail}</p>
		</button>
	);
}
function OrderCard({ order }) {
	const items = orderItems(order);
	const qty = items.reduce(
		(sum, item) => sum + (Number(item.quantity) || 0),
		0,
	);
	const [label, color] = orderStatus(order.status);
	const url = trackingUrl(order);
	return (
		<li
			className="rounded-[20px] border border-baume-border bg-white p-4 sm:p-5"
			data-testid={`order-${order.id}`}
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-baume-ivory text-baume-burgundy">
						<PackageCheck size={22} />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-baume-charcoal">
							Commande #{String(order.id).slice(0, 8).toUpperCase()}
						</p>
						<p className="mt-1 text-xs text-baume-charcoal/50">
							{dateFR(order.created_at)}
						</p>
					</div>
				</div>
				<span
					className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}
				>
					{label}
				</span>
			</div>
			<div className="mt-4 border-t border-baume-border/70 pt-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
				<div className="min-w-0">
					<p className="text-sm text-baume-charcoal/80">
						{qty || items.length} article{(qty || items.length) > 1 ? "s" : ""}
						{items.length
							? ` · ${items
									.slice(0, 2)
									.map((i) => i.product_title || i.name || "Produit")
									.join(", ")}`
							: ""}
					</p>
					<p className="mt-2 font-editorial text-2xl text-baume-charcoal">
						{money(order.total ?? order.amount, order.currency)}
					</p>
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-0">
					<Link
						className="text-sm font-semibold text-baume-burgundy underline underline-offset-4"
						to={`/commande/suivi/${order.id}`}
					>
						Détails et suivi <ArrowRight size={14} className="inline" />
					</Link>
					{url && (
						<a
							className="text-sm font-semibold text-baume-burgundy underline underline-offset-4"
							href={url}
							target="_blank"
							rel="noopener noreferrer"
						>
							Suivre le colis
						</a>
					)}
					{["paid", "processing", "shipped", "delivered"].includes(
						order.status,
					) && (
						<Link
							className="text-sm text-baume-charcoal/70 underline underline-offset-4"
							to={`/retour/${order.id}`}
						>
							Demander un retour
						</Link>
					)}
				</div>
			</div>
		</li>
	);
}

export default function AccountPage() {
	const { user, status, logout, saveProfile } = useAuth();
	const navigate = useNavigate();
	const [tab, setTab] = useState("dashboard");
	const [mobileNav, setMobileNav] = useState(false);
	const [orders, setOrders] = useState([]);
	const [loadingOrders, setLoadingOrders] = useState(true);
	const [ordersError, setOrdersError] = useState(false);
	const [loyalty, setLoyalty] = useState(null);
	const [loyaltyLoading, setLoyaltyLoading] = useState(true);
	const [loyaltyError, setLoyaltyError] = useState(false);
	const [referral, setReferral] = useState(null);
	const [referralLoading, setReferralLoading] = useState(true);
	const [referralError, setReferralError] = useState(false);
	const [profile, setProfile] = useState(PROFILE_EMPTY);
	const [saving, setSaving] = useState(false);
	const [converting, setConverting] = useState(false);
	const [newCode, setNewCode] = useState("");
	const addressInput = useRef(null);
	const [selectedAddress, setSelectedAddress] = useState(false);

	const [securityEmail, setSecurityEmail] = useState(user?.email || "");

	const [emailForm, setEmailForm] = useState({
		email: user?.email || "",
	});

	const [passwordForm, setPasswordForm] = useState({
		current_password: "",
		new_password: "",
		confirm_password: "",
	});

	const [securityBusy, setSecurityBusy] = useState(null);
	const [showPasswords, setShowPasswords] = useState(false);

	const refreshOrders = async () => {
		setLoadingOrders(true);
		setOrdersError(false);
		try {
			const data = await getMyOrders();
			setOrders(Array.isArray(data) ? data : []);
		} catch {
			setOrdersError(true);
		} finally {
			setLoadingOrders(false);
		}
	};
	const refreshLoyalty = async () => {
		setLoyaltyLoading(true);
		setLoyaltyError(false);
		try {
			const res = await api.get("/loyalty/me");
			setLoyalty(res.data);
		} catch {
			setLoyaltyError(true);
		} finally {
			setLoyaltyLoading(false);
		}
	};
	const refreshReferral = async () => {
		setReferralLoading(true);
		setReferralError(false);
		try {
			const res = await api.get("/referral/me");
			setReferral(res.data);
		} catch {
			setReferralError(true);
		} finally {
			setReferralLoading(false);
		}
	};
	useEffect(() => {
		if (status !== "authenticated") return;
		refreshOrders();
		refreshLoyalty();
		refreshReferral();
		// Rafraîchir après une reconnexion ; pas d'appels quand le visiteur est anonyme.
	}, [status]);
	useEffect(() => {
		if (!user) return;
		const u = user.profile || user;
		setProfile({
			first_name: u.first_name || user.first_name || "",
			last_name: u.last_name || user.last_name || "",
			phone: u.phone || user.phone || "",
			address: u.address || user.address || "",
			postal_code: u.postal_code || user.postal_code || "",
			city: u.city || user.city || "",
			country: u.country || user.country || "CH",
		});
	}, [user]);

	useEffect(() => {
		if (!user?.email) return;

		setSecurityEmail(user.email);

		setEmailForm({
			email: user.email,
		});
	}, [user?.email]);

	// Google Places n'est chargé que quand la section d'address est ouverte.
	useEffect(() => {
		if (status !== "authenticated" || !["profile", "addresses"].includes(tab))
			return;
		const key = process.env.REACT_APP_GOOGLE_MAPS_KEY;
		if (!key) return; // la saisie manuelle reste possible
		let live = true;
		let autocomplete;
		let listener;
		let retry;
		const setup = () => {
			if (!live || !addressInput.current || !window.google?.maps?.places)
				return;
			autocomplete = new window.google.maps.places.Autocomplete(
				addressInput.current,
				{
					types: ["address"],
					fields: ["address_components"],
				},
			);
			listener = autocomplete.addListener("place_changed", () => {
				const parts = autocomplete.getPlace()?.address_components || [];
				const get = (kind, short = false) => {
					const found = parts.find((p) => p.types.includes(kind));
					return found ? (short ? found.short_name : found.long_name) : "";
				};
				const country = get("country", true);
				setProfile((p) => ({
					...p,
					address:
						`${get("route")}${get("street_number") ? ` ${get("street_number")}` : ""}`.trim(),
					city:
						get("locality") ||
						get("postal_town") ||
						get("administrative_area_level_2"),
					postal_code: get("postal_code"),
					country: COUNTRY_NAMES[country] ? country : p.country,
				}));
				setSelectedAddress(true);
			});
		};
		if (window.google?.maps?.places) setup();
		else {
			if (!document.getElementById("baume-google-places")) {
				const script = document.createElement("script");
				script.id = "baume-google-places";
				script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=fr&loading=async`;
				script.async = true;
				script.defer = true;
				document.head.appendChild(script);
			}
			retry = window.setInterval(() => {
				if (window.google?.maps?.places) {
					window.clearInterval(retry);
					setup();
				}
			}, 250);
		}
		return () => {
			live = false;
			if (retry) window.clearInterval(retry);
			if (listener) window.google?.maps?.event?.removeListener(listener);
		};
	}, [status, tab]);

	const ordered = useMemo(
		() =>
			[...orders].sort(
				(a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
			),
		[orders],
	);
	const activeCodes = useMemo(
		() => (loyalty?.generated_codes || []).filter((v) => !v.used),
		[loyalty],
	);
	const address = [
		profile.address,
		[profile.postal_code, profile.city].filter(Boolean).join(" "),
		COUNTRY_NAMES[profile.country] || profile.country,
	].filter(Boolean);
	const name =
		profile.first_name ||
		user?.first_name ||
		user?.email?.split("@")[0] ||
		"vous";
	const admin =
		user?.role === "admin" ||
		user?.is_admin === true ||
		user?.isAdmin === true ||
		user?.profile?.role === "admin" ||
		user?.user_metadata?.role === "admin";
	const selectTab = (id) => {
		setTab(id);
		setMobileNav(false);
		window.scrollTo?.({ top: 0, behavior: "smooth" });
	};
	const save = async (event) => {
		event.preventDefault();
		setSaving(true);
		try {
			await saveProfile(profile);
			toast.success("Vos informations ont été enregistrées.");
		} catch (error) {
			toast.error("Enregistrement impossible", {
				description: formatApiError(error),
			});
		} finally {
			setSaving(false);
		}
	};
	const copy = async (value, label = "Code") => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copié !`);
		} catch {
			toast.error("Copie impossible. Sélectionnez le texte pour le copier.");
		}
	};
	const convert = async (threshold) => {
		if (converting || Number(loyalty?.points || 0) < Number(threshold.points))
			return;
		setConverting(true);
		try {
			const result = await api.post("/loyalty/convert", {
				points: threshold.points,
			});
			setNewCode(result.data?.code || "");
			toast.success("Votre bon d'achat a été créé.");
			await refreshLoyalty();
		} catch (error) {
			toast.error("Conversion impossible", {
				description: formatApiError(error),
			});
		} finally {
			setConverting(false);
		}
	};
	const signOut = async () => {
		try {
			await logout();
			toast.success("Vous êtes déconnecté·e.");
			navigate("/");
		} catch (error) {
			toast.error("Déconnexion impossible", {
				description: formatApiError(error),
			});
		}
	};

	const handleUpdateEmail = async (event) => {
		event.preventDefault();

		const nextEmail = emailForm.email.trim().toLowerCase();

		if (!nextEmail) {
			toast.error("Saisissez une nouvelle adresse e-mail.");
			return;
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
			toast.error("L'adresse e-mail saisie n'est pas valide.");
			return;
		}

		if (
			nextEmail === String(securityEmail || user?.email || "").toLowerCase()
		) {
			toast.error("Cette adresse e-mail est déjà utilisée sur votre compte.");
			return;
		}

		setSecurityBusy("email");

		try {
			const result = await updateAccountEmail(nextEmail);

			const updatedEmail = result.email || nextEmail;

			setSecurityEmail(updatedEmail);

			setEmailForm({
				email: updatedEmail,
			});

			toast.success("Adresse e-mail mise à jour", {
				description:
					"La nouvelle adresse est maintenant active sur votre compte.",
			});
		} catch (error) {
			toast.error("Impossible de modifier l'adresse e-mail", {
				description: error?.message || "Une erreur est survenue.",
			});
		} finally {
			setSecurityBusy(null);
		}
	};

	const handleUpdatePassword = async (event) => {
		event.preventDefault();

		const currentPassword = passwordForm.current_password;

		const newPassword = passwordForm.new_password;

		const confirmPassword = passwordForm.confirm_password;

		if (!currentPassword || !newPassword || !confirmPassword) {
			toast.error("Complétez les trois champs du mot de passe.");
			return;
		}

		if (newPassword.length < 8) {
			toast.error(
				"Le nouveau mot de passe doit contenir au moins 8 caractères.",
			);
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("Les deux nouveaux mots de passe ne correspondent pas.");
			return;
		}

		if (newPassword === currentPassword) {
			toast.error("Le nouveau mot de passe doit être différent de l'actuel.");
			return;
		}

		setSecurityBusy("password");

		try {
			await updateAccountPassword(currentPassword, newPassword);

			setPasswordForm({
				current_password: "",
				new_password: "",
				confirm_password: "",
			});

			setShowPasswords(false);

			toast.success("Votre mot de passe a été modifié.");
		} catch (error) {
			toast.error("Impossible de modifier le mot de passe", {
				description: error?.message || "Vérifiez votre mot de passe actuel.",
			});
		} finally {
			setSecurityBusy(null);
		}
	};

	if (status === "loading")
		return (
			<main className="flex min-h-[50vh] items-center justify-center bg-baume-ivory">
				<Loader2
					className="h-7 w-7 animate-spin text-baume-burgundy"
					aria-label="Chargement"
				/>
			</main>
		);
	if (status !== "authenticated")
		return <Navigate to="/connexion?redirect=/compte" replace />;

	const profileForm = (
		<form onSubmit={save} className="space-y-5">
			<div className="grid gap-5 sm:grid-cols-2">
				<Field label="Prénom" htmlFor="account-first">
					<input
						id="account-first"
						data-testid="profile-first-name"
						className={INPUT}
						autoComplete="given-name"
						value={profile.first_name}
						onChange={(e) =>
							setProfile((p) => ({ ...p, first_name: e.target.value }))
						}
					/>
				</Field>
				<Field label="Nom" htmlFor="account-last">
					<input
						id="account-last"
						data-testid="profile-last-name"
						className={INPUT}
						autoComplete="family-name"
						value={profile.last_name}
						onChange={(e) =>
							setProfile((p) => ({ ...p, last_name: e.target.value }))
						}
					/>
				</Field>
			</div>
			<div className="grid gap-5 sm:grid-cols-2">
				<Field
					label="Adresse e-mail"
					htmlFor="account-email"
					hint="Pour changer votre adresse e-mail, rendez-vous dans l'onglet Sécurité."
				>
					<input
						id="account-email"
						className={`${INPUT} bg-baume-ivory/40`}
						value={user?.email || ""}
						readOnly
					/>
				</Field>
				<Field label="Téléphone" htmlFor="account-phone">
					<input
						id="account-phone"
						className={INPUT}
						type="tel"
						autoComplete="tel"
						value={profile.phone}
						onChange={(e) =>
							setProfile((p) => ({ ...p, phone: e.target.value }))
						}
						placeholder="+41 ..."
					/>
				</Field>
			</div>
			<div className="border-t border-baume-border pt-6">
				<h3 className="flex items-center gap-2 font-editorial text-[23px] text-baume-charcoal">
					<MapPin size={20} className="text-baume-burgundy" /> Adresse par
					défaut
				</h3>
				<p className="mt-1.5 text-sm text-baume-charcoal/60">
					Utilisée pour préremplir vos informations lorsque le site le permet.
				</p>
			</div>
			<Field label="Rue et numéro" htmlFor="account-address">
				<input
					id="account-address"
					ref={addressInput}
					className={INPUT}
					autoComplete="street-address"
					value={profile.address}
					onChange={(e) => {
						setSelectedAddress(false);
						setProfile((p) => ({ ...p, address: e.target.value }));
					}}
					placeholder="Rue et numéro"
				/>
				<p className="mt-1.5 text-xs text-baume-charcoal/50">
					{selectedAddress
						? "Adresse sélectionnée via Google Places. Vous pouvez encore la modifier."
						: "Saisissez votre adresse ou sélectionnez une suggestion Google."}
				</p>
			</Field>
			<div className="grid gap-5 sm:grid-cols-3">
				<Field label="Code postal" htmlFor="account-zip">
					<input
						id="account-zip"
						className={INPUT}
						autoComplete="postal-code"
						value={profile.postal_code}
						onChange={(e) =>
							setProfile((p) => ({ ...p, postal_code: e.target.value }))
						}
					/>
				</Field>
				<div className="sm:col-span-2">
					<Field label="Ville" htmlFor="account-city">
						<input
							id="account-city"
							className={INPUT}
							autoComplete="address-level2"
							value={profile.city}
							onChange={(e) =>
								setProfile((p) => ({ ...p, city: e.target.value }))
							}
						/>
					</Field>
				</div>
			</div>
			<Field label="Pays" htmlFor="account-country">
				<select
					id="account-country"
					className={INPUT}
					autoComplete="country"
					value={profile.country}
					onChange={(e) =>
						setProfile((p) => ({ ...p, country: e.target.value }))
					}
				>
					{COUNTRIES.map(([code, country]) => (
						<option key={code} value={code}>
							{country}
						</option>
					))}
				</select>
			</Field>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-baume-border pt-6">
				<p className="text-xs text-baume-charcoal/50">
					Vos données sont enregistrées dans votre profil Baume.
				</p>
				<button
					type="submit"
					disabled={saving}
					data-testid="profile-save"
					className={SOLID}
				>
					{saving ? (
						<Loader2 size={16} className="animate-spin" />
					) : (
						<Check size={16} />
					)}
					{saving ? "Enregistrement…" : "Enregistrer mes informations"}
				</button>
			</div>
		</form>
	);

	const loyaltyProgress = loyalty?.next_threshold?.points
		? Math.min(
				100,
				(Math.max(0, Number(loyalty.points) || 0) /
					Number(loyalty.next_threshold.points)) *
					100,
			)
		: 0;
	const loyaltyOverview = (
		<div className="rounded-[21px] bg-gradient-to-br from-[#601528] via-[#772239] to-[#9D5162] p-6 text-white sm:p-8">
			<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.19em] text-white/75">
				<Sparkles size={17} /> Votre fidélité Baume
			</p>
			<div className="mt-5 flex flex-wrap items-baseline gap-2">
				<strong className="font-editorial text-[54px] font-normal leading-none sm:text-[66px]">
					{loyaltyLoading
						? "…"
						: loyaltyError
							? "—"
							: Number(loyalty?.points || 0).toLocaleString("fr-CH")}
				</strong>
				<span className="text-lg text-white/80">points disponibles</span>
			</div>
			{loyalty?.next_threshold?.points && (
				<div className="mt-7">
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/85">
						<span>Prochaine récompense</span>
						<span>
							{loyalty.next_threshold.label} · {loyalty.next_threshold.points}{" "}
							pts
						</span>
					</div>
					<div className="h-2.5 overflow-hidden rounded-full bg-white/20">
						<div
							className="h-full rounded-full bg-[#F3D5CB] transition-all"
							style={{ width: `${loyaltyProgress}%` }}
						/>
					</div>
					<p className="mt-2 text-xs text-white/75">
						Encore{" "}
						{Math.max(
							0,
							Number(loyalty.next_threshold.points) -
								Number(loyalty.points || 0),
						)}{" "}
						points pour atteindre ce palier.
					</p>
				</div>
			)}
			<button
				onClick={() => selectTab("loyalty")}
				className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4"
			>
				Découvrir mes récompenses <ArrowRight size={16} />
			</button>
		</div>
	);

	return (
		<main
			data-testid="account-page"
			className="min-h-screen bg-baume-ivory text-baume-charcoal"
		>
			<div className="mx-auto max-w-[1540px] px-4 pt-6 sm:px-7 lg:px-10">
				<Breadcrumb items={[{ label: "Mon compte" }]} />
			</div>
			<div className="mx-auto grid max-w-[1540px] gap-6 px-4 pb-24 pt-6 sm:px-7 lg:grid-cols-[242px_minmax(0,1fr)] lg:gap-8 lg:px-10">
				<aside className="min-w-0">
					<div className={`${CARD} sticky top-6 overflow-hidden`}>
						<div className="border-b border-baume-border px-5 py-6">
							<span className="text-[11px] font-bold uppercase tracking-[0.2em] text-baume-burgundy">
								Espace personnel
							</span>
							<p className="mt-2 font-editorial text-[28px]">Mon compte</p>
						</div>
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold lg:hidden"
							onClick={() => setMobileNav((s) => !s)}
							aria-expanded={mobileNav}
							aria-controls="account-navigation"
						>
							<span className="flex items-center gap-2">
								<Menu size={19} /> {NAV.find((x) => x.id === tab)?.label}
							</span>
							<ChevronDown
								size={18}
								className={mobileNav ? "rotate-180" : ""}
							/>
						</button>
						<nav
							id="account-navigation"
							aria-label="Navigation du compte"
							className={`${mobileNav ? "block" : "hidden"} space-y-1 px-3 py-3 lg:block`}
						>
							{NAV.map(({ id, label, icon: Icon }) => (
								<button
									key={id}
									type="button"
									onClick={() => selectTab(id)}
									aria-current={tab === id ? "page" : undefined}
									data-testid={`tab-${id}`}
									className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-baume-burgundy ${tab === id ? "bg-baume-burgundy/10 font-semibold text-baume-burgundy" : "text-baume-charcoal/80 hover:bg-baume-ivory hover:text-baume-burgundy"}`}
								>
									<Icon size={18} />
									<span className="flex-1">{label}</span>
									{tab === id && (
										<span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy" />
									)}
								</button>
							))}
							{admin && (
								<Link
									to="/admin"
									data-testid="admin-access-button"
									className="mt-3 flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[13px] font-medium text-baume-charcoal/80 hover:bg-baume-ivory"
								>
									<ShieldCheck size={18} /> Administration
								</Link>
							)}
						</nav>
						<div className="border-t border-baume-border px-3 py-3">
							<button
								data-testid="logout-button"
								onClick={signOut}
								className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-[13px] font-semibold text-baume-burgundy hover:bg-baume-burgundy/5"
							>
								<LogOut size={18} /> Se déconnecter
							</button>
						</div>
					</div>
				</aside>
				<div className="min-w-0 space-y-5">
					<header className="relative overflow-hidden rounded-[26px] border border-[#EADFD9] bg-gradient-to-r from-[#FFFDFC] via-[#FBF3EE] to-[#EEDDD3] px-6 py-8 sm:px-9 sm:py-10">
						<div
							className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full border border-white/70"
							aria-hidden="true"
						/>
						<div
							className="pointer-events-none absolute -right-2 top-8 h-52 w-52 rounded-full border border-white/60"
							aria-hidden="true"
						/>
						<div className="relative flex flex-wrap items-end justify-between gap-5">
							<div className="min-w-0">
								<p className="text-xs font-bold uppercase tracking-[0.21em] text-baume-burgundy">
									Votre univers Baume
								</p>
								<h1 className="mt-3 font-editorial text-[37px] leading-[1.06] text-baume-charcoal sm:text-[52px]">
									Bonjour,{" "}
									<span className="italic text-baume-burgundy">{name}</span>
								</h1>
								<p className="mt-3 break-all text-sm text-baume-charcoal/65">
									{user?.email}
								</p>
								<p className="mt-3 max-w-xl text-sm leading-relaxed text-baume-charcoal/65">
									Vos commandes, vos avantages et vos informations, réunis au
									même endroit.
								</p>
							</div>
							<button onClick={() => selectTab("profile")} className={OUTLINE}>
								<Pencil size={16} /> Modifier mon profil
							</button>
						</div>
					</header>

					{tab === "dashboard" && (
						<div className="space-y-5">
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								<Stat
									icon={ShoppingBag}
									eyebrow="Mes commandes"
									value={
										loadingOrders
											? "…"
											: ordersError
												? "—"
												: String(orders.length)
									}
									detail="Voir mon historique"
									onClick={() => selectTab("orders")}
								/>
								<Stat
									icon={Star}
									eyebrow="Points fidélité"
									value={
										loyaltyLoading
											? "…"
											: loyaltyError
												? "—"
												: `${Number(loyalty?.points || 0)} pts`
									}
									detail="Profiter de mes avantages"
									onClick={() => selectTab("loyalty")}
								/>
								<Stat
									icon={Ticket}
									eyebrow="Bons disponibles"
									value={
										loyaltyLoading
											? "…"
											: loyaltyError
												? "—"
												: String(activeCodes.length)
									}
									detail="Consulter mes codes"
									onClick={() => selectTab("vouchers")}
								/>
								<Stat
									icon={MapPin}
									eyebrow="Adresse par défaut"
									value={profile.city || "À compléter"}
									detail="Gérer mon adresse"
									onClick={() => selectTab("addresses")}
								/>
							</div>
							<div className="grid items-start gap-5 xl:grid-cols-[1.35fr_1fr]">
								<Panel
									title="Mes dernières commandes"
									subtitle="Retrouvez vos achats et suivez vos livraisons."
									action={
										<button
											onClick={() => selectTab("orders")}
											className="text-sm font-semibold text-baume-burgundy underline underline-offset-4"
										>
											Toutes mes commandes →
										</button>
									}
								>
									{loadingOrders ? (
										<Loader2 className="mx-auto my-12 animate-spin text-baume-burgundy" />
									) : ordersError ? (
										<Empty
											title="Historique indisponible"
											text="Réessayez dans quelques instants."
											action={
												<button className={OUTLINE} onClick={refreshOrders}>
													<RefreshCw size={15} /> Réessayer
												</button>
											}
										/>
									) : ordered.length ? (
										<ul className="space-y-3">
											{ordered.slice(0, 3).map((o) => (
												<OrderCard order={o} key={o.id} />
											))}
										</ul>
									) : (
										<Empty
											title="Votre histoire commence ici"
											text="Vos premières commandes apparaîtront dans cet espace."
											action={
												<Link to="/shop/produit" className={SOLID}>
													Découvrir la boutique <ArrowRight size={16} />
												</Link>
											}
										/>
									)}
								</Panel>
								<div className="space-y-5">
									{loyaltyOverview}
									<Panel
										title="Mes coordonnées"
										action={
											<button
												onClick={() => selectTab("profile")}
												className="text-sm font-semibold text-baume-burgundy underline underline-offset-4"
											>
												Modifier
											</button>
										}
									>
										<dl className="space-y-4 text-sm">
											<div className="flex justify-between gap-4">
												<dt className="text-baume-charcoal/55">Nom</dt>
												<dd className="text-right font-semibold">
													{[profile.first_name, profile.last_name]
														.filter(Boolean)
														.join(" ") || "À compléter"}
												</dd>
											</div>
											<div className="flex justify-between gap-4">
												<dt className="text-baume-charcoal/55">Téléphone</dt>
												<dd className="text-right">
													{profile.phone || "À compléter"}
												</dd>
											</div>
											<div className="border-t border-baume-border pt-4">
												<dt className="mb-2 flex items-center gap-2 text-baume-charcoal/55">
													<MapPin size={16} /> Livraison
												</dt>
												<dd className="leading-6">
													{profile.address
														? address.map((line) => (
																<span className="block" key={line}>
																	{line}
																</span>
															))
														: "Aucune adresse renseignée"}
												</dd>
											</div>
										</dl>
									</Panel>
								</div>
							</div>
							<div className="grid gap-5 md:grid-cols-2">
								<Panel
									title="Parrainez vos proches"
									subtitle="Partagez votre code personnel et retrouvez vos parrainages."
								>
									<div className="flex items-center justify-between gap-3 rounded-2xl bg-baume-ivory p-4">
										<span className="truncate font-mono text-lg font-semibold tracking-wider text-baume-burgundy">
											{referralLoading
												? "Chargement…"
												: referral?.referral_code || "Indisponible"}
										</span>
										<button
											disabled={!referral?.referral_code}
											onClick={() => copy(referral.referral_code)}
											className={OUTLINE}
										>
											<ClipboardCopy size={15} /> Copier
										</button>
									</div>
									<button
										className="mt-5 text-sm font-semibold text-baume-burgundy underline underline-offset-4"
										onClick={() => selectTab("referral")}
									>
										Voir mon parrainage →
									</button>
								</Panel>
								<Panel
									title="Besoin d'un coup de main ?"
									subtitle="Questions sur une commande, la livraison ou un retour ?"
								>
									<div className="flex flex-wrap gap-3">
										<button
											onClick={() => selectTab("help")}
											className={OUTLINE}
										>
											<CircleHelp size={16} /> Centre d'aide
										</button>
										<Link to="/contact" className={SOLID}>
											<Mail size={16} /> Nous contacter
										</Link>
									</div>
								</Panel>
							</div>
						</div>
					)}

					{tab === "orders" && (
						<Panel
							title="Mes commandes"
							subtitle="Historique, statuts de paiement et suivi de livraison."
							action={
								<button
									onClick={refreshOrders}
									className={OUTLINE}
									disabled={loadingOrders}
								>
									<RefreshCw
										size={16}
										className={loadingOrders ? "animate-spin" : ""}
									/>{" "}
									Actualiser
								</button>
							}
						>
							{loadingOrders ? (
								<Loader2 className="mx-auto my-16 animate-spin text-baume-burgundy" />
							) : ordersError ? (
								<Empty
									title="Impossible de charger vos commandes"
									action={
										<button onClick={refreshOrders} className={SOLID}>
											Réessayer
										</button>
									}
								/>
							) : ordered.length ? (
								<ul className="space-y-3">
									{ordered.map((o) => (
										<OrderCard key={o.id} order={o} />
									))}
								</ul>
							) : (
								<Empty
									title="Aucune commande pour l'instant"
									text="Vous retrouverez ici toutes vos commandes."
									action={
										<Link to="/shop/produit" className={SOLID}>
											Découvrir la boutique
										</Link>
									}
								/>
							)}
						</Panel>
					)}

					{tab === "profile" && (
						<Panel
							title="Mes informations personnelles"
							subtitle="Mettez à jour vos coordonnées et votre adresse principale."
						>
							{profileForm}
						</Panel>
					)}
					{tab === "addresses" && (
						<Panel
							title="Mon adresse de livraison"
							subtitle="Votre adresse par défaut est enregistrée dans votre profil."
						>
							{profileForm}
						</Panel>
					)}

					{tab === "loyalty" && (
						<div className="space-y-5">
							{loyaltyOverview}
							{loyaltyLoading ? (
								<Panel>
									<Loader2 className="mx-auto my-12 animate-spin text-baume-burgundy" />
								</Panel>
							) : loyaltyError ? (
								<Panel>
									<Empty
										title="Fidélité momentanément indisponible"
										action={
											<button onClick={refreshLoyalty} className={SOLID}>
												Réessayer
											</button>
										}
									/>
								</Panel>
							) : (
								<>
									<Panel
										title="Transformer mes points"
										subtitle="Choisissez une récompense disponible selon votre solde."
									>
										<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
											{[...(loyalty?.thresholds || [])]
												.sort((a, b) => Number(a.points) - Number(b.points))
												.map((reward) => {
													const available =
														Number(loyalty.points || 0) >=
														Number(reward.points);
													return (
														<div
															key={reward.points}
															className={`rounded-[20px] border p-5 ${available ? "border-baume-burgundy/30 bg-[#FFF9F7]" : "border-baume-border bg-baume-ivory/40"}`}
														>
															<Gift size={23} className="text-baume-burgundy" />
															<p className="mt-4 font-editorial text-[28px]">
																{reward.label}
															</p>
															<p className="mt-1 text-sm text-baume-charcoal/60">
																{reward.points} points
															</p>
															<button
																onClick={() => convert(reward)}
																disabled={!available || converting}
																className={`${available ? SOLID : OUTLINE} mt-5 w-full disabled:opacity-40`}
															>
																{converting
																	? "Conversion…"
																	: available
																		? "Obtenir ce bon"
																		: "Points insuffisants"}
															</button>
														</div>
													);
												})}
										</div>
										{newCode && (
											<div
												role="status"
												className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
											>
												<p className="text-sm font-semibold text-emerald-900">
													Nouveau bon :{" "}
													<span className="font-mono">{newCode}</span>
												</p>
												<button
													className={OUTLINE}
													onClick={() => copy(newCode)}
												>
													Copier
												</button>
											</div>
										)}
									</Panel>
									<Panel
										title="Historique des points"
										subtitle="Tous vos gains et utilisations."
									>
										{(loyalty?.transactions || []).length ? (
											<div className="divide-y divide-baume-border">
												{loyalty.transactions.map((item) => (
													<div
														key={item.id}
														className="flex items-center justify-between gap-4 py-4"
													>
														<div>
															<p className="text-sm font-semibold">
																{item.reason ||
																	(item.type === "earn"
																		? "Points gagnés"
																		: "Points utilisés")}
															</p>
															<p className="mt-1 text-xs text-baume-charcoal/50">
																{dateFR(item.created_at)}
															</p>
														</div>
														<span
															className={`shrink-0 font-semibold ${item.type === "earn" ? "text-emerald-700" : "text-baume-burgundy"}`}
														>
															{item.type === "earn" ? "+" : ""}
															{item.points} pts
														</span>
													</div>
												))}
											</div>
										) : (
											<Empty
												icon={Star}
												title="Aucun mouvement pour l'instant"
											/>
										)}
									</Panel>
								</>
							)}
						</div>
					)}

					{tab === "vouchers" && (
						<Panel
							title="Mes bons d'achat"
							subtitle="Vos codes créés avec vos points fidélité."
							action={
								<button
									onClick={refreshLoyalty}
									className={OUTLINE}
									disabled={loyaltyLoading}
								>
									<RefreshCw size={15} /> Actualiser
								</button>
							}
						>
							{loyaltyLoading ? (
								<Loader2 className="mx-auto my-12 animate-spin text-baume-burgundy" />
							) : loyaltyError ? (
								<Empty
									title="Bons indisponibles"
									action={
										<button className={SOLID} onClick={refreshLoyalty}>
											Réessayer
										</button>
									}
								/>
							) : (loyalty?.generated_codes || []).length ? (
								<div className="space-y-3">
									{[...loyalty.generated_codes]
										.reverse()
										.map((voucher, index) => (
											<div
												key={voucher.code || index}
												className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-baume-border bg-baume-ivory/45 p-5"
											>
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-3">
														<p className="break-all font-mono text-lg font-bold text-baume-burgundy">
															{voucher.code}
														</p>
														<span
															className={`rounded-full px-3 py-1 text-xs font-semibold ${voucher.used ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-800"}`}
														>
															{voucher.used ? "Utilisé" : "Disponible"}
														</span>
													</div>
													<p className="mt-1 text-sm text-baume-charcoal/65">
														{voucher.reward} CHF · {voucher.points_spent} points
														· {dateFR(voucher.created_at)}
													</p>
												</div>
												{!voucher.used && (
													<button
														onClick={() => copy(voucher.code)}
														className={OUTLINE}
													>
														<ClipboardCopy size={16} /> Copier le code
													</button>
												)}
											</div>
										))}
								</div>
							) : (
								<Empty
									icon={Ticket}
									title="Aucun bon pour l'instant"
									text="Convertissez vos points pour obtenir vos premiers bons d'achat."
									action={
										<button
											onClick={() => selectTab("loyalty")}
											className={SOLID}
										>
											Découvrir la fidélité
										</button>
									}
								/>
							)}
						</Panel>
					)}

					{tab === "referral" && (
						<div className="space-y-5">
							<Panel
								title="Parrainage"
								subtitle="Retrouvez votre code personnel, votre lien de partage et vos parrainages."
							>
								{referralLoading ? (
									<Loader2 className="mx-auto my-12 animate-spin text-baume-burgundy" />
								) : referralError ? (
									<Empty
										title="Parrainage indisponible"
										action={
											<button onClick={refreshReferral} className={SOLID}>
												Réessayer
											</button>
										}
									/>
								) : (
									<>
										<div className="grid gap-4 sm:grid-cols-3">
											<div className="rounded-2xl bg-baume-ivory p-5">
												<p className="text-xs text-baume-charcoal/60">
													Parrainages
												</p>
												<p className="mt-1 font-editorial text-3xl">
													{referral?.total_referrals ?? 0}
												</p>
											</div>
											<div className="rounded-2xl bg-baume-ivory p-5">
												<p className="text-xs text-baume-charcoal/60">
													En attente
												</p>
												<p className="mt-1 font-editorial text-3xl">
													{referral?.pending_referrals ?? 0}
												</p>
											</div>
											<div className="rounded-2xl bg-baume-ivory p-5">
												<p className="text-xs text-baume-charcoal/60">
													Points gagnés
												</p>
												<p className="mt-1 font-editorial text-3xl">
													{referral?.total_points_earned ?? 0}
												</p>
											</div>
										</div>
										<div className="mt-6 space-y-5">
											<div>
												<p className="mb-2 text-sm font-semibold">
													Mon code de parrainage
												</p>
												<div className="flex flex-wrap gap-3">
													<div className="min-w-0 flex-1 break-all rounded-2xl border border-baume-border bg-baume-ivory px-5 py-3 font-mono text-lg font-bold text-baume-burgundy">
														{referral?.referral_code || "Indisponible"}
													</div>
													<button
														disabled={!referral?.referral_code}
														className={OUTLINE}
														onClick={() => copy(referral.referral_code)}
													>
														Copier
													</button>
												</div>
											</div>
											<div>
												<p className="mb-2 text-sm font-semibold">
													Mon lien de partage
												</p>
												<div className="flex flex-wrap gap-3">
													<div className="min-w-0 flex-1 break-all rounded-2xl border border-baume-border bg-baume-ivory px-5 py-3 text-sm text-baume-charcoal/70">
														{referral?.referral_link || "Indisponible"}
													</div>
													<button
														disabled={!referral?.referral_link}
														className={OUTLINE}
														onClick={() => copy(referral.referral_link, "Lien")}
													>
														Copier le lien
													</button>
												</div>
											</div>
											{referral?.referral_link && (
												<div className="flex flex-wrap gap-3">
													<a
														className={SOLID}
														target="_blank"
														rel="noopener noreferrer"
														href={`https://wa.me/?text=${encodeURIComponent(`Découvre Baume Shop avec mon code ${referral.referral_code} : ${referral.referral_link}`)}`}
													>
														Partager sur WhatsApp
													</a>
													<a
														className={OUTLINE}
														href={`mailto:?subject=${encodeURIComponent("Découvre Baume Shop")}&body=${encodeURIComponent(`Voici mon lien de parrainage : ${referral.referral_link}`)}`}
													>
														Partager par e-mail
													</a>
												</div>
											)}
										</div>
									</>
								)}
							</Panel>
							{(referral?.referrals || []).length > 0 && (
								<Panel title="Historique de parrainage">
									<div className="divide-y divide-baume-border">
										{referral.referrals.map((r) => (
											<div
												key={r.id}
												className="flex flex-wrap items-center justify-between gap-3 py-4"
											>
												<div>
													<p className="text-sm font-semibold">
														{r.referee_email || "Parrainage"}
													</p>
													<p className="mt-1 text-xs text-baume-charcoal/50">
														{dateFR(r.created_at)}
													</p>
												</div>
												<span className="rounded-full bg-baume-ivory px-3 py-1 text-xs font-semibold text-baume-burgundy">
													{r.status === "completed"
														? `+${r.reward_points} points`
														: "En attente"}
												</span>
											</div>
										))}
									</div>
								</Panel>
							)}
						</div>
					)}

					{tab === "security" && (
						<div className="space-y-5">
							<Panel
								title="Sécurité de mon compte"
								subtitle="Gérez votre adresse e-mail, votre mot de passe et la sécurité de votre session."
							>
								<div className="grid gap-5 xl:grid-cols-2">
									{/* ───────────────────────────────────── */}
									{/* MODIFICATION DE L'ADRESSE E-MAIL     */}
									{/* ───────────────────────────────────── */}

									<form
										onSubmit={handleUpdateEmail}
										className="rounded-[20px] border border-baume-border bg-baume-ivory/45 p-5 sm:p-6"
									>
										<div className="flex items-start gap-3">
											<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-baume-burgundy">
												<Mail size={20} />
											</span>

											<div className="min-w-0">
												<h3 className="font-editorial text-[23px] text-baume-charcoal">
													Adresse e-mail
												</h3>

												<p className="mt-1 text-sm leading-6 text-baume-charcoal/60">
													Modifiez l'adresse utilisée pour vous connecter à
													votre compte Baume.
												</p>
											</div>
										</div>

										<div className="mt-6 rounded-2xl border border-baume-border bg-white px-4 py-3">
											<p className="text-[11px] font-bold uppercase tracking-[0.15em] text-baume-charcoal/45">
												Adresse actuelle
											</p>

											<p className="mt-1 break-all text-sm font-semibold text-baume-charcoal">
												{securityEmail || user?.email || "Non disponible"}
											</p>
										</div>

										<div className="mt-5">
											<label
												htmlFor="security-email"
												className="text-[13px] font-semibold text-baume-charcoal"
											>
												Nouvelle adresse e-mail
											</label>

											<input
												id="security-email"
												type="email"
												autoComplete="email"
												className={INPUT}
												value={emailForm.email}
												onChange={(event) =>
													setEmailForm({
														email: event.target.value,
													})
												}
												placeholder="nouvelle@email.com"
											/>
										</div>

										<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
											<p className="text-xs leading-5 text-amber-900">
												<strong>Modification immédiate :</strong> la nouvelle
												adresse sera utilisée directement. Aucune confirmation
												par e-mail ne sera demandée.
											</p>
										</div>

										<button
											type="submit"
											disabled={securityBusy !== null}
											className={`${SOLID} mt-5 w-full sm:w-auto`}
										>
											{securityBusy === "email" ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<Check size={16} />
											)}

											{securityBusy === "email"
												? "Mise à jour…"
												: "Mettre à jour l'e-mail"}
										</button>
									</form>

									{/* ───────────────────────────────────── */}
									{/* MODIFICATION DU MOT DE PASSE         */}
									{/* ───────────────────────────────────── */}

									<form
										onSubmit={handleUpdatePassword}
										className="rounded-[20px] border border-baume-border bg-white p-5 sm:p-6"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-start gap-3">
												<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7EBE7] text-baume-burgundy">
													<KeyRound size={20} />
												</span>

												<div>
													<h3 className="font-editorial text-[23px] text-baume-charcoal">
														Mot de passe
													</h3>

													<p className="mt-1 text-sm leading-6 text-baume-charcoal/60">
														Indiquez votre mot de passe actuel avant
														d'enregistrer le nouveau.
													</p>
												</div>
											</div>

											<button
												type="button"
												onClick={() => setShowPasswords((value) => !value)}
												className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-baume-border text-baume-charcoal/60 transition hover:text-baume-burgundy"
												aria-label={
													showPasswords
														? "Masquer les mots de passe"
														: "Afficher les mots de passe"
												}
											>
												{showPasswords ? (
													<EyeOff size={18} />
												) : (
													<Eye size={18} />
												)}
											</button>
										</div>

										<div className="mt-6">
											<label
												htmlFor="current-password"
												className="text-[13px] font-semibold text-baume-charcoal"
											>
												Mot de passe actuel
											</label>

											<input
												id="current-password"
												type={showPasswords ? "text" : "password"}
												autoComplete="current-password"
												className={INPUT}
												value={passwordForm.current_password}
												onChange={(event) =>
													setPasswordForm((state) => ({
														...state,
														current_password: event.target.value,
													}))
												}
											/>
										</div>

										<div className="mt-5 grid gap-5 sm:grid-cols-2">
											<div>
												<label
													htmlFor="new-password"
													className="text-[13px] font-semibold text-baume-charcoal"
												>
													Nouveau mot de passe
												</label>

												<input
													id="new-password"
													type={showPasswords ? "text" : "password"}
													autoComplete="new-password"
													className={INPUT}
													value={passwordForm.new_password}
													onChange={(event) =>
														setPasswordForm((state) => ({
															...state,
															new_password: event.target.value,
														}))
													}
												/>

												<p className="mt-1.5 text-xs text-baume-charcoal/50">
													8 caractères minimum.
												</p>
											</div>

											<div>
												<label
													htmlFor="confirm-password"
													className="text-[13px] font-semibold text-baume-charcoal"
												>
													Confirmer le nouveau mot de passe
												</label>

												<input
													id="confirm-password"
													type={showPasswords ? "text" : "password"}
													autoComplete="new-password"
													className={INPUT}
													value={passwordForm.confirm_password}
													onChange={(event) =>
														setPasswordForm((state) => ({
															...state,
															confirm_password: event.target.value,
														}))
													}
												/>
											</div>
										</div>

										<button
											type="submit"
											disabled={securityBusy !== null}
											className={`${SOLID} mt-6 w-full sm:w-auto`}
										>
											{securityBusy === "password" ? (
												<Loader2 size={16} className="animate-spin" />
											) : (
												<ShieldCheck size={16} />
											)}

											{securityBusy === "password"
												? "Modification…"
												: "Modifier mon mot de passe"}
										</button>
									</form>
								</div>

								{/* SESSION */}

								<div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-baume-border p-5">
									<div>
										<p className="text-sm font-semibold">Session actuelle</p>

										<p className="mt-1 text-sm text-baume-charcoal/60">
											Déconnectez-vous lorsque vous utilisez un appareil
											partagé.
										</p>
									</div>

									<button onClick={signOut} className={OUTLINE}>
										<LogOut size={16} />
										Se déconnecter
									</button>
								</div>

								<div className="mt-4 flex items-start gap-3 rounded-2xl bg-baume-ivory/50 px-4 py-4">
									<ShieldCheck
										size={18}
										className="mt-0.5 shrink-0 text-baume-burgundy"
									/>

									<p className="text-xs leading-5 text-baume-charcoal/60">
										Les modifications sensibles sont traitées côté serveur par
										Supabase. La clé administrateur n'est jamais exposée au
										navigateur.
									</p>
								</div>
							</Panel>
						</div>
					)}

					{tab === "help" && (
						<div className="space-y-5">
							<Panel
								title="Nous sommes là pour vous"
								subtitle="Retours, questions sur une commande et assistance."
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="rounded-[20px] bg-baume-ivory p-6">
										<Truck className="text-baume-burgundy" size={25} />
										<h3 className="mt-4 font-editorial text-2xl">
											Suivre une livraison
										</h3>
										<p className="mt-2 text-sm leading-6 text-baume-charcoal/60">
											Accédez aux informations disponibles pour chacune de vos
											commandes.
										</p>
										<button
											onClick={() => selectTab("orders")}
											className={`${OUTLINE} mt-5`}
										>
											Mes commandes <ArrowRight size={15} />
										</button>
									</div>
									<div className="rounded-[20px] bg-baume-ivory p-6">
										<Heart className="text-baume-burgundy" size={25} />
										<h3 className="mt-4 font-editorial text-2xl">
											Retours & assistance
										</h3>
										<p className="mt-2 text-sm leading-6 text-baume-charcoal/60">
											Une question ou une demande concernant votre achat ?
											Contactez-nous.
										</p>
										<Link to="/contact" className={`${SOLID} mt-5`}>
											Contacter Baume <ArrowRight size={15} />
										</Link>
									</div>
								</div>
							</Panel>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
