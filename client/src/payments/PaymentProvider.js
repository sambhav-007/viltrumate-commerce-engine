// PaymentProvider contract (documentation + shared helper).
//
// Every payment method implements this shape so checkout logic never depends on
// a specific provider:
//
//   id:         string                      unique provider id
//   label:      string                      customer-facing option/button text
//   featureFlag: string | null              StoreSettings.features flag gating it
//   isEnabled(settings): boolean            whether the store can use it now
//   checkout({ items, total, customer, settings, orderId }):
//                 Promise<{ ok, redirectUrl?, message?, error? }>
//
// Convention: the Checkout page creates the Order first (so EVERY method is
// recorded for analytics/history), then calls provider.checkout() with the
// persisted orderId. A provider may return a redirectUrl (e.g. WhatsApp/Stripe)
// or just resolve ok (e.g. Cash on Delivery).

// Map cart items + customer into the server Order payload (variant-named).
// `coupon` is optional ({ code }) — the server re-validates and re-prices, so
// only the code travels.
export const buildOrderPayload = (items, total, customer, paymentMethod, coupon) => ({
  items: (items || []).map((it) => ({
    variantId: it.shadeId,
    variantName: it.shadeName,
    productName: it.productName,
    productSlug: it.productSlug,
    price: it.price,
    qty: it.qty,
  })),
  customer,
  total,
  paymentMethod,
  ...(coupon && coupon.code ? { coupon: { code: coupon.code } } : {}),
});
