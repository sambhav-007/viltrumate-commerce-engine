const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

// Minimal order line: a snapshot of the purchased variant at order time.
const orderItemSchema = new mongoose.Schema(
  {
    variantId: { type: ObjectId, ref: "shades" },
    variantName: { type: String, default: "" },
    productName: { type: String, default: "" },
    productSlug: { type: String, default: "" },
    price: { type: Number, default: 0 },
    qty: { type: Number, default: 1 },
  },
  { _id: false }
);

// Minimal order record. Every checkout method (WhatsApp, COD, …) writes one,
// enabling future analytics, reporting and customer history.
const orderSchema = new mongoose.Schema(
  {
    items: { type: [orderItemSchema], default: [] },
    customer: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "whatsapp" }, // provider id
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("orders", orderSchema);
