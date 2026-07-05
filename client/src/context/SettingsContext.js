import React, { createContext, useContext, useEffect, useState } from "react";
import { getSettings } from "../api/shop";
import { isFeatureEnabled } from "../config/features.config";

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    getSettings().then((res) => {
      const s = (res && res.settings) || {};
      // content is stored as [{k,v}] pairs (dots aren't allowed in DB field
      // names); normalize to a {key: value} lookup for resolveContent.
      if (Array.isArray(s.content)) {
        const o = {};
        s.content.forEach((e) => {
          if (e && e.k) o[e.k] = e.v;
        });
        s.content = o;
      }
      setSettings(s);
    });
  }, []);

  return (
    <SettingsContext.Provider value={settings || {}}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

// Resolve a feature flag against the current store's runtime settings,
// falling back to client defaults. Generic: works for any registered flag.
export const useFeature = (flag) => {
  const settings = useContext(SettingsContext) || {};
  return isFeatureEnabled(flag, settings);
};
