import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Layout from "../Layout";
import { search } from "../../api/shop";
import { money } from "../format";

const useQuery = () => new URLSearchParams(useLocation().search);

const Search = () => {
  const q = useQuery().get("q") || "";
  const [res, setRes] = useState(null);

  useEffect(() => {
    if (!q) return;
    setRes(null);
    search(q).then(setRes);
  }, [q]);

  const empty =
    res &&
    !res.error &&
    !(res.shades || []).length &&
    !(res.products || []).length &&
    !(res.categories || []).length;

  return (
    <Layout>
      <div className="aura-container py-16 md:py-24">
        <div className="text-center mb-16">
          <div className="eyebrow mb-3">Search</div>
          <h1 className="display-1">“{q}”</h1>
        </div>

        {!res ? (
          <p className="text-muted text-center py-12">Searching…</p>
        ) : empty ? (
          <div className="text-center py-12">
            <p className="font-display text-2xl mb-3">Nothing found</p>
            <p className="text-muted mb-8">
              Try a shade name, product, or collection.
            </p>
            <Link to="/category" className="btn-outline">Browse Collections</Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Shades first */}
            {(res.shades || []).length > 0 && (
              <section>
                <h2 className="eyebrow mb-5">Shades</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {res.shades.map((s) => (
                    <Link
                      key={s._id}
                      to={s.product ? `/product/${s.product.slug}` : "#"}
                      className="lux-card flex items-center gap-4 p-4 rounded"
                    >
                      <div
                        className="w-12 h-12 bg-sand rounded"
                        style={{
                          background:
                            s.images && s.images[0]
                              ? `url(${s.images[0].url}) center/cover`
                              : undefined,
                        }}
                      />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted">
                          {s.product ? s.product.name : ""}
                          {s.product && s.product.category
                            ? ` · ${s.product.category.name}`
                            : ""}
                        </div>
                      </div>
                      <span className="ml-auto text-sm">{money(s.price)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(res.products || []).length > 0 && (
              <section>
                <h2 className="eyebrow mb-5">Products</h2>
                <div className="flex flex-wrap gap-3">
                  {res.products.map((p) => (
                    <Link key={p._id} to={`/product/${p.slug}`} className="btn-outline">
                      {p.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(res.categories || []).length > 0 && (
              <section>
                <h2 className="eyebrow mb-5">Categories</h2>
                <div className="flex flex-wrap gap-3">
                  {res.categories.map((c) => (
                    <Link key={c._id} to={`/category/${c.slug}`} className="btn-outline">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Search;
