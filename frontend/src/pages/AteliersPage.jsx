import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import ExpertCard from "../components/ExpertCard";
import { getExperts, getWorkshops, createWorkshopBooking } from "../lib/api";
import { Calendar, MapPin, Clock } from "lucide-react";

export default function AteliersPage() {
	const [selectedWorkshop, setSelectedWorkshop] = useState(null);
	const [experts, setExperts] = useState([]);
	const [workshops, setWorkshops] = useState([]);

	const [paymentPopup, setPaymentPopup] = useState(null);

	const location = useLocation();

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const bookingStatus = params.get("booking_status");

		if (!bookingStatus) return;

		if (bookingStatus === "free_success") {
			setPaymentPopup({
				type: "success",
				title: "Réservation confirmée",
				message:
					"Votre place gratuite a bien été réservée. Vous recevrez un email de confirmation.",
			});
		}

		if (bookingStatus === "success") {
			setPaymentPopup({
				type: "success",
				title: "Paiement confirmé",
				message:
					"Votre place a bien été réservée. Vous recevrez un email de confirmation.",
			});
		}

		if (bookingStatus === "failed") {
			setPaymentPopup({
				type: "failed",
				title: "Paiement non finalisé",
				message:
					"Votre paiement a été annulé ou refusé. Vous pouvez réessayer votre réservation.",
			});
		}

		getWorkshops()
			.then(setWorkshops)
			.catch(() => {});

		window.history.replaceState({}, "", "/ateliers");
	}, [location.search]);

	useEffect(() => {
		function handleFreeSuccess() {
			setPaymentPopup({
				type: "success",
				title: "Réservation confirmée",
				message:
					"Votre place gratuite a bien été réservée. Vous recevrez un email de confirmation.",
			});

			getWorkshops()
				.then(setWorkshops)
				.catch(() => {});

			window.history.replaceState({}, "", "/ateliers");
		}

		window.addEventListener("workshop-booking-free-success", handleFreeSuccess);

		return () => {
			window.removeEventListener(
				"workshop-booking-free-success",
				handleFreeSuccess,
			);
		};
	}, []);

	useEffect(() => {
		getExperts()
			.then(setExperts)
			.catch(() => {});
		getWorkshops()
			.then(setWorkshops)
			.catch(() => {});
	}, []);

	return (
		<div data-testid="ateliers-page" className="bg-baume-ivory">
			<div className="baume-container pt-8">
				<Breadcrumb items={[{ label: "Ateliers & experts" }]} />
			</div>

			<div className="baume-container py-10 md:py-14">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Rencontres mensuelles
				</p>
				<h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05] text-baume-charcoal max-w-[720px]">
					Nos expertes vous répondent,{" "}
					<span className="italic">en boutique</span>.
				</h1>
				<p className="mt-5 text-[17px] leading-[28px] text-baume-charcoal/70 max-w-[640px]">
					Ateliers petits groupes, conversations honnêtes, experts disponibles.
					Réservation requise.
				</p>
			</div>

			<section className="baume-container pb-16">
				<h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-8">
					Prochains ateliers
				</h2>

				{workshops.length === 0 ? (
					<p className="text-baume-charcoal/60">
						Aucun atelier disponible pour le moment.
					</p>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
						{workshops.map((w) => {
							const spotsLeft =
								Number(w.capacity || 0) - Number(w.reserved_count || 0);

							const price =
								Number(w.price || 0) <= 0
									? "Gratuit"
									: `${Number(w.price).toFixed(2)} ${w.currency || "CHF"}`;

							return (
								<article
									key={w.id}
									className="bg-baume-white border border-baume-border rounded-2xl p-6 flex flex-col gap-3"
								>
									<span className="text-[12px] uppercase tracking-[0.15em] text-baume-burgundy font-semibold">
										{price}
									</span>

									<h3 className="font-editorial text-[22px] leading-[28px] text-baume-charcoal">
										{w.title}
									</h3>

									<p className="text-[14px] leading-[22px] text-baume-charcoal/75">
										{w.description}
									</p>

									<div className="mt-auto pt-3 text-[13px] text-baume-charcoal/70 border-t border-baume-border space-y-1.5">
										<p className="inline-flex items-center gap-1.5">
											<Calendar className="h-4 w-4 text-baume-burgundy" />
											{w.starts_at
												? new Date(w.starts_at).toLocaleString("fr-CH")
												: "Date à venir"}
										</p>

										<p className="inline-flex items-center gap-1.5">
											<MapPin className="h-4 w-4 text-baume-burgundy" />
											{w.location || "Boutique Genève"}
										</p>

										<p className="inline-flex items-center gap-1.5">
											<Clock className="h-4 w-4 text-baume-burgundy" />
											{spotsLeft > 0
												? `${spotsLeft} places restantes`
												: "Complet"}
										</p>

										<p className="text-baume-charcoal/60">
											Animé par {w.expert_name || "l’équipe Baume"}
										</p>
									</div>

									<button
										type="button"
										disabled={spotsLeft <= 0}
										onClick={() => setSelectedWorkshop(w)}
										className={`h-10 px-5 inline-flex items-center justify-center rounded-full text-[13px] font-semibold ${
											spotsLeft > 0
												? "bg-baume-burgundy text-baume-white"
												: "bg-baume-border text-baume-charcoal/50 cursor-not-allowed"
										}`}
									>
										{spotsLeft > 0 ? "Réserver ma place" : "Complet"}
									</button>
								</article>
							);
						})}
					</div>
				)}
			</section>

			<section className="bg-baume-white border-y border-baume-border">
				<div className="baume-container py-16 md:py-20">
					<h2 className="font-editorial text-[28px] md:text-[36px] text-baume-charcoal mb-8">
						Notre équipe d'expertes
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
						{experts.map((e) => (
							<ExpertCard key={e.id} expert={e} />
						))}
					</div>
				</div>
			</section>
			{selectedWorkshop && (
				<WorkshopBookingModal
					workshop={selectedWorkshop}
					onClose={() => setSelectedWorkshop(null)}
				/>
			)}
			{paymentPopup && (
				<PaymentStatusModal
					popup={paymentPopup}
					onClose={() => setPaymentPopup(null)}
				/>
			)}
		</div>
	);
}

function PaymentStatusModal({ popup, onClose }) {
	const isSuccess = popup.type === "success";

	return (
		<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
			<div className="w-full max-w-[460px] rounded-3xl bg-baume-white border border-baume-border shadow-2xl p-6 md:p-8 text-center">
				<div
					className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center text-white text-[22px] ${
						isSuccess ? "bg-baume-burgundy" : "bg-red-700"
					}`}
				>
					{isSuccess ? "✓" : "!"}
				</div>

				<h2 className="mt-5 font-editorial text-[32px] text-baume-charcoal">
					{popup.title}
				</h2>

				<p className="mt-3 text-[15px] leading-6 text-baume-charcoal/70">
					{popup.message}
				</p>

				<button
					type="button"
					onClick={onClose}
					className="mt-6 h-11 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold hover:bg-baume-burgundyDark"
				>
					{isSuccess ? "Parfait" : "Réessayer"}
				</button>
			</div>
		</div>
	);
}

function WorkshopBookingModal({ workshop, onClose }) {
	const [form, setForm] = useState({
		first_name: "",
		last_name: "",
		email: "",
		phone: "",
		quantity: 1,
	});

	const [loading, setLoading] = useState(false);

	const spotsLeft =
		Number(workshop.capacity || 0) - Number(workshop.reserved_count || 0);

	const price =
		Number(workshop.price || 0) <= 0
			? "Gratuit"
			: `${Number(workshop.price).toFixed(2)} ${workshop.currency || "CHF"}`;

	function updateField(name, value) {
		setForm((prev) => ({ ...prev, [name]: value }));
	}

	async function handleSubmit(e) {
		e.preventDefault();

		setLoading(true);

		try {
			const data = await createWorkshopBooking({
				workshop_id: workshop.id,
				first_name: form.first_name,
				last_name: form.last_name,
				email: form.email,
				phone: form.phone,
				quantity: Number(form.quantity || 1),
				origin_url: window.location.origin,
			});

			if (data.url) {
				window.location.href = data.url;
				return;
			}

			// Cas atelier gratuit
			onClose();

			window.dispatchEvent(new Event("workshop-booking-free-success"));
		} catch (err) {
			alert(
				err?.response?.data?.detail || err.message || "Réservation impossible",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
			<div className="w-full max-w-[560px] rounded-3xl bg-baume-white border border-baume-border shadow-2xl p-6 md:p-8 relative">
				<button
					type="button"
					onClick={onClose}
					className="absolute right-5 top-5 text-baume-charcoal/50 hover:text-baume-charcoal"
				>
					✕
				</button>

				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Réservation atelier
				</p>

				<h2 className="font-editorial text-[32px] leading-tight text-baume-charcoal pr-8">
					{workshop.title}
				</h2>

				<div className="mt-4 text-[14px] text-baume-charcoal/70 space-y-1">
					<p>{price}</p>
					<p>
						{workshop.starts_at
							? new Date(workshop.starts_at).toLocaleString("fr-CH")
							: "Date à venir"}
					</p>
					<p>
						{spotsLeft} place{spotsLeft > 1 ? "s" : ""} restante
						{spotsLeft > 1 ? "s" : ""}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="mt-6 grid gap-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<input
							required
							value={form.first_name}
							onChange={(e) => updateField("first_name", e.target.value)}
							placeholder="Prénom"
							className="h-11 rounded-full border border-baume-border px-4 bg-baume-ivory/30"
						/>

						<input
							required
							value={form.last_name}
							onChange={(e) => updateField("last_name", e.target.value)}
							placeholder="Nom"
							className="h-11 rounded-full border border-baume-border px-4 bg-baume-ivory/30"
						/>
					</div>

					<input
						required
						type="email"
						value={form.email}
						onChange={(e) => updateField("email", e.target.value)}
						placeholder="Email"
						className="h-11 rounded-full border border-baume-border px-4 bg-baume-ivory/30"
					/>

					<input
						value={form.phone}
						onChange={(e) => updateField("phone", e.target.value)}
						placeholder="Téléphone"
						className="h-11 rounded-full border border-baume-border px-4 bg-baume-ivory/30"
					/>

					<input
						required
						type="number"
						min="1"
						max={spotsLeft}
						value={form.quantity}
						onChange={(e) => updateField("quantity", e.target.value)}
						placeholder="Nombre de places"
						className="h-11 rounded-full border border-baume-border px-4 bg-baume-ivory/30"
					/>

					<button
						type="submit"
						disabled={loading || spotsLeft <= 0}
						className="h-11 rounded-full bg-baume-burgundy text-baume-white font-semibold hover:bg-baume-burgundyDark disabled:opacity-60"
					>
						{loading
							? "Réservation..."
							: Number(workshop.price || 0) > 0
								? "Payer et réserver"
								: "Confirmer ma réservation"}
					</button>
				</form>
			</div>
		</div>
	);
}
