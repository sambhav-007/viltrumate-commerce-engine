import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cld } from "./format";

const isExternal = (url) => /^https?:\/\//i.test(url || "");

// A single banner: full image shown whole (contain, cream letterbox),
// optional caption, optional click-through.
const Cell = ({ b, active }) => {
  const bg = (
    <div
      className="banner-bg"
      style={{
        backgroundImage:
          b.image && b.image.url ? `url(${cld(b.image.url, 1600)})` : undefined,
      }}
    >
      {(b.heading || b.subheading) && (
        <div className="banner-scrim">
          <div className="aura-container w-full pb-12 md:pb-20">
            {b.heading && (
              <h2 className="display-hero" style={{ color: "#fff" }}>
                {b.heading}
              </h2>
            )}
            {b.subheading && (
              <p
                className="text-lg md:text-xl mt-4 max-w-lg"
                style={{ color: "rgba(255,255,255,.92)" }}
              >
                {b.subheading}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  let content = bg;
  if (b.link) {
    content = isExternal(b.link) ? (
      <a
        href={b.link}
        target="_blank"
        rel="noopener noreferrer"
        className="banner-fill"
        tabIndex={active ? 0 : -1}
      >
        {bg}
      </a>
    ) : (
      <Link to={b.link} className="banner-fill" tabIndex={active ? 0 : -1}>
        {bg}
      </Link>
    );
  }

  return (
    <div
      className="banner-cell"
      style={{ opacity: active ? 1 : 0, pointerEvents: active ? "auto" : "none" }}
      aria-hidden={active ? undefined : true}
    >
      {content}
    </div>
  );
};

// Homepage hero carousel: auto-rotates through all active banners.
const BannerCarousel = ({ banners = [] }) => {
  const [idx, setIdx] = useState(0);
  const n = banners.length;

  useEffect(() => {
    if (n <= 1) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 3500);
    return () => clearInterval(t);
  }, [n]);

  // Keep the index valid if the banner list changes length.
  useEffect(() => {
    if (idx >= n) setIdx(0);
  }, [n, idx]);

  if (!n) return null;

  return (
    <section className="banner-carousel" aria-label="Featured banners">
      {banners.map((b, i) => (
        <Cell key={b._id} b={b} active={i === idx} />
      ))}
      {n > 1 && (
        <div className="banner-dots">
          {banners.map((b, i) => (
            <button
              key={b._id}
              type="button"
              className={`banner-dot ${i === idx ? "active" : ""}`}
              aria-label={`Show banner ${i + 1}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default BannerCarousel;
