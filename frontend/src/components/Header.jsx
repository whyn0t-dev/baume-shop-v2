import React, { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { Link, NavLink } from "react-router-dom";
import {
	Search,
	User,
	ShoppingBag,
	Menu,
	ChevronDown,
	ArrowRight,
	ArrowUpRight,
	Sparkles,
	Heart,
	Droplet,
	Leaf,
	Flower2,
	Star,
	Baby,
	Loader2,
	X,
} from "lucide-react";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "./ui/sheet";

const MENU_COLUMNS = [
	{
		title: "Cycle menstruel",
		icon: Droplet,
		items: [
			{
				name: "Culottes menstruelles",
				slug: "culottes-menstruelles",
				type: "produit",
			},
			{
				name: "Maillots de bains menstruels",
				slug: "maillots-menstruels",
				type: "produit",
			},
			{ name: "Cups & Disques", slug: "cups-disques", type: "produit" },
			{
				name: "Serviettes lavables menstruels",
				slug: "serviettes-lavables",
				type: "produit",
			},
		],
	},
	{
		title: "Trouble du cycle féminin",
		icon: Flower2,
		items: [
			{
				name: "Règles douloureuses",
				slug: "regles-douloureuses",
				type: "besoin",
			},
			{ name: "Endométriose", slug: "endometriose", type: "besoin" },
			{ name: "SPM", slug: "spm", type: "besoin" },
			{ name: "Péri & Ménopause", slug: "peri-menopause", type: "besoin" },
			{
				name: "Inconforts intimes",
				slug: "inconforts-intimes",
				type: "besoin",
			},
		],
	},
	{
		title: "Intimité & Sexualité",
		icon: Heart,
		items: [
			{ name: "Intimité", slug: "intimite", type: "besoin" },
			{ name: "Sexualité", slug: "sexualite", type: "besoin" },
		],
	},
	{
		title: "Maternité & Grossesse",
		icon: Baby,
		items: [
			{
				name: "Soins pour la future maman",
				slug: "future-maman",
				type: "besoin",
			},
			{ name: "Confort post-partum", slug: "post-partum", type: "besoin" },
		],
	},
	{
		title: "Bien-être & Confort",
		icon: Leaf,
		items: [
			{
				name: "Soins corps & visage",
				slug: "soins-corps-visage",
				type: "produit",
			},
			{ name: "Aromathérapie", slug: "aromatherapie", type: "produit" },
			{
				name: "Bien-être gourmand",
				slug: "bien-etre-gourmand",
				type: "produit",
			},
			{ name: "Ambiance & Rituels", slug: "ambiance-rituels", type: "produit" },
		],
	},
	{
		title: "Les pépites de Marie",
		icon: Star,
		items: [
			{
				name: "Sous-vêtements non menstruels",
				slug: "sous-vetements",
				type: "produit",
			},
			{
				name: "Maillots de bain non menstruels",
				slug: "maillots-non-menstruels",
				type: "produit",
			},
			{ name: "Prêt à porter", slug: "pret-a-porter", type: "produit" },
			{ name: "Accessoires", slug: "accessoires", type: "produit" },
			{ name: "Moments brillants", slug: "moments-brillants", type: "produit" },
			{ name: "Derniers prix", slug: "derniers-prix", type: "produit" },
		],
	},
];

const EXPERT_SECTIONS = [
	{
		title: "Coachs",
		path: "/experts", // 👉 page Nos Experts
		image: "/images/image-coachs.webp",
	},
	{
		title: "Thérapeutes",
		path: "/experts/therapeutes",
		image: "/images/image-therapeute.webp",
	},
];

export default function Header() {
	const { count, setOpen } = useCart();
	const { isAuth, user } = useAuth();
	const [menuOpen, setMenuOpen] = useState(null);
	const [closeTimer, setCloseTimer] = useState(null);
	const [mobileOpen, setMobileOpen] = useState(false);

	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const searchRef = useRef(null);

	const [suggestions, setSuggestions] = useState([]);

	function openMenu(menu) {
		if (closeTimer) clearTimeout(closeTimer);
		setMenuOpen(menu);
	}

	function closeMenuSoon() {
		const timer = setTimeout(() => {
			setMenuOpen(null);
		}, 120);

		setCloseTimer(timer);
	}

	useEffect(() => {
		api
			.get("/products", { params: { limit: 6 } })
			.then((res) => {
				const products = Array.isArray(res.data) ? res.data : [];
				setSuggestions(products.map((p) => p.name));
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}
		const timer = setTimeout(async () => {
			setSearchLoading(true);
			try {
				const res = await api.get("/products", {
					params: { search: searchQuery, limit: 6 },
				});
				setSearchResults(Array.isArray(res.data) ? res.data : []);
			} catch {
				setSearchResults([]);
			} finally {
				setSearchLoading(false);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	return (
		<>
			<header
				data-testid="site-header"
				className="sticky top-0 z-50 w-full border-b border-baume-border bg-baume-white/95 backdrop-blur"
				onMouseLeave={closeMenuSoon}
				onMouseEnter={() => {
					if (closeTimer) clearTimeout(closeTimer);
				}}
			>
				<div className="w-full px-6 lg:px-10 h-[96px] flex items-center justify-between gap-8">
					<div className="lg:hidden">
						<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
							<SheetTrigger asChild>
								<button
									aria-label="Ouvrir le menu"
									className="h-11 w-11 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal"
								>
									<Menu className="h-5 w-5" />
								</button>
							</SheetTrigger>
							<SheetContent
								side="left"
								className="w-[340px] bg-baume-white p-0"
							>
								<SheetHeader className="sr-only">
									<SheetTitle>Menu</SheetTitle>
									<SheetDescription>Navigation principale</SheetDescription>
								</SheetHeader>
								<MobileDrawer onNavigate={() => setMobileOpen(false)} />
							</SheetContent>
						</Sheet>
					</div>

					<Link to="/" className="shrink-0">
						<span className="text-[42px] md:text-[52px] font-semibold leading-none text-baume-burgundy tracking-tight">
							Baume.
						</span>
					</Link>

					<nav className="hidden lg:flex items-center justify-center gap-4 flex-1">
						<button
							onMouseEnter={() => setMenuOpen("boutique")}
							onMouseLeave={closeMenuSoon} // ← ajouter
							className={`h-11 px-4 inline-flex items-center gap-1 text-[17px] font-semibold border-b-2 transition-colors ${menuOpen === "boutique" ? "border-baume-burgundy text-baume-burgundy" : "border-transparent text-baume-charcoal hover:text-baume-burgundy"}`}
						>
							Boutique <ChevronDown className="h-4 w-4 mt-0.5" />
						</button>
						<HeaderLink
							to="/ateliers"
							onMouseEnter={() => setMenuOpen(null)}
							onMouseLeave={closeMenuSoon}
						>
							Ateliers
						</HeaderLink>
						<button
							onMouseEnter={() => setMenuOpen("experts")}
							onMouseLeave={closeMenuSoon} // ← ajouter
							className={`h-11 px-3 inline-flex items-center gap-1 text-[17px] font-semibold border-b-2 transition-colors ${menuOpen === "experts" ? "border-baume-burgundy text-baume-burgundy" : "border-transparent text-baume-charcoal hover:text-baume-burgundy"}`}
						>
							Nos experts <ChevronDown className="h-4 w-4 mt-0.5" />
						</button>
						<HeaderLink to="/guides" onMouseEnter={() => setMenuOpen(null)}>
							Guides
						</HeaderLink>
						<HeaderLink to="/a-propos" onMouseEnter={() => setMenuOpen(null)}>
							À propos
						</HeaderLink>
					</nav>

					<div className="flex items-center gap-2 shrink-0">
						<button
							aria-label="Rechercher"
							onClick={() => {
								setSearchOpen(true);
								setTimeout(() => searchRef.current?.focus(), 50);
							}}
							className="h-11 w-11 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition-colors"
						>
							<Search className="h-5 w-5" />
						</button>
						<Link
							to={isAuth ? "/compte" : "/connexion"}
							className="hidden sm:inline-flex h-11 w-11 rounded-full border border-baume-border items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition-colors"
						>
							<User className="h-5 w-5" />
						</Link>
						<button
							onClick={() => setOpen(true)}
							className="relative h-11 w-11 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition-colors"
						>
							<ShoppingBag className="h-5 w-5" />
							{count > 0 && (
								<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-baume-burgundy text-baume-white text-[10px] font-semibold inline-flex items-center justify-center px-1">
									{count}
								</span>
							)}
						</button>
						<Link
							to="/ateliers"
							className="hidden xl:inline-flex items-center gap-2 rounded-full bg-baume-burgundy px-5 py-3 text-[14px] font-semibold text-baume-white hover:bg-baume-burgundyDark transition-colors"
						>
							<Sparkles className="h-4 w-4" />
							Nos ateliers
						</Link>
					</div>
				</div>

				{menuOpen === "boutique" && (
					<MegaMenu
						onClose={() => setMenuOpen(null)}
						onMouseEnter={() => {
							if (closeTimer) clearTimeout(closeTimer);
						}}
						onMouseLeave={closeMenuSoon}
					/>
				)}
				{menuOpen === "experts" && (
					<ExpertsMegaMenu
						onClose={() => setMenuOpen(null)}
						onMouseEnter={() => {
							if (closeTimer) clearTimeout(closeTimer);
						}}
						onMouseLeave={closeMenuSoon}
					/>
				)}
			</header>

			{/* ← OVERLAY ICI, en dehors du header */}
			{searchOpen && (
				<div className="fixed inset-0 z-[200] flex flex-col">
					<div
						className="absolute inset-0 bg-black/50"
						onClick={() => {
							setSearchOpen(false);
							setSearchQuery("");
							setSearchResults([]);
						}}
					/>
					<div className="relative z-10 bg-baume-white shadow-2xl">
						<div className="w-full px-6 lg:px-10 py-5 flex items-center gap-4 border-b border-baume-border max-w-5xl mx-auto">
							{searchLoading ? (
								<Loader2 className="h-5 w-5 text-baume-burgundy animate-spin shrink-0" />
							) : (
								<Search className="h-5 w-5 text-baume-charcoal/40 shrink-0" />
							)}
							<input
								ref={searchRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setSearchOpen(false);
										setSearchQuery("");
										setSearchResults([]);
									}
								}}
								placeholder="Rechercher un produit, un besoin…"
								className="flex-1 text-[18px] text-baume-charcoal bg-transparent outline-none placeholder:text-baume-charcoal/30"
								autoComplete="off"
							/>
							{searchQuery && (
								<button
									onClick={() => {
										setSearchQuery("");
										setSearchResults([]);
										searchRef.current?.focus();
									}}
									className="h-8 w-8 rounded-full bg-baume-ivory border border-baume-border flex items-center justify-center hover:bg-baume-border transition shrink-0"
								>
									<X className="h-3.5 w-3.5 text-baume-charcoal/60" />
								</button>
							)}
							<button
								onClick={() => {
									setSearchOpen(false);
									setSearchQuery("");
									setSearchResults([]);
								}}
								className="h-9 px-4 rounded-full border border-baume-border text-[13px] text-baume-charcoal font-semibold hover:bg-baume-ivory transition shrink-0"
							>
								Fermer
							</button>
						</div>

						<div className="w-full max-w-5xl mx-auto px-6 lg:px-10">
							{!searchQuery.trim() ? (
								<div className="py-6">
									<p className="text-[11px] uppercase tracking-[0.2em] text-baume-charcoal/40 font-semibold mb-4">
										Suggestions
									</p>
									<div className="flex flex-wrap gap-2">
										{suggestions.map((s) => (
											<button
												key={s}
												onClick={() => setSearchQuery(s)}
												className="h-9 px-4 rounded-full border border-baume-border bg-baume-ivory text-[13px] text-baume-charcoal font-medium hover:border-baume-burgundy hover:text-baume-burgundy transition-colors"
											>
												{s}
											</button>
										))}
									</div>
								</div>
							) : searchResults.length === 0 && !searchLoading ? (
								<div className="py-10 text-center">
									<p className="text-[15px] text-baume-charcoal/50">
										Aucun résultat pour{" "}
										<span className="font-semibold text-baume-charcoal">
											«&nbsp;{searchQuery}&nbsp;»
										</span>
									</p>
									<p className="mt-2 text-[13px] text-baume-charcoal/35">
										Essayez avec un autre terme
									</p>
								</div>
							) : (
								<ul className="py-3 divide-y divide-baume-border">
									{searchResults.map((p) => (
										<li key={p.id}>
											<Link
												to={`/produit/${p.slug}`}
												onClick={() => {
													setSearchOpen(false);
													setSearchQuery("");
													setSearchResults([]);
												}}
												className="flex items-center gap-4 py-3.5 hover:bg-baume-ivory rounded-xl px-3 -mx-3 transition-colors group"
											>
												<img
													src={p.image}
													alt={p.name}
													className="h-14 w-14 rounded-xl object-cover bg-baume-ivory border border-baume-border shrink-0"
												/>
												<div className="flex-1 min-w-0">
													<p className="text-[14px] font-semibold text-baume-charcoal truncate">
														{p.name}
													</p>
													<p className="text-[12px] text-baume-charcoal/50 truncate mt-0.5">
														{p.tagline}
													</p>
												</div>
												<div className="text-right shrink-0">
													<p className="text-[14px] font-semibold text-baume-charcoal">
														{Number(p.price).toFixed(2)} CHF
													</p>
													<p className="text-[11px] text-baume-burgundy font-semibold mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
														Voir →
													</p>
												</div>
											</Link>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}

function HeaderLink({ to, children, onMouseEnter }) {
	return (
		<NavLink
			to={to}
			onMouseEnter={onMouseEnter}
			className={({ isActive }) =>
				`h-11 px-3 inline-flex items-center text-[17px] font-semibold border-b-2 transition-colors ${
					isActive
						? "border-baume-burgundy text-baume-burgundy"
						: "border-transparent text-baume-charcoal hover:text-baume-burgundy"
				}`
			}
		>
			{children}
		</NavLink>
	);
}

function MegaMenu({ onClose, onMouseEnter, onMouseLeave }) {
	return (
		<div
			className="hidden lg:block absolute left-0 right-0 top-full px-3 pb-3"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="rounded-b-[28px] border border-baume-border bg-baume-white shadow-[0_18px_60px_rgba(61,42,42,0.12)] overflow-hidden">
				<div className="p-8 lg:p-10 min-h-[460px]">
					<div className="grid grid-cols-3 gap-x-10 gap-y-10">
						{MENU_COLUMNS.map((column) => {
							const Icon = column.icon;

							return (
								<div
									key={column.title}
									className="border-r border-baume-border/70 pr-8 last:border-r-0"
								>
									<div className="flex items-center gap-3 mb-5">
										<span className="h-11 w-11 rounded-full bg-baume-taupe/45 text-baume-burgundy inline-flex items-center justify-center">
											<Icon className="h-5 w-5" />
										</span>
										<h3 className="text-[21px] font-semibold leading-tight text-baume-burgundy">
											{column.title}
										</h3>
									</div>

									<ul className="space-y-3">
										{column.items.map((item) => (
											<li key={item.slug}>
												<Link
													to={`/shop/${item.type}/${item.slug}`}
													onClick={onClose}
													className="text-[16px] leading-[22px] text-baume-charcoal/78 hover:text-baume-burgundy hover:underline underline-offset-4 transition-colors"
												>
													{item.name}
												</Link>
											</li>
										))}
									</ul>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

function ExpertsMegaMenu({ onClose, onMouseEnter, onMouseLeave }) {
	return (
		<div
			className="hidden lg:block absolute left-0 right-0 top-full px-3 pb-3"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="rounded-b-[28px] border border-baume-border bg-baume-white shadow-[0_18px_60px_rgba(61,42,42,0.12)] overflow-hidden">
				<div className="p-8 lg:p-10 min-h-[360px]">
					<div className="grid grid-cols-2 gap-8">
						{EXPERT_SECTIONS.map((section) => (
							<Link
								key={section.title}
								to={section.path}
								onClick={onClose}
								className="group overflow-hidden rounded-[22px] border border-baume-border bg-baume-white hover:shadow-[0_18px_45px_rgba(61,42,42,0.12)] transition-all"
							>
								<div className="h-[275px] overflow-hidden bg-baume-ivory">
									<img
										src={section.image}
										alt={section.title}
										className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
									/>
								</div>

								<div className="h-20 px-5 flex items-center justify-between">
									<h3 className="text-[26px] font-semibold text-baume-charcoal">
										{section.title}
									</h3>

									<span className="h-12 w-12 rounded-full bg-baume-ivory text-baume-charcoal inline-flex items-center justify-center group-hover:bg-baume-burgundy group-hover:text-baume-white transition-colors">
										<ArrowUpRight className="h-5 w-5" />
									</span>
								</div>
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function MobileDrawer({ onNavigate }) {
	const { user, status: authStatus } = useAuth();

	return (
		<div className="h-full flex flex-col">
			<div className="px-6 py-6 border-b border-baume-border">
				<Link
					to="/"
					onClick={onNavigate}
					className="text-[38px] font-semibold leading-none text-baume-burgundy"
				>
					Baume.
				</Link>
				<p className="mt-3 text-[14px] text-baume-charcoal/60">
					Choisir simplement, sans pression.
				</p>
			</div>

			<div className="flex-1 overflow-y-auto px-6 py-5">
				<MobileLink to="/shop/besoin" onClick={onNavigate}>
					Je cherche une solution
				</MobileLink>

				<MobileLink to="/shop/produit" onClick={onNavigate}>
					Voir les produits
				</MobileLink>

				<MobileLink to="/guides" onClick={onNavigate}>
					Guides
				</MobileLink>

				<MobileLink to="/ateliers" onClick={onNavigate}>
					Ateliers
				</MobileLink>

				<MobileLink to="/experts" onClick={onNavigate}>
					Nos experts
				</MobileLink>

				<MobileLink to="/boutique-geneve" onClick={onNavigate}>
					Boutique Genève
				</MobileLink>

				<MobileLink to="/a-propos" onClick={onNavigate}>
					À propos
				</MobileLink>

				<MobileLink
					to={
						authStatus === "authenticated"
							? "/compte"
							: authStatus === "loading"
								? "#"
								: "/connexion"
					}
					onClick={onNavigate}
				>
					{authStatus === "authenticated"
						? `Mon compte${user?.first_name ? ` · ${user.first_name}` : ""}`
						: "Se connecter"}
				</MobileLink>

				<div className="mt-8 rounded-3xl bg-baume-ivory/70 border border-baume-border p-5">
					<p className="text-[13px] font-semibold text-baume-burgundy uppercase tracking-[0.16em]">
						Besoin d’aide ?
					</p>
					<p className="mt-2 text-[14px] text-baume-charcoal/65">
						Une question sur un produit ou un besoin intime ?
					</p>
					<Link
						to="/contact"
						onClick={onNavigate}
						className="mt-4 h-11 px-5 rounded-full bg-baume-burgundy text-baume-white text-[14px] font-semibold inline-flex items-center justify-center"
					>
						Nous contacter
					</Link>
				</div>
			</div>
		</div>
	);
}
function MobileLink({ to, onClick, children }) {
	return (
		<Link
			to={to}
			onClick={() => {
				setTimeout(() => onClick?.(), 50); // ← petit délai avant fermeture
			}}
			className="flex items-center justify-between py-4 border-b border-baume-border text-[20px] font-semibold text-baume-charcoal"
		>
			{children}
			<ArrowRight className="h-4 w-4 text-baume-burgundy" />
		</Link>
	);
}
