import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export default function Breadcrumb({ items = [] }) {
	return (
		<nav
			aria-label="Fil d'Ariane"
			className="text-[13px] text-baume-charcoal/60"
		>
			<ol className="flex items-center flex-wrap gap-1.5">
				<li>
					<Link
						to="/"
						className="inline-flex items-center gap-1 hover:text-baume-burgundy"
					>
						<Home className="h-3.5 w-3.5" /> Accueil
					</Link>
				</li>
				{items.map((it, i) => (
					<li key={i} className="inline-flex items-center gap-1.5">
						<ChevronRight className="h-3 w-3" />
						{it.to ? (
							<Link to={it.to} className="hover:text-baume-burgundy">
								{it.label}
							</Link>
						) : (
							<span className="text-baume-charcoal/80 font-medium">
								{it.label}
							</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
