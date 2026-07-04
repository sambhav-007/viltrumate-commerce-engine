import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "../../../api/admin";
import {
  Spinner,
  PageHeader,
  Btn,
  Field,
  Input,
  Select,
  useToast,
} from "../ui";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const emptyForm = {
  code: "",
  type: "percent",
  value: "",
  minCart: "",
  maxUses: "",
  expiresAt: "",
};

const Coupons = () => {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  const load = () => getCoupons().then((r) => setRows(r.coupons || []));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.code.trim() || f.value === "") return toast("Code and value are required", "error");
    setBusy(true);
    const res = await createCoupon({
      code: f.code.trim(),
      type: f.type,
      value: Number(f.value),
      minCart: f.minCart === "" ? 0 : Number(f.minCart),
      maxUses: f.maxUses === "" ? null : Number(f.maxUses),
      expiresAt: f.expiresAt || null,
    });
    setBusy(false);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    setF(emptyForm);
    load();
  };

  const toggle = async (c) => {
    const res = await updateCoupon(c._id, {
      status: c.status === "Active" ? "Disabled" : "Active",
    });
    if (res.error) return toast(res.error, "error");
    load();
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    const res = await deleteCoupon(c._id);
    if (res.error) return toast(res.error, "error");
    toast("Coupon deleted");
    load();
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Coupons" />

        {/* Create */}
        <form onSubmit={submit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <Field label="Code">
              <Input
                value={f.code}
                onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
              />
            </Field>
            <Field label="Type">
              <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                <option value="percent">% off</option>
                <option value="flat">Flat off</option>
              </Select>
            </Field>
            <Field label={f.type === "percent" ? "Percent" : "Amount"}>
              <Input
                type="number"
                value={f.value}
                onChange={(e) => setF({ ...f, value: e.target.value })}
              />
            </Field>
            <Field label="Min cart (opt)">
              <Input
                type="number"
                value={f.minCart}
                onChange={(e) => setF({ ...f, minCart: e.target.value })}
              />
            </Field>
            <Field label="Max uses (opt)">
              <Input
                type="number"
                value={f.maxUses}
                onChange={(e) => setF({ ...f, maxUses: e.target.value })}
              />
            </Field>
            <Field label="Expires (opt)">
              <Input
                type="date"
                value={f.expiresAt}
                onChange={(e) => setF({ ...f, expiresAt: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Btn type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create Coupon"}
            </Btn>
          </div>
        </form>

        {/* List */}
        {!rows ? (
          <Spinner />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="admin-table w-full text-sm text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Code</th>
                  <th className="p-3">Discount</th>
                  <th className="p-3">Min cart</th>
                  <th className="p-3">Uses</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-gray-400">
                      No coupons yet.
                    </td>
                  </tr>
                )}
                {rows.map((c) => (
                  <tr key={c._id} className="border-t">
                    <td className="p-3 font-medium" data-label="Code">{c.code}</td>
                    <td className="p-3" data-label="Discount">
                      {c.type === "percent" ? `${c.value}%` : c.value}
                    </td>
                    <td className="p-3" data-label="Min cart">{c.minCart || "—"}</td>
                    <td className="p-3" data-label="Uses">
                      {c.usedCount}
                      {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td className="p-3" data-label="Expires">{fmtDate(c.expiresAt)}</td>
                    <td className="p-3" data-label="Status">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          c.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right admin-actions" data-label="Actions">
                      <div className="admin-actions-wrap">
                        <Btn variant="light" onClick={() => toggle(c)}>
                          {c.status === "Active" ? "Disable" : "Enable"}
                        </Btn>
                        <Btn variant="danger" onClick={() => remove(c)}>
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
      {node}
    </AdminLayout>
  );
};

export default Coupons;
