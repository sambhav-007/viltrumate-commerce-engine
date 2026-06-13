import React from "react";
import { motion } from "framer-motion";
import useInView from "./useInView";

// Subtle fade-up reveal on scroll into view. Luxury = restrained motion.
const Reveal = ({ children, delay = 0, y = 28, className = "" }) => {
  const [ref, inView] = useInView();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default Reveal;
