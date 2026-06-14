import React, { createContext, useContext, useEffect, useState } from "react";
import { getSettings } from "../api/shop";
import { isFeatureEnabled } from "../config/features.config";

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    getSettings().then((res) => setSettings((res && res.settings) || {}));
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
