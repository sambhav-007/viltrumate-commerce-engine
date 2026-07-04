import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import { useSettings } from "../context/SettingsContext";
import { useContent } from "../config/content";
import { STORE_NAME } from "../config/store.config";

// Intro curtain: a cream overlay with the logo + an accent rule, then the
// panel lifts away to reveal the site. Plays on every load; skipped on
// /admin, for OS prefers-reduced-motion, and for stores with theme.motion
// "reduced" (that arrives async, so the curtain also bails early when the
// setting loads mid-animation).
const shouldPlay = () => {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/admin")) return false;
  const mq =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq && mq.matches) return false;
  return true;
};

const Preloader = () => {
  const [show, setShow] = useState(shouldPlay);
  const s = useSettings();
  const t = useContent();

  useEffect(() => {
    if (!show) return undefined;
    if (s && s.theme && s.theme.motion === "reduced") {
      setShow(false);
      return undefined;
    }
    // Lock scroll while the curtain is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => setShow(false), 1900);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prev;
    };
  }, [show, s]);

  const tagMain = t("home.preloader.tag") || s.storeName || STORE_NAME;
  const tagSub = t("home.preloader.sub");

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="preloader"
          initial={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden="true"
        >
          <motion.div
            className="preloader-inner"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            <div className="preloader-logo">
              <Logo height={88} />
            </div>
            <motion.div
              className="preloader-rule"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 120, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
            />
            <motion.div
              className="preloader-tag"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.95 }}
            >
              <span className="preloader-tag-main">{tagMain}</span>
              {tagSub && <span className="preloader-tag-sub">{tagSub}</span>}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;
