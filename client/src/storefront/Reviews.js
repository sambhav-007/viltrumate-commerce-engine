import React, { useEffect, useState } from "react";
import { getReviewsByShade, submitReview } from "../api/shop";

const Stars = ({ value, onChange }) => (
  <span>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={onChange ? () => onChange(n) : undefined}
        className={`text-lg ${n <= value ? "text-accent" : "text-muted"} ${
          onChange ? "cursor-pointer" : ""
        }`}
        style={{ color: n <= value ? "var(--accent)" : "#cfc6b8" }}
      >
        ★
      </button>
    ))}
  </span>
);

const Reviews = ({ shade }) => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ customerName: "", rating: 5, text: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    getReviewsByShade(shade._id).then((r) => setList(r.reviews || []));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shade._id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customerName.trim()) return setMsg("Please enter your name.");
    setBusy(true);
    const res = await submitReview({ ...form, shade: shade._id });
    setBusy(false);
    if (res.error) return setMsg(res.error);
    setForm({ customerName: "", rating: 5, text: "" });
    setMsg(res.success);
  };

  return (
    <div className="hairline-t pt-12 grid grid-cols-1 md:grid-cols-2 gap-12">
      <div>
        <h3 className="font-display text-2xl mb-6">Reviews — {shade.name}</h3>
        {list.length === 0 ? (
          <p className="text-muted text-sm">No reviews yet. Be the first.</p>
        ) : (
          list.map((r) => (
            <div key={r._id} className="hairline-b py-4">
              <div className="flex justify-between">
                <span className="font-medium">{r.customerName}</span>
                <Stars value={r.rating} />
              </div>
              {r.text && <p className="text-muted text-sm mt-1">{r.text}</p>}
            </div>
          ))
        )}
      </div>

      <div>
        <h3 className="font-display text-2xl mb-6">Write a Review</h3>
        <form onSubmit={submit}>
          <input
            className="lux-input mb-3"
            placeholder="Your name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          />
          <div className="mb-3">
            <Stars value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} />
          </div>
          <textarea
            rows="4"
            className="lux-input mb-3"
            placeholder="Share your thoughts…"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
          />
          <button className="btn-outline" disabled={busy}>
            {busy ? "Submitting…" : "Submit Review"}
          </button>
          {msg && <p className="text-sm text-accent mt-3">{msg}</p>}
        </form>
      </div>
    </div>
  );
};

export default Reviews;
