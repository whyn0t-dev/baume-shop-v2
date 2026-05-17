import React, { useState } from "react";
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

	return (
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

						<SheetContent side="left" className="w-[340px] bg-baume-white p-0">
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
						className={`h-11 px-4 inline-flex items-center gap-1 text-[17px] font-semibold border-b-2 transition-colors ${
							menuOpen === "boutique"
								? "border-baume-burgundy text-baume-burgundy"
								: "border-transparent text-baume-charcoal hover:text-baume-burgundy"
						}`}
					>
						Boutique <ChevronDown className="h-4 w-4 mt-0.5" />
					</button>

					<HeaderLink to="/ateliers" onMouseEnter={() => setMenuOpen(null)}>
						Ateliers
					</HeaderLink>

					<button
						onMouseEnter={() => setMenuOpen("experts")}
						className={`h-11 px-3 inline-flex items-center gap-1 text-[17px] font-semibold border-b-2 transition-colors ${
							menuOpen === "experts"
								? "border-baume-burgundy text-baume-burgundy"
								: "border-transparent text-baume-charcoal hover:text-baume-burgundy"
						}`}
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
						className="h-11 w-11 rounded-full border border-baume-border inline-flex items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition-colors"
					>
						<Search className="h-5 w-5" />
					</button>

					<Link
						to={isAuth ? "/compte" : "/connexion"}
						aria-label={
							isAuth
								? `Mon compte (${user?.first_name || "client"})`
								: "Se connecter"
						}
						className="hidden sm:inline-flex h-11 w-11 rounded-full border border-baume-border items-center justify-center text-baume-charcoal hover:bg-baume-ivory transition-colors"
					>
						<User className="h-5 w-5" />
					</Link>

					<button
						onClick={() => setOpen(true)}
						aria-label={`Panier (${count})`}
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
				<MegaMenu onClose={() => setMenuOpen(null)} />
			)}

			{menuOpen === "experts" && (
				<ExpertsMegaMenu onClose={() => setMenuOpen(null)} />
			)}
		</header>
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

function MegaMenu({ onClose }) {
	return (
		<div className="hidden lg:block absolute left-0 right-0 top-full px-3 pb-3">
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

function ExpertsMegaMenu({ onClose }) {
	return (
		<div className="hidden lg:block absolute left-0 right-0 top-full px-3 pb-3">
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
	const {user, status: authStatus } = useAuth();

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
