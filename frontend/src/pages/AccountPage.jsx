import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getMyOrders, formatApiError } from "../lib/api";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { LogOut, Loader2, Package, User, MapPin } from "lucide-react";
import Breadcrumb from "../components/Breadcrumb";

const COUNTRIES = [
  { code: "CH", name: "Suisse" }, { code: "FR", name: "France" }, { code: "BE", name: "Belgique" },
  { code: "DE", name: "Allemagne" }, { code: "IT", name: "Italie" }, { code: "ES", name: "Espagne" },
  { code: "AT", name: "Autriche" }, { code: "NL", name: "Pays-Bas" }, { code: "LU", name: "Luxembourg" },
];

export default function AccountPage() {
  const { user, status, logout, saveProfile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [profile, setProfile] = useState({
    first_name: "", last_name: "", phone: "", address: "", postal_code: "", city: "", country: "CH",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        address: user.address || "",
        postal_code: user.postal_code || "",
        city: user.city || "",
        country: user.country || "CH",
      });
    }
  }, [user]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingOrders(true);
    getMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [status]);

  if (status === "loading") {
    return (
      <div className="baume-container py-24 text-center">
        <Loader2 className="h-6 w-6 text-baume-burgundy animate-spin mx-auto" />
      </div>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/connexion?redirect=/compte" replace />;
  }

  const handleLogout = async () => {
    await logout();
    toast.success("Déconnecté·e");
    navigate("/");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile(profile);
      toast.success("Informations mises à jour");
    } catch (err) {
      toast.error("Erreur", { description: formatApiError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="account-page" className="bg-baume-ivory">
      <div className="baume-container pt-8">
        <Breadcrumb items={[{ label: "Mon compte" }]} />
      </div>
      <div className="baume-container py-10 md:py-14 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">Espace client</p>
          <h1 className="font-editorial text-[36px] md:text-[44px] leading-[1.1] text-baume-charcoal">
            Bonjour, <span className="italic text-baume-burgundy">{user.first_name}</span>
          </h1>
          <p className="mt-3 text-[14px] text-baume-charcoal/65">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="h-11 px-5 inline-flex items-center gap-2 rounded-full border border-baume-border text-baume-charcoal text-[14px] font-semibold hover:border-baume-burgundy hover:text-baume-burgundy"
        >
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </div>

      <div className="baume-container pb-24">
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid grid-cols-2 bg-baume-white border border-baume-border rounded-full h-12 p-1 mb-8 max-w-[400px]">
            <TabsTrigger
              value="orders"
              data-testid="tab-orders"
              className="rounded-full text-[14px] font-semibold data-[state=active]:bg-baume-burgundy data-[state=active]:text-baume-white"
            >
              <Package className="h-4 w-4 mr-2" /> Mes commandes
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              data-testid="tab-profile"
              className="rounded-full text-[14px] font-semibold data-[state=active]:bg-baume-burgundy data-[state=active]:text-baume-white"
            >
              <User className="h-4 w-4 mr-2" /> Mes informations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {loadingOrders ? (
              <div className="py-16 text-center">
                <Loader2 className="h-6 w-6 text-baume-burgundy animate-spin mx-auto" />
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-baume-border bg-baume-white p-10 text-center">
                <p className="font-editorial text-[24px] text-baume-charcoal">Aucune commande pour l'instant</p>
                <p className="mt-2 text-[14px] text-baume-charcoal/70">Votre historique apparaîtra ici dès votre premier achat.</p>
                <Link to="/shop/besoin" className="mt-6 inline-flex h-11 px-6 items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]">Découvrir nos produits</Link>
              </div>
            ) : (
              <ul className="space-y-4">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    data-testid={`order-${o.id}`}
                    className="bg-baume-white border border-baume-border rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold text-baume-charcoal">
                          Commande #{o.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.15em] bg-baume-taupe/25 text-baume-burgundy px-2 py-0.5 rounded-full font-semibold border border-baume-border">
                          {o.status === "paid" ? "Payée" : o.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-baume-charcoal/60">
                        {new Date(o.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p className="mt-2 text-[13px] text-baume-charcoal/80">
                        {o.items.length} article{o.items.length > 1 ? "s" : ""} ·{" "}
                        {o.items.map((i) => i.name).slice(0, 2).join(", ")}
                        {o.items.length > 2 ? "…" : ""}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <p className="font-editorial text-[22px] text-baume-charcoal">{o.amount.toFixed(2)} {o.currency.toUpperCase()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="profile">
            <form onSubmit={handleSave} className="bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4 max-w-[640px]">
              <div className="flex items-center gap-2 text-baume-burgundy">
                <User className="h-4 w-4" />
                <p className="text-[12px] uppercase tracking-[0.18em] font-semibold">Coordonnées</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fn">Prénom</Label>
                  <Input id="fn" data-testid="profile-first-name" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} className="mt-1.5 h-12 rounded-lg border-baume-border" />
                </div>
                <div>
                  <Label htmlFor="ln">Nom</Label>
                  <Input id="ln" data-testid="profile-last-name" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} className="mt-1.5 h-12 rounded-lg border-baume-border" />
                </div>
              </div>
              <div>
                <Label htmlFor="ph">Téléphone</Label>
                <Input id="ph" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="mt-1.5 h-12 rounded-lg border-baume-border" />
              </div>
              <div className="flex items-center gap-2 text-baume-burgundy pt-4 border-t border-baume-border">
                <MapPin className="h-4 w-4" />
                <p className="text-[12px] uppercase tracking-[0.18em] font-semibold">Adresse par défaut</p>
              </div>
              <div>
                <Label htmlFor="addr">Adresse</Label>
                <Input id="addr" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="mt-1.5 h-12 rounded-lg border-baume-border" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="pc">Code postal</Label>
                  <Input id="pc" value={profile.postal_code} onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} className="mt-1.5 h-12 rounded-lg border-baume-border" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className="mt-1.5 h-12 rounded-lg border-baume-border" />
                </div>
              </div>
              <div>
                <Label htmlFor="country">Pays</Label>
                <Select value={profile.country} onValueChange={(v) => setProfile({ ...profile, country: v })}>
                  <SelectTrigger id="country" className="mt-1.5 h-12 rounded-lg border-baume-border bg-baume-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="submit"
                disabled={saving}
                data-testid="profile-save"
                className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
              </button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
