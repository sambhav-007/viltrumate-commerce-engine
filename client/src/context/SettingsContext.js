import React, { createContext, useContext, useEffect, useState } from "react";
import { getSettings } from "../api/shop";

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
