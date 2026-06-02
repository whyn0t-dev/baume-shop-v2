import React, { useState } from "react";
import Breadcrumb from "../components/Breadcrumb";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { submitContact } from "../lib/api";
import { MapPin, Mail, Phone, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { hasConsent, resetConsent } from "../lib/consent";

const TOPICS = [
	"Conseil produit",
	"Suivi de commande",
	"Retour / Retrait boutique",
	"Atelier / Événement",
	"Partenariat / Presse",
	"Autre",
];

export default function ContactPage() {
	const [functionalConsent, setFunctionalConsent] = useState(
		hasConsent("functional"),
	);
	const [form, setForm] = useState({
		name: "",
		email: "",
		subject: "",
		topic: TOPICS[0],
		message: "",
	});
	const [loading, setLoading] = useState(false);

	const onSubmit = async (e) => {
		e.preventDefault();
		if (!form.name || !form.email || !form.subject || !form.message) {
			toast.error("Veuillez remplir tous les champs");
			return;
		}
		setLoading(true);
		try {
			const res = await submitContact(form);
			toast.success("Message envoyé", { description: res.message });
			setForm({
				name: "",
				email: "",
				subject: "",
				topic: TOPICS[0],
				message: "",
			});
		} catch (err) {
			toast.error("Erreur", {
				description: err?.response?.data?.detail || err.message,
			});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const handler = (e) => {
			setFunctionalConsent(e.detail?.functional === true);
		};
		window.addEventListener("baume:consent", handler);
		return () => window.removeEventListener("baume:consent", handler);
	}, []);

	return (
		<div data-testid="contact-page" className="bg-baume-ivory">
			<div className="baume-container pt-8">
				<Breadcrumb items={[{ label: "Contact" }]} />
			</div>
			<div className="baume-container py-10 md:py-14">
				<h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05] text-baume-charcoal max-w-[720px]">
					Parlez-nous de votre besoin,{" "}
					<span className="italic text-baume-burgundy">
						on vous répond avec douceur
					</span>{" "}
					et précision.
				</h1>
			</div>

			<div className="baume-container pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10">
				<div className="lg:col-span-5 space-y-6">
					<div className="bg-baume-white border border-baume-border rounded-2xl p-6">
						<p className="font-editorial text-[22px] text-baume-charcoal mb-5">
							Moyens de nous joindre
						</p>
						<ul className="space-y-4 text-[14px]">
							<li className="flex gap-3">
								<MapPin className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
								<div>
									<p className="font-semibold text-baume-charcoal">
										Boutique Genève
									</p>
									<p className="text-baume-charcoal/70">
										Rue du Rhône 15, 1204 Genève
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<Clock className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
								<div>
									<p className="font-semibold text-baume-charcoal">Horaires</p>
									<p className="text-baume-charcoal/70">
										Mardi – Samedi · 10h – 19h
									</p>
									<p className="text-baume-charcoal/70">
										Dimanche & Lundi · fermé
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<Mail className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
								<div>
									<p className="font-semibold text-baume-charcoal">Email</p>
									<a
										href="mailto:bonjour@baume-shop.com"
										className="text-baume-burgundy baume-link"
									>
										bonjour@baume-shop.com
									</a>
								</div>
							</li>
							<li className="flex gap-3">
								<Phone className="h-5 w-5 text-baume-burgundy shrink-0 mt-0.5" />
								<div>
									<p className="font-semibold text-baume-charcoal">Téléphone</p>
									<p className="text-baume-charcoal/70">+41 22 000 00 00</p>
								</div>
							</li>
						</ul>
					</div>
					<div className="rounded-2xl overflow-hidden border border-baume-border aspect-[4/3]">
						{functionalConsent ? (
							<iframe
								title="Carte Baume Genève"
								src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2829.675550058614!2d6.155088776217653!3d46.20328038382383!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x478c65196573d253%3A0xe72e5048e03017b3!2sBaume%20Shop!5e1!3m2!1sfr!2sfr!4v1780391929312!5m2!1sfr!2sfr"
								className="w-full h-full"
								style={{ border: 0 }}
								allowFullScreen
								loading="lazy"
								referrerPolicy="no-referrer-when-downgrade"
							/>
						) : (
							<div className="w-full h-full flex flex-col items-center justify-center bg-baume-ivory gap-4 p-8 text-center">
								<MapPin className="h-8 w-8 text-baume-charcoal/30" />
								<p className="text-[14px] font-semibold text-baume-charcoal">
									Carte non disponible
								</p>
								<p className="text-[13px] text-baume-charcoal/55 max-w-[240px]">
									Acceptez les cookies fonctionnels pour afficher la carte
									Google Maps.
								</p>
								<button
									onClick={resetConsent}
									className="h-9 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold hover:bg-baume-burgundyDark transition"
								>
									Gérer mes cookies
								</button>
							</div>
						)}
					</div>
				</div>

				<div className="lg:col-span-7">
					<form
						data-testid="contact-form"
						onSubmit={onSubmit}
						className="bg-baume-white border border-baume-border rounded-2xl p-6 md:p-8 space-y-4"
					>
						<p className="font-editorial text-[24px] text-baume-charcoal">
							Envoyer un message
						</p>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="name">Nom</Label>
								<Input
									id="name"
									data-testid="contact-name"
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									className="mt-1.5 h-12 rounded-lg border-baume-border focus-visible:ring-baume-burgundy"
								/>
							</div>
							<div>
								<Label htmlFor="c-email">Email</Label>
								<Input
									id="c-email"
									type="email"
									data-testid="contact-email"
									value={form.email}
									onChange={(e) => setForm({ ...form, email: e.target.value })}
									className="mt-1.5 h-12 rounded-lg border-baume-border focus-visible:ring-baume-burgundy"
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="topic">Motif</Label>
							<Select
								value={form.topic}
								onValueChange={(v) => setForm({ ...form, topic: v })}
							>
								<SelectTrigger
									id="topic"
									data-testid="contact-topic"
									className="mt-1.5 h-12 rounded-lg border-baume-border"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TOPICS.map((t) => (
										<SelectItem key={t} value={t}>
											{t}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="subject">Sujet</Label>
							<Input
								id="subject"
								data-testid="contact-subject"
								value={form.subject}
								onChange={(e) => setForm({ ...form, subject: e.target.value })}
								className="mt-1.5 h-12 rounded-lg border-baume-border focus-visible:ring-baume-burgundy"
							/>
						</div>

						<div>
							<Label htmlFor="message">Message</Label>
							<Textarea
								id="message"
								data-testid="contact-message"
								value={form.message}
								onChange={(e) => setForm({ ...form, message: e.target.value })}
								rows={6}
								className="mt-1.5 rounded-lg border-baume-border focus-visible:ring-baume-burgundy"
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							data-testid="contact-submit"
							className="h-12 px-8 inline-flex items-center gap-2 rounded-full bg-baume-burgundy text-baume-white font-semibold text-[15px] hover:bg-baume-burgundyDark disabled:opacity-60"
						>
							{loading && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer
							le message
						</button>
						<p className="text-[12px] text-baume-charcoal/60">
							Nous vous répondons sous 24 h ouvrées.
						</p>
					</form>
				</div>
			</div>
		</div>
	);
}
