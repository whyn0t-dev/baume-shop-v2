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
					title: product.title,
					name: product.name || product.title,
					slug: product.slug,
					description: product.description,
					vendor: product.vendor,
					product_type: product.product_type,
					product_category: product.product_category,
					status: product.status,
					seo_title: product.seo_title,
					seo_description: product.seo_description,
					available: product.available,
					tagline: product.tagline,
					stock: Number(product.stock || 0),
					featured: product.featured,
					bestseller: product.bestseller,
					flux: product.flux,
					price: product.price ? Number(product.price) : null,
					compare_price: product.compare_price
						? Number(product.compare_price)
						: null,
					currency: product.currency || "CHF",
					image:
						images[0]?.public_url || images[0]?.storage_path || product.image,
					rating: Number(product.rating || 0),
					reviews_count: Number(product.reviews_count || 0),
					composition: product.composition,
					usage: product.usage,
					how_to_use: product.how_to_use,
					fabrication: product.fabrication,
					colors: product.colors || [],
					sizes: product.sizes || [],
					benefits: product.benefits || [],
					needs: product.needs || [],
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
					.map((img, index) => ({
						...img,
						position: index + 1,
					})),
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

				<section className="rounded-[28px] border border-baume-border bg-baume-ivory/45 p-6">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
						<div>
							<p className="text-[11px] uppercase tracking-[0.22em] text-baume-burgundy/70 font-semibold">
								Galerie
							</p>
							<h2 className="mt-1 text-[24px] font-semibold text-baume-burgundy">
								Images du produit
							</h2>
						</div>

						<button
							type="button"
							onClick={() => setShowImagePicker(true)}
							className="h-11 px-5 rounded-full bg-baume-white border border-baume-border text-[14px] font-semibold hover:border-baume-burgundy transition"
						>
							+ Ajouter une image
						</button>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{images.map((img, index) => {
							const src = img.public_url || img.storage_path;

							return (
								<div
									key={`${src}-${index}`}
									draggable
									onDragStart={(e) =>
										e.dataTransfer.setData("imageIndex", String(index))
									}
									onDragOver={(e) => e.preventDefault()}
									onDrop={(e) => {
										const fromIndex = Number(
											e.dataTransfer.getData("imageIndex"),
										);
										const toIndex = index;

										if (fromIndex === toIndex) return;

										const next = [...images];
										const [moved] = next.splice(fromIndex, 1);
										next.splice(toIndex, 0, moved);

										setImages(
											next.map((image, i) => ({
												...image,
												position: i + 1,
											})),
										);
									}}
									className="group relative cursor-grab active:cursor-grabbing rounded-[22px] border border-baume-border bg-baume-white p-2 shadow-sm hover:shadow-md transition"
								>
									<div className="aspect-square overflow-hidden rounded-[18px] bg-baume-ivory">
										{src ? (
											<img
												src={src}
												alt={img.alt_text || product.title || ""}
												className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
											/>
										) : (
											<div className="h-full w-full flex items-center justify-center text-[13px] text-baume-charcoal/45">
												Image vide
											</div>
										)}
									</div>

									<div className="mt-3 flex items-center justify-between gap-2">
										<span className="h-8 min-w-8 px-3 rounded-full bg-baume-burgundy text-baume-white text-[12px] font-semibold inline-flex items-center justify-center">
											#{index + 1}
										</span>

										<button
											type="button"
											onClick={() =>
												setImages(images.filter((_, i) => i !== index))
											}
											className="h-8 px-3 rounded-full bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100"
										>
											Retirer
										</button>
									</div>
								</div>
							);
						})}

						{images.length === 0 && (
							<button
								type="button"
								onClick={() => setShowImagePicker(true)}
								className="min-h-[190px] rounded-[22px] border border-dashed border-baume-border bg-baume-white/70 text-baume-burgundy font-semibold hover:bg-baume-white transition"
							>
								+ Choisir une image
							</button>
						)}
					</div>

					{showImagePicker && (
						<div className="mt-6 rounded-[24px] border border-baume-border bg-baume-white p-5">
							<div className="flex items-center justify-between gap-4 mb-4">
								<h3 className="text-[18px] font-semibold text-baume-burgundy">
									Choisir une image du bucket
								</h3>

								<button
									type="button"
									onClick={() => setShowImagePicker(false)}
									className="h-9 px-4 rounded-full bg-baume-ivory text-[13px] font-semibold"
								>
									Fermer
								</button>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[420px] overflow-y-auto pr-2">
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
										className="group rounded-[20px] border border-baume-border bg-baume-ivory p-2 hover:border-baume-burgundy transition"
									>
										<div className="aspect-square overflow-hidden rounded-[16px] bg-baume-white">
											<img
												src={img.public_url}
												alt={img.name}
												className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
											/>
										</div>
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
