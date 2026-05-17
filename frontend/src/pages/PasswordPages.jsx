import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { forgotPassword, resetPassword, formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	const submit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await forgotPassword(email);
			setSent(true);
		} catch (err) {
			toast.error("Erreur", { description: formatApiError(err) });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div data-testid="forgot-page" className="bg-baume-ivory min-h-[70vh]">
			<div className="baume-container py-16 md:py-24 max-w-[480px] mx-auto">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Mot de passe oublié
				</p>
				<h1 className="font-editorial text-[36px] md:text-[44px] leading-[1.1] text-baume-charcoal">
					Réinitialisation
				</h1>
				{sent ? (
					<div className="mt-8 bg-baume-white border border-baume-border rounded-2xl p-6">
						<p className="font-editorial text-[22px] text-baume-charcoal">
							Vérifiez votre boîte mail
						</p>
						<p className="mt-2 text-[14px] text-baume-charcoal/75">
							Si un compte existe pour <strong>{email}</strong>, un email avec
							les instructions vous a été envoyé.
						</p>
						<Link
							to="/connexion"
							className="mt-6 inline-flex h-11 px-6 items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[14px]"
						>
							Retour à la connexion
						</Link>
					</div>
				) : (
					<form
						onSubmit={submit}
						className="mt-10 bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4"
					>
						<p className="text-[14px] text-baume-charcoal/75">
							Entrez votre email, nous vous enverrons un lien pour choisir un
							nouveau mot de passe.
						</p>
						<div>
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								data-testid="forgot-email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="mt-1.5 h-12 rounded-lg border-baume-border"
							/>
						</div>
						<button
							type="submit"
							disabled={loading}
							data-testid="forgot-submit"
							className="w-full h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center justify-center gap-2"
						>
							{loading && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer
							le lien
						</button>
					</form>
				)}
			</div>
		</div>
	);
}

export function ResetPasswordPage() {
	const [params] = useSearchParams();
	const token = params.get("token") || "";
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const submit = async (e) => {
		e.preventDefault();
		if (password.length < 8) {
			toast.error("Mot de passe trop court", {
				description: "8 caractères minimum.",
			});
			return;
		}
		setLoading(true);
		try {
			await resetPassword(token, password);
			toast.success("Mot de passe mis à jour");
			navigate("/connexion");
		} catch (err) {
			toast.error("Impossible", { description: formatApiError(err) });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div data-testid="reset-page" className="bg-baume-ivory min-h-[70vh]">
			<div className="baume-container py-16 md:py-24 max-w-[480px] mx-auto">
				<h1 className="font-editorial text-[36px] md:text-[44px] leading-[1.1] text-baume-charcoal">
					Nouveau mot de passe
				</h1>
				<form
					onSubmit={submit}
					className="mt-10 bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4"
				>
					<div>
						<Label htmlFor="pw">Nouveau mot de passe</Label>
						<Input
							id="pw"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={8}
							className="mt-1.5 h-12 rounded-lg border-baume-border"
						/>
						<p className="mt-1 text-[11px] text-baume-charcoal/60">
							8 caractères minimum.
						</p>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="w-full h-12 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60 inline-flex items-center justify-center gap-2"
					>
						{loading && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
						Enregistrer
					</button>
				</form>
			</div>
		</div>
	);
}
