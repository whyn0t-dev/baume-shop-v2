import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function EmailConfirmationPage() {
	const navigate = useNavigate();
	const [status, setStatus] = useState("loading");

	useEffect(() => {
		// ← Créer une fonction async à l'intérieur
		async function handleConfirmation() {
			const hash = window.location.hash;
			const hashParams = new URLSearchParams(hash.replace("#", ""));
			const accessToken = hashParams.get("access_token");
			const type = hashParams.get("type");
			const error = hashParams.get("error");
			const errorDescription = hashParams.get("error_description");

			if (error || errorDescription) {
				setStatus("error");
				toast.error("Lien expiré ou invalide", {
					description:
						"Ce lien de confirmation n'est plus valide. Veuillez créer un nouveau compte.",
					duration: 8000,
				});
				setTimeout(() => navigate("/inscription"), 3000);
				return;
			}

			if (accessToken && type === "signup") {
				setStatus("success");
				toast.success("Compte validé !", {
					description:
						"Votre email a bien été confirmé. Vous pouvez maintenant vous connecter.",
					duration: 6000,
				});

				try {
					await fetch(
						`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-welcome-email`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
							},
							body: JSON.stringify({ access_token: accessToken }),
						},
					);
				} catch (e) {
					console.error("Welcome email failed:", e);
				}

				setTimeout(() => navigate("/connexion"), 3000);
				return;
			}

			setTimeout(() => navigate("/connexion"), 1500);
		}

		handleConfirmation(); // ← Appeler la fonction
	}, [navigate]);

	return (
		<div className="bg-baume-ivory min-h-[70vh] flex items-center justify-center">
			<div className="text-center">
				{status === "loading" && (
					<>
						<Loader2 className="h-8 w-8 animate-spin text-baume-burgundy mx-auto mb-4" />
						<p className="text-[15px] text-baume-charcoal/70">
							Validation en cours…
						</p>
					</>
				)}
				{status === "error" && (
					<>
						<div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
							<span className="text-2xl">✕</span>
						</div>
						<p className="text-[15px] text-baume-charcoal/70">
							Lien expiré — redirection en cours…
						</p>
					</>
				)}
				{status === "success" && (
					<>
						<div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
							<span className="text-2xl">✓</span>
						</div>
						<p className="text-[15px] text-baume-charcoal/70">
							Compte validé — redirection en cours…
						</p>
					</>
				)}
			</div>
		</div>
	);
}
