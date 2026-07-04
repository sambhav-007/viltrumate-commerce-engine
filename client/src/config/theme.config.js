// Default theme tokens. These mirror the :root custom properties in
// styles/aura.css so the storefront renders correctly before any runtime
// override arrives. ThemeApplier injects StoreSettings.theme (colors + tokens +
// fonts + motion) onto these CSS variables at runtime.
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
  // Personality tokens (keys mirror aura.css :root, sans the -- prefix).
  // Any key here may be overridden per store via StoreSettings.theme.tokens.
  tokens: {
    "weight-display": "500",
    "track-luxe": "0.22em",
    "track-wide": "0.08em",
    "track-btn": "0.18em",
    "track-nav": "0.16em",
    "track-eyebrow": "0.32em",
    "radius-btn": "2px",
    "radius-card": "3px",
    "radius-control": "4px",
    "container-max": "1280px",
    "section-y": "6rem",
    "section-y-md": "8.5rem",
  },
  fonts: {
    body: '"Inter", system-ui, sans-serif',
    display: '"Playfair Display", Georgia, serif',
    // Google Fonts css2 family specs loaded by FontLoader (index.html loads
    // the Aura defaults statically, so this stays empty for the base theme).
    googleFamilies: [],
  },
  // "full" | "reduced" — reduced zeroes the motion durations (also forced by
  // the OS prefers-reduced-motion setting).
  motion: "full",
};

export default THEME_DEFAULTS;
