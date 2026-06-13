import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../Layout";
import ProductCard from "../ProductCard";
import CategoryCard from "../CategoryCard";
import Reveal from "../Reveal";
import { useSettings } from "../../context/SettingsContext";
import { getCategories, getProducts, getBanners } from "../../api/shop";

const Home = () => {
  const s = useSettings();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [banner, setBanner] = useState(null);
  const [heroRatio, setHeroRatio] = useState(null);

  useEffect(() => {
    getCategories().then((r) =>
      setCats((r.categories || []).filter((c) => c.status === "Active"))
    );
    getProducts().then((r) => setProducts(r.products || []));
    getBanners().then((r) => setBanner((r.banners || [])[0] || null));
  }, []);

  const counts = {};
  products.forEach((p) => {
    const id = p.category && (p.category._id || p.category);
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  const featured = products.filter((p) => p.isFeatured);
  const bestSellers = (featured.length ? featured : products).slice(0, 4);
  const moreProducts = products.slice(0, 8);

  const heroImg =
    (s.heroImage && s.heroImage.url) || (banner && banner.image && banner.image.url);
  const heroHeading = s.heroHeading || "Beauty That Speaks For Itself";
  const heroSub = s.heroSubheading || "Discover shades crafted for every mood.";

  // Read the hero image's natural aspect ratio so the section height adapts
  // to it (box matches the image → full image shown, no crop, no letterbox).
  useEffect(() => {
    if (!heroImg) {
      setHeroRatio(null);
      return;
    }
    const im = new Image();
    im.onload = () =>
      setHeroRatio(im.naturalHeight ? im.naturalWidth / im.naturalHeight : null);
    im.src = heroImg;
  }, [heroImg]);

  return (
    <Layout bare>
      {/* ---------- HERO ---------- */}
      <section
        className={`relative flex items-center ${heroImg ? "" : "hero-fallback"}`}
        style={{
          // No image: full-viewport fallback. With image: box matches the
          // image's aspect ratio (clamped) so the whole image shows, cover-filled.
          minHeight: heroImg ? "55vh" : "100vh",
          maxHeight: heroImg ? "100vh" : undefined,
          aspectRatio: heroImg && heroRatio ? String(heroRatio) : undefined,
          width: "100%",
          backgroundColor: heroImg ? "var(--ink)" : undefined,
          background: heroImg
            ? `linear-gradient(90deg, rgba(31,31,31,.45) 0%, rgba(31,31,31,.15) 55%, rgba(31,31,31,0) 100%), url(${heroImg}) center/cover no-repeat var(--ink)`
            : undefined,
        }}
      >
        <div className="aura-container w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
            style={{ color: heroImg ? "#fff" : "var(--ink)" }}
          >
            <div
              className="eyebrow mb-5"
              style={{ color: heroImg ? "#e8d6c0" : "var(--accent)" }}
            >
              {s.storeName || "Aura Rare"} · Rare by Nature
            </div>
            <h1 className="display-hero mb-6">{heroHeading}</h1>
            <p
              className="text-lg md:text-xl mb-10 max-w-lg"
              style={{ color: heroImg ? "rgba(255,255,255,.9)" : "var(--muted)" }}
            >
              {heroSub}
            </p>
            <Link to="/category" className={heroImg ? "btn-accent" : "btn-ink"}>
              Explore Collection
            </Link>
          </motion.div>
        </div>
        <div
          className="absolute text-xs tracking-luxe uppercase"
          style={{
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            color: heroImg ? "rgba(255,255,255,.8)" : "var(--muted)",
          }}
        >
          Scroll
        </div>
      </section>

      {/* ---------- FEATURED CATEGORIES ---------- */}
      {cats.length > 0 && (
        <section className="section">
          <div className="aura-container">
            <Reveal className="text-center mb-16">
              <div className="eyebrow mb-3">Collections</div>
              <h2 className="display-1">Shop by Category</h2>
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
              {cats.map((c, i) => (
                <CategoryCard key={c._id} category={c} count={counts[c._id]} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- BEST SELLERS ---------- */}
      {bestSellers.length > 0 && (
        <section className="section bg-sand">
          <div className="aura-container">
            <Reveal className="flex items-end justify-between mb-16">
              <div>
                <div className="eyebrow mb-3">Loved Most</div>
                <h2 className="display-1">Best Sellers</h2>
              </div>
              <Link to="/category" className="nav-link hidden md:block">View All</Link>
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
              {bestSellers.map((p, i) => (
                <ProductCard key={p._id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- BRAND STORY ---------- */}
      <section className="section">
        <div className="aura-container grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
          <Reveal>
            <div
              className="bg-sand img-zoom"
              style={{
                aspectRatio: "4 / 5",
                background:
                  heroImg ? undefined : "linear-gradient(135deg,var(--sand),#efe6d8)",
              }}
            >
              {heroImg && (
                <div
                  className="img-zoom-inner"
                  style={{ background: `url(${heroImg}) center/cover no-repeat` }}
                />
              )}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="eyebrow mb-4">Our Story</div>
            <h2 className="display-1 mb-6">Rare by Nature</h2>
            <p className="text-muted text-lg leading-relaxed mb-8">
              {s.aboutUs ||
                "Aura Rare is a premium cosmetics house crafting considered, wearable shades — made to let your natural glow lead."}
            </p>
            <Link to="/category" className="btn-outline">Discover the Range</Link>
          </Reveal>
        </div>
      </section>

      {/* ---------- MORE PRODUCTS ---------- */}
      {moreProducts.length > 4 && (
        <section className="section bg-sand">
          <div className="aura-container">
            <Reveal className="text-center mb-16">
              <div className="eyebrow mb-3">The Edit</div>
              <h2 className="display-1">Featured Shades</h2>
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
              {moreProducts.map((p, i) => (
                <ProductCard key={p._id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- TESTIMONIAL BAND ---------- */}
      <section className="section">
        <div className="aura-container text-center max-w-3xl">
          <Reveal>
            <div className="eyebrow mb-6">Loved by Many</div>
            <p className="display-2 leading-snug">
              “Quiet luxury you can wear every day. The shades feel considered, the
              finish effortless.”
            </p>
            <div className="text-muted text-sm tracking-luxe uppercase mt-8">
              — The {s.storeName || "Aura Rare"} Community
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- SOCIAL ---------- */}
      {(s.instagramUrl || s.facebookUrl) && (
        <section className="section bg-ink text-cream">
          <div className="aura-container text-center">
            <Reveal>
              <div className="eyebrow mb-4" style={{ color: "#e8d6c0" }}>Follow</div>
              <h2 className="display-1 mb-8">Join the Aura</h2>
              <div className="flex justify-center gap-4">
                {s.instagramUrl && (
                  <a href={s.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-accent">
                    Instagram
                  </a>
                )}
                {s.facebookUrl && (
                  <a
                    href={s.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline"
                    style={{ borderColor: "#fff", color: "#fff" }}
                  >
                    Facebook
                  </a>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      )}
    </Layout>
  );
};

export default Home;
