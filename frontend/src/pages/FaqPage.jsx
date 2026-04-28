import React, { useState } from "react";
import Breadcrumb from "../components/Breadcrumb";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { Input } from "../components/ui/input";
import { FAQ_ITEMS } from "../lib/constants";
import { Search } from "lucide-react";

export default function FaqPage() {
	const [query, setQuery] = useState("");
	const filtered = FAQ_ITEMS.filter(
		(f) =>
			f.q.toLowerCase().includes(query.toLowerCase()) ||
			f.a.toLowerCase().includes(query.toLowerCase()),
	);

	return (
		<div data-testid="faq-page" className="bg-baume-ivory">
			<div className="baume-container pt-8">
				<Breadcrumb items={[{ label: "FAQ" }]} />
			</div>
			<div className="baume-container py-10 md:py-14 max-w-[720px]">
				<p className="text-[12px] uppercase tracking-[0.2em] text-baume-burgundy font-semibold mb-3">
					Aide & informations
				</p>
				<h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.05] text-baume-charcoal">
					Questions fréquentes
				</h1>
				<p className="mt-5 text-[17px] leading-[28px] text-baume-charcoal/70">
					Livraison, retours, retrait, ateliers — toutes les réponses
					essentielles.
				</p>

				<div className="relative mt-10">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-baume-charcoal/50" />
					<Input
						data-testid="faq-search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Rechercher une question…"
						className="h-12 pl-11 rounded-full bg-baume-white border-baume-border focus-visible:ring-baume-burgundy"
					/>
				</div>
			</div>
			<div className="baume-container pb-24 max-w-[720px]">
				<Accordion type="single" collapsible className="space-y-3">
					{filtered.map((f, i) => (
						<AccordionItem
							key={i}
							value={`item-${i}`}
							className="bg-baume-white border border-baume-border rounded-2xl px-5"
						>
							<AccordionTrigger className="py-5 text-left font-editorial text-[20px] text-baume-charcoal hover:no-underline">
								{f.q}
							</AccordionTrigger>
							<AccordionContent className="pb-5 text-[15px] leading-[24px] text-baume-charcoal/80">
								{f.a}
							</AccordionContent>
						</AccordionItem>
					))}
					{filtered.length === 0 && (
						<div className="rounded-2xl border border-baume-border bg-baume-white p-8 text-center">
							<p className="text-[15px] text-baume-charcoal/70">
								Aucune question trouvée. Essayez un autre mot-clé.
							</p>
						</div>
					)}
				</Accordion>
			</div>
		</div>
	);
}
