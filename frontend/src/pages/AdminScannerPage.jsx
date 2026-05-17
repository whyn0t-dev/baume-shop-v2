import React, { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import BarcodeScanner from "../components/BarcodeScanner";
import {
	Package,
	Plus,
	Minus,
	Search,
	Loader2,
	CheckCircle2,
	XCircle,
	Camera,
	CameraOff,
	ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const MODES = [
	{ key: "lookup", label: "Consulter", icon: Search, color: "blue" },
	{ key: "stock_in", label: "Entrée stock", icon: Plus, color: "emerald" },
	{ key: "stock_out", label: "Sortie stock", icon: Minus, color: "red" },
];

export default function AdminScannerPage() {
	const { user, status } = useAuth();

	const [scannerActive, setScannerActive] = useState(true);
	const [mode, setMode] = useState("lookup");
	const [quantity, setQuantity] = useState(1);
	const [processing, setProcessing] = useState(false);
	const [lastResult, setLastResult] = useState(null);
	const [manualBarcode, setManualBarcode] = useState("");

	const isAdmin =
		user?.role === "admin" || user?.is_admin === true || user?.isAdmin === true;

	const processBarcode = useCallback(
		async (barcode) => {
			if (processing || !barcode?.trim()) return;

			setProcessing(true);
			setLastResult(null);

			try {
				const res = await api.post("/ecom/admin/scan", {
					barcode: barcode.trim(),
					action: mode,
					quantity: mode === "lookup" ? 1 : quantity,
				});

				setLastResult({ success: true, data: res.data });

				if (mode === "lookup") {
					toast.success(`Produit trouvé : ${res.data.product_name}`);
				} else if (mode === "stock_in") {
					toast.success(`+${quantity} en stock`, {
						description: res.data.product_name,
					});
				} else if (mode === "stock_out") {
					toast.success(`−${quantity} du stock`, {
						description: res.data.product_name,
					});
				}
			} catch (err) {
				const msg = err?.response?.data?.detail || "Code barre non reconnu";
				setLastResult({ success: false, error: msg });
				toast.error("Scan échoué", { description: msg });
			} finally {
				setProcessing(false);
			}
		},
		[mode, quantity, processing],
	);

	const handleScan = useCallback(
		(barcode) => {
			processBarcode(barcode);
		},
		[processBarcode],
	);

	const handleManualSubmit = (e) => {
		e.preventDefault();
		if (manualBarcode.trim()) {
			processBarcode(manualBarcode.trim());
			setManualBarcode("");
		}
	};

	if (status === "loading") {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	if (status !== "authenticated" || !isAdmin) {
		return <Navigate to="/compte" replace />;
	}

	const modeInfo = MODES.find((m) => m.key === mode);

	return (
		<div className="min-h-screen bg-baume-ivory">
			{/* Header */}
			<header className="sticky top-0 z-10 border-b border-baume-border bg-baume-white/95 backdrop-blur px-4 md:px-8 py-4">
				<div className="flex items-center justify-between max-w-2xl mx-auto">
					<div>
						<Link
							to="/admin"
							className="inline-flex items-center gap-1 text-[13px] text-baume-burgundy hover:text-baume-burgundyDark mb-1"
						>
							<ArrowLeft className="h-4 w-4" />
							Dashboard
						</Link>
						<h1 className="text-[20px] font-semibold text-baume-charcoal">
							Scanner de produits
						</h1>
					</div>

					<button
						onClick={() => setScannerActive((v) => !v)}
						className={`h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 transition-colors ${
							scannerActive
								? "bg-baume-burgundy text-white hover:bg-baume-burgundyDark"
								: "border border-baume-border text-baume-charcoal hover:bg-baume-ivory"
						}`}
					>
						{scannerActive ? (
							<>
								<CameraOff className="h-4 w-4" /> Désactiver
							</>
						) : (
							<>
								<Camera className="h-4 w-4" /> Activer
							</>
						)}
					</button>
				</div>
			</header>

			<main className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
				{/* Sélection du mode */}
				<div className="rounded-2xl border border-baume-border bg-baume-white p-4">
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold mb-3">
						Mode de scan
					</p>
					<div className="grid grid-cols-3 gap-2">
						{MODES.map((m) => {
							const Icon = m.icon;
							const colors = {
								blue: "border-blue-300 bg-blue-50 text-blue-700",
								emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
								red: "border-red-300 bg-red-50 text-red-700",
							};
							const inactiveColors =
								"border-baume-border bg-baume-ivory text-baume-charcoal/60";

							return (
								<button
									key={m.key}
									onClick={() => setMode(m.key)}
									className={`rounded-xl border p-3 text-center transition-all ${
										mode === m.key ? colors[m.color] : inactiveColors
									}`}
								>
									<Icon className="h-5 w-5 mx-auto mb-1" />
									<p className="text-[12px] font-semibold">{m.label}</p>
								</button>
							);
						})}
					</div>
				</div>

				{/* Quantité pour stock in/out */}
				{mode !== "lookup" && (
					<div className="rounded-2xl border border-baume-border bg-baume-white p-4">
						<p className="text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold mb-3">
							Quantité
						</p>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setQuantity((q) => Math.max(1, q - 1))}
								className="h-10 w-10 rounded-full border border-baume-border text-baume-charcoal hover:bg-baume-ivory transition-colors inline-flex items-center justify-center"
							>
								<Minus className="h-4 w-4" />
							</button>
							<input
								type="number"
								min={1}
								value={quantity}
								onChange={(e) =>
									setQuantity(Math.max(1, parseInt(e.target.value) || 1))
								}
								className="w-20 h-10 rounded-xl border border-baume-border text-center text-[16px] font-semibold text-baume-charcoal outline-none focus:ring-2 focus:ring-baume-taupe"
							/>
							<button
								onClick={() => setQuantity((q) => q + 1)}
								className="h-10 w-10 rounded-full border border-baume-border text-baume-charcoal hover:bg-baume-ivory transition-colors inline-flex items-center justify-center"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>
					</div>
				)}

				{/* Scanner caméra */}
				<div className="rounded-2xl border border-baume-border bg-baume-white p-4">
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold mb-3">
						Caméra
					</p>
					<BarcodeScanner
						active={scannerActive}
						onScan={handleScan}
						onError={(err) => console.error("Scanner error:", err)}
					/>
				</div>

				{/* Saisie manuelle */}
				<div className="rounded-2xl border border-baume-border bg-baume-white p-4">
					<p className="text-[12px] uppercase tracking-[0.18em] text-baume-charcoal/50 font-semibold mb-3">
						Saisie manuelle
					</p>
					<form onSubmit={handleManualSubmit} className="flex gap-2">
						<input
							type="text"
							value={manualBarcode}
							onChange={(e) => setManualBarcode(e.target.value)}
							placeholder="Code barre ou SKU..."
							className="flex-1 h-11 rounded-xl border border-baume-border bg-baume-ivory/50 px-4 text-[14px] text-baume-charcoal outline-none focus:ring-2 focus:ring-baume-taupe font-mono"
						/>
						<button
							type="submit"
							disabled={processing || !manualBarcode.trim()}
							className="h-11 px-5 rounded-xl bg-baume-burgundy text-white text-[13px] font-semibold hover:bg-baume-burgundyDark disabled:opacity-50 transition-colors inline-flex items-center gap-2"
						>
							{processing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Search className="h-4 w-4" />
							)}
							Valider
						</button>
					</form>
				</div>

				{/* Résultat du scan */}
				{lastResult && (
					<div
						className={`rounded-2xl border p-5 ${
							lastResult.success
								? "border-emerald-200 bg-emerald-50"
								: "border-red-200 bg-red-50"
						}`}
					>
						<div className="flex items-start gap-3">
							{lastResult.success ? (
								<CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
							) : (
								<XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
							)}

							<div className="flex-1 min-w-0">
								{lastResult.success ? (
									<>
										<p className="text-[14px] font-semibold text-emerald-800">
											{lastResult.data.product_name}
										</p>
										{lastResult.data.variant_title && (
											<p className="text-[12px] text-emerald-600 mt-0.5">
												{lastResult.data.variant_title}
											</p>
										)}
										<div className="mt-3 grid grid-cols-2 gap-3">
											<div className="rounded-xl bg-white/60 p-3 text-center">
												<p className="text-[11px] text-emerald-600 uppercase tracking-wider font-semibold">
													Stock actuel
												</p>
												<p className="text-[24px] font-editorial text-emerald-800 mt-0.5">
													{lastResult.data.current_stock}
												</p>
											</div>
											{lastResult.data.previous_stock !== undefined && (
												<div className="rounded-xl bg-white/60 p-3 text-center">
													<p className="text-[11px] text-emerald-600 uppercase tracking-wider font-semibold">
														Avant scan
													</p>
													<p className="text-[24px] font-editorial text-emerald-800 mt-0.5">
														{lastResult.data.previous_stock}
													</p>
												</div>
											)}
										</div>
										{lastResult.data.sku && (
											<p className="text-[11px] text-emerald-600 mt-2 font-mono">
												SKU : {lastResult.data.sku}
											</p>
										)}
									</>
								) : (
									<p className="text-[14px] text-red-700">{lastResult.error}</p>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Processing indicator */}
				{processing && (
					<div className="rounded-2xl border border-baume-border bg-baume-white p-5 flex items-center justify-center gap-3">
						<Loader2 className="h-5 w-5 animate-spin text-baume-burgundy" />
						<p className="text-[14px] text-baume-charcoal/70">
							Traitement en cours...
						</p>
					</div>
				)}
			</main>
		</div>
	);
}
