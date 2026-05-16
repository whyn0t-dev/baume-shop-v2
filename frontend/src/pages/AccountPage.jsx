import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getMyOrders, formatApiError } from "../lib/api";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import {
	LogOut,
	Loader2,
	Package,
	User,
	MapPin,
	ArrowRight,
	ShieldCheck,
} from "lucide-react";
import Breadcrumb from "../components/Breadcrumb";

const COUNTRIES = [
	{ code: "CH", name: "Suisse" },
	{ code: "FR", name: "France" },
	{ code: "BE", name: "Belgique" },
	{ code: "DE", name: "Allemagne" },
	{ code: "IT", name: "Italie" },
	{ code: "ES", name: "Espagne" },
	{ code: "AT", name: "Autriche" },
	{ code: "NL", name: "Pays-Bas" },
	{ code: "LU", name: "Luxembourg" },
];

export default function AccountPage() {
	const { user, status, logout, saveProfile } = useAuth();
	const navigate = useNavigate();
	const [orders, setOrders] = useState([]);
	const [loadingOrders, setLoadingOrders] = useState(true);
	const [profile, setProfile] = useState({
		first_name: "",
		last_name: "",
		phone: "",
		address: "",
		postal_code: "",
		city: "",
		country: "CH",
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
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-24 text-center">
				<Loader2 className="h-6 w-6 text-baume-burgundy animate-spin mx-auto" />
			</div>
		);
	}

	if (status !== "authenticated") {
		return <Navigate to="/connexion?redirect=/compte" replace />;
	}

	const isAdmin =
		user?.role === "admin" ||
		user?.is_admin === true ||
		user?.isAdmin === true ||
		user?.profile?.role === "admin" ||
		user?.user_metadata?.role === "admin";

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
			<div className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8">
				<Breadcrumb items={[{ label: "Mon compte" }]} />
			</div>

			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 md:py-14">
				<div className="rounded-[32px] border border-baume-border bg-baume-white px-6 md:px-10 lg:px-12 py-10 md:py-12">
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
						<div>
							<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold mb-3">
								Espace client
							</p>

							<h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.04] text-baume-charcoal">
								Bonjour,{" "}
								<span className="italic text-baume-burgundy">
									{user.first_name || user.email?.split("@")[0] || "client"}
								</span>
							</h1>

							<p className="mt-4 text-[15px] text-baume-charcoal/65">
								{user.email}
							</p>
						</div>
						<div className="flex gap-3">
							{isAdmin && (
								<Link
									to="/admin"
									data-testid="admin-access-button"
									className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-full bg-baume-charcoal text-baume-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
								>
									<ShieldCheck className="h-4 w-4" />
									Accès administrateur
								</Link>
							)}
							<button
								onClick={handleLogout}
								data-testid="logout-button"
								className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-full border border-baume-border text-baume-charcoal text-[14px] font-semibold hover:border-baume-burgundy hover:text-baume-burgundy transition-colors"
							>
								<LogOut className="h-4 w-4" />
								Se déconnecter
							</button>
						</div>
					</div>

					<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
						<MiniStat
							icon={Package}
							title="Commandes"
							value={`${orders.length}`}
						/>
						<MiniStat icon={User} title="Profil" value="Informations client" />
						<MiniStat icon={ShieldCheck} title="Compte" value="Sécurisé" />
					</div>
				</div>
			</section>

			<section className="w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
				<Tabs defaultValue="orders" className="w-full">
					<TabsList className="grid grid-cols-2 bg-baume-white border border-baume-border rounded-full h-12 p-1 mb-8 max-w-[460px]">
						<TabsTrigger
							value="orders"
							data-testid="tab-orders"
							className="rounded-full text-[14px] font-semibold data-[state=active]:bg-baume-burgundy data-[state=active]:text-baume-white"
						>
							<Package className="h-4 w-4 mr-2" />
							Mes commandes
						</TabsTrigger>

						<TabsTrigger
							value="profile"
							data-testid="tab-profile"
							className="rounded-full text-[14px] font-semibold data-[state=active]:bg-baume-burgundy data-[state=active]:text-baume-white"
						>
							<User className="h-4 w-4 mr-2" />
							Mes informations
						</TabsTrigger>
					</TabsList>

					<TabsContent value="orders" className="space-y-4">
						{loadingOrders ? (
							<div className="rounded-3xl border border-baume-border bg-baume-white py-20 text-center">
								<Loader2 className="h-6 w-6 text-baume-burgundy animate-spin mx-auto" />
							</div>
						) : orders.length === 0 ? (
							<div className="rounded-3xl border border-baume-border bg-baume-white p-10 md:p-14 text-center">
								<Package className="h-8 w-8 text-baume-burgundy mx-auto mb-4" />

								<p className="font-editorial text-[30px] text-baume-charcoal">
									Aucune commande pour l’instant
								</p>

								<p className="mt-3 text-[15px] text-baume-charcoal/70 max-w-[460px] mx-auto">
									Votre historique apparaîtra ici dès votre premier achat.
								</p>

								<Link
									to="/shop/produit"
									className="mt-7 inline-flex h-12 px-7 items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
								>
									Découvrir nos produits <ArrowRight className="h-4 w-4" />
								</Link>
							</div>
						) : (
							<ul className="space-y-4">
								{orders.map((o) => (
									<li
										key={o.id}
										data-testid={`order-${o.id}`}
										className="bg-baume-white border border-baume-border rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-sm transition-shadow"
									>
										<div className="h-12 w-12 rounded-full bg-baume-ivory text-baume-burgundy inline-flex items-center justify-center shrink-0">
											<Package className="h-5 w-5" />
										</div>

										<div className="flex-1">
											<div className="flex flex-wrap items-center gap-3">
												<span className="text-[13px] font-semibold text-baume-charcoal">
													Commande #{o.id.slice(0, 8).toUpperCase()}
												</span>

												<span className="text-[11px] uppercase tracking-[0.15em] bg-baume-taupe/25 text-baume-burgundy px-2 py-0.5 rounded-full font-semibold border border-baume-border">
													{o.status === "paid" ? "Payée" : o.status}
												</span>
											</div>

											<p className="mt-1 text-[12px] text-baume-charcoal/60">
												{new Date(o.created_at).toLocaleDateString("fr-CH", {
													day: "numeric",
													month: "long",
													year: "numeric",
												})}
											</p>

											<p className="mt-2 text-[13px] text-baume-charcoal/80">
												{o.order_items?.length || 0} article
												{(o.order_items || [])
													.map((i) => i.name)
													.slice(0, 2)
													.join(", ")}
												{(o.items || [])
													.map((i) => i.name)
													.slice(0, 2)
													.join(", ")}
												{(o.order_items?.length || 0) > 1 ? "s" : ""}
											</p>
										</div>

										<div className="md:text-right">
											<p className="font-editorial text-[24px] text-baume-charcoal">
												{(o.amount || o.total || 0).toFixed(2)}{" "}
												{(o.currency || "CHF").toUpperCase()}
											</p>
										</div>
									</li>
								))}
							</ul>
						)}
					</TabsContent>

					<TabsContent value="profile">
						<form
							onSubmit={handleSave}
							className="bg-baume-white border border-baume-border rounded-3xl p-6 md:p-8 space-y-5 max-w-[760px]"
						>
							<div>
								<div className="flex items-center gap-2 text-baume-burgundy">
									<User className="h-4 w-4" />
									<p className="text-[12px] uppercase tracking-[0.18em] font-semibold">
										Coordonnées
									</p>
								</div>

								<p className="mt-2 text-[14px] text-baume-charcoal/65">
									Ces informations permettent de préparer vos commandes et vos
									rendez-vous plus rapidement.
								</p>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Field label="Prénom" htmlFor="fn">
									<Input
										id="fn"
										data-testid="profile-first-name"
										value={profile.first_name}
										onChange={(e) =>
											setProfile({ ...profile, first_name: e.target.value })
										}
										className="mt-1.5 h-12 rounded-xl border-baume-border"
									/>
								</Field>

								<Field label="Nom" htmlFor="ln">
									<Input
										id="ln"
										data-testid="profile-last-name"
										value={profile.last_name}
										onChange={(e) =>
											setProfile({ ...profile, last_name: e.target.value })
										}
										className="mt-1.5 h-12 rounded-xl border-baume-border"
									/>
								</Field>
							</div>

							<Field label="Téléphone" htmlFor="ph">
								<Input
									id="ph"
									value={profile.phone}
									onChange={(e) =>
										setProfile({ ...profile, phone: e.target.value })
									}
									className="mt-1.5 h-12 rounded-xl border-baume-border"
								/>
							</Field>

							<div className="flex items-center gap-2 text-baume-burgundy pt-5 border-t border-baume-border">
								<MapPin className="h-4 w-4" />
								<p className="text-[12px] uppercase tracking-[0.18em] font-semibold">
									Adresse par défaut
								</p>
							</div>

							<Field label="Adresse" htmlFor="addr">
								<Input
									id="addr"
									value={profile.address}
									onChange={(e) =>
										setProfile({ ...profile, address: e.target.value })
									}
									className="mt-1.5 h-12 rounded-xl border-baume-border"
								/>
							</Field>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<Field label="Code postal" htmlFor="pc">
									<Input
										id="pc"
										value={profile.postal_code}
										onChange={(e) =>
											setProfile({ ...profile, postal_code: e.target.value })
										}
										className="mt-1.5 h-12 rounded-xl border-baume-border"
									/>
								</Field>

								<div className="md:col-span-2">
									<Field label="Ville" htmlFor="city">
										<Input
											id="city"
											value={profile.city}
											onChange={(e) =>
												setProfile({ ...profile, city: e.target.value })
											}
											className="mt-1.5 h-12 rounded-xl border-baume-border"
										/>
									</Field>
								</div>
							</div>

							<Field label="Pays" htmlFor="country">
								<Select
									value={profile.country}
									onValueChange={(v) => setProfile({ ...profile, country: v })}
								>
									<SelectTrigger
										id="country"
										className="mt-1.5 h-12 rounded-xl border-baume-border bg-baume-white"
									>
										<SelectValue />
									</SelectTrigger>

									<SelectContent>
										{COUNTRIES.map((c) => (
											<SelectItem key={c.code} value={c.code}>
												{c.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<button
								type="submit"
								disabled={saving}
								data-testid="profile-save"
								className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center gap-2"
							>
								{saving && <Loader2 className="h-4 w-4 animate-spin" />}
								Enregistrer
							</button>
						</form>
					</TabsContent>
				</Tabs>
			</section>
		</div>
	);
}

function MiniStat({ icon: Icon, title, value }) {
	return (
		<div className="rounded-2xl bg-baume-ivory border border-baume-border p-4 flex items-center gap-3">
			<span className="h-10 w-10 rounded-full bg-baume-white text-baume-burgundy inline-flex items-center justify-center shrink-0">
				<Icon className="h-5 w-5" />
			</span>
			<div>
				<p className="text-[12px] uppercase tracking-[0.16em] text-baume-charcoal/50 font-semibold">
					{title}
				</p>
				<p className="mt-0.5 text-[14px] font-medium text-baume-charcoal">
					{value}
				</p>
			</div>
		</div>
	);
}

function Field({ label, htmlFor, children }) {
	return (
		<div>
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}
