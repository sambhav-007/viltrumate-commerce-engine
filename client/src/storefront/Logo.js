import React, { useState } from "react";

// Renders the Aura Rare logo image; falls back to a typographic wordmark
// if /logo.png is missing, so the header never breaks.
const Logo = ({ height = 44, fallbackName = "Aura Rare", className = "" }) => {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className={`font-display text-2xl tracking-luxe text-ink ${className}`}>
        {fallbackName}
      </span>
    );
  }
  return (
    <img
      src="/logo.png"
      alt={fallbackName}
      style={{ height }}
      className={`w-auto ${className}`}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
};

export default Logo;
