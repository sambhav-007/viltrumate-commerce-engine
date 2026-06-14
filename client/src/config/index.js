// Single import surface for all VCE configuration.
//   import config, { STORE_NAME, isFeatureEnabled } from "../config";
export { default as store, STORE_NAME, CURRENCY_SYMBOL, LOCALE } from "./store.config";
export { default as theme, THEME_DEFAULTS } from "./theme.config";
export { default as payment, PAYMENT_DEFAULTS } from "./payment.config";
export { default as seo, SEO_DEFAULTS } from "./seo.config";
export {
  default as features,
  DEFAULT_FEATURES,
  isFeatureEnabled,
} from "./features.config";

import store from "./store.config";
import theme from "./theme.config";
import payment from "./payment.config";
import seo from "./seo.config";
import features from "./features.config";

export default { store, theme, payment, seo, features };
