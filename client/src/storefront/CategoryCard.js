import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import useInView from "./useInView";
import { cld } from "./format";

const CategoryCard = ({ category, count, index = 0, tall = false }) => {
  const img = category.image && category.image.url;
  const [ref, inView] = useInView();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.8, delay: (index % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/category/${category.slug}`} className="cat-card img-zoom block">
        <div className="img-zoom-inner bg-sand" style={{ aspectRatio: tall ? "3 / 4" : "4 / 5" }}>
          {img && (
            <img
              src={cld(img, 800)}
              alt={category.name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="overlay" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-center text-white">
          <h3 className="font-display text-2xl md:text-3xl">{category.name}</h3>
          {count != null && (
            <div className="text-xs tracking-luxe uppercase mt-1 opacity-90">
              {count} {count === 1 ? "Product" : "Products"}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

export default CategoryCard;
