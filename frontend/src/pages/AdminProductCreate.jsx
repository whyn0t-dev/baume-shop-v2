import React, { useEffect, useState } from "react";
import { Plus, Trash2, Save, ImagePlus } from "lucide-react";
import { createAdminProduct, formatApiError } from "../lib/api";

const emptyVariant = {
	title: "",
	sku: "",
	barcode: "",
	price: "",
	compare_at_price: "",
	cost_price: "",
	weight_grams: 0,
	option1: "",
	option2: "",
	option3: "",
	active: true,
};

const emptyOption = {
	name: "",
	position: 1,
};

const emptyImage = {
	storage_path: "",
	public_url: "",
	alt_text: "",
	position: 1,
};

export default function AdminProductCreate() {
	const [loading, setLoading] = useState(false);
	const [collections, setCollections] = useState([]);
	const [selectedCollections, setSelectedCollections] = useState([]);

	const [product, setProduct] = useState({
		title: "",
		name: "",
		slug: "",
		description: "",
		vendor: "",
		product_type: "",
		product_category: "",
		status: "draft",
		seo_title: "",
		seo_description: "",
		available: true,
		tagline: "",
		stock: 0,
		featured: false,
		bestseller: false,
		flux: "",
		needs: [],
		preorder: false,
		preorder_shipping_date: "",
		preorder_message: "",
		price: "",
		compare_price: "",
		currency: "CHF",
		image: "",
		rating: 0,
		reviews_count: 0,
		composition: "",
		usage: "",
		how_to_use: "",
		fabrication: "",
		colors: [],
		sizes: [],
		benefits: [],
		gallery: [],
		needs: [],
	});

	const [options, setOptions] = useState([{ ...emptyOption }]);
	const [variants, setVariants] = useState([{ ...emptyVariant }]);
	const [images, setImages] = useState([{ ...emptyImage }]);

	useEffect(() => {
		loadCollections();
	}, []);

	async function loadCollections() {
		const { data, error } = await supabase
			.from("collections")
			.select("id, title, name, slug")
			.order("title", { ascending: true });

		if (!error) {
			setCollections(data || []);
		}
	}

	function updateProduct(field, value) {
		setProduct((current) => ({
			...current,
			[field]: value,
		}));
	}

	function generateSlug(value) {
		return value
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
	}

	function updateJsonField(field, value) {
		const items = value
			.split("\n")
			.map((item) => item.trim())
			.filter(Boolean);

		updateProduct(field, items);
	}

	function updateOption(index, field, value) {
		setOptions((current) =>
			current.map((option, i) =>
				i === index ? { ...option, [field]: value } : option,
			),
		);
	}

	function updateVariant(index, field, value) {
		setVariants((current) =>
			current.map((variant, i) =>
				i === index ? { ...variant, [field]: value } : variant,
			),
		);
	}

	function updateImage(index, field, value) {
		setImages((current) =>
			current.map((image, i) =>
				i === index ? { ...image, [field]: value } : image,
			),
		);
	}

	function toggleCollection(collectionId) {
		setSelectedCollections((current) =>
			current.includes(collectionId)
				? current.filter((id) => id !== collectionId)
				: [...current, collectionId],
		);
	}

	async function handleSubmit(e) {
		e.preventDefault();
		setLoading(true);

		try {
			const payload = {
				product: {
					...product,
					name: product.name || product.title,
					price: product.price ? Number(product.price) : null,
					compare_price: product.compare_price
						? Number(product.compare_price)
						: null,
					stock: Number(product.stock || 0),
					rating: Number(product.rating || 0),
					reviews_count: Number(product.reviews_count || 0),
				},
				options: options.filter((o) => o.name.trim()),
				variants: variants
					.filter((v) => v.title.trim())
					.map((v) => ({
						...v,
						price: Number(v.price || 0),
						compare_at_price: v.compare_at_price
							? Number(v.compare_at_price)
							: null,
						cost_price: v.cost_price ? Number(v.cost_price) : null,
						weight_grams: Number(v.weight_grams || 0),
					})),
				images: images.filter((img) => img.storage_path.trim()),
				collections: selectedCollections,
			};

			await createAdminProduct(payload);

			alert("Produit créé avec succès !");
		} catch (err) {
			console.error(err);
			alert(formatApiError(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="min-h-screen bg-baume-ivory px-6 lg:px-10 py-10">
			<form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-8">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
							Dashboard Admin
						</p>
						<h1 className="mt-2 text-[38px] md:text-[52px] font-semibold text-baume-burgundy leading-tight">
							Ajouter un produit
						</h1>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="h-12 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-baume-burgundyDark disabled:opacity-60"
					>
						<Save className="h-4 w-4" />
						{loading ? "Enregistrement..." : "Enregistrer le produit"}
					</button>
				</div>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<h2 className="text-[24px] font-semibold text-baume-burgundy mb-6">
						Informations principales
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						<Input
							label="Titre"
							value={product.title}
							onChange={(value) => {
								updateProduct("title", value);
								updateProduct("slug", generateSlug(value));
							}}
							required
						/>

						<Input
							label="Slug"
							value={product.slug}
							onChange={(value) => updateProduct("slug", value)}
							required
						/>

						<Input
							label="Nom affiché"
							value={product.name}
							onChange={(value) => updateProduct("name", value)}
						/>

						<Input
							label="Marque / Vendor"
							value={product.vendor}
							onChange={(value) => updateProduct("vendor", value)}
						/>

						<Input
							label="Type produit"
							value={product.product_type}
							onChange={(value) => updateProduct("product_type", value)}
						/>

						<Input
							label="Catégorie produit"
							value={product.product_category}
							onChange={(value) => updateProduct("product_category", value)}
						/>

						<Select
							label="Statut"
							value={product.status}
							onChange={(value) => updateProduct("status", value)}
							options={[
								{ label: "Brouillon", value: "draft" },
								{ label: "Publié", value: "published" },
								{ label: "Archivé", value: "archived" },
							]}
						/>

						<Input
							label="Image principale"
							value={product.image}
							onChange={(value) => updateProduct("image", value)}
							placeholder="/images/produit.webp"
						/>

						<Textarea
							label="Description"
							value={product.description}
							onChange={(value) => updateProduct("description", value)}
							className="md:col-span-2"
						/>

						<Input
							label="Phrase d’accroche"
							value={product.tagline}
							onChange={(value) => updateProduct("tagline", value)}
							className="md:col-span-2"
						/>
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<h2 className="text-[24px] font-semibold text-baume-burgundy mb-6">
						Prix, stock et visibilité
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-4 gap-5">
						<Input
							label="Prix"
							type="number"
							value={product.price}
							onChange={(value) => updateProduct("price", value)}
						/>

						<Input
							label="Prix comparé"
							type="number"
							value={product.compare_price}
							onChange={(value) => updateProduct("compare_price", value)}
						/>

						<Input
							label="Devise"
							value={product.currency}
							onChange={(value) => updateProduct("currency", value)}
						/>

						<Input
							label="Stock"
							type="number"
							value={product.stock}
							onChange={(value) => updateProduct("stock", value)}
						/>

						<Checkbox
							label="Disponible"
							checked={product.available}
							onChange={(value) => updateProduct("available", value)}
						/>

						<Checkbox
							label="Mis en avant"
							checked={product.featured}
							onChange={(value) => updateProduct("featured", value)}
						/>

						<Checkbox
							label="Bestseller"
							checked={product.bestseller}
							onChange={(value) => updateProduct("bestseller", value)}
						/>
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<h2 className="text-[24px] font-semibold text-baume-burgundy mb-6">
						Détails produit
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						<Textarea
							label="Composition"
							value={product.composition}
							onChange={(value) => updateProduct("composition", value)}
						/>

						<Textarea
							label="Utilisation"
							value={product.usage}
							onChange={(value) => updateProduct("usage", value)}
						/>

						<Textarea
							label="Comment utiliser"
							value={product.how_to_use}
							onChange={(value) => updateProduct("how_to_use", value)}
						/>

						<Textarea
							label="Fabrication"
							value={product.fabrication}
							onChange={(value) => updateProduct("fabrication", value)}
						/>

						<Textarea
							label="Bénéfices — un par ligne"
							onChange={(value) => updateJsonField("benefits", value)}
						/>

						<Textarea
							label="Besoins — un par ligne"
							onChange={(value) => updateJsonField("needs", value)}
						/>

						<Textarea
							label="Couleurs — une par ligne"
							onChange={(value) => updateJsonField("colors", value)}
						/>

						<Textarea
							label="Tailles — une par ligne"
							onChange={(value) => updateJsonField("sizes", value)}
						/>

						<Textarea
							label="Galerie — une URL par ligne"
							onChange={(value) => updateJsonField("gallery", value)}
							className="md:col-span-2"
						/>
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-[24px] font-semibold text-baume-burgundy">
							Options
						</h2>

						<button
							type="button"
							onClick={() =>
								setOptions([
									...options,
									{ ...emptyOption, position: options.length + 1 },
								])
							}
							className="h-10 px-4 rounded-full border border-baume-border font-semibold inline-flex items-center gap-2"
						>
							<Plus className="h-4 w-4" />
							Ajouter
						</button>
					</div>

					<div className="space-y-4">
						{options.map((option, index) => (
							<div
								key={index}
								className="grid grid-cols-1 md:grid-cols-[1fr_120px_44px] gap-4"
							>
								<Input
									label="Nom option"
									value={option.name}
									onChange={(value) => updateOption(index, "name", value)}
									placeholder="Taille, Couleur..."
								/>

								<Input
									label="Position"
									type="number"
									value={option.position}
									onChange={(value) => updateOption(index, "position", value)}
								/>

								<RemoveButton
									onClick={() =>
										setOptions(options.filter((_, i) => i !== index))
									}
								/>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-[24px] font-semibold text-baume-burgundy">
							Variantes
						</h2>

						<button
							type="button"
							onClick={() => setVariants([...variants, { ...emptyVariant }])}
							className="h-10 px-4 rounded-full border border-baume-border font-semibold inline-flex items-center gap-2"
						>
							<Plus className="h-4 w-4" />
							Ajouter
						</button>
					</div>

					<div className="space-y-6">
						{variants.map((variant, index) => (
							<div
								key={index}
								className="rounded-[22px] border border-baume-border p-5"
							>
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<Input
										label="Titre"
										value={variant.title}
										onChange={(v) => updateVariant(index, "title", v)}
									/>
									<Input
										label="SKU"
										value={variant.sku}
										onChange={(v) => updateVariant(index, "sku", v)}
									/>
									<Input
										label="Code-barres"
										value={variant.barcode}
										onChange={(v) => updateVariant(index, "barcode", v)}
									/>
									<Input
										label="Prix"
										type="number"
										value={variant.price}
										onChange={(v) => updateVariant(index, "price", v)}
									/>

									<Input
										label="Prix comparé"
										type="number"
										value={variant.compare_at_price}
										onChange={(v) =>
											updateVariant(index, "compare_at_price", v)
										}
									/>
									<Input
										label="Prix coûtant"
										type="number"
										value={variant.cost_price}
										onChange={(v) => updateVariant(index, "cost_price", v)}
									/>
									<Input
										label="Poids grammes"
										type="number"
										value={variant.weight_grams}
										onChange={(v) => updateVariant(index, "weight_grams", v)}
									/>
									<Input
										label="Option 1"
										value={variant.option1}
										onChange={(v) => updateVariant(index, "option1", v)}
									/>

									<Input
										label="Option 2"
										value={variant.option2}
										onChange={(v) => updateVariant(index, "option2", v)}
									/>
									<Input
										label="Option 3"
										value={variant.option3}
										onChange={(v) => updateVariant(index, "option3", v)}
									/>

									<Checkbox
										label="Active"
										checked={variant.active}
										onChange={(value) => updateVariant(index, "active", value)}
									/>

									<RemoveButton
										onClick={() =>
											setVariants(variants.filter((_, i) => i !== index))
										}
									/>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-[24px] font-semibold text-baume-burgundy">
							Images produit
						</h2>

						<button
							type="button"
							onClick={() =>
								setImages([
									...images,
									{ ...emptyImage, position: images.length + 1 },
								])
							}
							className="h-10 px-4 rounded-full border border-baume-border font-semibold inline-flex items-center gap-2"
						>
							<ImagePlus className="h-4 w-4" />
							Ajouter
						</button>
					</div>

					<div className="space-y-4">
						{images.map((image, index) => (
							<div
								key={index}
								className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_100px_44px] gap-4"
							>
								<Input
									label="Storage path"
									value={image.storage_path}
									onChange={(v) => updateImage(index, "storage_path", v)}
								/>
								<Input
									label="URL publique"
									value={image.public_url}
									onChange={(v) => updateImage(index, "public_url", v)}
								/>
								<Input
									label="Alt text"
									value={image.alt_text}
									onChange={(v) => updateImage(index, "alt_text", v)}
								/>
								<Input
									label="Position"
									type="number"
									value={image.position}
									onChange={(v) => updateImage(index, "position", v)}
								/>
								<RemoveButton
									onClick={() =>
										setImages(images.filter((_, i) => i !== index))
									}
								/>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-burgundy/20 bg-baume-burgundy/5 p-6 md:p-8">
					<h2 className="text-[24px] font-semibold text-baume-burgundy mb-6">
						Pré-commande
					</h2>

					<div className="space-y-4">
						<Checkbox
							label="Activer la pré-commande"
							checked={product.preorder}
							onChange={(value) => updateProduct("preorder", value)}
						/>

						{product.preorder && (
							<>
								<Input
									label="Date d'expédition estimée"
									type="date"
									value={product.preorder_shipping_date}
									onChange={(value) =>
										updateProduct("preorder_shipping_date", value)
									}
								/>
								<Textarea
									label="Message affiché sur la page produit"
									value={product.preorder_message}
									onChange={(value) => updateProduct("preorder_message", value)}
									className="md:col-span-2"
								/>
							</>
						)}
					</div>
				</section>

				<section className="rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8">
					<h2 className="text-[24px] font-semibold text-baume-burgundy mb-6">
						Collections
					</h2>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
						{collections.map((collection) => (
							<label
								key={collection.id}
								className="rounded-2xl border border-baume-border px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-baume-ivory"
							>
								<input
									type="checkbox"
									checked={selectedCollections.includes(collection.id)}
									onChange={() => toggleCollection(collection.id)}
								/>
								<span className="text-[14px] font-semibold">
									{collection.title || collection.name || collection.slug}
								</span>
							</label>
						))}
					</div>
				</section>
			</form>
		</main>
	);
}

function Input({
	label,
	value,
	onChange,
	type = "text",
	required,
	placeholder,
	className = "",
}) {
	return (
		<label className={`block ${className}`}>
			<span className="block mb-2 text-[13px] font-semibold text-baume-charcoal/70">
				{label}
			</span>
			<input
				type={type}
				value={value}
				required={required}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
				className="h-12 w-full rounded-2xl border border-baume-border bg-baume-white px-4 text-[14px] outline-none focus:ring-2 focus:ring-baume-taupe"
			/>
		</label>
	);
}

function Textarea({ label, value, onChange, className = "" }) {
	return (
		<label className={`block ${className}`}>
			<span className="block mb-2 text-[13px] font-semibold text-baume-charcoal/70">
				{label}
			</span>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={5}
				className="w-full rounded-2xl border border-baume-border bg-baume-white px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-baume-taupe resize-none"
			/>
		</label>
	);
}

function Select({ label, value, onChange, options }) {
	return (
		<label className="block">
			<span className="block mb-2 text-[13px] font-semibold text-baume-charcoal/70">
				{label}
			</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-12 w-full rounded-2xl border border-baume-border bg-baume-white px-4 text-[14px] outline-none focus:ring-2 focus:ring-baume-taupe"
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}

function Checkbox({ label, checked, onChange }) {
	return (
		<label className="h-12 rounded-2xl border border-baume-border px-4 flex items-center gap-3 cursor-pointer">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<span className="text-[14px] font-semibold text-baume-charcoal/70">
				{label}
			</span>
		</label>
	);
}

function RemoveButton({ onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="h-12 w-12 mt-7 rounded-full border border-baume-border text-baume-burgundy inline-flex items-center justify-center hover:bg-baume-ivory"
		>
			<Trash2 className="h-4 w-4" />
		</button>
	);
}
