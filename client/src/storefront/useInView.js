import { useEffect, useRef, useState } from "react";

// IntersectionObserver-based reveal (framer-motion v4 has no whileInView).
// Returns [ref, inView]; inView latches true once and stays.
export default function useInView(margin = "-60px") {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: margin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);

  return [ref, inView];
}
