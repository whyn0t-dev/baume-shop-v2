import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Search, User, ShoppingBag, Menu, ChevronRight } from "lucide-react";
import { NAV_MAIN, NEEDS, PRODUCT_CATS } from "../lib/constants";
import { useCart } from "../lib/cart";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";

export default function Header() {
  const { count, setOpen } = useCart();
  const [megaOpen, setMegaOpen] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-50 w-full border-b border-baume-border bg-baume-ivory/90 backdrop-blur-xl"
      onMouseLeave={() => setMegaOpen(null)}
    >
      {/* Announcement bar */}
      <div className="hidden md:flex items-center justify-center bg-baume-burgundy text-baume-white text-[12px] leading-[20px] py-2 font-medium tracking-wide">
        Livraison offerte dès 60 CHF · Retrait boutique à Genève · Ateliers mensuels
      </div>

      <div className="baume-container h-[72px] flex items-center justify-between gap-6">
        {/* Mobile menu trigger */}
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                data-testid="mobile-menu-trigger"
                aria-label="Ouvrir le menu"
                className="h-11 w-11 inline-flex items-center justify-center text-baume-charcoal"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-baume-ivory border-r border-baume-border w-[320px] p-0">
              <MobileDrawer onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo */}
        <Link to="/" data-testid="logo-home-link" className="flex items-center gap-2">
          <span className="font-editorial text-[28px] leading-none text-baume-burgundy tracking-tight">
            Baume
          </span>
          <span className="hidden md:inline text-[11px] tracking-[0.2em] uppercase text-baume-charcoal/60">
            Genève
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7 h-full" aria-label="Navigation principale">
          {NAV_MAIN.map((item) => (
            <div
              key={item.name}
              className="h-full flex items-center"
              onMouseEnter={() => item.key && setMegaOpen(item.key)}
            >
              <NavLink
                to={item.path}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "et")}`}
                className={({ isActive }) =>
                  `text-[14px] leading-[22px] font-medium text-baume-charcoal hover:text-baume-burgundy transition-colors ${isActive ? "text-baume-burgundy" : ""}`
                }
              >
                {item.name}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          <button
            data-testid="search-button"
            aria-label="Rechercher"
            className="h-11 w-11 inline-flex items-center justify-center text-baume-charcoal hover:text-baume-burgundy transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            to="/compte"
            data-testid="account-link"
            aria-label="Mon compte"
            className="h-11 w-11 hidden sm:inline-flex items-center justify-center text-baume-charcoal hover:text-baume-burgundy transition-colors"
          >
            <User className="h-5 w-5" />
          </Link>
          <button
            data-testid="cart-button"
            onClick={() => setOpen(true)}
            aria-label={`Panier (${count})`}
            className="relative h-11 w-11 inline-flex items-center justify-center text-baume-charcoal hover:text-baume-burgundy transition-colors"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span
                data-testid="cart-count"
                className="absolute top-1.5 right-1 min-w-[18px] h-[18px] rounded-full bg-baume-burgundy text-baume-white text-[10px] font-semibold inline-flex items-center justify-center px-1"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Desktop mega menu */}
      {megaOpen && (
        <div
          data-testid={`mega-menu-${megaOpen}`}
          className="hidden lg:block absolute left-0 right-0 top-full bg-baume-white border-b border-baume-border shadow-sm"
          onMouseLeave={() => setMegaOpen(null)}
        >
          <div className="baume-container py-10 grid grid-cols-12 gap-8">
            <div className="col-span-3">
              <p className="font-editorial italic text-[20px] text-baume-burgundy">
                {megaOpen === "besoin" ? "Commencez par votre besoin" : "Par typologie de produit"}
              </p>
              <p className="mt-3 text-[14px] text-baume-charcoal/70">
                {megaOpen === "besoin"
                  ? "Entrez par une étape de votre vie, nous vous guidons."
                  : "Trouvez le format qui vous convient."}
              </p>
            </div>
            <ul className="col-span-9 grid grid-cols-3 gap-x-8 gap-y-4">
              {(megaOpen === "besoin" ? NEEDS : PRODUCT_CATS).map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/shop/${megaOpen}/${c.slug}`}
                    onClick={() => setMegaOpen(null)}
                    className="group flex items-center justify-between py-2 text-[16px] leading-[24px] text-baume-charcoal hover:text-baume-burgundy transition-colors"
                  >
                    {c.name}
                    <ChevronRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileDrawer({ onNavigate }) {
  const [section, setSection] = useState(null);
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-baume-border">
        <span className="font-editorial text-[28px] text-baume-burgundy">Baume</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {section === null ? (
          <ul className="space-y-1">
            {NAV_MAIN.map((item) => (
              <li key={item.name}>
                {item.key ? (
                  <button
                    onClick={() => setSection(item.key)}
                    className="w-full flex items-center justify-between py-3 text-[16px] font-medium text-baume-charcoal"
                  >
                    {item.name}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={onNavigate}
                    className="block py-3 text-[16px] font-medium text-baume-charcoal"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <button
              onClick={() => setSection(null)}
              className="text-[14px] text-baume-burgundy mb-4"
            >
              ← Retour
            </button>
            <ul className="space-y-1">
              {(section === "besoin" ? NEEDS : PRODUCT_CATS).map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/shop/${section}/${c.slug}`}
                    onClick={onNavigate}
                    className="block py-3 text-[16px] text-baume-charcoal"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
