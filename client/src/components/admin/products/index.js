import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import AdminLayout from "../layout";
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
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

const empty = {
  name: "",
  description: "",
  category: "",
  status: "Active",
  isFeatured: false,
};

const Products = () => {
  const history = useHistory();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fields, setFields] = useState(empty);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, node } = useToast();

  const load = () =>
    getProducts().then((res) => setProducts(res.products || []));
  useEffect(() => {
    load();
    getCategories().then((res) => setCategories(res.categories || []));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFields({ ...empty, category: categories[0] ? categories[0]._id : "" });
    setFile(null);
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setFields({
      name: p.name,
      description: p.description || "",
      category: p.category ? p.category._id : "",
      status: p.status,
      isFeatured: p.isFeatured,
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
      ? await updateProduct(editing._id, payload)
      : await createProduct(payload);
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    setOpen(false);
    load();
  };

  const removeImage = async () => {
    if (!editing || !window.confirm("Remove this product's cover image?")) return;
    const res = await updateProduct(editing._id, { removeImage: "true" });
    if (res.error) return toast(res.error, "error");
    setEditing(res.product);
    setFile(null);
    toast("Cover image removed");
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" and all its shades?`)) return;
    const res = await deleteProduct(p._id);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    load();
  };

  // Group products by category name for the client's mental model.
  const groups = {};
  (products || []).forEach((p) => {
    const key = p.category ? p.category.name : "Uncategorized";
    (groups[key] = groups[key] || []).push(p);
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title="Products"
          action={<Btn onClick={openAdd}>+ Add Product</Btn>}
        />
        {!products ? (
          <Spinner />
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
            No products yet.
          </div>
        ) : (
          Object.keys(groups).map((cat) => (
            <div key={cat} className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">{cat}</h2>
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-left">
                    <tr>
                      <th className="p-3">Cover</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Shades</th>
                      <th className="p-3">Featured</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[cat].map((p) => (
                      <tr key={p._id} className="border-t">
                        <td className="p-3">
                          {imgUrl(p.coverImage) ? (
                            <img
                              src={p.coverImage.url}
                              alt={p.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded" />
                          )}
                        </td>
                        <td className="p-3 font-medium text-gray-800">
                          {p.name}
                        </td>
                        <td className="p-3">{p.shadeCount || 0}</td>
                        <td className="p-3">
                          {p.isFeatured ? (
                            <span className="text-yellow-600">★ Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              p.status === "Active"
                                ? "text-green-600"
                                : "text-gray-400"
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2 whitespace-nowrap">
                          <Btn
                            onClick={() =>
                              history.push(
                                `/admin/dashboard/products/${p._id}/shades`
                              )
                            }
                          >
                            Manage Shades
                          </Btn>
                          <Btn variant="light" onClick={() => openEdit(p)}>
                            Edit
                          </Btn>
                          <Btn variant="danger" onClick={() => remove(p)}>
                            Delete
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Product" : "Add Product"}
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
          <Field label="Category">
            <Select
              value={fields.category}
              onChange={(e) =>
                setFields({ ...fields, category: e.target.value })
              }
              required
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
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
          <div className="grid grid-cols-2 gap-3 items-end">
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
            <label className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                checked={fields.isFeatured}
                onChange={(e) =>
                  setFields({ ...fields, isFeatured: e.target.checked })
                }
              />
              <span className="text-sm text-gray-700">Featured product</span>
            </label>
          </div>
          <Field label={`Cover image ${editing ? "(leave blank to keep)" : ""}`}>
            {editing && imgUrl(editing.coverImage) && (
              <div className="mb-2">
                <img
                  src={editing.coverImage.url}
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

export default Products;
