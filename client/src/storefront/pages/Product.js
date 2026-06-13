import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../Layout";
import ProductCard from "../ProductCard";
import Reveal from "../Reveal";
import { useCart } from "../../context/CartContext";
import { getProduct, getProducts } from "../../api/shop";
import { money, cld } from "../format";
import Reviews from "../Reviews";

const Product = () => {
  const { slug } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [shades, setShades] = useState([]);
  const [sel, setSel] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [filter, setFilter] = useState("");
  const [related, setRelated] = useState([]);

  useEffect(() => {
    setFilter("");
    getProduct(slug).then((r) => {
      if (r.error) return setProduct({ error: true });
      setProduct(r.product);
      const active = (r.shades || []).filter((s) => s.status !== "Disabled");
      setShades(active);
      setSel(active[0] || null);
      const catId = r.product.category && (r.product.category._id || r.product.category);
      if (catId) {
        getProducts(`?category=${catId}`).then((res) =>
          setRelated(
            (res.products || []).filter((p) => p.slug !== r.product.slug).slice(0, 4)
          )
        );
      }
    });
  }, [slug]);

  const gallery = useMemo(() => {
    if (sel && sel.images && sel.images.length) return sel.images.map((i) => i.url);
    if (product && product.coverImage) return [product.coverImage.url];
    return [];
  }, [sel, product]);

  useEffect(() => setActiveImg(0), [sel]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return shades;
    return shades.filter((s) => s.name.toLowerCase().indexOf(q) > -1);
  }, [shades, filter]);

  if (!product)
    return <Layout><p className="text-center text-muted py-40">Loading…</p></Layout>;
  if (product.error)
    return <Layout><p className="text-center text-muted py-40">Product not found.</p></Layout>;

  const addToCart = () => {
    if (!sel) return;
    add(
      {
        shadeId: sel._id,
        shadeName: sel.name,
        productName: product.name,
        productSlug: product.slug,
        price: sel.price,
        image: gallery[0] || null,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <Layout>
      <div className="aura-container py-12 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20">
        {/* Gallery */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>
          <div className="img-zoom bg-sand rounded" style={{ aspectRatio: "1 / 1" }}>
            {gallery[activeImg] ? (
              <img
                src={cld(gallery[activeImg], 1000)}
                alt={`${product.name}${sel ? ` — ${sel.name}` : ""}`}
                className="img-zoom-inner w-full h-full object-cover"
              />
            ) : (
              <div className="img-zoom-inner" />
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-3 mt-4">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className="w-20 h-20 rounded bg-sand overflow-hidden"
                  style={{
                    boxShadow:
                      i === activeImg ? "0 0 0 2px #fff, 0 0 0 4px var(--accent)" : "none",
                  }}
                >
                  <img src={cld(g, 160)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="md:py-4"
        >
          <div className="eyebrow mb-3">
            {product.category ? product.category.name : "Collection"}
          </div>
          <h1 className="display-1 mb-3">{product.name}</h1>

          {product.rating && product.rating.count > 0 && (
            <div className="mb-4 text-sm" style={{ color: "var(--accent-hover)" }}>
              {"★".repeat(Math.round(product.rating.avg))}
              {"☆".repeat(5 - Math.round(product.rating.avg))}
              <span className="text-muted ml-2">
                {product.rating.avg} · {product.rating.count} review
                {product.rating.count > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {sel && (
            <div className="flex items-end gap-3 mb-8">
              <span className="text-2xl md:text-3xl text-ink">{money(sel.price)}</span>
              {sel.mrp && sel.mrp > sel.price && (
                <span className="price-strike text-lg mb-1">{money(sel.mrp)}</span>
              )}
            </div>
          )}

          {/* Shade selector */}
          <div className="mb-10">
            <div className="flex justify-between items-baseline mb-4">
              <span className="eyebrow">Shade · {shades.length}</span>
              {sel && <span className="text-sm font-medium">{sel.name}</span>}
            </div>
            {shades.length > 12 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a shade… e.g. 23 or Red"
                className="lux-input mb-3"
                style={{ padding: "0.6rem 0.9rem" }}
              />
            )}
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}
            >
              {shown.map((sh) => {
                const thumb = sh.images && sh.images[0] && sh.images[0].url;
                const num = sh.name.replace(/[^0-9]/g, "").slice(-2);
                return (
                  <button
                    key={sh._id}
                    title={sh.name}
                    onClick={() => setSel(sh)}
                    className={`swatch ${sel && sel._id === sh._id ? "selected" : ""}`}
                    style={thumb ? { backgroundImage: `url(${cld(thumb, 120)})` } : undefined}
                  >
                    {!thumb && (num || sh.name.slice(0, 2))}
                  </button>
                );
              })}
              {shown.length === 0 && (
                <div className="col-span-full text-sm text-muted py-2">
                  No shades match “{filter}”.
                </div>
              )}
            </div>
          </div>

          {/* Qty + Add */}
          <div className="flex items-stretch gap-4 mb-8">
            <div className="flex items-center border border-hairline rounded">
              <button className="px-4 text-lg" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="px-4">{qty}</span>
              <button className="px-4 text-lg" onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <button className="btn-accent flex-1" onClick={addToCart} disabled={!sel}>
              {added ? "Added ✓" : "Add to Cart"}
            </button>
          </div>

          {product.description && (
            <div className="hairline-t pt-8">
              <div className="eyebrow mb-3">Details</div>
              <p className="text-muted leading-relaxed">{product.description}</p>
            </div>
          )}
        </motion.div>
      </div>

      {sel && (
        <div className="aura-container pb-12">
          <Reviews shade={sel} />
        </div>
      )}

      {/* Related products */}
      {related.length > 0 && (
        <div className="aura-container pb-24">
          <Reveal className="text-center mb-12 mt-12">
            <div className="eyebrow mb-3">You May Also Like</div>
            <h2 className="display-2">
              More from {product.category ? product.category.name : "the Collection"}
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
            {related.map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} />
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Product;
