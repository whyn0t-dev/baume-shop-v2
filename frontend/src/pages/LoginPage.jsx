import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const { login, completeMfaLogin } = useAuth();
	// Étape du code à 6 chiffres (double authentification active sur le compte).
	const [mfa, setMfa] = useState(null);
	const [code, setCode] = useState("");
	const navigate = useNavigate();
	const location = useLocation();
	const redirect =
		new URLSearchParams(location.search).get("redirect") || "/compte";

	const [keepSession, setKeepSession] = useState(false);

	const onSubmit = async (e) => {
		e.preventDefault();
		if (!email || !password) return;
		setLoading(true);
		try {
			const result = await login(email, password, {
				rememberMe: keepSession,
			});
			if (result?.mfaRequired) {
				setMfa(result);
				setCode("");
				return;
			}
			toast.success("Bon retour chez Baume");
			navigate(redirect);
		} catch (err) {
			toast.error("Connexion impossible", { description: formatApiError(err) });
		} finally {
			setLoading(false);
		}
	};

	const [showPassword, setShowPassword] = useState(false);

	const onSubmitCode = async (e) => {
		e.preventDefault();
		const digits = code.replace(/\D/g, "");
		if (digits.length !== 6 || !mfa) return;
		setLoading(true);
		try {
			await completeMfaLogin(mfa.ticket, mfa.factorId, digits, {
				rememberMe: keepSession,
			});
			toast.success("Bon retour chez Baume");
			navigate(redirect);
		} catch (err) {
			const status = err?.response?.status;
			toast.error(status === 401 ? "Connexion expirée" : "Code refusé", {
				description: formatApiError(err),
			});
			if (status === 401) {
				setMfa(null);
				setPassword("");
			}
			setCode("");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div data-testid="login-page" className="bg-baume-ivory min-h-[70vh]">
			<div className="baume-container py-16 md:py-24 max-w-[480px] mx-auto">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Espace client
				</p>
				<h1 className="font-editorial text-[36px] md:text-[44px] leading-[1.1] text-baume-charcoal">
					Se connecter
				</h1>
				<p className="mt-3 text-[15px] text-baume-muted">
					Retrouvez votre historique de commandes et vos informations.
				</p>

				{mfa ? (
					<form
						onSubmit={onSubmitCode}
						className="mt-10 bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-5"
					>
						<div className="flex items-start gap-3">
							<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-baume-ivory text-baume-burgundy">
								<ShieldCheck size={20} />
							</span>
							<div>
								<p className="font-editorial text-[22px] text-baume-charcoal">
									Code de sécurité
								</p>
								<p className="mt-1 text-sm leading-6 text-baume-muted">
									Ouvrez votre application d'authentification et saisissez le
									code à 6 chiffres affiché pour Baume.
								</p>
							</div>
						</div>
						<div>
							<Label htmlFor="mfa-code">Code à 6 chiffres</Label>
							<Input
								id="mfa-code"
								data-testid="login-mfa-code"
								inputMode="numeric"
								autoComplete="one-time-code"
								autoFocus
								maxLength={7}
								placeholder="123 456"
								value={code}
								onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
								className="mt-1.5 h-14 rounded-lg border-baume-border text-center text-[22px] tracking-[0.35em] focus-visible:ring-baume-burgundy"
							/>
						</div>
						<button
							type="submit"
							disabled={loading || code.replace(/\D/g, "").length !== 6}
							data-testid="login-mfa-submit"
							className="w-full h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center justify-center gap-2"
						>
							{loading && <Loader2 className="h-4 w-4 animate-spin" />} Valider
						</button>
						<button
							type="button"
							onClick={() => {
								setMfa(null);
								setCode("");
							}}
							className="w-full text-center text-[13px] text-baume-muted hover:text-baume-charcoal"
						>
							Revenir à la connexion
						</button>
						<p className="text-center text-[12px] leading-5 text-baume-muted">
							Téléphone perdu ?{" "}
							<Link to="/contact" className="baume-link">
								Contactez-nous
							</Link>{" "}
							pour réinitialiser la double authentification.
						</p>
					</form>
				) : (
				<form
					onSubmit={onSubmit}
					className="mt-10 bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4"
				>
					<div>
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							data-testid="login-email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="mt-1.5 h-12 rounded-lg border-baume-border focus-visible:ring-baume-burgundy"
						/>
					</div>
					<div>
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Mot de passe</Label>
							<Link
								to="/mot-de-passe-oublie"
								className="text-[12px] baume-link"
							>
								Oublié ?
							</Link>
						</div>
						<div className="relative mt-1.5">
							<Input
								id="password"
								type={showPassword ? "text" : "password"}
								data-testid="login-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								className="h-12 rounded-lg border-baume-border focus-visible:ring-baume-burgundy pr-12"
							/>
							<button
								type="button"
								onClick={() => setShowPassword((v) => !v)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-baume-muted hover:text-baume-charcoal transition-colors"
								tabIndex={-1}
							>
								{showPassword ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</button>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="keep-session"
							checked={keepSession}
							onChange={(e) => setKeepSession(e.target.checked)}
							className="h-4 w-4 text-baume-burgundy focus:ring-baume-burgundy"
						/>
						<Label htmlFor="keep-session">Rester connecté</Label>
					</div>
					<button
						type="submit"
						disabled={loading}
						data-testid="login-submit"
						className="w-full h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center justify-center gap-2"
					>
						{loading && <Loader2 className="h-4 w-4 animate-spin" />} Se
						connecter
					</button>
				</form>
				)}

				<p className="mt-6 text-center text-[14px] text-baume-muted">
					Pas encore de compte ?{" "}
					<Link
						to="/inscription"
						className="baume-link font-semibold"
						data-testid="link-to-register"
					>
						Créer un compte
					</Link>
				</p>
			</div>
		</div>
	);
}
