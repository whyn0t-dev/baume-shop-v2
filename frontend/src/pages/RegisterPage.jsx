import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function RegisterPage() {
	const [form, setForm] = useState({
		first_name: "",
		last_name: "",
		email: "",
		password: "",
	});
	const [loading, setLoading] = useState(false);
	const { register } = useAuth();
	const navigate = useNavigate();

	const [searchParams] = useSearchParams();
	const [referralCode, setReferralCode] = useState(
		searchParams.get("ref") || "",
	);
	const [referralValid, setReferralValid] = useState(null);
	const [referralName, setReferralName] = useState("");

	// Vérifier le code parrainage au chargement si présent dans l'URL
	useEffect(() => {
		const refCode = searchParams.get("ref");
		if (refCode) {
			api
				.get(`/referral/check/${refCode}`)
				.then((r) => {
					setReferralValid(true);
					setReferralName(r.data.referrer_name);
				})
				.catch(() => setReferralValid(false));
		}
	}, [searchParams]);

	const onSubmit = async (e) => {
		e.preventDefault();
		if (form.password.length < 8) {
			toast.error("Mot de passe trop court", {
				description: "8 caractères minimum.",
			});
			return;
		}
		setLoading(true);
		try {
			await register(form);

			// Enregistrer le parrainage si code valide
			if (referralCode && referralValid) {
				try {
					const res = await api.post("/referral/register", {
						referral_code: referralCode,
						email: form.email,
					});
					toast.success("Bienvenue chez Baume !", {
						description: `Code −10% offert par ${referralName} : ${res.data.promo_code}`,
						duration: 10000,
					});
				} catch {
					toast.success("Bienvenue chez Baume !");
				}
			} else {
				toast.success("Bienvenue chez Baume !");
			}

			navigate("/compte");
		} catch (err) {
			toast.error("Inscription impossible", {
				description: formatApiError(err),
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div data-testid="register-page" className="bg-baume-ivory min-h-[70vh]">
			<div className="baume-container py-16 md:py-24 max-w-[480px] mx-auto">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Créer un compte
				</p>
				<h1 className="font-editorial text-[36px] md:text-[44px] leading-[1.1] text-baume-charcoal">
					Rejoindre Baume
				</h1>
				<p className="mt-3 text-[15px] text-baume-charcoal/70">
					Suivez vos commandes, enregistrez vos adresses, recevez nos conseils.
				</p>

				{referralValid === true && (
					<div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
						<p className="text-[13px] text-emerald-700 font-semibold">
							🎁 {referralName} vous offre −10% sur votre première commande !
						</p>
						<p className="text-[12px] text-emerald-600 mt-0.5">
							Créez votre compte pour recevoir votre code de réduction.
						</p>
					</div>
				)}

				<form
					onSubmit={onSubmit}
					className="mt-10 bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4"
				>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="first_name">Prénom</Label>
							<Input
								id="first_name"
								data-testid="register-first-name"
								value={form.first_name}
								onChange={(e) =>
									setForm({ ...form, first_name: e.target.value })
								}
								required
								className="mt-1.5 h-12 rounded-lg border-baume-border"
							/>
						</div>
						<div>
							<Label htmlFor="last_name">Nom</Label>
							<Input
								id="last_name"
								data-testid="register-last-name"
								value={form.last_name}
								onChange={(e) =>
									setForm({ ...form, last_name: e.target.value })
								}
								required
								className="mt-1.5 h-12 rounded-lg border-baume-border"
							/>
						</div>
					</div>
					<div>
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							data-testid="register-email"
							value={form.email}
							onChange={(e) => setForm({ ...form, email: e.target.value })}
							required
							className="mt-1.5 h-12 rounded-lg border-baume-border"
						/>
					</div>
					<div>
						<Label htmlFor="password">Mot de passe</Label>
						<Input
							id="password"
							type="password"
							data-testid="register-password"
							value={form.password}
							onChange={(e) => setForm({ ...form, password: e.target.value })}
							required
							minLength={8}
							className="mt-1.5 h-12 rounded-lg border-baume-border"
						/>
						<p className="mt-1 text-[11px] text-baume-charcoal/60">
							8 caractères minimum.
						</p>
					</div>
					{/* Bloc parrainage */}
					<div>
						<Label htmlFor="referral">Code parrainage (optionnel)</Label>
						<div className="relative mt-1.5">
							<Input
								id="referral"
								value={referralCode}
								onChange={(e) => {
									setReferralCode(e.target.value.toUpperCase());
									setReferralValid(null);
									setReferralName("");
								}}
								onBlur={async () => {
									if (!referralCode.trim()) return;
									try {
										const res = await api.get(
											`/referral/check/${referralCode}`,
										);
										setReferralValid(true);
										setReferralName(res.data.referrer_name);
									} catch {
										setReferralValid(false);
									}
								}}
								placeholder="BAUME-MARIE-A1B2"
								className={`h-12 rounded-lg font-mono ${
									referralValid === true
										? "border-emerald-400 bg-emerald-50"
										: referralValid === false
											? "border-red-400 bg-red-50"
											: "border-baume-border"
								}`}
							/>
						</div>
						{referralValid === true && (
							<p className="mt-1.5 text-[12px] text-emerald-600 font-semibold">
								✓ Code valide — {referralName} vous offre −10% sur votre
								première commande !
							</p>
						)}
						{referralValid === false && referralCode && (
							<p className="mt-1.5 text-[12px] text-red-500">
								Code parrainage invalide
							</p>
						)}
					</div>
					<button
						type="submit"
						disabled={loading}
						data-testid="register-submit"
						className="w-full h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center justify-center gap-2"
					>
						{loading && <Loader2 className="h-4 w-4 animate-spin" />} Créer mon
						compte
					</button>
					<p className="text-[11px] text-baume-charcoal/60">
						En créant un compte vous acceptez nos conditions générales et notre
						politique de confidentialité.
					</p>
				</form>

				<p className="mt-6 text-center text-[14px] text-baume-charcoal/75">
					Déjà un compte ?{" "}
					<Link
						to="/connexion"
						className="baume-link font-semibold"
						data-testid="link-to-login"
					>
						Se connecter
					</Link>
				</p>
			</div>
		</div>
	);
}
