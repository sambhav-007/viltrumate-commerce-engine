import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Link, useHistory } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useSettings, useFeature } from "../context/SettingsContext";
import { getCategories, getProducts, search as searchApi } from "../api/shop";
import Logo from "./Logo";
import { cld, money } from "./format";
import { STORE_NAME } from "../config/store.config";
import { useContent } from "../config/content";

const Navbar = () => {
  const history = useHistory();
  const { count, setOpen } = useCart();
  const settings = useSettings();
  const wishlistOn = useFeature("wishlist");
  const t = useContent();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sugg, setSugg] = useState(null);
  // Which desktop nav item is being previewed (null | "shop" | category id).
  const [hovered, setHovered] = useState(null);
  const closeTimer = useRef();

  // Debounced live suggestions while typing in the expanded search.
  useEffect(() => {
    if (!showSearch || q.trim().length < 2) {
      setSugg(null);
      return;
    }
    const t = setTimeout(() => {
      searchApi(q.trim()).then((r) => {
        if (r && !r.error) {
          const shades = (r.shades || []).slice(0, 4);
          const products = (r.products || []).slice(0, 3);
          setSugg(shades.length || products.length ? { shades, products } : null);
        }
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q, showSearch]);

  useEffect(() => {
    getCategories().then((res) =>
      setCats((res.categories || []).filter((c) => c.status === "Active"))
    );
    // Catalogue snapshot powering the hover previews (counts + thumbnails).
    getProducts().then((res) => setProducts(res.products || []));
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hover-intent: open immediately, close after a short delay so the cursor
  // can travel from the link down into the panel without it flickering shut.
  const openPreview = (key) => {
    clearTimeout(closeTimer.current);
    setHovered(key);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(null), 160);
  };
  const closePreview = () => {
    clearTimeout(closeTimer.current);
    setHovered(null);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Group products by category for the previews.
  const productsByCat = {};
  products.forEach((p) => {
    const id = p.category && (p.category._id || p.category);
    if (id) (productsByCat[id] = productsByCat[id] || []).push(p);
  });
  const hoveredCat =
    hovered && hovered !== "shop" ? cats.find((c) => c._id === hovered) : null;

  const go = (e) => {
    e.preventDefault();
    if (q.trim()) {
      history.push(`/search?q=${encodeURIComponent(q.trim())}`);
      setShowSearch(false);
      setQ("");
    }
  };

  return (
    <header
      className={`aura-nav fixed top-0 w-full z-30 ${scrolled ? "scrolled" : ""} ${
        showSearch || hovered ? "solid" : ""
      }`}
    >
      <div
        className="aura-container flex items-center justify-between"
        style={{ height: scrolled ? 80 : 104, transition: "height .4s ease" }}
      >
        {/* left: nav / mobile menu */}
        <div className="flex-1 flex items-center">
          <button
            className="md:hidden text-2xl text-ink"
            onClick={() => setMenu(!menu)}
            aria-label="Menu"
          >
            ☰
          </button>
          <nav
            className="hidden md:flex items-center space-x-9"
            onMouseLeave={scheduleClose}
          >
            <Link
              to="/category"
              className="nav-link"
              onMouseEnter={() => openPreview("shop")}
              onFocus={() => openPreview("shop")}
              onClick={closePreview}
            >
              {t("nav.shop")}
            </Link>
            {cats.slice(0, 4).map((c) => (
              <Link
                key={c._id}
                to={`/category/${c.slug}`}
                className="nav-link"
                onMouseEnter={() => openPreview(c._id)}
                onFocus={() => openPreview(c._id)}
                onClick={closePreview}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* center: logo */}
        <Link to="/" className="flex items-center justify-center px-4">
          <Logo
            height={scrolled ? 52 : 68}
            fallbackName={settings.storeName || STORE_NAME}
            className="transition-all duration-300"
          />
        </Link>

        {/* right: actions */}
        <div className="flex-1 flex items-center justify-end space-x-6">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-ink hover:text-accent transition-colors"
            aria-label="Search"
            title="Search"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m2.2-5.3a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
          </button>
          {wishlistOn && (
            <Link
              to="/wishlist"
              className="text-ink hover:text-accent transition-colors"
              aria-label="Wishlist"
              title="Wishlist"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.6c0 5.2-7.2 9.9-9 10.9-1.8-1-9-5.7-9-10.9A4.9 4.9 0 017.9 3.7 5 5 0 0112 5.6a5 5 0 014.1-1.9A4.9 4.9 0 0121 8.6z" />
              </svg>
            </Link>
          )}
          <button
            onClick={() => setOpen(true)}
            className="relative text-ink hover:text-accent transition-colors"
            aria-label="Cart"
            title="Cart"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l1 13H5L6 7zM9 7a3 3 0 016 0" />
            </svg>
            {count > 0 && (
              <span
                className="absolute -top-2 -right-2 text-white text-xs rounded-full flex items-center justify-center"
                style={{ background: "var(--accent)", minWidth: 18, height: 18, padding: "0 4px" }}
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Desktop hover preview flyout */}
      {hovered && (
        <div
          className="nav-flyout hidden md:block"
          onMouseEnter={() => openPreview(hovered)}
          onMouseLeave={scheduleClose}
        >
          <div className="aura-container py-8">
            {hovered === "shop" ? (
              <>
                <div className="flex items-end justify-between mb-5">
                  <div className="eyebrow">{t("home.categories.title")}</div>
                  <Link to="/category" className="nav-link" onClick={closePreview}>
                    {t("nav.shopAll")} →
                  </Link>
                </div>
                {cats.length === 0 ? (
                  <div className="text-muted text-sm">Loading…</div>
                ) : (
                  <div className="nav-preview-grid">
                    {cats.slice(0, 8).map((c) => (
                      <Link
                        key={c._id}
                        to={`/category/${c.slug}`}
                        className="nav-preview-card block group"
                        onClick={closePreview}
                      >
                        <div
                          className="nav-preview-thumb"
                          style={{
                            aspectRatio: "4 / 3",
                            backgroundImage:
                              c.image && c.image.url
                                ? `url(${cld(c.image.url, 300)})`
                                : undefined,
                          }}
                        />
                        <div className="mt-2 text-sm font-medium text-ink group-hover:text-accent transition-colors">
                          {c.name}
                        </div>
                        <div className="text-xs text-muted">
                          {(productsByCat[c._id] || []).length} item
                          {(productsByCat[c._id] || []).length === 1 ? "" : "s"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : hoveredCat ? (
              <>
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <div className="eyebrow">{hoveredCat.name}</div>
                    {hoveredCat.description && (
                      <p className="text-sm text-muted mt-1 max-w-md">
                        {hoveredCat.description}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/category/${hoveredCat.slug}`}
                    className="nav-link"
                    onClick={closePreview}
                  >
                    View all →
                  </Link>
                </div>
                {(productsByCat[hoveredCat._id] || []).length === 0 ? (
                  <div className="text-muted text-sm">
                    Explore the {hoveredCat.name} collection.
                  </div>
                ) : (
                  <div className="nav-preview-grid">
                    {(productsByCat[hoveredCat._id] || []).slice(0, 5).map((p) => (
                      <Link
                        key={p._id}
                        to={`/product/${p.slug}`}
                        className="nav-preview-card block group"
                        onClick={closePreview}
                      >
                        <div
                          className="nav-preview-thumb"
                          style={{
                            aspectRatio: "3 / 4",
                            backgroundImage:
                              p.coverImage && p.coverImage.url
                                ? `url(${cld(p.coverImage.url, 300)})`
                                : undefined,
                          }}
                        />
                        <div className="mt-2 text-sm font-medium text-ink group-hover:text-accent transition-colors">
                          {p.name}
                        </div>
                        {p.minPrice != null && (
                          <div className="text-xs text-muted">
                            From {money(p.minPrice)}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {showSearch && (
        <div className="aura-container pb-5 relative">
          <form onSubmit={go} className="hairline-b flex">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent py-3 outline-none text-ink placeholder-gray-400 font-display text-xl"
            />
          </form>
          {sugg && (
            <div className="absolute left-0 right-0 z-40 px-6">
              <div className="bg-card rounded shadow-xl border border-hairline overflow-hidden mx-auto" style={{ maxWidth: 640 }}>
                {sugg.shades.map((s) => (
                  <button
                    key={s._id}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-sand transition-colors"
                    onClick={() => {
                      if (s.product) history.push(`/product/${s.product.slug}`);
                      setShowSearch(false);
                      setQ("");
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded bg-sand flex-shrink-0"
                      style={
                        s.images && s.images[0]
                          ? { background: `url(${cld(s.images[0].url, 80)}) center/cover` }
                          : undefined
                      }
                    />
                    <span className="text-sm">
                      {s.name}
                      <span className="text-muted"> — {s.product ? s.product.name : ""}</span>
                    </span>
                  </button>
                ))}
                {sugg.products.map((p) => (
                  <button
                    key={p._id}
                    className="block w-full text-left px-4 py-3 hover:bg-sand transition-colors text-sm font-medium"
                    onClick={() => {
                      history.push(`/product/${p.slug}`);
                      setShowSearch(false);
                      setQ("");
                    }}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  className="block w-full text-left px-4 py-3 text-sm text-accent hover:bg-sand"
                  onClick={go}
                >
                  See all results →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile drawer — rendered via portal: the header's backdrop-filter
          would otherwise trap position:fixed children inside it. */}
      {ReactDOM.createPortal(
        <>
          {menu && (
            <div
              className="fixed inset-0 z-40 md:hidden"
              onClick={() => setMenu(false)}
              style={{
                background: "rgba(250, 247, 242, 0.3)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            />
          )}
          <aside
        className="fixed top-0 left-0 h-full z-50 shadow-2xl md:hidden flex flex-col"
        style={{
          width: "80%",
          maxWidth: 320,
          background: "var(--cream)",
          transform: menu ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex items-center justify-between px-6 h-20 hairline-b">
          <Logo height={44} fallbackName={settings.storeName || STORE_NAME} />
          <button onClick={() => setMenu(false)} className="text-3xl text-muted leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-6">
          <form onSubmit={go} className="hairline-b flex mb-8">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent py-2 outline-none text-ink placeholder-gray-400"
            />
          </form>
          <nav className="flex flex-col space-y-5">
            <Link
              to="/category"
              className="font-display text-2xl text-ink"
              onClick={() => setMenu(false)}
            >
              {t("nav.shopAll")}
            </Link>
            {cats.map((c) => (
              <Link
                key={c._id}
                to={`/category/${c.slug}`}
                className="font-display text-2xl text-ink"
                onClick={() => setMenu(false)}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto px-6 py-6 hairline-t text-xs text-muted tracking-luxe uppercase">
          {t("nav.cta")}
        </div>
          </aside>
        </>,
        document.body
      )}
    </header>
  );
};

export default Navbar;
