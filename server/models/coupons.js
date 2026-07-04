const mongoose = require("mongoose");

// Discount coupon (feature-flagged: "coupons"). Codes are stored uppercase;
// usage is counted atomically at order creation so maxUses can't be raced.
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: { type: String, enum: ["flat", "percent"], required: true },
    value: { type: Number, required: true, min: 0 },
    minCart: { type: Number, default: 0, min: 0 }, // minimum cart total to apply
    expiresAt: { type: Date, default: null }, // null = never expires
    maxUses: { type: Number, default: null }, // null = unlimited
    usedCount: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Disabled"], default: "Active" },
  },
  { timestamps: true }
);

// Compute the discount this coupon gives on a cart total (0 = not applicable).
couponSchema.methods.discountFor = function (cartTotal) {
  const total = Number(cartTotal) || 0;
  if (this.status !== "Active") return 0;
  if (this.expiresAt && this.expiresAt < new Date()) return 0;
  if (this.maxUses !== null && this.usedCount >= this.maxUses) return 0;
  if (total < (this.minCart || 0)) return 0;
  const raw = this.type === "percent" ? (total * this.value) / 100 : this.value;
  return Math.min(Math.round(raw), total);
};

module.exports = mongoose.model("coupons", couponSchema);
