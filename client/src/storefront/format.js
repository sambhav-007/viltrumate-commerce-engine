export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Lowest active shade price for a product's shade list.
export const fromPrice = (shades = []) => {
  const prices = shades
    .filter((s) => s.status !== "Disabled")
    .map((s) => s.price);
  return prices.length ? Math.min(...prices) : null;
};

// Cloudinary delivery transform: auto format/quality + width cap.
// Non-Cloudinary URLs pass through untouched.
export const cld = (url, w = 600) => {
  if (!url || url.indexOf("/upload/") === -1) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w}/`);
};
