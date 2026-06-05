import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function CarteFidelitePage() {
	const { isAuth, user } = useAuth();
	const [loyalty, setLoyalty] = useState(null);
	const [loading, setLoading] = useState(true);
	const [qrKey, setQrKey] = useState(0);
	const [timeLeft, setTimeLeft] = useState(300);

	useEffect(() => {
		if (isAuth) loadLoyalty();
		else setLoading(false);
	}, [isAuth]);

	// ← Timer QR code 5 min
	useEffect(() => {
		const interval = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					setQrKey((k) => k + 1);
					return 300;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	async function loadLoyalty() {
		try {
			const res = await api.get("/loyalty/me");
			setLoyalty(res.data);
		} catch {
		} finally {
			setLoading(false);
		}
	}

	const minutes = Math.floor(timeLeft / 60);
	const seconds = timeLeft % 60;
	const progressPercent = (timeLeft / 300) * 100;

	const qrValue = loyalty
		? `BAUME:${user?.email}:${loyalty.points}:${Math.floor(Date.now() / (5 * 60 * 1000))}`
		: "";

	const nextThreshold = loyalty?.next_threshold;
	const progressToNext = nextThreshold
		? Math.min((loyalty.points / nextThreshold.points) * 100, 100)
		: 100;

	if (!isAuth) {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center px-6">
				<div className="text-center max-w-sm">
					<p className="text-4xl font-semibold text-baume-burgundy mb-4">
						Baume.
					</p>
					<p className="text-baume-charcoal/60 mb-8">
						Connectez-vous pour accéder à votre carte de fidélité
					</p>

					<a
						href="/connexion"
						className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-baume-burgundy text-white font-semibold"
					>
						Se connecter
					</a>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<div className="w-8 h-8 border-2 border-baume-burgundy border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-baume-ivory flex flex-col items-center justify-start pt-8 pb-12 px-5">
			{/* ── Carte principale ── */}
			<div className="w-full max-w-sm bg-[#3D2A2A] rounded-[32px] overflow-hidden shadow-2xl mb-6">
				{/* Header carte */}
				<div className="px-7 pt-7 pb-4 flex items-start justify-between">
					<div>
						<p className="text-[11px] tracking-[3px] text-white/40 font-semibold uppercase">
							Carte de fidélité
						</p>
						<p className="text-[32px] font-semibold text-white tracking-tight mt-1">
							Baume.
						</p>
					</div>
					<div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
						<p className="text-[26px] font-bold text-white leading-none">
							{loyalty?.points || 0}
						</p>
						<p className="text-[10px] text-white/50 mt-0.5">points</p>
					</div>
				</div>

				{/* Nom du client */}
				<div className="px-7 pb-5">
					<p className="text-white/70 text-[17px] font-medium capitalize">
						{user?.first_name || user?.email?.split("@")[0]}
					</p>
					<p className="text-white/35 text-[12px] mt-0.5">{user?.email}</p>
				</div>

				{/* Séparateur pointillé */}
				<div className="flex items-center px-5 pb-5 gap-1.5">
					{Array.from({ length: 28 }).map((_, i) => (
						<div key={i} className="flex-1 h-px bg-white/15 rounded-full" />
					))}
				</div>

				{/* QR Code */}
				<div className="flex flex-col items-center px-7 pb-6">
					<div className="bg-white rounded-2xl p-4 shadow-lg">
						<QRCode
							key={qrKey}
							value={qrValue || "BAUME:invalid"}
							size={200}
							fgColor="#3D2A2A"
							bgColor="#ffffff"
							style={{ height: "auto", maxWidth: "100%", width: "100%" }}
						/>
					</div>

					{/* Timer */}
					<div className="mt-4 w-full">
						<div className="h-[3px] bg-white/15 rounded-full overflow-hidden mb-2">
							<div
								className="h-full bg-[#C4A882] rounded-full transition-all duration-1000"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
						<p className="text-center text-[11px] text-white/40">
							Code valide encore {minutes}:{seconds.toString().padStart(2, "0")}
						</p>
					</div>

					{/* Bouton rafraîchir */}
					<button
						onClick={() => {
							setQrKey((k) => k + 1);
							setTimeLeft(300);
						}}
						className="mt-3 text-[12px] text-white/40 border border-white/20 rounded-full px-4 py-1.5 hover:text-white/60 transition-colors"
					>
						↻ Rafraîchir
					</button>
				</div>

				{/* Barre progression */}
				{nextThreshold && (
					<div className="px-7 pb-5">
						<div className="h-[5px] bg-white/15 rounded-full overflow-hidden mb-2">
							<div
								className="h-full bg-[#C4A882] rounded-full transition-all duration-500"
								style={{ width: `${progressToNext}%` }}
							/>
						</div>
						<div className="flex justify-between">
							<p className="text-[11px] text-white/40">{loyalty.points} pts</p>
							<p className="text-[11px] text-white/40">
								{nextThreshold.points} pts → {nextThreshold.label}
							</p>
						</div>
						<p className="text-[11px] text-white/30 mt-1">
							Plus que {nextThreshold.points - loyalty.points} pts pour{" "}
							{nextThreshold.label}
						</p>
					</div>
				)}

				{/* Stats */}
				<div className="flex border-t border-white/10 mx-7 pt-4 pb-6">
					<div className="flex-1 text-center">
						<p className="text-[18px] font-bold text-white">
							{loyalty?.total_earned || 0}
						</p>
						<p className="text-[10px] text-white/40 mt-0.5">pts gagnés</p>
					</div>
					<div className="w-px bg-white/10" />
					<div className="flex-1 text-center">
						<p className="text-[18px] font-bold text-white">
							{loyalty?.total_spent || 0}
						</p>
						<p className="text-[10px] text-white/40 mt-0.5">pts utilisés</p>
					</div>
					<div className="w-px bg-white/10" />
					<div className="flex-1 text-center">
						<p className="text-[18px] font-bold text-white">
							{(loyalty?.generated_codes || []).filter((c) => !c.used).length}
						</p>
						<p className="text-[10px] text-white/40 mt-0.5">bons actifs</p>
					</div>
				</div>
			</div>

			{/* ── Convertir mes points ── */}
			{loyalty?.thresholds?.length > 0 && (
				<div className="w-full max-w-sm mb-6">
					<p className="text-[11px] font-bold text-baume-burgundy uppercase tracking-[2px] mb-3">
						Convertir mes points
					</p>
					<div className="flex gap-3">
						{loyalty.thresholds.map((t) => {
							const canConvert = loyalty.points >= t.points;
							return (
								<button
									key={t.points}
									onClick={async () => {
										if (!canConvert) return;
										try {
											const res = await api.post("/loyalty/convert", {
												points: t.points,
											});
											alert(
												`Code créé : ${res.data.code}\nValeur : ${res.data.reward} CHF`,
											);
											loadLoyalty();
										} catch (e) {
											alert("Erreur lors de la conversion.");
										}
									}}
									disabled={!canConvert}
									className={`flex-1 rounded-2xl p-3 border text-left transition-all ${
										canConvert
											? "bg-white border-baume-burgundy"
											: "bg-white border-baume-border opacity-40"
									}`}
								>
									<p
										className={`text-[18px] font-bold ${canConvert ? "text-baume-burgundy" : "text-baume-charcoal/30"}`}
									>
										{t.label}
									</p>
									<p className="text-[11px] text-baume-charcoal/50 mt-0.5">
										{t.points} pts
									</p>
									{canConvert && (
										<p className="text-[10px] text-baume-burgundy font-semibold mt-2">
											Convertir →
										</p>
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* ── Bons d'achat actifs ── */}
			{(loyalty?.generated_codes || []).filter((c) => !c.used).length > 0 && (
				<div className="w-full max-w-sm mb-6">
					<p className="text-[11px] font-bold text-baume-burgundy uppercase tracking-[2px] mb-3">
						Mes bons d'achat
					</p>
					{loyalty.generated_codes
						.filter((c) => !c.used)
						.map((c, i) => (
							<div
								key={i}
								className="bg-white border border-baume-border rounded-2xl px-4 py-3 flex items-center justify-between mb-2"
							>
								<div>
									<p className="font-bold text-baume-burgundy tracking-widest text-[14px]">
										{c.code}
									</p>
									<p className="text-[11px] text-baume-charcoal/40 mt-0.5">
										{new Date(c.created_at).toLocaleDateString("fr-CH", {
											day: "numeric",
											month: "long",
											year: "numeric",
										})}
									</p>
								</div>
								<span className="bg-green-50 text-green-700 text-[13px] font-bold px-3 py-1.5 rounded-full">
									{c.reward} CHF
								</span>
							</div>
						))}
				</div>
			)}

			{/* ── Historique ── */}
			{(loyalty?.transactions || []).length > 0 && (
				<div className="w-full max-w-sm">
					<p className="text-[11px] font-bold text-baume-burgundy uppercase tracking-[2px] mb-3">
						Historique
					</p>
					<div className="bg-white border border-baume-border rounded-2xl overflow-hidden">
						{loyalty.transactions.slice(0, 5).map((tx, i) => (
							<div
								key={i}
								className="flex items-center justify-between px-4 py-3 border-b border-baume-border last:border-0"
							>
								<div>
									<p className="text-[13px] font-medium text-baume-charcoal">
										{tx.reason}
									</p>
									<p className="text-[11px] text-baume-charcoal/40 mt-0.5">
										{new Date(tx.created_at).toLocaleDateString("fr-CH", {
											day: "numeric",
											month: "long",
										})}
									</p>
								</div>
								<span
									className={`text-[14px] font-bold ${
										tx.type === "earn"
											? "text-green-600"
											: "text-baume-burgundy"
									}`}
								>
									{tx.type === "earn" ? "+" : ""}
									{tx.points} pts
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* ── Bannière install PWA ── */}
			<div className="w-full max-w-sm mt-6 bg-baume-burgundy rounded-2xl p-5 text-center">
				<p className="text-white font-semibold text-[15px] mb-1">
					📲 Installez votre carte
				</p>
				<p className="text-white/60 text-[12px] mb-4">
					Ajoutez cette page à votre écran d'accueil pour y accéder en un clic
				</p>
				<p className="text-white/40 text-[11px]">
					iOS : Partager → Sur l'écran d'accueil{"\n"}
					Android : Menu → Ajouter à l'écran d'accueil
				</p>
			</div>
		</div>
	);
}
