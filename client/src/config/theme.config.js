// Default theme tokens. These mirror the :root custom properties in
// styles/aura.css so the storefront renders correctly before any runtime
// override arrives. Phase D injects StoreSettings.theme onto these CSS
// variables at runtime (see ThemeApplier).
export const THEME_DEFAULTS = {
  colors: {
    cream: "#faf7f2",
    sand: "#f5efe6",
    card: "#ffffff",
    ink: "#1f1f1f",
    muted: "#6b6b6b",
    accent: "#b88a5a",
    "accent-hover": "#9c7349",
    hairline: "#e7ded2",
  },
};

export default THEME_DEFAULTS;
