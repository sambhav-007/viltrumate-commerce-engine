const Variant = require("../models/variants");
const { isFeatureEnabled } = require("./features");

// Inventory movements tied to the order workflow. Feature-flagged: stores
// without the `inventory` flag never touch stock. Only variants with a
// numeric stock are tracked (null = unlimited).
//
// Movement rules (single source of truth for every confirm path — admin
// status change AND online-payment confirmation):
//   * -> confirmed   : decrement each line's qty
//   confirmed -> cancelled : restore each line's qty
// Decrements are $inc with a stock:{$ne:null} filter — atomic, and oversell
// shows as negative stock instead of silently failing the order.
async function applyOrderTransition(order, from, to) {
  if (!isFeatureEnabled("inventory")) return;
  if (!order || !Array.isArray(order.items)) return;

  let direction = 0;
  if (to === "confirmed" && from !== "confirmed") direction = -1;
  else if (from === "confirmed" && to === "cancelled") direction = +1;
  if (!direction) return;

  await Promise.all(
    order.items
      .filter((it) => it.variantId && it.qty > 0)
      .map((it) =>
        Variant.updateOne(
          { _id: it.variantId, stock: { $ne: null } },
          { $inc: { stock: direction * it.qty } }
        )
      )
  );
}

// Dashboard helper: tracked variants at or below the threshold.
async function lowStockCount(threshold = 5) {
  if (!isFeatureEnabled("inventory")) return 0;
  return Variant.countDocuments({ stock: { $ne: null, $lte: threshold } });
}

module.exports = { applyOrderTransition, lowStockCount };
