import { useEffect, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import useMotion from "../hooks/useMotion";

// Injects the store's theme (StoreSettings.theme.colors + .tokens) onto the
// :root CSS variables at runtime. The defaults in styles/aura.css remain the
// no-FOUC fallback; this only overrides keys the admin has set — and REMOVES
// the override when a key is cleared, so the stylesheet default returns
// without a reload (the old version left stale values behind).
//
// For each hex color it also derives a `--<k>-rgb` triplet so the stylesheet's
// translucent rgba(var(--x-rgb), a) tints re-theme with the palette.

const hexToRgb = (hex) => {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const ThemeApplier = () => {
  const s = useSettings();
  const applied = useRef(new Set()); // var names we set (for cleanup on change)
  useMotion(s);

  useEffect(() => {
    const root = document.documentElement.style;
    const next = {};

    const colors = (s && s.theme && s.theme.colors) || {};
    Object.keys(colors).forEach((k) => {
      const v = colors[k];
      if (!v) return;
      next[`--${k}`] = v;
      const rgb = hexToRgb(v);
      if (rgb) next[`--${k}-rgb`] = rgb;
    });

    const tokens = (s && s.theme && s.theme.tokens) || {};
    Object.keys(tokens).forEach((k) => {
      if (tokens[k]) next[`--${k}`] = tokens[k];
    });

    // Clear overrides that are no longer set, then apply the current ones.
    applied.current.forEach((name) => {
      if (!(name in next)) root.removeProperty(name);
    });
    Object.keys(next).forEach((name) => root.setProperty(name, next[name]));
    applied.current = new Set(Object.keys(next));
  }, [s]);

  return null;
};

export default ThemeApplier;
