import React, { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/browser";
import { Camera, CameraOff, Loader2, RefreshCw } from "lucide-react";

export default function BarcodeScanner({ onScan, onError, active = true }) {
	const videoRef = useRef(null);
	const readerRef = useRef(null);
	const controlsRef = useRef(null);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [cameras, setCameras] = useState([]);
	const [selectedCamera, setSelectedCamera] = useState(null);
	const [lastScan, setLastScan] = useState(null);

	// Cooldown pour éviter les scans répétés
	const lastScanTime = useRef(0);
	const SCAN_COOLDOWN = 2000;

	const stopScanner = useCallback(async () => {
		if (controlsRef.current) {
			try {
				controlsRef.current.stop();
			} catch (e) {}
			controlsRef.current = null;
		}
	}, []);

	const startScanner = useCallback(
		async (deviceId) => {
			if (!videoRef.current || !active) return;

			setLoading(true);
			setError(null);

			try {
				await stopScanner();

				readerRef.current = new BrowserMultiFormatReader();

				const controls = await readerRef.current.decodeFromVideoDevice(
					deviceId || undefined,
					videoRef.current,
					(result, err) => {
						if (result) {
							const now = Date.now();
							if (now - lastScanTime.current < SCAN_COOLDOWN) return;
							lastScanTime.current = now;

							const text = result.getText();
							setLastScan(text);
							onScan?.(text);
						}
						if (err && !(err instanceof NotFoundException)) {
							console.warn("Scanner error:", err);
						}
					},
				);

				controlsRef.current = controls;
				setLoading(false);
			} catch (err) {
				setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
				setLoading(false);
				onError?.(err);
			}
		},
		[active, stopScanner, onScan, onError],
	);

	// Charger les caméras disponibles
	useEffect(() => {
		const loadCameras = async () => {
			try {
				const devices = await BrowserMultiFormatReader.listVideoInputDevices();
				setCameras(devices);

				// Préférer la caméra arrière sur mobile
				const backCamera = devices.find(
					(d) =>
						d.label.toLowerCase().includes("back") ||
						d.label.toLowerCase().includes("arrière") ||
						d.label.toLowerCase().includes("rear") ||
						d.label.toLowerCase().includes("environment"),
				);

				const preferred = backCamera || devices[0];
				if (preferred) {
					setSelectedCamera(preferred.deviceId);
				}
			} catch (err) {
				setError("Impossible de lister les caméras.");
			}
		};

		if (active) loadCameras();
	}, [active]);

	// Démarrer le scanner quand la caméra est sélectionnée
	useEffect(() => {
		if (active && selectedCamera !== null) {
			startScanner(selectedCamera);
		}
		return () => {
			stopScanner();
		};
	}, [active, selectedCamera, startScanner, stopScanner]);

	if (!active) return null;

	return (
		<div className="relative w-full">
			{/* Vidéo */}
			<div className="relative rounded-2xl overflow-hidden bg-baume-charcoal aspect-[4/3] w-full">
				<video
					ref={videoRef}
					className="w-full h-full object-cover"
					muted
					playsInline
				/>

				{/* Overlay de visée */}
				{!loading && !error && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div className="relative w-56 h-40">
							{/* Coins */}
							<div
								className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-baume-ivory rounded-tl-lg"
								style={{ borderWidth: 3 }}
							/>
							<div
								className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-baume-ivory rounded-tr-lg"
								style={{ borderWidth: 3 }}
							/>
							<div
								className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-baume-ivory rounded-bl-lg"
								style={{ borderWidth: 3 }}
							/>
							<div
								className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-baume-ivory rounded-br-lg"
								style={{ borderWidth: 3 }}
							/>

							{/* Ligne de scan animée */}
							<div className="absolute inset-x-2 top-1/2 h-0.5 bg-baume-burgundy/80 animate-pulse" />
						</div>
					</div>
				)}

				{/* Loading */}
				{loading && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-baume-charcoal/80">
						<Loader2 className="h-8 w-8 text-baume-ivory animate-spin mb-3" />
						<p className="text-baume-ivory text-[13px]">
							Activation de la caméra...
						</p>
					</div>
				)}

				{/* Erreur */}
				{error && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-baume-charcoal/90 px-6 text-center">
						<CameraOff className="h-10 w-10 text-red-400 mb-3" />
						<p className="text-baume-ivory text-[13px] mb-4">{error}</p>
						<button
							onClick={() => startScanner(selectedCamera)}
							className="h-9 px-4 rounded-full bg-baume-burgundy text-white text-[12px] font-semibold inline-flex items-center gap-2"
						>
							<RefreshCw className="h-3.5 w-3.5" /> Réessayer
						</button>
					</div>
				)}

				{/* Dernier scan */}
				{lastScan && !loading && !error && (
					<div className="absolute bottom-3 left-3 right-3 bg-baume-charcoal/80 rounded-xl px-3 py-2 text-center">
						<p className="text-[11px] text-baume-ivory/60 uppercase tracking-wider">
							Scanné
						</p>
						<p className="text-[13px] text-baume-ivory font-mono font-bold">
							{lastScan}
						</p>
					</div>
				)}
			</div>

			{/* Sélecteur de caméra */}
			{cameras.length > 1 && (
				<div className="mt-3 flex items-center gap-2">
					<Camera className="h-4 w-4 text-baume-charcoal/50 shrink-0" />
					<select
						value={selectedCamera || ""}
						onChange={(e) => setSelectedCamera(e.target.value)}
						className="flex-1 h-9 rounded-xl border border-baume-border bg-baume-white px-3 text-[13px] text-baume-charcoal"
					>
						{cameras.map((cam) => (
							<option key={cam.deviceId} value={cam.deviceId}>
								{cam.label || `Caméra ${cam.deviceId.slice(0, 8)}`}
							</option>
						))}
					</select>
				</div>
			)}
		</div>
	);
}
