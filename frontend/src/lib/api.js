import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const getProducts = (params = {}) => api.get("/products", { params }).then((r) => r.data);
export const getProduct = (slug) => api.get(`/products/${slug}`).then((r) => r.data);
export const getCategories = (kind) => api.get("/categories", { params: { kind } }).then((r) => r.data);
export const getCategory = (kind, slug) => api.get(`/categories/${kind}/${slug}`).then((r) => r.data);
export const getReviews = (productId) =>
  api.get("/reviews", { params: productId ? { product_id: productId } : {} }).then((r) => r.data);
export const getGuides = () => api.get("/guides").then((r) => r.data);
export const getGuide = (slug) => api.get(`/guides/${slug}`).then((r) => r.data);
export const getExperts = () => api.get("/experts").then((r) => r.data);
export const submitContact = (payload) => api.post("/contact", payload).then((r) => r.data);
export const createCheckout = (payload) => api.post("/checkout/session", payload).then((r) => r.data);
export const getCheckoutStatus = (sessionId) => api.get(`/checkout/status/${sessionId}`).then((r) => r.data);
