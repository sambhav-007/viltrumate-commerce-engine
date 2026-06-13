import axios from "axios";

// Global request tracker: counts in-flight axios calls and notifies listeners.
// Registered once (imported in index.js) so every request/response — storefront
// and admin — drives the top progress bar automatically.
let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(pending > 0));

export const subscribeLoading = (fn) => {
  listeners.add(fn);
  fn(pending > 0);
  return () => listeners.delete(fn);
};

const inc = () => {
  pending += 1;
  emit();
};
const dec = () => {
  pending = Math.max(0, pending - 1);
  emit();
};

axios.interceptors.request.use(
  (config) => {
    inc();
    return config;
  },
  (error) => {
    dec();
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    dec();
    return response;
  },
  (error) => {
    dec();
    return Promise.reject(error);
  }
);
