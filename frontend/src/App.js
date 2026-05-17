import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import { CartProvider } from "./lib/cart";
import { AuthProvider, useAuth } from "./lib/auth";
import posthog from "posthog-js";

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
import { MentionsLegalesPage, CgvPage, PrivacyPage } from "./pages/LegalPages";
import DashBoardAdmin from "./pages/DashBoardAdmin";
import OrderItems from "./pages/OrderItems";
import SiteLoader from "./components/SiteLoader";
import NosExperts from "./pages/NosExperts";
import AdminProductCreate from "./pages/AdminProductCreate";
import AdminProductEdit from "./pages/AdminProductEdit";
import AdminWorkshopForm from "./pages/AdminWorkshopForm";

import QuizPage from "./pages/QuizPage";
import QuizResultsPage from "./pages/QuizResultsPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function isAdminUser(user) {
  return (
    user?.role === "admin" ||
    user?.is_admin === true ||
    user?.isAdmin === true ||
    user?.profile?.role === "admin" ||
    user?.user_metadata?.role === "admin"
  );
}

function AdminRoute({ children }) {
  const { user, status } = useAuth();

  if (status === "loading") return null;

  if (!user || !isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppShell() {
  return (
    <>
      <SiteLoader />
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
          <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
          <Route path="/cgv" element={<CgvPage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />
          <Route path="/experts" element={<NosExperts />} />
          <Route path="/admin/ateliers/nouveau" element={<AdminWorkshopForm />} />
          <Route path="/admin/ateliers/:id/modifier" element={<AdminWorkshopForm />} />
          <Route
            path="/admin/produits/nouveau"
            element={
              <AdminRoute>
                <AdminProductCreate />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/produits/:productId/modifier"
            element={
              <AdminRoute>
                <AdminProductEdit />
              </AdminRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <DashBoardAdmin />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/orders/:orderId"
            element={
              <AdminRoute>
                <OrderItems />
              </AdminRoute>
            }
          />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/quiz/resultats" element={<QuizResultsPage />} />
          <Route path="/commande/suivi/:orderId" element={<OrderTrackingPage />} />
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

posthog.init(process.env.REACT_APP_POSTHOG_KEY, {
  api_host: "https://us.posthog.com",
  capture_pageview: true,
  capture_pageleave: true,
});

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
