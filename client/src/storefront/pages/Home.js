import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../Layout";
import ProductCard from "../ProductCard";
import CategoryCard from "../CategoryCard";
import TrustStats from "../TrustStats";
import BannerCarousel from "../BannerCarousel";
import Reveal from "../Reveal";
import { useSettings } from "../../context/SettingsContext";
import { getCategories, getProducts, getBanners } from "../../api/shop";
import { useContent } from "../../config/content";

/* ---------- Sections (composed per layout variant below) ---------- */

/* Hero, three ways (mirrors aura-rare):
   1) Active banners → auto-rotating carousel, image shown whole (no site text).
   2) A single uploaded hero image → clean clickable band, whole image (contain),
      no overlaid title/CTA — the image is a self-contained design.
   3) No image → full-viewport text hero with title + CTA.
   Cases 1-2 render a visually-hidden H1 for crawlers. */
const Hero = ({ t, s, banners, heroImg }) => {
  const heroHeading = s.heroHeading || t("home.hero.heading");
  const heroSub = s.heroSubheading || t("home.hero.sub");
  const storeName = s.storeName || "";

  if (banners.length > 0 || heroImg) {
    return (
      <>
        <h1 className="sr-only">{heroHeading}</h1>
        {banners.length > 0 ? (
          <BannerCarousel banners={banners} />
        ) : (
          <Link
            to="/category"
            className="hero-image-hero"
            aria-label={storeName ? `Shop ${storeName}` : "Shop"}
            style={{ backgroundImage: `url(${heroImg})` }}
          />
        )}
      </>
    );
  }

  return (
    <section
      className="relative flex items-center hero-fallback"
      style={{ minHeight: "100vh", width: "100%" }}
    >
      <div className="aura-container w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
          style={{ color: "var(--ink)" }}
        >
          <div className="eyebrow mb-5" style={{ color: "var(--accent)" }}>
            {t("home.hero.eyebrow")}
          </div>
          <h1 className="display-hero mb-6">{heroHeading}</h1>
          <p
            className="text-lg md:text-xl mb-10 max-w-lg"
            style={{ color: "var(--muted)" }}
          >
            {heroSub}
          </p>
          <Link to="/category" className="btn-ink">
            {t("home.hero.cta")}
          </Link>
        </motion.div>
      </div>
      <div
        className="absolute text-xs tracking-luxe uppercase"
        style={{
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          color: "var(--muted)",
        }}
      >
        {t("home.hero.scroll")}
      </div>
    </section>
  );
};

const Categories = ({ t, cats, counts }) =>
  cats.length > 0 && (
    <section className="section">
      <div className="aura-container">
        <Reveal className="text-center mb-16">
          <div className="eyebrow mb-3">{t("home.categories.eyebrow")}</div>
          <h2 className="display-1">{t("home.categories.title")}</h2>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
          {cats.map((c, i) => (
            <CategoryCard key={c._id} category={c} count={counts[c._id]} index={i} />
          ))}
        </div>
      </div>
    </section>
  );

const BestSellers = ({ t, bestSellers }) =>
  bestSellers.length > 0 && (
    <section className="section bg-sand">
      <div className="aura-container">
        <Reveal className="flex items-end justify-between mb-16">
          <div>
            <div className="eyebrow mb-3">{t("home.bestsellers.eyebrow")}</div>
            <h2 className="display-1">{t("home.bestsellers.title")}</h2>
          </div>
          <Link to="/category" className="nav-link hidden md:block">
            {t("home.bestsellers.viewAll")}
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {bestSellers.map((p, i) => (
            <ProductCard key={p._id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );

const Story = ({ t, s, heroImg }) => (
  <section className="section">
    <div className="aura-container grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
      <Reveal>
        <div
          className="bg-sand img-zoom"
          style={{
            aspectRatio: "4 / 5",
            background: heroImg
              ? undefined
              : "linear-gradient(135deg,var(--sand),#efe6d8)",
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
        <div className="eyebrow mb-4">{t("home.story.eyebrow")}</div>
        <h2 className="display-1 mb-6">{t("home.story.title")}</h2>
        <p className="text-muted text-lg leading-relaxed mb-8">
          {s.aboutUs || t("home.story.body")}
        </p>
        <Link to="/category" className="btn-outline">{t("home.story.cta")}</Link>
      </Reveal>
    </div>
  </section>
);

const MoreProducts = ({ t, moreProducts }) =>
  moreProducts.length > 4 && (
    <section className="section bg-sand">
      <div className="aura-container">
        <Reveal className="text-center mb-16">
          <div className="eyebrow mb-3">{t("home.featured.eyebrow")}</div>
          <h2 className="display-1">{t("home.featured.title")}</h2>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {moreProducts.map((p, i) => (
            <ProductCard key={p._id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );

const Testimonial = ({ t }) =>
  !!t("home.testimonial.quote") && (
    <section className="section">
      <div className="aura-container text-center max-w-3xl">
        <Reveal>
          <div className="eyebrow mb-6">{t("home.testimonial.eyebrow")}</div>
          <p className="display-2 leading-snug">{t("home.testimonial.quote")}</p>
          {t("home.testimonial.attribution") && (
            <div className="text-muted text-sm tracking-luxe uppercase mt-8">
              {t("home.testimonial.attribution")}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );

const Social = ({ t, s }) =>
  !!(s.instagramUrl || s.facebookUrl) && (
    <section className="section bg-ink text-cream">
      <div className="aura-container text-center">
        <Reveal>
          <div className="eyebrow mb-4" style={{ color: "#e8d6c0" }}>
            {t("home.social.eyebrow")}
          </div>
          <h2 className="display-1 mb-8">{t("home.social.title")}</h2>
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
  );

/* ---------- Layout variants (StoreSettings.layout.home) ----------
   editorial — Aura's original brand-first composition (default)
   catalog   — product-first, denser: sell before you storytell
   minimal   — lookbook: hero, collections and story only              */
const SECTIONS = {
  hero: Hero,
  stats: TrustStats, // renders null until StoreSettings.stats has entries
  categories: Categories,
  bestsellers: BestSellers,
  story: Story,
  more: MoreProducts,
  testimonial: Testimonial,
  social: Social,
};
export const LAYOUTS = {
  editorial: ["hero", "stats", "categories", "bestsellers", "story", "more", "testimonial", "social"],
  catalog: ["hero", "stats", "bestsellers", "categories", "more", "testimonial", "social"],
  minimal: ["hero", "stats", "categories", "story", "social"],
};

const Home = () => {
  const s = useSettings();
  const t = useContent();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    getCategories().then((r) =>
      setCats((r.categories || []).filter((c) => c.status === "Active"))
    );
    getProducts().then((r) => setProducts(r.products || []));
    getBanners().then((r) => setBanners(r.banners || []));
  }, []);

  const counts = {};
  products.forEach((p) => {
    const id = p.category && (p.category._id || p.category);
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  const featured = products.filter((p) => p.isFeatured);
  const bestSellers = (featured.length ? featured : products).slice(0, 4);
  const moreProducts = products.slice(0, 8);

  // The Story section image is tied only to the store's own hero image
  // setting — never to banners (they're campaign material).
  const heroImg = s.heroImage && s.heroImage.url;

  const variant = (s.layout && s.layout.home) || "editorial";
  const order = LAYOUTS[variant] || LAYOUTS.editorial;
  const ctx = { t, s, cats, counts, bestSellers, moreProducts, banners, heroImg };

  return (
    <Layout>
      {order.map((key) => {
        const Section = SECTIONS[key];
        return <Section key={key} {...ctx} />;
      })}
    </Layout>
  );
};

export default Home;
