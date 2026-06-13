import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../../api/admin";
import {
  Spinner,
  PageHeader,
  Btn,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  useToast,
  imgUrl,
} from "../ui";

const empty = { name: "", description: "", status: "Active", order: 0 };

const Categories = () => {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fields, setFields] = useState(empty);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, node } = useToast();

  const load = () =>
    getCategories().then((res) => setList(res.categories || []));
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFields(empty);
    setFile(null);
    setOpen(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    setFields({
      name: c.name,
      description: c.description || "",
      status: c.status,
      order: c.order || 0,
    });
    setFile(null);
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...fields };
    if (file) payload.image = file;
    const res = editing
      ? await updateCategory(editing._id, payload)
      : await createCategory(payload);
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    setOpen(false);
    load();
  };

  const removeImage = async () => {
    if (!editing || !window.confirm("Remove this category's image?")) return;
    const res = await updateCategory(editing._id, { removeImage: "true" });
    if (res.error) return toast(res.error, "error");
    setEditing(res.category);
    setFile(null);
    toast("Image removed");
    load();
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}" and ALL its products/shades?`)) return;
    const res = await deleteCategory(c._id);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    load();
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Categories"
          action={<Btn onClick={openAdd}>+ Add Category</Btn>}
        />
        {!list ? (
          <Spinner />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="p-3">Image</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Order</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-gray-400">
                      No categories yet.
                    </td>
                  </tr>
                )}
                {list.map((c) => (
                  <tr key={c._id} className="border-t">
                    <td className="p-3">
                      {imgUrl(c.image) ? (
                        <img
                          src={c.image.url}
                          alt={c.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded" />
                      )}
                    </td>
                    <td className="p-3 font-medium text-gray-800">{c.name}</td>
                    <td className="p-3">
                      <span
                        className={
                          c.status === "Active"
                            ? "text-green-600"
                            : "text-gray-400"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3">{c.order}</td>
                    <td className="p-3 text-right space-x-2">
                      <Btn variant="light" onClick={() => openEdit(c)}>
                        Edit
                      </Btn>
                      <Btn variant="danger" onClick={() => remove(c)}>
                        Delete
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Category" : "Add Category"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit}>
          <Field label="Name">
            <Input
              value={fields.name}
              onChange={(e) => setFields({ ...fields, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows="2"
              value={fields.description}
              onChange={(e) =>
                setFields({ ...fields, description: e.target.value })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={fields.status}
                onChange={(e) =>
                  setFields({ ...fields, status: e.target.value })
                }
              >
                <option>Active</option>
                <option>Disabled</option>
              </Select>
            </Field>
            <Field label="Order">
              <Input
                type="number"
                value={fields.order}
                onChange={(e) =>
                  setFields({ ...fields, order: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label={`Image ${editing ? "(leave blank to keep)" : ""}`}>
            {editing && imgUrl(editing.image) && (
              <div className="mb-2">
                <img
                  src={editing.image.url}
                  alt={editing.name}
                  className="w-24 h-24 object-cover rounded mb-2"
                />
                <Btn type="button" variant="danger" onClick={removeImage}>
                  Remove Image
                </Btn>
              </div>
            )}
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

export default Categories;
