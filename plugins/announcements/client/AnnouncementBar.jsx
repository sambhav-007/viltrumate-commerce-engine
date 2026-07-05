// Example storefront component (reference — not auto-built into the CRA bundle).
// Drop it into client/src and render near the top of the app to show the bar.
// It reads the plugin's public endpoint; style comes from the plugin settings.
import React, { useEffect, useState } from "react";

const API = process.env.REACT_APP_API_URL || "";

export default function AnnouncementBar() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/plugins/announcements/active`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || dismissed || !data.announcements || !data.announcements.length) return null;
  const { style } = data;
  const text = data.announcements.map((a) => a.message).join("  •  ");

  return (
    <div style={{ background: style.barColor, color: style.textColor, padding: "8px 16px", textAlign: "center", fontSize: 14 }}>
      <span>{text}</span>
      {style.dismissible && (
        <button
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: style.textColor, cursor: "pointer", marginLeft: 12 }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
