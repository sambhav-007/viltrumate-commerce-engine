import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";
import { useSettings } from "../../context/SettingsContext";
import { useContent } from "../../config/content";

const About = () => {
  const s = useSettings();
  const t = useContent();
  return (
    <Layout>
      <div className="aura-container py-24 max-w-2xl text-center">
        <div className="eyebrow mb-4">{t("about.eyebrow")}</div>
        <h1 className="display-hero mb-10">{t("about.title")}</h1>
        <p className="text-muted text-lg leading-relaxed mb-12" style={{ whiteSpace: "pre-line" }}>
          {s.aboutUs || t("about.body")}
        </p>
        <Link to="/category" className="btn-outline">{t("about.cta")}</Link>
      </div>
    </Layout>
  );
};

export default About;
