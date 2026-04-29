import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Search,
  User,
  ShoppingBag,
  Menu,
  ChevronDown,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { NAV_MAIN, NEEDS, PRODUCT_CATS } from "../lib/constants";
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
    items: [
      { name: "Culottes menstruelles", slug: "culottes-menstruelles", type: "produit" },
      { name: "Maillots de bains menstruels", slug: "maillots-menstruels", type: "produit" },
      { name: "Cups & Disques", slug: "cups-disques", type: "produit" },
      { name: "Serviettes lavables menstruels", slug: "serviettes-lavables", type: "produit" },
    ],
  },
  {
    title: "Trouble du cycle féminin",
    items: [
      { name: "Règles douloureuses", slug: "regles-douloureuses", type: "besoin" },
      { name: "Endométriose", slug: "endometriose", type: "besoin" },
      { name: "SPM", slug: "spm", type: "besoin" },
      { name: "Péri & Ménopause", slug: "peri-menopause", type: "besoin" },
      { name: "Inconforts intimes", slug: "inconforts-intimes", type: "besoin" },
    ],
  },
  {
    title: "Intimité & Sexualité",
    items: [
      { name: "Intimité", slug: "intimite", type: "besoin" },
      { name: "Sexualité", slug: "sexualite", type: "besoin" },
    ],
  },
  {
    title: "Maternité & Grossesse",
    items: [
      { name: "Soins pour la future maman", slug: "future-maman", type: "besoin" },
      { name: "Confort post-partum", slug: "post-partum", type: "besoin" },
    ],
  },
  {
    title: "Bien-être & Confort",
    items: [
      { name: "Soins corps & visage", slug: "soins-corps-visage", type: "produit" },
      { name: "Aromathérapie", slug: "aromatherapie", type: "produit" },
      { name: "Bien-être gourmand", slug: "bien-etre-gourmand", type: "produit" },
      { name: "Ambiance & Rituels", slug: "ambiance-rituels", type: "produit" },
    ],
  },
  {
    title: "Les pépites de Marie",
    items: [
      { name: "Sous-vêtements non menstruels", slug: "sous-vetements", type: "produit" },
      { name: "Maillots de bain non menstruels", slug: "maillots-non-menstruels", type: "produit" },
      { name: "Prêt à porter", slug: "pret-a-porter", type: "produit" },
      { name: "Accessoires", slug: "accessoires", type: "produit" },
      { name: "Moments brillants", slug: "moments-brillants", type: "produit" },
      { name: "Derniers prix", slug: "derniers-prix", type: "produit" },
    ],
  },
];

const CARD_MENUS = {
  ateliers: [
    {
      title: "Ateliers mensuels",
      path: "/ateliers",
      image:
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Guides & conseils",
      path: "/guides",
      image:
        "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=900&q=80",
    },
  ],
  experts: [
    {
      title: "Coachs",
      path: "/experts/coachs",
      image:
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Thérapeutes",
      path: "/experts/therapeutes",
      image:
        "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80",
    },
  ],
};

export default function Header() {
  const { count, setOpen } = useCart();
  const { isAuth, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-50 w-full border-b border-baume-border bg-baume-white"
      onMouseLeave={() => setMenuOpen(null)}
    >
      <div className="w-full px-8 lg:px-16 h-[120px] flex items-center justify-between gap-8">
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Ouvrir le menu"
                className="h-11 w-11 inline-flex items-center justify-center text-baume-charcoal"
              >
                <Menu className="h-6 w-6" />
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
          <span className="font-editorial text-[58px] leading-none text-baume-charcoal tracking-tight">
            Baume.
          </span>
        </Link>
        <nav className="hidden lg:flex items-center justify-center gap-8 flex-1">
          <button
            onMouseEnter={() => setMenuOpen("boutique")}
            className="inline-flex items-center gap-1 font-editorial text-[22px] text-baume-charcoal hover:underline underline-offset-8"
          >
            Boutique <ChevronDown className="h-4 w-4 mt-1" />
          </button>

          <button
            onMouseEnter={() => setMenuOpen("ateliers")}
            className="inline-flex items-center gap-1 font-editorial text-[22px] text-baume-charcoal hover:underline underline-offset-8"
          >
            Ateliers <ChevronDown className="h-4 w-4 mt-1" />
          </button>

          <button
            onMouseEnter={() => setMenuOpen("experts")}
            className="inline-flex items-center gap-1 font-editorial text-[22px] text-baume-charcoal hover:underline underline-offset-8"
          >
            Experts <ChevronDown className="h-4 w-4 mt-1" />
          </button>

          <NavLink
            to="/guides"
            className="font-editorial text-[22px] text-baume-charcoal hover:underline underline-offset-8"
          >
            Guides
          </NavLink>

          <NavLink
            to="/a-propos"
            className="font-editorial text-[22px] text-baume-charcoal hover:underline underline-offset-8"
          >
            À propos
          </NavLink>
        </nav>
        <div className="flex items-center gap-5 shrink-0">
          <Link
            to="/ateliers"
            className="hidden xl:inline-flex items-center gap-2 rounded-full bg-baume-burgundy px-5 py-3 text-[14px] font-medium text-baume-white shadow-sm hover:scale-[1.03] hover:shadow-md transition-all duration-300"
          >
            <Sparkles className="h-4 w-4" />
            Nos ateliers
          </Link>
          <button aria-label="Rechercher" className="text-baume-charcoal">
            <Search className="h-6 w-6" />
          </button>

          <Link
            to={isAuth ? "/compte" : "/connexion"}
            aria-label={isAuth ? `Mon compte (${user?.first_name || "client"})` : "Se connecter"}
            className="hidden sm:block text-baume-charcoal"
          >
            <User className="h-6 w-6" />
          </Link>

          <button
            onClick={() => setOpen(true)}
            aria-label={`Panier (${count})`}
            className="relative text-baume-charcoal"
          >
            <ShoppingBag className="h-6 w-6" />
            {count > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-baume-burgundy text-baume-white text-[10px] font-semibold inline-flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {menuOpen === "boutique" && (
        <div className="hidden lg:block absolute left-0 right-0 top-full bg-baume-white border-b border-baume-border">
          <div className="w-full px-8 lg:px-16 py-12 grid grid-cols-3 gap-x-20 gap-y-16">
            {MENU_COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="font-editorial text-[24px] leading-[30px] text-baume-charcoal mb-4">
                  {column.title}
                </h3>

                <ul className="space-y-3">
                  {column.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        to={`/shop/${item.type}/${item.slug}`}
                        onClick={() => setMenuOpen(null)}
                        className="font-editorial text-[18px] leading-[24px] text-baume-charcoal/75 hover:text-baume-charcoal hover:underline underline-offset-4"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {(menuOpen === "experts" || menuOpen === "ateliers") && (
        <div className="hidden lg:block absolute left-0 right-0 top-full bg-baume-white border-b border-baume-border animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="w-full px-8 lg:px-16 py-10 grid grid-cols-2 gap-8">
            {CARD_MENUS[menuOpen].map((card) => (
              <Link
                key={card.title}
                to={card.path}
                onClick={() => setMenuOpen(null)}
                className="group overflow-hidden rounded-2xl border border-baume-border bg-baume-white"
              >
                <div className="aspect-[16/10] overflow-hidden bg-baume-ivory">
                  <img
                    src={card.image}
                    alt=""
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <div className="flex items-center justify-between p-5">
                  <h3 className="font-editorial text-[25px] text-baume-charcoal">
                    {card.title}
                  </h3>

                  <span className="h-12 w-12 rounded-full bg-baume-ivory inline-flex items-center justify-center group-hover:bg-baume-burgundy group-hover:text-baume-white transition-colors">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function MobileDrawer({ onNavigate }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-7 border-b border-baume-border">
        <span className="font-editorial text-[42px] text-baume-charcoal">
          Baume.
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <Link to="/shop" onClick={onNavigate} className="block py-4 font-editorial text-[24px] border-b border-baume-border">
          Boutique
        </Link>

        <Link to="/ateliers" onClick={onNavigate} className="block py-4 font-editorial text-[24px] border-b border-baume-border">
          Ateliers
        </Link>

        <Link to="/experts" onClick={onNavigate} className="block py-4 font-editorial text-[24px] border-b border-baume-border">
          Experts
        </Link>

        <Link to="/guides" onClick={onNavigate} className="block py-4 font-editorial text-[24px] border-b border-baume-border">
          Guides
        </Link>

        <Link to="/a-propos" onClick={onNavigate} className="block py-4 font-editorial text-[24px] border-b border-baume-border">
          À propos
        </Link>

        <div className="mt-8">
          <p className="mb-3 text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/45">
            Liens utiles
          </p>

          <Link to="/boutique-geneve" onClick={onNavigate} className="block py-3 text-[16px] text-baume-charcoal/70">
            Boutique Genève
          </Link>

          <Link to="/faq" onClick={onNavigate} className="block py-3 text-[16px] text-baume-charcoal/70">
            FAQ
          </Link>

          <Link to="/contact" onClick={onNavigate} className="block py-3 text-[16px] text-baume-charcoal/70">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}