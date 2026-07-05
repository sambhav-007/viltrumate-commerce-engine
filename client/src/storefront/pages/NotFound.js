import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";
import { useContent } from "../../config/content";

const NotFound = () => {
  const t = useContent();
  return (
    <Layout>
      <div className="aura-container py-32 text-center">
        <h1 className="font-display text-5xl mb-4">{t("notfound.title")}</h1>
        <p className="text-muted mb-8">{t("notfound.body")}</p>
        <Link to="/" className="btn-accent">{t("notfound.cta")}</Link>
      </div>
    </Layout>
  );
};

export default NotFound;
