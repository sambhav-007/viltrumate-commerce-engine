import { useEffect } from "react";

// Motion preference: zero the aura.css duration tokens when the store sets
// theme.motion = "reduced" OR the visitor's OS asks for reduced motion.
// Transitions/animations collapse to near-instant without touching layout.
const DUR_VARS = ["--dur-fast", "--dur-med", "--dur-slow", "--dur-zoom"];

export default function useMotion(settings) {
  useEffect(() => {
    const root = document.documentElement.style;
    const mq = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    const apply = () => {
      const storeReduced =
        settings && settings.theme && settings.theme.motion === "reduced";
      const osReduced = !!(mq && mq.matches);
      if (storeReduced || osReduced) {
        DUR_VARS.forEach((v) => root.setProperty(v, "0.01s"));
      } else {
        DUR_VARS.forEach((v) => root.removeProperty(v)); // stylesheet defaults
      }
    };

    apply();
    if (mq && mq.addEventListener) mq.addEventListener("change", apply);
    else if (mq && mq.addListener) mq.addListener(apply); // Safari < 14
    return () => {
      if (mq && mq.removeEventListener) mq.removeEventListener("change", apply);
      else if (mq && mq.removeListener) mq.removeListener(apply);
    };
  }, [settings]);
}
