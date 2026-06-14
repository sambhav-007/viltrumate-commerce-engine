import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";
import { useSettings } from "../../context/SettingsContext";
import { STORE_NAME } from "../../config/store.config";

const About = () => {
  const s = useSettings();
  return (
    <Layout>
      <div className="aura-container py-24 max-w-2xl text-center">
        <div className="eyebrow mb-4">Our Story</div>
        <h1 className="display-hero mb-10">Rare by Nature</h1>
        <p className="text-muted text-lg leading-relaxed mb-12" style={{ whiteSpace: "pre-line" }}>
          {s.aboutUs ||
            `${STORE_NAME} is a premium house crafting considered, beautifully made pieces — designed to let what's best about you lead.`}
        </p>
        <Link to="/category" className="btn-outline">Explore the Collection</Link>
      </div>
    </Layout>
  );
};

export default About;
