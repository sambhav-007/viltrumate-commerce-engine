import { isFeatureEnabled } from "../config/features.config";
import { STORE_NAME } from "../config/store.config";
import { money } from "../storefront/format";

// Build the WhatsApp order message (moved out of the Checkout page).
const buildMessage = (items, total, customer, settings) => {
  const store = settings.storeName || STORE_NAME;
  let m = `🛍️ *New Order — ${store}*\n`;
  m += `━━━━━━━━━━━━━━━\n\n`;
  m += `*Customer:* ${customer.name}\n`;
  m += `*Phone:* ${customer.phone}\n`;
  m += `*Address:* ${customer.address}\n\n`;
  m += `*Order Details:*\n\n`;
  items.forEach((it, i) => {
    m += `${i + 1}. *${it.productName}*\n`;
    m += `    ${it.shadeName}\n`;
    m += `    Qty: ${it.qty} × ${money(it.price)} = ${money(it.price * it.qty)}\n\n`;
  });
  m += `━━━━━━━━━━━━━━━\n`;
  m += `*Total: ${money(total)}*`;
  return m;
};

const whatsapp = {
  id: "whatsapp",
  label: "WhatsApp",
  featureFlag: "whatsappCheckout",
  isEnabled: (settings) =>
    isFeatureEnabled("whatsappCheckout", settings) &&
    !!(settings.whatsappNumber || "").replace(/\D/g, ""),
  async checkout({ items, total, customer, settings }) {
    const number = (settings.whatsappNumber || "").replace(/\D/g, "");
    if (!number)
      return { ok: false, error: "Store WhatsApp number is not configured." };
    const url = `https://wa.me/${number}?text=${encodeURIComponent(
      buildMessage(items, total, customer, settings)
    )}`;
    return { ok: true, redirectUrl: url };
  },
};

export default whatsapp;
