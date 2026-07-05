import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";
import { useContent } from "../../config/content";

const ThankYou = () => {
  const t = useContent();
  const bodyAlt = t("thankyou.bodyAlt");
  return (
    <Layout>
      <div className="aura-container py-32 text-center max-w-xl">
        <div className="eyebrow mb-4">{t("thankyou.eyebrow")}</div>
        <h1 className="display-1 mb-6">{t("thankyou.title")}</h1>
        <p className="text-muted text-lg leading-relaxed mb-4">{t("thankyou.body")}</p>
        {bodyAlt && <p className="text-muted text-sm mb-10">{bodyAlt}</p>}
        <Link to="/category" className="btn-accent">{t("thankyou.cta")}</Link>
      </div>
    </Layout>
  );
};

export default ThankYou;
