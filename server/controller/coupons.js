const Coupon = require("../models/coupons");

const clean = (v, fallback = undefined) =>
  v === undefined || v === null || v === "" ? fallback : v;

class CouponController {
  // GET /api/coupons (admin)
  async list(req, res) {
    try {
      const coupons = await Coupon.find({}).sort({ createdAt: -1 });
      return res.json({ coupons });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load coupons" });
    }
  }

  // POST /api/coupons (admin)
  async create(req, res) {
    try {
      const { code, type, value } = req.body;
      if (!code || !type || value === undefined) {
        return res.status(400).json({ error: "Code, type and value are required" });
      }
      if (!["flat", "percent"].includes(type)) {
        return res.status(400).json({ error: "Type must be flat or percent" });
      }
      const num = Number(value);
      if (isNaN(num) || num < 0 || (type === "percent" && num > 100)) {
        return res.status(400).json({ error: "Invalid discount value" });
      }
      const coupon = await Coupon.create({
        code,
        type,
        value: num,
        minCart: Number(clean(req.body.minCart, 0)) || 0,
        expiresAt: clean(req.body.expiresAt, null),
        maxUses: clean(req.body.maxUses, null) === null ? null : Number(req.body.maxUses),
        status: clean(req.body.status, "Active"),
      });
      return res.json({ success: "Coupon created", coupon });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: "A coupon with this code already exists" });
      }
      return res.status(500).json({ error: "Failed to create coupon" });
    }
  }

  // PUT /api/coupons/:id (admin)
  async update(req, res) {
    try {
      const coupon = await Coupon.findById(req.params.id);
      if (!coupon) return res.status(404).json({ error: "Coupon not found" });
      const editable = ["type", "value", "minCart", "expiresAt", "maxUses", "status"];
      editable.forEach((k) => {
        if (req.body[k] !== undefined)
          coupon[k] = req.body[k] === "" ? null : req.body[k];
      });
      if (coupon.minCart === null) coupon.minCart = 0;
      await coupon.save();
      return res.json({ success: "Coupon updated", coupon });
    } catch (err) {
      return res.status(500).json({ error: "Failed to update coupon" });
    }
  }

  // DELETE /api/coupons/:id (admin)
  async remove(req, res) {
    try {
      const coupon = await Coupon.findByIdAndDelete(req.params.id);
      if (!coupon) return res.status(404).json({ error: "Coupon not found" });
      return res.json({ success: "Coupon deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete coupon" });
    }
  }

  // POST /api/coupons/validate (public) — body: { code, cartTotal }
  // Never reveals WHY a code failed beyond a generic message (no oracle).
  async validate(req, res) {
    try {
      const { code, cartTotal } = req.body;
      if (!code) return res.status(400).json({ error: "Coupon code is required" });
      const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
      const discount = coupon ? coupon.discountFor(cartTotal) : 0;
      if (!discount) {
        return res.status(400).json({ error: "This coupon can't be applied" });
      }
      return res.json({ valid: true, code: coupon.code, discount });
    } catch (err) {
      return res.status(500).json({ error: "Failed to validate coupon" });
    }
  }
}

module.exports = new CouponController();
