import React, { useEffect, useState } from "react";
import Layout from "../Layout";
import CategoryCard from "../CategoryCard";
import Reveal from "../Reveal";
import { getCategories, getProducts } from "../../api/shop";

const Collections = () => {
  const [cats, setCats] = useState([]);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    getCategories().then((r) =>
      setCats((r.categories || []).filter((c) => c.status === "Active"))
    );
    getProducts().then((r) => {
      const m = {};
      (r.products || []).forEach((p) => {
        const id = p.category && (p.category._id || p.category);
        if (id) m[id] = (m[id] || 0) + 1;
      });
      setCounts(m);
    });
  }, []);

  return (
    <Layout>
      <div className="aura-container py-16 md:py-24">
        <Reveal className="text-center mb-16">
          <div className="eyebrow mb-3">Explore</div>
          <h1 className="display-hero">Collections</h1>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
          {cats.map((c, i) => (
            <CategoryCard key={c._id} category={c} count={counts[c._id]} index={i} />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Collections;
