import React, { useEffect, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import AdminLayout from "../layout";
import {
  getProductById,
  getVariantsByProduct,
  bulkCreateVariants,
  bulkUpdateVariants,
  updateVariant,
  deleteVariant,
  deleteVariantImage,
  reorderVariants,
} from "../../../api/admin";
import useRowDnd, { moveItem } from "../useRowDnd";
import { useSettings, useFeature } from "../../../context/SettingsContext";
import { VARIANT_LABEL } from "../../../config/store.config";
import {
  Spinner,
  PageHeader,
  Btn,
  Modal,
  Field,
  Input,
  Select,
  useToast,
} from "../ui";

const pad = (n, width) => String(n).padStart(width, "0");

const VariantManager = () => {
  const { id } = useParams();
  const history = useHistory();
  const settings = useSettings();
  const L = settings.variantLabel || VARIANT_LABEL; // singular label
  const Lp = `${L}s`; // plural label
  const inventoryOn = useFeature("inventory");
  const [product, setProduct] = useState(null);
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const { toast, node } = useToast();

  const load = () =>
    getVariantsByProduct(id).then((res) =>
      setRows(res.variants || res.shades || [])
    );
  useEffect(() => {
    load();
    getProductById(id).then((res) => setProduct(res.product || {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allChecked = rows && rows.length > 0 && selectedIds.length === rows.length;
  const toggleAll = () =>
    setSelected(
      allChecked
        ? {}
        : rows.reduce((m, r) => {
            m[r._id] = true;
            return m;
          }, {})
    );

  // ---- drag-to-reorder (optimistic; reload on failure) ----
  const onReorder = async (from, to) => {
    const next = moveItem(rows, from, to);
    setRows(next);
    const res = await reorderVariants(next.map((r) => r._id));
    if (res.error) {
      toast(res.error, "error");
      load();
    }
  };
  const dnd = useRowDnd(onReorder);

  // ---- inline row editing ----
  const setRow = (rid, patch) =>
    setRows(rows.map((r) => (r._id === rid ? { ...r, ...patch, _dirty: true } : r)));

  const saveRow = async (r) => {
    const res = await updateVariant(r._id, {
      name: r.name,
      price: r.price,
      mrp: r.mrp === null ? "" : r.mrp,
      status: r.status,
      // stock: "" clears tracking (unlimited); numbers set the on-hand count
      stock: r.stock == null ? "" : r.stock,
    });
    if (res.error) return toast(res.error, "error");
    toast(`${L} saved`);
    setRows(rows.map((x) => (x._id === r._id ? { ...x, _dirty: false } : x)));
  };

  const uploadImages = async (r, files) => {
    if (!files.length) return;
    const res = await updateVariant(r._id, { images: Array.from(files) });
    if (res.error) return toast(res.error, "error");
    toast("Image(s) added");
    load();
  };

  const removeImage = async (r, publicId) => {
    const res = await deleteVariantImage(r._id, publicId);
    if (res.error) return toast(res.error, "error");
    load();
  };

  const removeRow = async (r) => {
    if (!window.confirm(`Delete ${L.toLowerCase()} "${r.name}"?`)) return;
    const res = await deleteVariant(r._id);
    if (res.error) return toast(res.error, "error");
    toast(`${L} deleted`);
    load();
  };

  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected ${Lp.toLowerCase()}?`))
      return;
    for (const vid of selectedIds) await deleteVariant(vid);
    toast(`${selectedIds.length} ${Lp.toLowerCase()} deleted`);
    setSelected({});
    load();
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader
          title={
            <span>
              <button
                onClick={() => history.push("/admin/dashboard/products")}
                className="text-gray-400 hover:text-gray-700 mr-2"
              >
                ←
              </button>
              {Lp}
              {product && product.name ? ` — ${product.name}` : ""}
            </span>
          }
          action={
            <div className="space-x-2">
              <Btn onClick={() => setBulkOpen(true)}>+ Bulk Add</Btn>
            </div>
          }
        />

        {/* selection toolbar */}
        {rows && rows.length > 0 && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="text-gray-500">{selectedIds.length} selected</span>
            <Btn
              variant="light"
              disabled={!selectedIds.length}
              onClick={() => setPriceOpen(true)}
            >
              Set Price/MRP
            </Btn>
            <Btn
              variant="danger"
              disabled={!selectedIds.length}
              onClick={bulkDelete}
            >
              Delete selected
            </Btn>
          </div>
        )}

        {!rows ? (
          <Spinner />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="admin-table w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="p-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-2">#</th>
                  <th className="p-2">Images</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">MRP</th>
                  {inventoryOn && <th className="p-2">Stock</th>}
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={inventoryOn ? 9 : 8} className="p-6 text-center text-gray-400">
                      No {Lp.toLowerCase()} yet. Use “Bulk Add”.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr
                    key={r._id}
                    className={`border-t align-top ${
                      dnd.overIndex === i ? "row-drop-target" : ""
                    }`}
                    {...dnd.rowProps(i)}
                  >
                    <td className="p-2" data-label="Select">
                      <input
                        type="checkbox"
                        checked={!!selected[r._id]}
                        onChange={(e) =>
                          setSelected({ ...selected, [r._id]: e.target.checked })
                        }
                      />
                    </td>
                    <td
                      className="p-2 text-gray-400 admin-hide-sm whitespace-nowrap"
                      data-label="#"
                    >
                      <span
                        className="drag-handle"
                        title="Drag to reorder"
                        {...dnd.handleProps(i)}
                      >
                        ⠿
                      </span>
                      <span className="ml-1">{i + 1}</span>
                    </td>
                    <td className="p-2" data-label="Images">
                      <div className="flex items-center gap-1 flex-wrap max-w-xs">
                        {(r.images || []).map((img) => (
                          <div key={img.publicId} className="relative">
                            <img
                              src={img.url}
                              alt=""
                              className="w-10 h-10 object-cover rounded"
                            />
                            <button
                              onClick={() => removeImage(r, img.publicId)}
                              className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 text-xs leading-none"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <label className="w-10 h-10 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 cursor-pointer hover:border-gray-500">
                          +
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => uploadImages(r, e.target.files)}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="p-2" data-label="Name">
                      <Input
                        value={r.name}
                        onChange={(e) => setRow(r._id, { name: e.target.value })}
                      />
                    </td>
                    <td className="p-2 w-24" data-label="Price">
                      <Input
                        type="number"
                        value={r.price}
                        onChange={(e) =>
                          setRow(r._id, { price: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2 w-24" data-label="MRP">
                      <Input
                        type="number"
                        value={r.mrp == null ? "" : r.mrp}
                        onChange={(e) => setRow(r._id, { mrp: e.target.value })}
                      />
                    </td>
                    {inventoryOn && (
                      <td className="p-2 w-24" data-label="Stock">
                        <Input
                          type="number"
                          placeholder="∞"
                          title="Blank = untracked (unlimited)"
                          value={r.stock == null ? "" : r.stock}
                          onChange={(e) => setRow(r._id, { stock: e.target.value })}
                        />
                      </td>
                    )}
                    <td className="p-2 w-28" data-label="Status">
                      <Select
                        value={r.status}
                        onChange={(e) =>
                          setRow(r._id, { status: e.target.value })
                        }
                      >
                        <option>Active</option>
                        <option>Disabled</option>
                      </Select>
                    </td>
                    <td
                      className="p-2 text-right whitespace-nowrap admin-actions"
                      data-label="Actions"
                    >
                      <div className="admin-actions-wrap">
                        <Btn
                          variant={r._dirty ? "dark" : "light"}
                          onClick={() => saveRow(r)}
                        >
                          Save
                        </Btn>
                        <Btn variant="danger" onClick={() => removeRow(r)}>
                          Del
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BulkAddModal
        open={bulkOpen}
        label={L}
        labelPlural={Lp}
        onClose={() => setBulkOpen(false)}
        productId={id}
        existingCount={rows ? rows.length : 0}
        onDone={(msg) => {
          toast(msg);
          setBulkOpen(false);
          load();
        }}
        onError={(m) => toast(m, "error")}
      />
      <SetPriceModal
        open={priceOpen}
        labelPlural={Lp}
        count={selectedIds.length}
        onClose={() => setPriceOpen(false)}
        onApply={async ({ price, mrp }) => {
          const body = { ids: selectedIds };
          if (price !== "") body.price = Number(price);
          if (mrp !== "") body.mrp = Number(mrp);
          const res = await bulkUpdateVariants(body);
          if (res.error) return toast(res.error, "error");
          toast(res.success);
          setPriceOpen(false);
          setSelected({});
          load();
        }}
      />
      {node}
    </AdminLayout>
  );
};

/* ---- Bulk add: generate numbered range OR paste a list ---- */
const BulkAddModal = ({
  open,
  label,
  labelPlural,
  onClose,
  productId,
  existingCount,
  onDone,
  onError,
}) => {
  const [mode, setMode] = useState("range");
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState(`${label} `);
  const [padding, setPadding] = useState(2);
  const [startAt, setStartAt] = useState(1);
  const [paste, setPaste] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [busy, setBusy] = useState(false);

  const buildNames = () => {
    if (mode === "range") {
      const n = Math.max(0, parseInt(count, 10) || 0);
      const start = parseInt(startAt, 10) || 1;
      return Array.from({ length: n }, (_, i) =>
        `${prefix}${pad(start + i, parseInt(padding, 10) || 0)}`
      );
    }
    return paste
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const names = open ? buildNames() : [];

  const submit = async () => {
    if (!names.length) return onError("Nothing to create");
    setBusy(true);
    const body = {
      product: productId,
      variants: names.map((name) => ({ name })),
    };
    if (price !== "") body.price = Number(price);
    if (mrp !== "") body.mrp = Number(mrp);
    const res = await bulkCreateVariants(body);
    setBusy(false);
    if (res.error) return onError(res.error);
    onDone(res.success);
  };

  return (
    <Modal open={open} title={`Bulk Add ${labelPlural}`} onClose={onClose}>
      <div className="flex gap-4 mb-3 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "range"}
            onChange={() => setMode("range")}
          />
          Generate numbered range
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "paste"}
            onChange={() => setMode("paste")}
          />
          Paste list
        </label>
      </div>

      {mode === "range" ? (
        <div className="grid grid-cols-4 gap-2">
          <Field label="Prefix">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </Field>
          <Field label="Count">
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </Field>
          <Field label="Start at">
            <Input
              type="number"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </Field>
          <Field label="Pad">
            <Input
              type="number"
              value={padding}
              onChange={(e) => setPadding(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <Field label={`One ${label.toLowerCase()} name per line`}>
          <textarea
            rows="6"
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Passionate Red\nHot Red\nRusty Nude"}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2">
        <Field label="Default price (optional)">
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Default MRP (optional)">
          <Input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </Field>
      </div>

      <div className="text-sm text-gray-500 mt-1">
        Will create <b>{names.length}</b> {labelPlural.toLowerCase()}
        {names.length > 0 && (
          <>
            {" "}
            ({names[0]} … {names[names.length - 1]})
          </>
        )}
        . Existing: {existingCount}.
      </div>

      <div className="flex justify-end space-x-2 mt-4">
        <Btn variant="light" onClick={onClose}>
          Cancel
        </Btn>
        <Btn onClick={submit} disabled={busy}>
          {busy ? "Creating…" : `Create ${names.length}`}
        </Btn>
      </div>
    </Modal>
  );
};

/* ---- Set price/MRP on selected variants ---- */
const SetPriceModal = ({ open, count, labelPlural, onClose, onApply }) => {
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  useEffect(() => {
    if (open) {
      setPrice("");
      setMrp("");
    }
  }, [open]);
  return (
    <Modal
      open={open}
      title={`Set Price/MRP (${count} ${(labelPlural || "items").toLowerCase()})`}
      onClose={onClose}
      width="max-w-sm"
    >
      <Field label="Price">
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="MRP">
        <Input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)} />
      </Field>
      <p className="text-xs text-gray-400 mb-3">Leave a field blank to keep it unchanged.</p>
      <div className="flex justify-end space-x-2">
        <Btn variant="light" onClick={onClose}>
          Cancel
        </Btn>
        <Btn onClick={() => onApply({ price, mrp })}>Apply</Btn>
      </div>
    </Modal>
  );
};

export default VariantManager;
