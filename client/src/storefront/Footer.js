import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { getCategories } from "../api/shop";

const Col = ({ title, children }) => (
  <div>
    <div className="footer-eyebrow mb-5">{title}</div>
    <div className="flex flex-col space-y-3">{children}</div>
  </div>
);

const FLink = ({ to, href, children }) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="footer-link">
      {children}
    </a>
  ) : (
    <Link to={to} className="footer-link">
      {children}
    </Link>
  );

const Footer = () => {
  const s = useSettings();
  const [cats, setCats] = useState([]);
  const wa = (s.whatsappNumber || "").replace(/\D/g, "");

  useEffect(() => {
    getCategories().then((r) =>
      setCats((r.categories || []).filter((c) => c.status === "Active").slice(0, 5))
    );
  }, []);

  return (
    <footer className="footer-mega mt-24">
      {/* Top: tagline + link columns */}
      <div className="aura-container pt-20 pb-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <div className="font-display text-2xl mb-4" style={{ color: "var(--cream)" }}>
            Rare by Nature
          </div>
          <p className="text-sm leading-relaxed footer-muted max-w-xs">
            {s.aboutUs
              ? `${s.aboutUs.slice(0, 120)}${s.aboutUs.length > 120 ? "…" : ""}`
              : "Premium cosmetics, thoughtfully made to let your natural glow lead."}
          </p>
          {wa && (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent mt-6 inline-flex"
              style={{ padding: "0.7rem 1.5rem" }}
            >
              Order on WhatsApp
            </a>
          )}
        </div>

        <Col title="Shop">
          <FLink to="/category">All Collections</FLink>
          {cats.map((c) => (
            <FLink key={c._id} to={`/category/${c.slug}`}>{c.name}</FLink>
          ))}
        </Col>

        <Col title="Explore">
          <FLink to="/about">Our Story</FLink>
          <FLink to="/contact">Contact</FLink>
          <FLink to="/search?q=">Search</FLink>
          <FLink to="/cart">Cart</FLink>
        </Col>

        <Col title="Connect">
          {s.instagramUrl && <FLink href={s.instagramUrl}>Instagram</FLink>}
          {s.facebookUrl && <FLink href={s.facebookUrl}>Facebook</FLink>}
          {s.contactEmail && <FLink href={`mailto:${s.contactEmail}`}>{s.contactEmail}</FLink>}
          {s.contactPhone && <span className="footer-link">{s.contactPhone}</span>}
          {s.address && <span className="footer-muted text-sm">{s.address}</span>}
        </Col>
      </div>

      {/* Bottom bar */}
      <div className="footer-hairline">
        <div className="aura-container py-5 flex flex-wrap items-center justify-between gap-2 text-xs footer-muted tracking-wide2 uppercase">
          <span>© {new Date().getFullYear()} {s.storeName || "Aura Rare"}</span>
          <span>Crafted with care · Ordered over WhatsApp</span>
        </div>
      </div>

      {/* Giant brand wordmark */}
      <div className="footer-giant-wrap" aria-hidden="true">
        <div className="footer-giant font-display">
          {(s.storeName || "Aura Rare").toUpperCase()}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
