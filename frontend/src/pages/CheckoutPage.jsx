import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { createCheckout, getShippingMethods } from "../lib/api";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CheckoutPage() {
	const { items, subtotal } = useCart();
	const { user, isAuth } = useAuth();
	const navigate = useNavigate();
	const location = useLocation(); // ← ajouter
	const discountCode = location.state?.discountCode || null; // ← ajouter
	const discountAmount = Number(location.state?.discountAmount || 0); // ← ajouter
	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);

	const [shippingMethods, setShippingMethods] = useState([]);
	const [shippingLoading, setShippingLoading] = useState(false);

	useEffect(() => {
		setShippingLoading(true);

		getShippingMethods()
			.then((data) => {
				setShippingMethods(data);

				if (data.length > 0 && !data.some((m) => m.country === form.country)) {
					setForm((f) => ({ ...f, country: data[0].country }));
				}
			})
			.catch(() => {
				toast.error("Impossible de charger les méthodes de livraison");
			})
			.finally(() => setShippingLoading(false));
	}, []);

	const [form, setForm] = useState({
		email: "",
		first_name: "",
		last_name: "",
		address: "",
		postal_code: "",
		city: "",
		country: "CH",
		phone: "",
	});

	// Pre-fill from authenticated user profile
	useEffect(() => {
		if (isAuth && user) {
			setForm((f) => ({
				...f,
				email: f.email || user.email || "",
				first_name: f.first_name || user.first_name || "",
				last_name: f.last_name || user.last_name || "",
				phone: f.phone || user.phone || "",
				address: f.address || user.address || "",
				postal_code: f.postal_code || user.postal_code || "",
				city: f.city || user.city || "",
				country: f.country || user.country || "CH",
			}));
		}
	}, [isAuth, user]);

	const shippingMethod =
		shippingMethods.find((m) => m.country === form.country) ||
		shippingMethods[0];

	const shippingThreshold = Number(
		shippingMethod?.free_shipping_threshold || 0,
	);

	const shippingFee = Number(shippingMethod?.price || 0);

	const shipping = subtotal >= shippingThreshold ? 0 : shippingFee;
	const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
	const total = totalAfterDiscount + shipping;

	const countryName = shippingMethod?.name || form.country;

	if (items.length === 0 && !loading) {
		return (
			<div
				data-testid="checkout-empty"
				className="baume-container py-24 text-center"
			>
				<h1 className="font-editorial text-[32px] text-baume-charcoal">
					Votre panier est vide
				</h1>
				<p className="mt-3 text-[15px] text-baume-charcoal/70">
					Ajoutez au moins un produit avant de passer au paiement.
				</p>
				<Link
					to="/shop/produit"
					className="mt-6 inline-flex h-11 px-6 items-center rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px]"
				>
					Découvrir nos produits
				</Link>
			</div>
		);
	}

	const validateStep = () => {
		if (step === 1) {
			if (!form.email || !/.+@.+\..+/.test(form.email)) {
				toast.error("Email invalide");
				return false;
			}
		}
		if (step === 2) {
			if (
				!form.first_name ||
				!form.last_name ||
				!form.address ||
				!form.postal_code ||
				!form.city
			) {
				toast.error("Veuillez compléter tous les champs");
				return false;
			}
		}
		return true;
	};

	const next = () => {
		if (!validateStep()) return;
		if (step < 3) setStep(step + 1);
	};

	const pay = async () => {
		if (!validateStep()) return;
		setLoading(true);
		try {
			const payload = {
				items: items.map((i) => ({
					product_id: i.product_id || i.id,
					name: i.name,
					price: Number(i.price || 0),
					quantity: Number(i.quantity || 1),
					size: i.size,
					color: i.color,
					sku: i.sku,
				})),
				origin_url: window.location.origin,
				email: form.email,
				shipping_country: form.country,
				shipping_total: shipping,
				discount_code: discountCode, // ← ajouter
				discount_amount: discountAmount, // ← ajouter
				shipping_address: {
					name: `${form.first_name} ${form.last_name}`.trim(),
					first_name: form.first_name,
					last_name: form.last_name,
					line1: form.address,
					address: form.address,
					postal_code: form.postal_code,
					city: form.city,
					country: form.country,
					phone: form.phone,
				},
			};
			const res = await createCheckout(payload);
			if (res?.url) {
				window.location.href = res.url;
			} else {
				toast.error("Impossible de créer la session de paiement");
			}
		} catch (e) {
			console.error("Erreur complète:", e); // ← ajouter
			console.error("Message:", e?.message);
			console.error("Response:", e?.response?.data);
			toast.error("Erreur de paiement", {
				description: e?.response?.data?.detail || e.message,
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div data-testid="checkout-page" className="bg-baume-ivory min-h-[80vh]">
			<div className="baume-container py-10 md:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Form */}
				<div className="lg:col-span-7">
					<h1 className="font-editorial text-[32px] md:text-[40px] text-baume-charcoal">
						Paiement
					</h1>
					<p className="mt-2 text-[14px] text-baume-charcoal/70">
						Paiement sécurisé par Stripe. Vos données sont chiffrées.
					</p>

					{/* Steps */}
					<ol className="mt-8 flex items-center gap-2 text-[13px]">
						{[
							{ n: 1, label: "Informations" },
							{ n: 2, label: "Livraison" },
							{ n: 3, label: "Paiement" },
						].map((s, i) => (
							<li key={s.n} className="flex items-center gap-2">
								<span
									className={`h-7 w-7 rounded-full inline-flex items-center justify-center text-[12px] font-semibold ${step >= s.n ? "bg-baume-burgundy text-baume-white" : "bg-baume-white border border-baume-border text-baume-charcoal/60"}`}
								>
									{step > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
								</span>
								<span
									className={`font-medium ${step >= s.n ? "text-baume-charcoal" : "text-baume-charcoal/50"}`}
								>
									{s.label}
								</span>
								{i < 2 && <span className="w-6 h-px bg-baume-border" />}
							</li>
						))}
					</ol>

					<div className="mt-8 bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8">
						{step === 1 && (
							<div className="space-y-4">
								<p className="font-editorial text-[22px] text-baume-charcoal">
									Vos informations
								</p>
								{!isAuth && (
									<div
										className="rounded-xl border border-baume-border bg-baume-ivory p-4 text-[13px] text-baume-charcoal/80 flex flex-wrap items-center gap-2"
										data-testid="checkout-login-banner"
									>
										<span>Déjà cliente ?</span>
										<Link
											to={`/connexion?redirect=/checkout`}
											className="baume-link font-semibold"
										>
											Se connecter
										</Link>
										<span className="text-baume-charcoal/50">
											— vos infos seront pré-remplies.
										</span>
									</div>
								)}
								<div>
									<Label htmlFor="email" className="text-[13px] font-medium">
										Email
									</Label>
									<Input
										id="email"
										type="email"
										data-testid="checkout-email"
										value={form.email}
										onChange={(e) =>
											setForm({ ...form, email: e.target.value })
										}
										placeholder="votre@email.com"
										className="mt-1.5 h-12 rounded-lg border-baume-border bg-baume-white focus-visible:ring-baume-burgundy focus-visible:border-baume-burgundy"
									/>
								</div>
								<p className="text-[12px] text-baume-charcoal/60">
									Nous vous enverrons la confirmation de commande ici.
								</p>
							</div>
						)}

						{step === 2 && (
							<div className="space-y-4">
								<p className="font-editorial text-[22px] text-baume-charcoal">
									Adresse de livraison
								</p>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label htmlFor="fn" className="text-[13px]">
											Prénom
										</Label>
										<Input
											id="fn"
											data-testid="checkout-first-name"
											value={form.first_name}
											onChange={(e) =>
												setForm({ ...form, first_name: e.target.value })
											}
											className="mt-1.5 h-12 rounded-lg border-baume-border"
										/>
									</div>
									<div>
										<Label htmlFor="ln" className="text-[13px]">
											Nom
										</Label>
										<Input
											id="ln"
											data-testid="checkout-last-name"
											value={form.last_name}
											onChange={(e) =>
												setForm({ ...form, last_name: e.target.value })
											}
											className="mt-1.5 h-12 rounded-lg border-baume-border"
										/>
									</div>
								</div>
								<div>
									<Label htmlFor="addr" className="text-[13px]">
										Adresse
									</Label>
									<Input
										id="addr"
										data-testid="checkout-address"
										value={form.address}
										onChange={(e) =>
											setForm({ ...form, address: e.target.value })
										}
										className="mt-1.5 h-12 rounded-lg border-baume-border"
									/>
								</div>
								<div className="grid grid-cols-3 gap-4">
									<div>
										<Label htmlFor="pc" className="text-[13px]">
											Code postal
										</Label>
										<Input
											id="pc"
											data-testid="checkout-postal"
											value={form.postal_code}
											onChange={(e) =>
												setForm({ ...form, postal_code: e.target.value })
											}
											className="mt-1.5 h-12 rounded-lg border-baume-border"
										/>
									</div>
									<div className="col-span-2">
										<Label htmlFor="city" className="text-[13px]">
											Ville
										</Label>
										<Input
											id="city"
											data-testid="checkout-city"
											value={form.city}
											onChange={(e) =>
												setForm({ ...form, city: e.target.value })
											}
											className="mt-1.5 h-12 rounded-lg border-baume-border"
										/>
									</div>
								</div>
								<div>
									<Label htmlFor="country" className="text-[13px]">
										Pays
									</Label>
									<Select
										value={form.country}
										onValueChange={(v) => setForm({ ...form, country: v })}
									>
										<SelectTrigger
											id="country"
											data-testid="checkout-country"
											className="mt-1.5 h-12 rounded-lg border-baume-border bg-baume-white"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{shippingMethods.map((method) => (
												<SelectItem key={method.id} value={method.country}>
													{method.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="mt-1 text-[11px] text-baume-charcoal/60">
										Livraison vers 9 pays européens. Sélectionnez votre pays
										avant de saisir votre adresse.
									</p>
								</div>
								<div>
									<Label htmlFor="phone" className="text-[13px]">
										Téléphone (optionnel)
									</Label>
									<Input
										id="phone"
										value={form.phone}
										onChange={(e) =>
											setForm({ ...form, phone: e.target.value })
										}
										className="mt-1.5 h-12 rounded-lg border-baume-border"
									/>
								</div>
							</div>
						)}

						{step === 3 && (
							<div className="space-y-5">
								<p className="font-editorial text-[22px] text-baume-charcoal">
									Paiement sécurisé
								</p>
								<div className="rounded-xl border border-baume-border bg-baume-ivory p-5">
									<p className="text-[14px] text-baume-charcoal/80">
										Vous serez redirigé·e vers une page Stripe sécurisée pour
										finaliser votre paiement. Cartes, TWINT, Apple Pay et Google
										Pay acceptés (selon votre pays).
									</p>
									<div className="mt-4 flex items-center gap-2 text-[12px] text-baume-charcoal/65">
										<ShieldCheck className="h-4 w-4 text-baume-burgundy" />{" "}
										Paiement chiffré · Aucune donnée bancaire stockée
									</div>
								</div>
								<div className="rounded-xl border border-baume-border p-5">
									<p className="text-[13px] font-semibold text-baume-charcoal mb-2">
										Récapitulatif
									</p>
									<p className="text-[13px] text-baume-charcoal/75">
										{form.email}
									</p>
									<p className="text-[13px] text-baume-charcoal/75">
										{form.first_name} {form.last_name}
									</p>
									<p className="text-[13px] text-baume-charcoal/75">
										{form.address}, {form.postal_code} {form.city},{" "}
										{countryName}
									</p>
								</div>
							</div>
						)}

						<div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 justify-between">
							{step > 1 ? (
								<button
									onClick={() => setStep(step - 1)}
									className="h-12 px-6 rounded-full border border-baume-border text-baume-charcoal font-semibold text-[14px] hover:bg-baume-ivory"
								>
									Retour
								</button>
							) : (
								<span />
							)}
							{step < 3 ? (
								<button
									onClick={next}
									data-testid="checkout-next-button"
									className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:bg-baume-burgundyDark"
								>
									Continuer
								</button>
							) : (
								<button
									onClick={pay}
									disabled={loading || shippingLoading || !shippingMethod}
									data-testid="checkout-pay-button"
									className="h-12 px-8 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[14px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center gap-2"
								>
									{loading && <Loader2 className="h-4 w-4 animate-spin" />}
									Payer {total.toFixed(2)} CHF
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Summary */}
				<aside className="lg:col-span-5">
					<div className="bg-baume-white border border-baume-border rounded-2xl p-6 lg:sticky lg:top-[96px]">
						<p className="font-editorial text-[22px] text-baume-charcoal mb-5">
							Votre commande
						</p>
						<ul className="space-y-4">
							{items.map((it) => (
								<li key={it.key} className="flex gap-3">
									<img
										src={it.image}
										alt={it.name}
										className="h-16 w-14 rounded object-cover bg-baume-ivory"
									/>
									<div className="flex-1 min-w-0">
										<p className="text-[14px] font-medium text-baume-charcoal truncate">
											{it.name}
										</p>
										<p className="text-[12px] text-baume-charcoal/60">
											{[it.size, it.color].filter(Boolean).join(" · ") ||
												"Taille unique"}{" "}
											· Qté {it.quantity}
										</p>
									</div>
									<span className="text-[14px] font-medium text-baume-charcoal">
										{(it.price * it.quantity).toFixed(2)}
									</span>
								</li>
							))}
						</ul>
						<div className="my-5 border-t border-baume-border" />
						<div className="space-y-2 text-[14px]">
							<div className="flex justify-between">
								<span className="text-baume-charcoal/70">Sous-total</span>
								<span>{subtotal.toFixed(2)} CHF</span>
							</div>
							{/* ← ajouter */}
							{discountAmount > 0 && (
								<div className="flex justify-between text-emerald-700">
									<span>Réduction ({discountCode})</span>
									<span>−{discountAmount.toFixed(2)} CHF</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-baume-charcoal/70">
									Livraison ({countryName})
								</span>
								<span>
									{shipping === 0 ? "Offerte" : `${shipping.toFixed(2)} CHF`}
								</span>
							</div>
						</div>
						<div className="my-5 border-t border-baume-border" />
						<div className="flex items-center justify-between">
							<span className="text-[15px] font-semibold">Total</span>
							<span
								className="font-editorial text-[24px] text-baume-charcoal"
								data-testid="checkout-total"
							>
								{total.toFixed(2)} CHF
							</span>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
