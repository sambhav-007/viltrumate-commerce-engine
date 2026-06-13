import React, { useEffect, useState } from "react";
import { subscribeLoading } from "../api/httpLoader";

// Minimal indeterminate progress bar pinned to the top of the viewport.
// Visible only while one or more requests are in flight.
const TopLoader = () => {
  const [active, setActive] = useState(false);
  useEffect(() => subscribeLoading(setActive), []);
  return <div className={`top-loader ${active ? "active" : ""}`} aria-hidden="true" />;
};

export default TopLoader;
