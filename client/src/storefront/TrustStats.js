import React, { useEffect, useRef, useState } from "react";
import useInView from "./useInView";
import { useSettings } from "../context/SettingsContext";

// Trust-stats band: admin-editable social-proof figures (StoreSettings.stats,
// Admin → Settings → Trust Stats). Hidden while the list is empty. Numbers
// count up from 0 once the band scrolls into the middle of the viewport.
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const CountUp = ({ to, duration = 1700, start }) => {
  const [val, setVal] = useState(0);
  const raf = useRef();

  useEffect(() => {
    if (!start) return undefined;
    let t0 = null;
    const tick = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      setVal(to * easeOutCubic(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [start, to, duration]);

  return <>{Math.round(val).toLocaleString()}</>;
};

const TrustStats = () => {
  const s = useSettings();
  // Trigger only once the band reaches the middle of the viewport so the
  // count-up runs on scroll-down, not while parked below the hero on load.
  const [ref, inView] = useInView("-40% 0px -40% 0px");

  const stats = (s.stats || []).filter((st) => st && st.label);
  if (!stats.length) return null;

  return (
    <div className="trust-band" ref={ref}>
      <div
        className="trust-card"
        style={{
          // Hidden until scrolled into view so the starting "0"s never flash.
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(24px)",
          transition:
            "opacity 0.7s ease, transform 0.7s var(--ease-luxe)",
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        }}
      >
        {stats.map((st, i) => (
          <div className="trust-stat" key={`${st.label}-${i}`}>
            <div className="trust-num">
              <CountUp to={Number(st.value) || 0} start={inView} duration={1600 + i * 200} />
              <span className="trust-suffix">{st.suffix}</span>
            </div>
            <div className="trust-label">{st.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustStats;
