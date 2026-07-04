import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import useInView from "./useInView";
import { money, cld } from "./format";
import { useContent } from "../config/content";
import { useFeature } from "../context/SettingsContext";
import { useWishlist } from "../context/WishlistContext";

const Stars = ({ rating }) =>
  rating && rating.count > 0 ? (
    <div className="text-xs mt-1" style={{ color: "var(--accent)" }}>
      ★ {rating.avg} <span className="text-muted">({rating.count})</span>
    </div>
  ) : null;

const ProductCard = ({ product, index = 0 }) => {
  const t = useContent();
  const img = product.coverImage && product.coverImage.url;
  const [ref, inView] = useInView();
  const wishlistOn = useFeature("wishlist");
  const wishlist = useWishlist();
  const saved = wishlistOn && wishlist && wishlist.has(product.slug);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/product/${product.slug}`} className="block group relative">
        {wishlistOn && wishlist && (
          <button
            aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
            title={saved ? "Remove from wishlist" : "Add to wishlist"}
            onClick={(e) => {
              e.preventDefault();
              wishlist.toggle(product);
            }}
            className="absolute z-10"
            style={{
              top: 10,
              right: 10,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.85)",
              color: saved ? "var(--accent)" : "var(--muted)",
              fontSize: 16,
              lineHeight: "34px",
            }}
          >
            {saved ? "♥" : "♡"}
          </button>
        )}
        <div className="img-zoom bg-sand" style={{ aspectRatio: "3 / 4" }}>
          {img ? (
            <img
              src={cld(img, 600)}
              alt={product.name}
              loading="lazy"
              className="img-zoom-inner w-full h-full object-cover"
            />
          ) : (
            <div className="img-zoom-inner" />
          )}
        </div>
        <div className="pt-5 text-center">
          <div className="eyebrow mb-1">
            {t("product.card.count", { count: product.shadeCount || 0 })}
          </div>
          <h3 className="font-display text-xl text-ink group-hover:text-accent transition-colors">
            {product.name}
          </h3>
          {product.minPrice != null && (
            <div className="text-sm text-muted mt-1">From {money(product.minPrice)}</div>
          )}
          <Stars rating={product.rating} />
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
