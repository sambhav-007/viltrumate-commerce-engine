import { useEffect } from "react";
import { useSettings } from "../context/SettingsContext";

// Injects the store's theme colors (StoreSettings.theme.colors) onto the :root
// CSS variables at runtime. The defaults in styles/aura.css remain the no-FOUC
// fallback; this only overrides keys the admin has set.
const ThemeApplier = () => {
  const s = useSettings();
  useEffect(() => {
    const colors = (s && s.theme && s.theme.colors) || {};
    Object.keys(colors).forEach((k) => {
      const v = colors[k];
      if (v) document.documentElement.style.setProperty(`--${k}`, v);
    });
  }, [s]);
  return null;
};

export default ThemeApplier;
