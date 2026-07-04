import { useEffect } from "react";
import { useSettings } from "../context/SettingsContext";

// Loads per-store webfonts and applies the font-family tokens.
// - theme.fonts.googleFamilies: css2 family specs (e.g. "Sora:wght@400;600")
//   injected as a single Google Fonts stylesheet link (replaced on change,
//   removed when cleared — the static index.html Aura fonts stay as fallback).
// - theme.fonts.body / .display: CSS stacks applied to --font-body /
//   --font-display (cleared back to the aura.css defaults when unset).
const LINK_ID = "vce-store-fonts";

const FontLoader = () => {
  const s = useSettings();

  useEffect(() => {
    const fonts = (s && s.theme && s.theme.fonts) || {};
    const families = (fonts.googleFamilies || []).filter(Boolean);

    let link = document.getElementById(LINK_ID);
    if (families.length) {
      const href =
        "https://fonts.googleapis.com/css2?" +
        families.map((f) => "family=" + encodeURIComponent(f).replace(/%3A/g, ":").replace(/%40/g, "@").replace(/%3B/g, ";")).join("&") +
        "&display=swap";
      if (!link) {
        link = document.createElement("link");
        link.id = LINK_ID;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.href !== href) link.href = href;
    } else if (link) {
      link.remove();
    }

    const root = document.documentElement.style;
    if (fonts.body) root.setProperty("--font-body", fonts.body);
    else root.removeProperty("--font-body");
    if (fonts.display) root.setProperty("--font-display", fonts.display);
    else root.removeProperty("--font-display");
  }, [s]);

  return null;
};

export default FontLoader;
