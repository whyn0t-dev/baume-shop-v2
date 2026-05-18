import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react"; // ← ajouter Eye, EyeOff

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const { login } = useAuth();
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
			await login(email, password, { expiresInHours: keepSession ? 3 : null });
			toast.success("Bon retour chez Baume");
			navigate(redirect);
		} catch (err) {
			toast.error("Connexion impossible", { description: formatApiError(err) });
		} finally {
			setLoading(false);
		}
	};

	const [showPassword, setShowPassword] = useState(false);

	return (
		<div data-testid="login-page" className="bg-baume-ivory min-h-[70vh]">
			<div className="baume-container py-16 md:py-24 max-w-[480px] mx-auto">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Espace client
				</p>
				<h1 className="font-editorial text-[36px] md:text-[44px] leading-[1.1] text-baume-charcoal">
					Se connecter
				</h1>
				<p className="mt-3 text-[15px] text-baume-charcoal/70">
					Retrouvez votre historique de commandes et vos informations.
				</p>

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
								className="absolute right-3 top-1/2 -translate-y-1/2 text-baume-charcoal/40 hover:text-baume-charcoal transition-colors"
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

				<p className="mt-6 text-center text-[14px] text-baume-charcoal/75">
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
