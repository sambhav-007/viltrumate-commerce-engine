import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import useInView from "./useInView";
import { money, cld } from "./format";

const Stars = ({ rating }) =>
  rating && rating.count > 0 ? (
    <div className="text-xs mt-1" style={{ color: "var(--accent)" }}>
      ★ {rating.avg} <span className="text-muted">({rating.count})</span>
    </div>
  ) : null;

const ProductCard = ({ product, index = 0 }) => {
  const img = product.coverImage && product.coverImage.url;
  const [ref, inView] = useInView();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/product/${product.slug}`} className="block group">
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
          <div className="eyebrow mb-1">{product.shadeCount || 0} Shades</div>
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
