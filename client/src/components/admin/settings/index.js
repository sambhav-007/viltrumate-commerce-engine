import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import { getSettings, updateSettings } from "../../../api/admin";
import { THEME_DEFAULTS } from "../../../config/theme.config";
import { DEFAULT_FEATURES } from "../../../config/features.config";
import {
  Spinner,
  PageHeader,
  Btn,
  Field,
  Input,
  Textarea,
  Select,
  useToast,
  imgUrl,
} from "../ui";

const TEXT_FIELDS = [
  ["storeName", "Store Name"],
  ["whatsappNumber", "WhatsApp Number (with country code, digits only)"],
  ["address", "Address"],
  ["contactEmail", "Contact Email"],
  ["contactPhone", "Contact Phone"],
  ["instagramUrl", "Instagram URL"],
  ["facebookUrl", "Facebook URL"],
  ["heroHeading", "Hero Heading"],
  ["heroSubheading", "Hero Subheading"],
  ["variantLabel", "Variant Label (e.g. Shade, Size, Model)"],
];

const COLOR_KEYS = Object.keys(THEME_DEFAULTS.colors);
const FEATURE_KEYS = Object.keys(DEFAULT_FEATURES);
const PROVIDERS = [
  ["whatsapp", "WhatsApp"],
  ["cod", "Cash on Delivery"],
  ["razorpay", "Razorpay"],
  ["stripe", "Stripe (coming soon)"],
];

const Section = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow p-6 mb-6">
    <h2 className="font-semibold text-gray-800 mb-4">{title}</h2>
    {children}
  </div>
);

const Settings = () => {
  const [s, setS] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => {
    getSettings().then((res) => setS(res.settings || {}));
  }, []);

  // ---- nested config helpers ----
  const theme = (s && s.theme) || {};
  const colors = theme.colors || {};
  const payment = (s && s.payment) || {};
  const enabled = payment.enabledProviders || ["whatsapp"];
  const seo = (s && s.seo) || {};
  const features = (s && s.features) || {};

  const fonts = theme.fonts || {};

  const setColor = (k, v) =>
    setS({ ...s, theme: { ...theme, colors: { ...colors, [k]: v } } });
  const setLogo = (v) => setS({ ...s, theme: { ...theme, logoUrl: v } });
  const setFont = (k, v) =>
    setS({ ...s, theme: { ...theme, fonts: { ...fonts, [k]: v } } });
  const setGoogleFamilies = (v) =>
    setS({
      ...s,
      theme: {
        ...theme,
        fonts: {
          ...fonts,
          googleFamilies: v.split(",").map((x) => x.trim()).filter(Boolean),
        },
      },
    });
  const setMotion = (v) => setS({ ...s, theme: { ...theme, motion: v } });
  const setSeo = (k, v) => setS({ ...s, seo: { ...seo, [k]: v } });
  const setFeature = (k, v) =>
    setS({ ...s, features: { ...features, [k]: v } });
  const toggleProvider = (id) => {
    const next = enabled.includes(id)
      ? enabled.filter((x) => x !== id)
      : [...enabled, id];
    setS({ ...s, payment: { ...payment, enabledProviders: next } });
  };
  const setDefaultProvider = (v) =>
    setS({ ...s, payment: { ...payment, defaultProvider: v } });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      storeName: s.storeName || "",
      whatsappNumber: s.whatsappNumber || "",
      address: s.address || "",
      aboutUs: s.aboutUs || "",
      contactEmail: s.contactEmail || "",
      contactPhone: s.contactPhone || "",
      instagramUrl: s.instagramUrl || "",
      facebookUrl: s.facebookUrl || "",
      heroHeading: s.heroHeading || "",
      heroSubheading: s.heroSubheading || "",
      variantLabel: s.variantLabel || "",
      // Nested config travels as JSON (multipart form) and is parsed server-side.
      theme: JSON.stringify(s.theme || {}),
      payment: JSON.stringify(s.payment || {}),
      seo: JSON.stringify(s.seo || {}),
      features: JSON.stringify(s.features || {}),
    };
    if (file) payload.image = file;
    const res = await updateSettings(payload);
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    setS(res.settings);
    setFile(null);
    toast(res.success);
  };

  const removeHero = async () => {
    if (!window.confirm("Remove the hero image? The homepage will use its fallback."))
      return;
    const res = await updateSettings({ removeHeroImage: "true" });
    if (res.error) return toast(res.error, "error");
    setS(res.settings);
    setFile(null);
    toast("Hero image removed");
  };

  if (!s) return <AdminLayout><Spinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-4 md:p-8 max-w-3xl">
        <PageHeader title="Store Settings" />
        <form onSubmit={submit}>
          {/* Identity */}
          <Section title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              {TEXT_FIELDS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    value={s[key] || ""}
                    onChange={(e) => setS({ ...s, [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <Field label="About Us">
              <Textarea
                rows="4"
                value={s.aboutUs || ""}
                onChange={(e) => setS({ ...s, aboutUs: e.target.value })}
              />
            </Field>
            <Field label="Hero Image">
              {imgUrl(s.heroImage) ? (
                <div className="mb-2">
                  <img
                    src={s.heroImage.url}
                    alt="hero"
                    className="w-full h-40 object-cover rounded"
                  />
                  <div className="mt-2">
                    <Btn type="button" variant="danger" onClick={removeHero}>
                      Remove Hero Image
                    </Btn>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-2">
                  No hero image set — the homepage uses its styled fallback.
                </p>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </Field>
          </Section>

          {/* Theme */}
          <Section title="Theme">
            <p className="text-sm text-gray-500 mb-3">
              Override brand colors. Leave blank to use the default.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLOR_KEYS.map((k) => (
                <Field key={k} label={k}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors[k] || THEME_DEFAULTS.colors[k]}
                      onChange={(e) => setColor(k, e.target.value)}
                      className="w-9 h-9 border rounded"
                    />
                    <Input
                      value={colors[k] || ""}
                      placeholder={THEME_DEFAULTS.colors[k]}
                      onChange={(e) => setColor(k, e.target.value)}
                    />
                  </div>
                </Field>
              ))}
            </div>
            <Field label="Logo URL (optional)">
              <Input
                value={theme.logoUrl || ""}
                onChange={(e) => setLogo(e.target.value)}
              />
            </Field>
          </Section>

          {/* Typography & Motion (3B personality) */}
          <Section title="Typography & Motion">
            <p className="text-sm text-gray-500 mb-3">
              Per-store fonts and animation. Leave blank to use the engine
              defaults.
            </p>
            <Field label="Google Fonts families (comma-separated css2 specs, e.g. Sora:wght@400;600, Fraunces:wght@500)">
              <Input
                value={(fonts.googleFamilies || []).join(", ")}
                onChange={(e) => setGoogleFamilies(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Field label="Body font stack">
                <Input
                  value={fonts.body || ""}
                  placeholder={THEME_DEFAULTS.fonts.body}
                  onChange={(e) => setFont("body", e.target.value)}
                />
              </Field>
              <Field label="Display font stack">
                <Input
                  value={fonts.display || ""}
                  placeholder={THEME_DEFAULTS.fonts.display}
                  onChange={(e) => setFont("display", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Motion">
              <Select
                value={theme.motion || "full"}
                onChange={(e) => setMotion(e.target.value)}
              >
                <option value="full">Full (default animations)</option>
                <option value="reduced">Reduced (minimal animation)</option>
              </Select>
            </Field>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <p className="text-sm text-gray-500 mb-3">
              Choose which checkout methods customers can use.
            </p>
            <div className="space-y-2 mb-4">
              {PROVIDERS.map(([id, label]) => (
                <label key={id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enabled.includes(id)}
                    onChange={() => toggleProvider(id)}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <Field label="Default Method">
              <Select
                value={payment.defaultProvider || "whatsapp"}
                onChange={(e) => setDefaultProvider(e.target.value)}
              >
                {PROVIDERS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          {/* SEO */}
          <Section title="SEO">
            <Field label="Meta Title">
              <Input
                value={seo.metaTitle || ""}
                onChange={(e) => setSeo("metaTitle", e.target.value)}
              />
            </Field>
            <Field label="Meta Description">
              <Textarea
                rows="2"
                value={seo.metaDescription || ""}
                onChange={(e) => setSeo("metaDescription", e.target.value)}
              />
            </Field>
            <Field label="OG Image URL">
              <Input
                value={seo.ogImage || ""}
                onChange={(e) => setSeo("ogImage", e.target.value)}
              />
            </Field>
          </Section>

          {/* Features */}
          <Section title="Features">
            <p className="text-sm text-gray-500 mb-3">
              Enable or disable engine features for this store.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_KEYS.map((k) => {
                const val =
                  features[k] !== undefined ? features[k] : DEFAULT_FEATURES[k];
                return (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!val}
                      onChange={(e) => setFeature(k, e.target.checked)}
                    />
                    <span className="text-sm">{k}</span>
                  </label>
                );
              })}
            </div>
          </Section>

          <div className="flex justify-end mb-10">
            <Btn type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Settings"}
            </Btn>
          </div>
        </form>
      </div>
      {node}
    </AdminLayout>
  );
};

export default Settings;
