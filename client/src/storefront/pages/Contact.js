import React from "react";
import Layout from "../Layout";
import { useSettings } from "../../context/SettingsContext";

const Row = ({ label, children }) =>
  children ? (
    <div className="py-5 hairline-b">
      <div className="eyebrow mb-1">{label}</div>
      <div className="text-lg">{children}</div>
    </div>
  ) : null;

const Contact = () => {
  const s = useSettings();
  const wa = (s.whatsappNumber || "").replace(/\D/g, "");
  return (
    <Layout>
      <div className="aura-container py-24 max-w-xl">
        <div className="text-center mb-14">
          <div className="eyebrow mb-4">Get in Touch</div>
          <h1 className="display-1">Contact Us</h1>
        </div>
        <Row label="WhatsApp">
          {wa && (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent"
            >
              Chat with us
            </a>
          )}
        </Row>
        <Row label="Phone">{s.contactPhone}</Row>
        <Row label="Email">
          {s.contactEmail && (
            <a href={`mailto:${s.contactEmail}`} className="text-accent">
              {s.contactEmail}
            </a>
          )}
        </Row>
        <Row label="Address">{s.address}</Row>
        <Row label="Instagram">
          {s.instagramUrl && (
            <a href={s.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-accent">
              @aurarare
            </a>
          )}
        </Row>
      </div>
    </Layout>
  );
};

export default Contact;
