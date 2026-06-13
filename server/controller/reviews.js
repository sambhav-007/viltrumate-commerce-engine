const Review = require("../models/reviews");
const Shade = require("../models/shades");

class ReviewController {
  // GET /api/reviews/by-shade/:shadeId -> approved reviews only (storefront)
  async getByShade(req, res) {
    try {
      const reviews = await Review.find({
        shade: req.params.shadeId,
        approved: true,
      }).sort({ _id: -1 });
      return res.json({ reviews });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load reviews" });
    }
  }

  // POST /api/reviews -> guest submission (unapproved by default)
  async create(req, res) {
    try {
      const { shade, customerName, rating, text } = req.body;
      if (!shade || !customerName || !rating) {
        return res
          .status(400)
          .json({ error: "Shade, name and rating are required" });
      }
      const r = Number(rating);
      if (isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: "Rating must be 1-5" });
      }
      if (String(customerName).length > 60 || String(text || "").length > 1000) {
        return res.status(400).json({ error: "Review is too long" });
      }
      const shadeDoc = await Shade.findById(shade, "product");
      if (!shadeDoc) return res.status(404).json({ error: "Shade not found" });
      await Review.create({
        shade,
        product: shadeDoc.product,
        customerName,
        rating,
        text,
      });
      return res.json({ success: "Thanks for your review. Pending approval." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to submit review" });
    }
  }

  // GET /api/reviews (admin) -> all reviews for moderation
  async getAll(req, res) {
    try {
      const reviews = await Review.find({})
        .populate("shade", "name")
        .populate("product", "name slug")
        .sort({ _id: -1 });
      return res.json({ reviews });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load reviews" });
    }
  }

  // PUT /api/reviews/:id/approve (admin)
  async approve(req, res) {
    try {
      const review = await Review.findByIdAndUpdate(
        req.params.id,
        { approved: true },
        { new: true }
      );
      if (!review) return res.status(404).json({ error: "Review not found" });
      return res.json({ success: "Review approved", review });
    } catch (err) {
      return res.status(500).json({ error: "Failed to approve review" });
    }
  }

  // DELETE /api/reviews/:id (admin)
  async remove(req, res) {
    try {
      const review = await Review.findByIdAndDelete(req.params.id);
      if (!review) return res.status(404).json({ error: "Review not found" });
      return res.json({ success: "Review deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete review" });
    }
  }
}

module.exports = new ReviewController();
