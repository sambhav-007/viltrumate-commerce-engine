import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";
import ProductCard from "../ProductCard";
import { useWishlist } from "../../context/WishlistContext";
import { useFeature } from "../../context/SettingsContext";

// Wishlist page (feature-flagged). Items are device-local snapshots; each card
// links to the live PDP.
const Wishlist = () => {
  const wishlistOn = useFeature("wishlist");
  const wishlist = useWishlist();
  const items = (wishlist && wishlist.items) || [];

  if (!wishlistOn)
    return (
      <Layout>
        <div className="aura-container py-24 text-center text-muted">
          Wishlist is not enabled for this store.
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="aura-container py-16">
        <div className="eyebrow mb-3">Saved For Later</div>
        <h1 className="display-1 mb-10">Wishlist</h1>
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted mb-6">
              Nothing saved yet — tap the ♡ on any product.
            </p>
            <Link to="/category" className="btn-accent">
              Browse Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
            {items.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Wishlist;
