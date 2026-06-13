import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from "../../../api/admin";
import {
  Spinner,
  PageHeader,
  Btn,
  Modal,
  Field,
  Input,
  useToast,
  imgUrl,
} from "../ui";

const empty = { heading: "", subheading: "", link: "", order: 0, active: true };

const Banners = () => {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fields, setFields] = useState(empty);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, node } = useToast();

  const load = () => getBanners(true).then((res) => setList(res.banners || []));
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFields(empty);
    setFile(null);
    setOpen(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setFields({
      heading: b.heading || "",
      subheading: b.subheading || "",
      link: b.link || "",
      order: b.order || 0,
      active: b.active,
    });
    setFile(null);
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && !file) return toast("Image is required", "error");
    setSaving(true);
    const payload = { ...fields };
    if (file) payload.image = file;
    const res = editing
      ? await updateBanner(editing._id, payload)
      : await createBanner(payload);
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    setOpen(false);
    load();
  };

  const remove = async (b) => {
    if (!window.confirm("Delete this banner?")) return;
    const res = await deleteBanner(b._id);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    load();
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Homepage Banners"
          action={<Btn onClick={openAdd}>+ Add Banner</Btn>}
        />
        {!list ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.length === 0 && (
              <div className="text-gray-400">No banners yet.</div>
            )}
            {list.map((b) => (
              <div key={b._id} className="bg-white rounded-lg shadow overflow-hidden">
                {imgUrl(b.image) && (
                  <img src={b.image.url} alt="" className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <div className="font-semibold text-gray-800">
                    {b.heading || <span className="text-gray-400">No heading</span>}
                  </div>
                  <div className="text-sm text-gray-500">{b.subheading}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    order {b.order} · {b.active ? "Active" : "Hidden"}
                  </div>
                  <div className="mt-3 space-x-2">
                    <Btn variant="light" onClick={() => openEdit(b)}>
                      Edit
                    </Btn>
                    <Btn variant="danger" onClick={() => remove(b)}>
                      Delete
                    </Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Banner" : "Add Banner"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit}>
          <Field label="Heading">
            <Input
              value={fields.heading}
              onChange={(e) => setFields({ ...fields, heading: e.target.value })}
            />
          </Field>
          <Field label="Subheading">
            <Input
              value={fields.subheading}
              onChange={(e) =>
                setFields({ ...fields, subheading: e.target.value })
              }
            />
          </Field>
          <Field label="Link (optional)">
            <Input
              value={fields.link}
              onChange={(e) => setFields({ ...fields, link: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Order">
              <Input
                type="number"
                value={fields.order}
                onChange={(e) => setFields({ ...fields, order: e.target.value })}
              />
            </Field>
            <label className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                checked={fields.active}
                onChange={(e) =>
                  setFields({ ...fields, active: e.target.checked })
                }
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
          <Field label={`Image ${editing ? "(leave blank to keep)" : ""}`}>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </Field>
          <div className="flex justify-end space-x-2 mt-4">
            <Btn type="button" variant="light" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Btn>
          </div>
        </form>
      </Modal>
      {node}
    </AdminLayout>
  );
};

export default Banners;
