import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import {
	getAdminTable,
	createAdminWorkshop,
	updateAdminWorkshop,
	formatApiError,
} from "../lib/api";

const emptyForm = {
	title: "",
	slug: "",
	description: "",
	expert_name: "",
	location: "Boutique Genève",
	starts_at: "",
	price: 0,
	currency: "CHF",
	capacity: 10,
	active: true,
};

export default function AdminWorkshopForm() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { user, status } = useAuth();

	const isEdit = Boolean(id);
	const isAdmin = user?.role === "admin";

	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(isEdit);
	const [saving, setSaving] = useState(false);

	const title = isEdit ? "Modifier l’atelier" : "Ajouter un atelier";

	useEffect(() => {
		if (!isEdit || status !== "authenticated" || !isAdmin) return;

		setLoading(true);

		getAdminTable("workshops", 500)
			.then((rows) => {
				const workshop = rows.find((w) => String(w.id) === String(id));

				if (!workshop) {
					toast.error("Atelier introuvable");
					navigate("/admin");
					return;
				}

				setForm({
					title: workshop.title || "",
					slug: workshop.slug || "",
					description: workshop.description || "",
					expert_name: workshop.expert_name || "",
					location: workshop.location || "Boutique Genève",
					starts_at: workshop.starts_at
						? toDatetimeLocal(workshop.starts_at)
						: "",
					price: Number(workshop.price || 0),
					currency: workshop.currency || "CHF",
					capacity: Number(workshop.capacity || 10),
					active: workshop.active !== false,
				});
			})
			.catch((err) => {
				toast.error("Erreur", { description: formatApiError(err) });
			})
			.finally(() => setLoading(false));
	}, [id, isEdit, status, isAdmin, navigate]);

	const placesLabel = useMemo(() => {
		const capacity = Number(form.capacity || 0);
		return capacity > 1 ? `${capacity} places` : `${capacity} place`;
	}, [form.capacity]);

	function updateField(name, value) {
		setForm((prev) => ({
			...prev,
			[name]: value,
			...(name === "title" && !isEdit ? { slug: slugify(value) } : {}),
		}));
	}

	async function handleSubmit(e) {
		e.preventDefault();

		if (!form.title.trim()) {
			toast.error("Le titre est obligatoire");
			return;
		}

		if (!form.slug.trim()) {
			toast.error("Le slug est obligatoire");
			return;
		}

		if (!form.starts_at) {
			toast.error("La date est obligatoire");
			return;
		}

		setSaving(true);

		try {
			const payload = {
				...form,
				price: Number(form.price || 0),
				capacity: Number(form.capacity || 1),
				starts_at: new Date(form.starts_at).toISOString(),
			};

			if (isEdit) {
				await updateAdminWorkshop(id, payload);
				toast.success("Atelier modifié");
			} else {
				await createAdminWorkshop(payload);
				toast.success("Atelier créé");
			}

			navigate("/admin");
		} catch (err) {
			toast.error("Enregistrement impossible", {
				description: formatApiError(err),
			});
		} finally {
			setSaving(false);
		}
	}

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-baume-ivory flex items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-baume-burgundy" />
			</div>
		);
	}

	if (status !== "authenticated") {
		return <Navigate to="/connexion?redirect=/admin" replace />;
	}

	if (!isAdmin) {
		return <Navigate to="/admin" replace />;
	}

	return (
		<div className="min-h-screen bg-baume-ivory">
			<div className="baume-container py-8">
				<Link
					to="/admin"
					className="inline-flex items-center gap-2 text-[14px] font-semibold text-baume-burgundy hover:text-baume-burgundyDark"
				>
					<ArrowLeft className="h-4 w-4" />
					Retour au dashboard
				</Link>

				<div className="mt-6 rounded-3xl border border-baume-border bg-baume-white p-6 md:p-8">
					<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
						Admin Baume
					</p>

					<h1 className="mt-3 font-editorial text-[40px] md:text-[54px] text-baume-charcoal leading-none">
						{title}
					</h1>

					<form onSubmit={handleSubmit} className="mt-8 grid gap-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
							<Field label="Titre">
								<input
									value={form.title}
									onChange={(e) => updateField("title", e.target.value)}
									className="input"
									placeholder="Découvrir la cup en douceur"
								/>
							</Field>

							<Field label="Slug">
								<input
									value={form.slug}
									onChange={(e) => updateField("slug", slugify(e.target.value))}
									className="input"
									placeholder="decouvrir-la-cup-en-douceur"
								/>
							</Field>

							<Field label="Experte">
								<input
									value={form.expert_name}
									onChange={(e) => updateField("expert_name", e.target.value)}
									className="input"
									placeholder="Laura Benoit"
								/>
							</Field>

							<Field label="Lieu">
								<input
									value={form.location}
									onChange={(e) => updateField("location", e.target.value)}
									className="input"
									placeholder="Boutique Genève"
								/>
							</Field>

							<Field label="Date et heure">
								<input
									type="datetime-local"
									value={form.starts_at}
									onChange={(e) => updateField("starts_at", e.target.value)}
									className="input"
								/>
							</Field>

							<Field label="Prix">
								<div className="grid grid-cols-[1fr_100px] gap-3">
									<input
										type="number"
										min="0"
										step="0.01"
										value={form.price}
										onChange={(e) => updateField("price", e.target.value)}
										className="input"
									/>

									<select
										value={form.currency}
										onChange={(e) => updateField("currency", e.target.value)}
										className="input"
									>
										<option value="CHF">CHF</option>
										<option value="EUR">EUR</option>
									</select>
								</div>
							</Field>

							<Field label={`Capacité (${placesLabel})`}>
								<input
									type="number"
									min="1"
									value={form.capacity}
									onChange={(e) => updateField("capacity", e.target.value)}
									className="input"
								/>
							</Field>

							<Field label="Statut">
								<label className="h-12 px-4 rounded-2xl border border-baume-border bg-baume-ivory/40 flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={form.active}
										onChange={(e) => updateField("active", e.target.checked)}
									/>
									<span className="text-[14px] font-semibold text-baume-charcoal">
										Atelier actif / visible
									</span>
								</label>
							</Field>
						</div>

						<Field label="Description">
							<textarea
								value={form.description}
								onChange={(e) => updateField("description", e.target.value)}
								className="input min-h-[140px] py-3 resize-y"
								placeholder="Atelier pratique : pliages, insertion, entretien, questions réponses."
							/>
						</Field>

						<div className="flex flex-col sm:flex-row gap-3 sm:justify-end border-t border-baume-border pt-6">
							<Link
								to="/admin"
								className="h-11 px-5 rounded-full border border-baume-border text-baume-charcoal font-semibold inline-flex items-center justify-center hover:bg-baume-ivory"
							>
								Annuler
							</Link>

							<button
								type="submit"
								disabled={saving}
								className="h-11 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark disabled:opacity-60"
							>
								{saving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
								{isEdit ? "Enregistrer" : "Créer l’atelier"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}

function Field({ label, children }) {
	return (
		<label className="grid gap-2">
			<span className="text-[13px] font-semibold text-baume-charcoal/75">
				{label}
			</span>
			{children}
		</label>
	);
}

function slugify(value) {
	return String(value || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toDatetimeLocal(value) {
	const date = new Date(value);
	const offset = date.getTimezoneOffset();
	const localDate = new Date(date.getTime() - offset * 60 * 1000);
	return localDate.toISOString().slice(0, 16);
}
