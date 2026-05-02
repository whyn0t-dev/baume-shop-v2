import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	getAdminProductFull,
	updateAdminProduct,
	archiveAdminProduct,
	deleteAdminProduct,
	formatApiError,
} from "../lib/api";

export default function AdminProductEdit() {
	const { productId } = useParams();
	const navigate = useNavigate();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		loadProduct();
	}, [productId]);

	async function loadProduct() {
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
		} catch (err) {
			alert(formatApiError(err));
		} finally {
			setLoading(false);
		}
	}

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
				images: images.filter((img) => img.storage_path?.trim()),
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
		<form onSubmit={handleSubmit}>
			{/* garde exactement le même formulaire que AdminProductCreate */}

			<button type="submit" disabled={saving}>
				{saving ? "Enregistrement..." : "Enregistrer les modifications"}
			</button>

			<button type="button" onClick={handleArchive}>
				Archiver
			</button>

			<button type="button" onClick={handleDelete}>
				Supprimer
			</button>
		</form>
	);
}
