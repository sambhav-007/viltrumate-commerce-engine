import axios from "axios";

const apiURL = process.env.REACT_APP_API_URL;
const base = `${apiURL}/api`;

// JWT is stored as { token, user } JSON under "jwt".
const token = () =>
  localStorage.getItem("jwt")
    ? JSON.parse(localStorage.getItem("jwt")).token
    : false;
const auth = () => ({ headers: { token: `Bearer ${token()}` } });
const authForm = () => ({
  headers: { token: `Bearer ${token()}`, "Content-Type": "multipart/form-data" },
});

const data = (res) => res.data;
const fail = (e) =>
  (e.response && e.response.data) || { error: "Network error" };
const get = (url, cfg) => axios.get(`${base}${url}`, cfg).then(data).catch(fail);
const post = (url, body, cfg) =>
  axios.post(`${base}${url}`, body, cfg).then(data).catch(fail);
const put = (url, body, cfg) =>
  axios.put(`${base}${url}`, body, cfg).then(data).catch(fail);
const patch = (url, body, cfg) =>
  axios.patch(`${base}${url}`, body, cfg).then(data).catch(fail);
const del = (url, cfg) =>
  axios.delete(`${base}${url}`, cfg).then(data).catch(fail);

// Build FormData from a plain object (File values supported; arrays of File too).
const form = (obj) => {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item) => fd.append(k, item));
    else fd.append(k, v);
  });
  return fd;
};

/* ---- Stats ---- */
export const getStats = () => get("/stats", auth());

/* ---- Categories ---- */
export const getCategories = () => get("/categories");
export const createCategory = (obj) => post("/categories", form(obj), authForm());
export const updateCategory = (id, obj) =>
  put(`/categories/${id}`, form(obj), authForm());
export const deleteCategory = (id) => del(`/categories/${id}`, auth());

/* ---- Products ---- */
export const getProducts = (q = "") => get(`/products${q}`);
export const getProduct = (slug) => get(`/products/${slug}`);
export const getProductById = (id) => get(`/products/by-id/${id}`);
export const createProduct = (obj) => post("/products", form(obj), authForm());
export const updateProduct = (id, obj) =>
  put(`/products/${id}`, form(obj), authForm());
export const deleteProduct = (id) => del(`/products/${id}`, auth());

/* ---- Variants (purchasable unit; legacy: "shades") ---- */
export const getVariantsByProduct = (productId) =>
  get(`/variants/by-product/${productId}`);
export const createVariant = (obj) => post("/variants", form(obj), authForm());
export const bulkCreateVariants = (body) => post("/variants/bulk", body, auth());
export const bulkUpdateVariants = (body) => patch("/variants/bulk", body, auth());
export const updateVariant = (id, obj) =>
  put(`/variants/${id}`, form(obj), authForm());
export const deleteVariant = (id) => del(`/variants/${id}`, auth());
export const deleteVariantImage = (id, publicId) =>
  axios
    .delete(`${base}/variants/${id}/image`, { ...auth(), data: { publicId } })
    .then(data)
    .catch(fail);

// Back-compat aliases (old "shade" names).
export const getShadesByProduct = getVariantsByProduct;
export const createShade = createVariant;
export const bulkCreateShades = bulkCreateVariants;
export const bulkUpdateShades = bulkUpdateVariants;
export const updateShade = updateVariant;
export const deleteShade = deleteVariant;
export const deleteShadeImage = deleteVariantImage;

/* ---- Product CSV import ---- */
export const previewProductImport = (csv) =>
  post("/products/import/preview", { csv }, auth());
export const runProductImport = (csv) => post("/products/import", { csv }, auth());

/* ---- Banners ---- */
export const getBanners = (all = true) =>
  get(`/banners${all ? "?all=true" : ""}`);
export const createBanner = (obj) => post("/banners", form(obj), authForm());
export const updateBanner = (id, obj) =>
  put(`/banners/${id}`, form(obj), authForm());
export const deleteBanner = (id) => del(`/banners/${id}`, auth());

/* ---- Reviews ---- */
export const getAllReviews = () => get("/reviews", auth());
export const approveReview = (id) => put(`/reviews/${id}/approve`, {}, auth());
export const deleteReview = (id) => del(`/reviews/${id}`, auth());

/* ---- Orders ---- */
// query e.g. "?status=pending&limit=50&page=1"; response: { orders, total, page, limit }
export const getOrders = (query = "") => get(`/orders${query}`, auth());
export const getOrder = (id) => get(`/orders/${id}`, auth());
export const updateOrderStatus = (id, status) =>
  patch(`/orders/${id}/status`, { status }, auth());

/* ---- Settings ---- */
export const getSettings = () => get("/settings");
export const updateSettings = (obj) => put("/settings", form(obj), authForm());
