import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";
import { useSettings } from "../../context/SettingsContext";

const ThankYou = () => {
  const s = useSettings();
  return (
    <Layout>
      <div className="aura-container py-32 text-center max-w-xl">
        <div className="eyebrow mb-4">Order Sent</div>
        <h1 className="display-1 mb-6">Thank You</h1>
        <p className="text-muted text-lg leading-relaxed mb-4">
          Your order has been opened in WhatsApp. Please press <b>send</b> there to
          confirm it with us — we'll reply shortly to arrange delivery.
        </p>
        <p className="text-muted text-sm mb-10">
          Didn't reach WhatsApp? Message us directly
          {s.contactPhone ? ` at ${s.contactPhone}` : ""}.
        </p>
        <Link to="/category" className="btn-accent">Continue Shopping</Link>
      </div>
    </Layout>
  );
};

export default ThankYou;
