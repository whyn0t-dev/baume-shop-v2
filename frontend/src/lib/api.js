import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function normalizeArray(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;

  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.products?.data)) return data.products.data;
  if (Array.isArray(data?.products?.items)) return data.products.items;

  if (Array.isArray(data?.categories)) return data.categories;
  if (Array.isArray(data?.reviews)) return data.reviews;
  if (Array.isArray(data?.guides)) return data.guides;
  if (Array.isArray(data?.experts)) return data.experts;
  if (Array.isArray(data?.orders)) return data.orders;

  return [];
}

// Public data
export const getProducts = (params = {}) =>
  api.get("/products", { params }).then((r) => normalizeArray(r.data));

export const getProduct = (slug) =>
  api.get(`/products/${slug}`).then((r) => r.data);

export const getCategories = (kind) =>
  api.get("/categories", { params: { kind } }).then((r) => normalizeArray(r.data));

export const getCategory = (kind, slug) =>
  api.get(`/categories/${kind}/${slug}`).then((r) => r.data);

export const getReviews = (productId) =>
  api
    .get("/reviews", { params: productId ? { product_id: productId } : {} })
    .then((r) => normalizeArray(r.data));

export const getGuides = () =>
  api.get("/guides").then((r) => normalizeArray(r.data));

export const getGuide = (slug) =>
  api.get(`/guides/${slug}`).then((r) => r.data);

export const getExperts = () =>
  api.get("/experts").then((r) => normalizeArray(r.data));

export const submitContact = (payload) =>
  api.post("/contact", payload).then((r) => r.data);

// Checkout
export const createCheckout = (payload) =>
  axios
    .post(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-checkout-session`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
    .then((r) => r.data);

export const getCheckoutStatus = (sessionId) =>
  api.get(`/checkout/status/${sessionId}`).then((r) => r.data);

// Auth
export const authApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api/auth`,
  withCredentials: true,
});

authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const registerUser = (payload) =>
  authApi.post("/register", payload).then((r) => r.data);

export const loginUser = (payload) =>
  authApi.post("/login", payload).then((r) => r.data);

export const logoutUser = () =>
  authApi.post("/logout").then((r) => r.data);

export const fetchMe = () =>
  api.get("/me").then((r) => r.data);

export const updateMe = (payload) =>
  authApi.patch("/me", payload).then((r) => r.data);

export const forgotPassword = (email) =>
  authApi.post("/forgot-password", { email }).then((r) => r.data);

export const resetPassword = (token, password) =>
  authApi.post("/reset-password", { token, password }).then((r) => r.data);

export const refreshToken = () =>
  authApi.post("/refresh").then((r) => r.data);

// Orders
export const getMyOrders = () =>
  api.get("/orders/mine").then((r) => normalizeArray(r.data));

export const getOrder = (orderId) =>
  api.get(`/orders/${orderId}`).then((r) => r.data);

export const getAdminOrder = (orderId) =>
  api.get(`/ecom/admin/orders/${orderId}`).then((r) => r.data);

export const getAdminTable = (table, limit = 200) =>
  api.get(`/ecom/admin/${table}`, { params: { limit } }).then((r) => normalizeArray(r.data));

export const deleteAdminItem = (table, id) =>
  api.delete(`/ecom/admin/${table}/${id}`).then((r) => r.data);

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Une erreur est survenue.";
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" · ");
  if (d && typeof d.msg === "string") return d.msg;
  return String(d);
}

async function callOrderFunction(name, payload) {
  const token = localStorage.getItem("access_token");

  const res = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || "Erreur Edge Function");
  }

  return data;
}

export function updateOrderStatus(orderId, status) {
  return callOrderFunction("update-order-status", { orderId, status });
}

export function refundOrder(orderId) {
  return callOrderFunction("refund-order", { orderId });
}
export function updateOrderItemStatus(itemId, fulfillmentStatus) {
  return callOrderFunction("update-order-item-status", {
    itemId,
    fulfillmentStatus,
  });
}
export const createAdminProduct = (payload) =>
  api.post("/ecom/admin/products/create", payload).then((r) => r.data);

export const getAdminProductFull = (productId) =>
  api.get(`/products/${productId}/full`).then((r) => r.data);

export const updateAdminProduct = (productId, payload) =>
  api.patch(`/ecom/admin/products/${productId}`, payload).then((r) => r.data);

export const archiveAdminProduct = (productId) =>
  api.patch(`/ecom/admin/products/${productId}/archive`).then((r) => r.data);

export const deleteAdminProduct = (productId) =>
  api.delete(`/ecom/admin/products/${productId}`).then((r) => r.data);