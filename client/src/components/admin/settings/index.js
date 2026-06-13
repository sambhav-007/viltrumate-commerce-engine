import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import { getSettings, updateSettings } from "../../../api/admin";
import {
  Spinner,
  PageHeader,
  Btn,
  Field,
  Input,
  Textarea,
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
];

const Settings = () => {
  const [s, setS] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => {
    getSettings().then((res) => setS(res.settings || {}));
  }, []);

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
    if (!window.confirm("Remove the hero image? The homepage will use its fallback.")) return;
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
        <form onSubmit={submit} className="bg-white rounded-lg shadow p-6">
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
          <div className="flex justify-end mt-4">
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
