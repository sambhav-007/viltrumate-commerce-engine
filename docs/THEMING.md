# Theming & Design Tokens (3B)

A store's look is carried entirely by `StoreSettings.theme` — no code edits, no CSS forks.
Defaults live in `client/src/styles/aura.css` (`:root`) and are mirrored in
`client/src/config/theme.config.js`; anything unset falls back to those.

## The four layers

| Layer | Field | What it changes |
| --- | --- | --- |
| Palette | `theme.colors` | `--accent`, `--ink`, `--cream`, … (ThemeApplier also derives `--<k>-rgb` triplets so translucent tints re-theme too) |
| Personality | `theme.tokens` | Any `:root` token: corner radius (`radius-btn/card/control`), letter-spacing (`track-luxe/wide/btn/nav/eyebrow`), display weight (`weight-display`), density (`container-max`, `section-y`, `section-y-md`) |
| Typography | `theme.fonts` | `body` / `display` CSS stacks (`--font-body` / `--font-display`) + `googleFamilies` (css2 specs, loaded at runtime by FontLoader) |
| Motion | `theme.motion` | `"full"` (default) or `"reduced"` — zeroes `--dur-*`; the visitor's OS `prefers-reduced-motion` is always honored regardless |

All four are editable in **Admin → Settings** (colors, fonts, motion) or set at provision
time via the manifest's `branding.theme` (colors, tokens, fonts, motion).

## Runtime pieces

- **ThemeApplier** (`client/src/storefront/ThemeApplier.js`) — injects `colors` + `tokens`
  onto `:root`; removes an override when its key is cleared (stylesheet default returns
  without a reload).
- **FontLoader** (`client/src/storefront/FontLoader.js`) — injects/updates one Google Fonts
  `<link>` for `googleFamilies` and applies the font-family tokens.
- **useMotion** (`client/src/hooks/useMotion.js`) — zeroes durations for reduced motion
  (store setting or OS preference).

## Recipes

**Soft/friendly brand (e.g. kids, food):**
```json
"theme": {
  "colors": { "accent": "#e2574c", "cream": "#fffdf8" },
  "tokens": { "radius-btn": "999px", "radius-card": "14px", "radius-control": "10px",
               "track-luxe": "0.06em", "track-btn": "0.06em", "track-eyebrow": "0.14em",
               "section-y": "4rem", "section-y-md": "5.5rem" },
  "fonts": { "body": "'Nunito', system-ui, sans-serif", "display": "'Nunito', system-ui, sans-serif",
              "googleFamilies": ["Nunito:wght@400;600;800"] }
}
```

**Tech/minimal brand (e.g. sneakers, gadgets):**
```json
"theme": {
  "colors": { "accent": "#111111", "cream": "#ffffff", "sand": "#f4f4f4", "hairline": "#e5e5e5" },
  "tokens": { "radius-btn": "0px", "radius-card": "0px", "weight-display": "700",
               "track-luxe": "0.02em", "container-max": "1440px" },
  "fonts": { "body": "'Inter Tight', system-ui, sans-serif", "display": "'Space Grotesk', sans-serif",
              "googleFamilies": ["Inter+Tight:wght@400;500;600", "Space+Grotesk:wght@500;700"] },
  "motion": "reduced"
}
```

Aura (the demo store) sets none of this and renders from the stylesheet defaults —
byte-identical to pre-3B.
