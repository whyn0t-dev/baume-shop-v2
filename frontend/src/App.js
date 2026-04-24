import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import { CartProvider } from "./lib/cart";
import { AuthProvider } from "./lib/auth";

import HomePage from "./pages/HomePage";
import ShopIndexPage from "./pages/ShopIndexPage";
import CategoryPage from "./pages/CategoryPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FaqPage from "./pages/FaqPage";
import StorePage from "./pages/StorePage";
import AteliersPage from "./pages/AteliersPage";
import { GuidesIndexPage, GuideDetailPage } from "./pages/GuidesPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AccountPage from "./pages/AccountPage";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/PasswordPages";

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AppShell() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop/besoin" element={<ShopIndexPage kind="besoin" />} />
          <Route path="/shop/besoin/:slug" element={<CategoryPage kind="besoin" />} />
          <Route path="/shop/produit" element={<ShopIndexPage kind="produit" />} />
          <Route path="/shop/produit/:slug" element={<CategoryPage kind="produit" />} />
          <Route path="/produit/:slug" element={<ProductPage />} />
          <Route path="/panier" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/commande/confirmation" element={<ConfirmationPage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/boutique-geneve" element={<StorePage />} />
          <Route path="/ateliers" element={<AteliersPage />} />
          <Route path="/guides" element={<GuidesIndexPage />} />
          <Route path="/guides/:slug" element={<GuideDetailPage />} />
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/inscription" element={<RegisterPage />} />
          <Route path="/compte" element={<AccountPage />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <Footer />
      <CartDrawer />
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: "#FFFFFF",
            border: "1px solid #E7DDD3",
            color: "#111111",
            fontFamily: "Inter, sans-serif",
          },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
