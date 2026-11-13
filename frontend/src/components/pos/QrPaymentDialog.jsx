import React, { useEffect, useRef, useState } from "react";
import { BrowserQRCodeSvgWriter } from "@zxing/browser";
import { Loader2, QrCode, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import {
	formatChf,
	posCancelQr,
	posCreateQrCheckout,
	posError,
	posQrStatus,
} from "../../lib/posApi";

const POLL_MS = 2500;

/**
 * Paiement carte / TWINT : la caisse crée une session Stripe et affiche
 * son lien en QR code. Le client scanne et paie sur son téléphone ; la
 * commande est créée par le webhook Stripe, la caisse interroge le statut.
 */
export default function QrPaymentDialog({ open, payload, customerName, onClose, onPaid }) {
	const [state, setState] = useState("idle"); // creating | waiting | finalizing | expired | error
	const [error, setError] = useState("");
	const [session, setSession] = useState(null);
	const qrRef = useRef(null);
	const sessionRef = useRef(null);
	const doneRef = useRef(false);

	// Création de la session à l'ouverture.
	useEffect(() => {
		if (!open) return undefined;
		let cancelled = false;
		doneRef.current = false;
		setState("creating");
		setError("");
		setSession(null);

		posCreateQrCheckout(payload)
			.then((s) => {
				if (cancelled) {
					posCancelQr(s.session_id).catch(() => {});
					return;
				}
				sessionRef.current = s;
				setSession(s);
				setState("waiting");
			})
			.catch((err) => {
				if (cancelled) return;
				setError(posError(err, "Impossible de créer le paiement."));
				setState("error");
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Dessin du QR code.
	useEffect(() => {
		if (!session?.url || !qrRef.current) return;
		qrRef.current.innerHTML = "";
		const svg = new BrowserQRCodeSvgWriter().write(session.url, 280, 280);
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		qrRef.current.appendChild(svg);
	}, [session, state]);

	// Suivi du paiement.
	useEffect(() => {
		if (!open || !session || !["waiting", "finalizing"].includes(state)) return undefined;
		let stopped = false;

		const tick = async () => {
			try {
				const s = await posQrStatus(session.session_id);
				if (stopped || doneRef.current) return;
				if (s.order_ready && s.order) {
					doneRef.current = true;
					onPaid({
						order: { ...s.order, created_at: new Date().toISOString() },
						items: session.items,
						payment: { method: "card", amount: session.total },
						customer_name: customerName,
					});
					return;
				}
				if (s.payment_status === "paid") setState("finalizing");
				else if (s.status === "expired") setState("expired");
			} catch {
				// Erreur réseau ponctuelle : on retente au prochain tour.
			}
		};

		const id = setInterval(tick, POLL_MS);
		return () => {
			stopped = true;
			clearInterval(id);
		};
	}, [open, session, state, onPaid, customerName]);

	const cancel = async () => {
		const s = sessionRef.current;
		if (s && state === "waiting") {
			try {
				await posCancelQr(s.session_id);
			} catch (err) {
				// 409 : le client vient de payer, on laisse le suivi conclure.
				if (err?.response?.status === 409) {
					setState("finalizing");
					return;
				}
			}
		}
		sessionRef.current = null;
		onClose();
	};

	const canClose = state !== "finalizing";

	return (
		<Dialog open={open} onOpenChange={(v) => !v && canClose && cancel()}>
			<DialogContent className="max-w-md bg-white">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-baume-charcoal">
						<QrCode className="h-5 w-5" /> Carte ou TWINT
					</DialogTitle>
					<DialogDescription>
						Le client scanne le QR code avec son téléphone et paie{" "}
						<strong className="text-baume-charcoal">{formatChf(session?.total ?? 0)}</strong>.
					</DialogDescription>
				</DialogHeader>

				<div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
					{state === "creating" && <Loader2 className="h-8 w-8 animate-spin text-baume-burgundy" />}

					{["waiting", "finalizing"].includes(state) && (
						<>
							<div ref={qrRef} className="h-[280px] w-[280px] rounded-xl bg-white p-2 shadow-inner" />
							<p className="flex items-center gap-2 text-[15px] text-neutral-600">
								<Loader2 className="h-4 w-4 animate-spin" />
								{state === "finalizing"
									? "Paiement reçu, création de la commande…"
									: "En attente du paiement…"}
							</p>
						</>
					)}

					{state === "expired" && (
						<p className="flex items-center gap-2 text-[15px] text-neutral-700">
							<XCircle className="h-5 w-5 text-red-600" /> Le QR code a expiré. Relancez le paiement.
						</p>
					)}

					{state === "error" && (
						<p className="rounded-lg bg-red-50 p-3 text-center text-[14px] text-red-700">{error}</p>
					)}
				</div>

				<button
					type="button"
					onClick={cancel}
					disabled={!canClose}
					className="min-h-[52px] w-full rounded-xl border border-baume-border text-[16px] font-medium text-baume-charcoal disabled:opacity-40"
				>
					{state === "waiting" ? "Annuler le paiement" : "Fermer"}
				</button>
			</DialogContent>
		</Dialog>
	);
}

