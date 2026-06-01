import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../lib/cart";
import { createCheckout } from "../lib/api";
import {
	CheckCircle2,
	ArrowRight,
	XCircle,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function ConfirmationPage() {
	const [params] = useSearchParams();
	const sessionId = params.get("session_id");
	const cancelled = params.get("cancelled"); // ← Stripe redirige avec ?cancelled=true si annulé
	const { clear, items } = useCart();
	const cleared = useRef(false);
	const [retrying, setRetrying] = useState(false);

	// Détecter si c'est une erreur — soit ?cancelled=true, soit pas de session_id
	const isError = cancelled === "true" || (!sessionId && !cancelled);
	const isSuccess = sessionId && !cancelled;

	useEffect(() => {
		if (isSuccess && !cleared.current) {
			cleared.current = true;
			clear();
		}
	}, [isSuccess, clear]);

	const handleRetry = async () => {
		if (items.length === 0) {
			toast.error("Votre panier est vide");
			return;
		}

		setRetrying(true);
		try {
			// ← Récupérer la session Stripe en cours si elle existe
			const sessionIdFromStorage = sessionStorage.getItem("stripe_session_id");
			if (sessionIdFromStorage) {
				const res = await fetch(
					`${process.env.REACT_APP_BACKEND_URL}/api/checkout/status/${sessionIdFromStorage}`,
				);
				const data = await res.json();

				// Si la session est encore ouverte, rediriger vers Stripe
				if (data.status === "open") {
					const sessionRes = await fetch(
						`https://checkout.stripe.com/pay/${sessionIdFromStorage}`,
					);
					window.location.href = `https://checkout.stripe.com/pay/${sessionIdFromStorage}`;
					return;
				}
			}

			// Sinon créer une nouvelle session
			const payload = {
				items: items.map((i) => ({
					product_id: i.product_id || i.id,
					variant_id: i.variant_id || null,
					name: i.name,
					price: Number(i.price || 0),
					quantity: Number(i.quantity || 1),
					size: i.size,
					color: i.color,
					sku: i.sku,
				})),
				origin_url: window.location.origin,
				shipping_country: "CH",
			};

			const result = await createCheckout(payload);
			if (result?.url) {
				window.location.href = result.url;
			}
		} catch (e) {
			toast.error("Erreur lors du rechargement du paiement");
		} finally {
			setRetrying(false);
		}
	};

	// ── Page succès ────────────────────────────────────────────────────────────
	if (isSuccess) {
		return (
			<div
				data-testid="confirmation-page"
				className="bg-baume-ivory min-h-[70vh]"
			>
				<div className="baume-container py-20 md:py-28 max-w-[720px] mx-auto text-center">
					<div className="mx-auto h-16 w-16 rounded-full bg-baume-burgundy text-baume-white inline-flex items-center justify-center mb-6">
						<CheckCircle2 className="h-8 w-8" />
					</div>

					<h1 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal">
						Merci pour votre commande
					</h1>

					<p className="mt-4 text-[16px] md:text-[18px] leading-[28px] text-baume-charcoal/75">
						Votre paiement a bien été reçu. Un email de confirmation vous sera
						envoyé sous quelques minutes. Votre commande sera expédiée depuis
						Genève dans les 24 h ouvrées.
					</p>

					{sessionId && (
						<p className="mt-4 text-[12px] text-baume-charcoal/45">
							Référence paiement : {sessionId}
						</p>
					)}

					<div className="mt-10 flex flex-wrap justify-center gap-3">
						<Link
							to="/"
							className="h-12 px-8 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px]"
						>
							Retour à l'accueil <ArrowRight className="h-4 w-4" />
						</Link>

						<Link
							to="/guides"
							className="h-12 px-8 inline-flex items-center rounded-full border border-baume-burgundy text-baume-burgundy font-semibold text-[15px]"
						>
							Lire nos guides
						</Link>
					</div>
				</div>
			</div>
		);
	}

	// ── Page erreur / annulation ───────────────────────────────────────────────
	return (
		<div
			data-testid="confirmation-error-page"
			className="bg-baume-ivory min-h-[70vh]"
		>
			<div className="baume-container py-20 md:py-28 max-w-[720px] mx-auto text-center">
				<div className="mx-auto h-16 w-16 rounded-full bg-red-100 text-red-500 inline-flex items-center justify-center mb-6">
					<XCircle className="h-8 w-8" />
				</div>

				<h1 className="font-editorial text-[36px] md:text-[48px] text-baume-charcoal">
					Paiement non abouti
				</h1>

				<p className="mt-4 text-[16px] md:text-[18px] leading-[28px] text-baume-charcoal/75">
					{cancelled === "true"
						? "Vous avez annulé le paiement. Votre panier a été conservé — vous pouvez relancer la commande quand vous le souhaitez."
						: "Une erreur est survenue lors du traitement de votre paiement. Aucun montant n'a été débité."}
				</p>

				<div className="mt-8 rounded-2xl border border-baume-border bg-baume-white p-6 text-left space-y-3">
					<p className="text-[14px] font-semibold text-baume-charcoal">
						Que faire maintenant ?
					</p>
					{[
						"Vérifiez que les informations de votre carte sont correctes",
						"Assurez-vous que votre carte est activée pour les paiements en ligne",
						"Contactez votre banque si le problème persiste",
						"Essayez avec un autre moyen de paiement",
					].map((t, i) => (
						<div
							key={i}
							className="flex items-start gap-2 text-[13px] text-baume-charcoal/70"
						>
							<span className="h-1.5 w-1.5 rounded-full bg-baume-burgundy mt-1.5 shrink-0" />
							<span>{t}</span>
						</div>
					))}
				</div>

				<div className="mt-10 flex flex-wrap justify-center gap-3">
					{/* Relancer le paiement */}
					<button
						onClick={handleRetry}
						disabled={retrying || items.length === 0}
						className="h-12 px-8 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60"
					>
						{retrying ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						{retrying ? "Chargement..." : "Relancer le paiement"}
					</button>

					{/* Retour au panier */}
					<Link
						to="/panier"
						className="h-12 px-8 inline-flex items-center rounded-full border border-baume-border text-baume-charcoal font-semibold text-[15px] hover:bg-baume-ivory"
					>
						Retour au panier
					</Link>
				</div>

				{items.length === 0 && (
					<p className="mt-4 text-[12px] text-baume-charcoal/50">
						Votre panier est vide — retournez au shop pour ajouter des produits.
					</p>
				)}

				<p className="mt-8 text-[13px] text-baume-charcoal/55">
					Un problème persistant ?{" "}
					<Link to="/contact" className="baume-link">
						Contactez-nous
					</Link>{" "}
					et nous vous aiderons.
				</p>
			</div>
		</div>
	);
}
