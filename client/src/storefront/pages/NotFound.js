import React from "react";
import { Link } from "react-router-dom";
import Layout from "../Layout";

const NotFound = () => (
  <Layout>
    <div className="aura-container py-32 text-center">
      <h1 className="font-display text-5xl mb-4">404</h1>
      <p className="text-muted mb-8">This page could not be found.</p>
      <Link to="/" className="btn-accent">Return Home</Link>
    </div>
  </Layout>
);

export default NotFound;
