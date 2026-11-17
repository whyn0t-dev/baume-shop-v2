import React, { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { confirmMfaEnroll, disableMfa, formatApiError, getMfaStatus, startMfaEnroll } from "../lib/api";

const SOLID =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-baume-burgundy px-6 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const OUTLINE =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-baume-border bg-white px-6 text-sm font-semibold text-baume-charcoal transition hover:border-baume-burgundy disabled:cursor-not-allowed disabled:opacity-50";
const CODE_INPUT =
	"mt-2 h-14 w-full max-w-[220px] rounded-2xl border border-baume-border bg-white px-4 text-center text-[22px] tracking-[0.35em] text-baume-charcoal outline-none transition focus:border-baume-burgundy focus:ring-2 focus:ring-baume-burgundy/15";

const onlyDigits = (v) => v.replace(/\D/g, "").slice(0, 6);

// Supabase renvoie le QR code en SVG brut (« data:image/svg+xml;utf-8,<svg…> »), que
// certains navigateurs refusent d'afficher : on le réencode proprement.
function qrSource(qr) {
	if (!qr) return null;
	const m = qr.match(/^data:image\/svg\+xml;(?:utf-?8|charset=utf-?8)?,(.*)$/is);
	if (!m) return qr;
	let svg = m[1];
	try {
		if (/%3Csvg/i.test(svg)) svg = decodeURIComponent(svg);
	} catch {
		// déjà décodé
	}
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const groupSecret = (s) => (s || "").replace(/(.{4})/g, "$1 ").trim();

function dateFR(value) {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime())
		? null
		: d.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Double authentification (code à 6 chiffres) — espace client du site.
 * Le réglage est enregistré sur le compte : il vaut aussi pour les deux apps mobiles.
 */
export default function TwoFactorPanel() {
	const { replaceTokens, refreshMe } = useAuth();
	const [status, setStatus] = useState(null); // { enabled, since }
	const [enroll, setEnroll] = useState(null); // { factor_id, qr_code, secret, uri }
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [showDisable, setShowDisable] = useState(false);

	useEffect(() => {
		getMfaStatus()
			.then(setStatus)
			.catch(() => setStatus({ enabled: false }));
	}, []);

	async function begin() {
		setBusy(true);
		try {
			setEnroll(await startMfaEnroll());
			setCode("");
		} catch (err) {
			toast.error("Activation impossible", { description: formatApiError(err) });
		} finally {
			setBusy(false);
		}
	}

	async function confirm(e) {
		e.preventDefault();
		if (code.length !== 6 || !enroll) return;
		setBusy(true);
		try {
			const res = await confirmMfaEnroll(enroll.factor_id, code);
			replaceTokens(res);
			setEnroll(null);
			setCode("");
			setStatus({ enabled: true, since: new Date().toISOString() });
			refreshMe?.();
			toast.success("Double authentification activée", {
				description: "Le code vous sera demandé à chaque connexion, sur le site et dans les apps.",
			});
		} catch (err) {
			setCode("");
			toast.error("Code refusé", { description: formatApiError(err) });
		} finally {
			setBusy(false);
		}
	}

	async function disable(e) {
		e.preventDefault();
		if (code.length !== 6) return;
		setBusy(true);
		try {
			const res = await disableMfa(code);
			replaceTokens(res);
			setStatus({ enabled: false });
			setShowDisable(false);
			setCode("");
			refreshMe?.();
			toast.success("Double authentification désactivée");
		} catch (err) {
			setCode("");
			toast.error("Code refusé", { description: formatApiError(err) });
		} finally {
			setBusy(false);
		}
	}

	async function copySecret() {
		try {
			await navigator.clipboard.writeText(enroll?.secret || "");
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Copie impossible", { description: "Sélectionnez la clé et copiez-la manuellement." });
		}
	}

	return (
		<div className="rounded-[20px] border border-baume-border bg-baume-ivory/45 p-5 sm:p-6" data-testid="two-factor-panel">
			<div className="flex items-start gap-3">
				<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-baume-burgundy">
					<KeyRound size={20} />
				</span>
				<div className="min-w-0">
					<h3 className="font-editorial text-[23px] text-baume-charcoal">Double authentification</h3>
					<p className="mt-1 text-sm leading-6 text-baume-muted">
						En plus de votre mot de passe, un code à 6 chiffres généré par une application sur votre
						téléphone vous est demandé à la connexion. Le réglage vaut pour le site et les apps Baume.
					</p>
				</div>
			</div>

			{status === null ? (
				<div className="mt-6 flex items-center gap-2 text-sm text-baume-muted">
					<Loader2 className="h-4 w-4 animate-spin" /> Chargement…
				</div>
			) : status.enabled ? (
				<div className="mt-6 space-y-4">
					<div className="flex items-center gap-3 rounded-2xl border border-baume-border bg-white px-4 py-3">
						<ShieldCheck size={18} className="shrink-0 text-green-700" />
						<p className="text-sm text-baume-charcoal">
							<strong>Activée</strong>
							{dateFR(status.since) ? ` depuis le ${dateFR(status.since)}` : ""}.
						</p>
					</div>
					{showDisable ? (
						<form onSubmit={disable} className="space-y-3">
							<label className="block text-sm font-semibold text-baume-charcoal" htmlFor="mfa-disable-code">
								Saisissez un code de votre application pour confirmer
							</label>
							<input
								id="mfa-disable-code"
								className={CODE_INPUT}
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="123456"
								value={code}
								onChange={(e) => setCode(onlyDigits(e.target.value))}
								autoFocus
							/>
							<div className="flex flex-wrap gap-3">
								<button type="submit" className={OUTLINE} disabled={busy || code.length !== 6}>
									{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff size={16} />}
									Désactiver
								</button>
								<button
									type="button"
									className="text-sm text-baume-muted hover:text-baume-charcoal"
									onClick={() => {
										setShowDisable(false);
										setCode("");
									}}
								>
									Annuler
								</button>
							</div>
						</form>
					) : (
						<button type="button" className={OUTLINE} onClick={() => setShowDisable(true)}>
							<ShieldOff size={16} /> Désactiver
						</button>
					)}
				</div>
			) : enroll ? (
				<form onSubmit={confirm} className="mt-6 space-y-5">
					<ol className="space-y-5 text-sm leading-6 text-baume-charcoal">
						<li>
							<p className="font-semibold">1. Installez une application d'authentification</p>
							<p className="text-baume-muted">
								Google Authenticator, Microsoft Authenticator, 1Password ou l'app Mots de passe de
								l'iPhone.
							</p>
						</li>
						<li>
							<p className="font-semibold">2. Ajoutez votre compte Baume</p>
							<div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
								{enroll.qr_code ? (
									<img
										src={qrSource(enroll.qr_code)}
										alt="QR code à scanner avec votre application d'authentification"
										className="h-44 w-44 shrink-0 rounded-2xl border border-baume-border bg-white p-2"
									/>
								) : null}
								<div className="min-w-0 space-y-3">
									<p className="text-baume-muted">
										Scannez le QR code avec l'application. Sur ce téléphone ? Ouvrez directement le lien,
										ou saisissez la clé à la main.
									</p>
									{enroll.uri ? (
										<a href={enroll.uri} className={OUTLINE}>
											<Smartphone size={16} /> Ouvrir dans l'application
										</a>
									) : null}
									<div className="rounded-2xl border border-baume-border bg-white px-4 py-3">
										<p className="text-[11px] font-bold uppercase tracking-[0.15em] text-baume-muted">Clé</p>
										<div className="mt-1 flex items-center gap-2">
											<code className="break-all font-mono text-[13px] text-baume-charcoal select-all">
												{groupSecret(enroll.secret)}
											</code>
											<button type="button" onClick={copySecret} className="shrink-0 text-baume-burgundy" aria-label="Copier la clé">
												{copied ? <Check size={16} /> : <Copy size={16} />}
											</button>
										</div>
									</div>
								</div>
							</div>
						</li>
						<li>
							<label className="block font-semibold" htmlFor="mfa-enroll-code">
								3. Saisissez le code à 6 chiffres affiché
							</label>
							<input
								id="mfa-enroll-code"
								className={CODE_INPUT}
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="123456"
								value={code}
								onChange={(e) => setCode(onlyDigits(e.target.value))}
							/>
						</li>
					</ol>
					<div className="flex flex-wrap items-center gap-3">
						<button type="submit" className={SOLID} disabled={busy || code.length !== 6}>
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck size={16} />}
							Activer
						</button>
						<button
							type="button"
							className="text-sm text-baume-muted hover:text-baume-charcoal"
							onClick={() => {
								setEnroll(null);
								setCode("");
							}}
						>
							Annuler
						</button>
					</div>
				</form>
			) : (
				<div className="mt-6 space-y-4">
					<div className="flex items-center gap-3 rounded-2xl border border-baume-border bg-white px-4 py-3">
						<ShieldOff size={18} className="shrink-0 text-baume-muted" />
						<p className="text-sm text-baume-charcoal">Non activée.</p>
					</div>
					<button type="button" className={SOLID} onClick={begin} disabled={busy}>
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck size={16} />}
						Activer la double authentification
					</button>
				</div>
			)}
		</div>
	);
}
