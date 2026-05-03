import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	getAdminProductFull,
	updateAdminProduct,
	archiveAdminProduct,
	deleteAdminProduct,
	formatApiError,
	getProductBucketImages,
} from "../lib/api";

export default function AdminProductEdit() {
	const { productId } = useParams();
	const navigate = useNavigate();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [product, setProduct] = useState({});
	const [options, setOptions] = useState([]);
	const [variants, setVariants] = useState([]);
	const [images, setImages] = useState([]);
	const [selectedCollections, setSelectedCollections] = useState([]);

	const [bucketImages, setBucketImages] = useState([]);
	const [showImagePicker, setShowImagePicker] = useState(false);

	const loadProduct = useCallback(async () => {
		try {
			const data = await getAdminProductFull(productId);

			setProduct({
				title: data.title || "",
				name: data.name || "",
				slug: data.slug || "",
				description: data.description || "",
				vendor: data.vendor || "",
				product_type: data.product_type || "",
				product_category: data.product_category || "",
				status: data.status || "draft",
				seo_title: data.seo_title || "",
				seo_description: data.seo_description || "",
				available: data.available ?? true,
				tagline: data.tagline || "",
				stock: data.stock || 0,
				featured: data.featured ?? false,
				bestseller: data.bestseller ?? false,
				flux: data.flux || "",
				price: data.price || "",
				compare_price: data.compare_price || "",
				currency: data.currency || "CHF",
				image: data.image || "",
				rating: data.rating || 0,
				reviews_count: data.reviews_count || 0,
				composition: data.composition || "",
				usage: data.usage || "",
				how_to_use: data.how_to_use || "",
				fabrication: data.fabrication || "",
				colors: data.colors || [],
				sizes: data.sizes || [],
				benefits: data.benefits || [],
				gallery: data.gallery || [],
				needs: data.needs || [],
			});

			setVariants(data.variants || []);
			setOptions(data.options || []);
			setImages(data.images || []);
			setSelectedCollections(
				(data.product_collections || []).map((c) => c.collection_id),
			);
		} catch (err) {
			alert(formatApiError(err));
		} finally {
			setLoading(false);
		}
	}, [productId]);

	useEffect(() => {
		loadProduct();
	}, [loadProduct]);

	useEffect(() => {
		getProductBucketImages()
			.then(setBucketImages)
			.catch(() => setBucketImages([]));
	}, []);

	async function handleSubmit(e) {
		e.preventDefault();
		setSaving(true);

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
				options: options.filter((o) => o.name?.trim()),
				variants: variants
					.filter((v) => v.title?.trim())
					.map((v) => ({
						title: v.title,
						sku: v.sku || "",
						barcode: v.barcode || "",
						price: Number(v.price || 0),
						compare_at_price: v.compare_at_price
							? Number(v.compare_at_price)
							: null,
						cost_price: v.cost_price ? Number(v.cost_price) : null,
						weight_grams: Number(v.weight_grams || 0),
						option1: v.option1 || "",
						option2: v.option2 || "",
						option3: v.option3 || "",
						active: v.active ?? true,
					})),
				images: images
					.filter((img) => img.storage_path?.trim() || img.public_url?.trim())
					.sort((a, b) => Number(a.position || 1) - Number(b.position || 1)),
				collections: selectedCollections,
			};

			await updateAdminProduct(productId, payload);

			alert("Produit modifié avec succès !");
		} catch (err) {
			alert(formatApiError(err));
		} finally {
			setSaving(false);
		}
	}

	async function handleArchive() {
		if (!window.confirm("Archiver ce produit ?")) return;

		try {
			await archiveAdminProduct(productId);
			alert("Produit archivé.");
			navigate("/admin");
		} catch (err) {
			alert(formatApiError(err));
		}
	}

	async function handleDelete() {
		if (!window.confirm("Supprimer définitivement ce produit ?")) return;

		try {
			await deleteAdminProduct(productId);
			alert("Produit supprimé.");
			navigate("/admin");
		} catch (err) {
			alert(formatApiError(err));
		}
	}

	if (loading) return <p className="p-10">Chargement...</p>;

	return (
		<main className="min-h-screen bg-baume-ivory px-6 lg:px-10 py-10">
			<form
				onSubmit={handleSubmit}
				className="max-w-5xl mx-auto rounded-[28px] bg-baume-white border border-baume-border p-6 md:p-8 space-y-6"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
							Admin produit
						</p>
						<h1 className="mt-2 text-[38px] font-semibold text-baume-burgundy">
							Modifier le produit
						</h1>
					</div>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleArchive}
							className="h-11 px-5 rounded-full border border-baume-border font-semibold"
						>
							Archiver
						</button>
						<button
							type="button"
							onClick={handleDelete}
							className="h-11 px-5 rounded-full bg-red-100 text-red-800 font-semibold"
						>
							Supprimer
						</button>
					</div>
				</div>

				<section className="rounded-[24px] border border-baume-border bg-baume-ivory/40 p-5">
					<div className="flex items-center justify-between gap-4 mb-4">
						<h2 className="text-[22px] font-semibold text-baume-burgundy">
							Images du produit
						</h2>

						<button
							type="button"
							onClick={() => setShowImagePicker(true)}
							className="h-10 px-4 rounded-full border border-baume-border bg-baume-white text-[14px] font-semibold"
						>
							+ Ajouter une image
						</button>
					</div>

					{showImagePicker && (
						<div className="mt-6 rounded-[22px] border border-baume-border bg-baume-white p-5">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-[18px] font-semibold text-baume-burgundy">
									Choisir une image du bucket
								</h3>

								<button
									type="button"
									onClick={() => setShowImagePicker(false)}
									className="text-[14px] font-semibold text-baume-charcoal/60"
								>
									Fermer
								</button>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
								{bucketImages.map((img) => (
									<button
										key={img.storage_path}
										type="button"
										onClick={() => {
											setImages([
												...images,
												{
													storage_path: img.storage_path,
													public_url: img.public_url,
													alt_text: product.title || "",
													position: images.length + 1,
												},
											]);
											setShowImagePicker(false);
										}}
										className="rounded-2xl overflow-hidden border border-baume-border bg-baume-ivory hover:ring-2 hover:ring-baume-burgundy"
									>
										<img
											src={img.public_url}
											alt={img.name}
											className="h-32 w-full object-cover"
										/>
									</button>
								))}
							</div>
						</div>
					)}
				</section>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					<Input
						label="Titre"
						value={product.title || ""}
						onChange={(v) => setProduct({ ...product, title: v })}
					/>
					<Input
						label="Nom"
						value={product.name || ""}
						onChange={(v) => setProduct({ ...product, name: v })}
					/>
					<Input
						label="Slug"
						value={product.slug || ""}
						onChange={(v) => setProduct({ ...product, slug: v })}
					/>
					<Input
						label="Prix"
						type="number"
						value={product.price || ""}
						onChange={(v) => setProduct({ ...product, price: v })}
					/>
					<Input
						label="Stock"
						type="number"
						value={product.stock || ""}
						onChange={(v) => setProduct({ ...product, stock: v })}
					/>
					<Input
						label="Catégorie"
						value={product.product_category || ""}
						onChange={(v) => setProduct({ ...product, product_category: v })}
					/>
					<Input
						label="Image"
						value={product.image || ""}
						onChange={(v) => setProduct({ ...product, image: v })}
					/>
					<div className="md:col-span-2 rounded-[22px] border border-baume-border bg-baume-ivory/40 p-5">
						<div className="flex items-center justify-between gap-4 mb-4">
							<h3 className="text-[20px] font-semibold text-baume-burgundy">
								Ordre d’affichage des images
							</h3>
						</div>

						<div className="space-y-4">
							{images.length === 0 && (
								<p className="text-[14px] text-baume-charcoal/60">
									Aucune image dans la galerie.
								</p>
							)}

							{images.map((img, index) => (
								<div
									key={index}
									className="grid grid-cols-1 md:grid-cols-[90px_1fr_1fr_90px_auto] gap-3 items-end rounded-2xl border border-baume-border bg-baume-white p-4"
								>
									<div>
										<p className="mb-2 text-[13px] font-semibold text-baume-charcoal/70">
											Aperçu
										</p>

										{img.public_url || img.storage_path ? (
											<img
												src={img.public_url || img.storage_path}
												alt={img.alt_text || ""}
												className="h-[70px] w-[70px] rounded-xl object-cover border border-baume-border"
											/>
										) : (
											<div className="h-[70px] w-[70px] rounded-xl border border-baume-border bg-baume-ivory" />
										)}
									</div>

									<div>
										<p className="mb-2 text-[13px] font-semibold text-baume-charcoal/70">
											Image
										</p>
										<p className="h-12 rounded-2xl border border-baume-border bg-baume-ivory px-4 flex items-center text-[13px] text-baume-charcoal/60 truncate">
											{img.public_url || img.storage_path || "Image vide"}
										</p>
									</div>

									<Input
										label="Texte alternatif"
										value={img.alt_text || ""}
										onChange={(v) => {
											const next = [...images];
											next[index] = { ...next[index], alt_text: v };
											setImages(next);
										}}
									/>

									<Input
										label="Position"
										type="number"
										value={img.position || index + 1}
										onChange={(v) => {
											const next = [...images];
											next[index] = {
												...next[index],
												position: Number(v || index + 1),
											};
											setImages(next);
										}}
									/>

									<button
										type="button"
										onClick={() =>
											setImages(images.filter((_, i) => i !== index))
										}
										className="h-12 px-4 rounded-full bg-red-100 text-red-800 text-[13px] font-semibold hover:bg-red-200"
									>
										Supprimer
									</button>
								</div>
							))}
						</div>
					</div>
					<Input
						label="Statut"
						value={product.status || ""}
						onChange={(v) => setProduct({ ...product, status: v })}
					/>

					<Textarea
						label="Description"
						value={product.description || ""}
						onChange={(v) => setProduct({ ...product, description: v })}
						className="md:col-span-2"
					/>
				</div>

				<div className="flex justify-end">
					<button
						type="submit"
						disabled={saving}
						className="h-12 px-6 rounded-full bg-baume-burgundy text-baume-white font-semibold"
					>
						{saving ? "Enregistrement..." : "Enregistrer les modifications"}
					</button>
				</div>
			</form>
		</main>
	);

	function Input({ label, value, onChange, type = "text", className = "" }) {
		return (
			<label className={`block ${className}`}>
				<span className="block mb-2 text-[13px] font-semibold text-baume-charcoal/70">
					{label}
				</span>
				<input
					type={type}
					value={value}
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
}
