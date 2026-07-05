import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminLayout from "../layout";
import { getOrders, updateOrderStatus } from "../../../api/admin";
import { Spinner, PageHeader, Btn, Modal, useToast } from "../ui";
import { money } from "../../../storefront/format";

const FILTERS = ["pending", "confirmed", "fulfilled", "cancelled", "all"];

// Client mirror of the server transition rules (server is the source of truth).
const NEXT = {
  pending: [["confirmed", "Confirm", "dark"], ["cancelled", "Cancel", "danger"]],
  confirmed: [["fulfilled", "Mark Fulfilled", "dark"], ["cancelled", "Cancel", "danger"]],
  fulfilled: [],
  cancelled: [],
};

const STATUS_STYLE = {
  pending: "text-yellow-600",
  confirmed: "text-blue-600",
  fulfilled: "text-green-600",
  cancelled: "text-gray-400",
};

const shortId = (id) => (id ? id.slice(-6).toUpperCase() : "—");
const when = (d) => (d ? new Date(d).toLocaleString() : "—");

const Orders = () => {
  const location = useLocation();
  // Initial filter can be deep-linked from the dashboard (?status=pending).
  const initial = new URLSearchParams(location.search).get("status");
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState(
    FILTERS.includes(initial) ? initial : "pending"
  );
  const [active, setActive] = useState(null); // order shown in the modal
  const { toast, node } = useToast();

  const load = () => {
    const q = filter === "all" ? "" : `?status=${filter}`;
    return getOrders(q).then((res) => setList((res && res.orders) || []));
  };
  useEffect(() => {
    setList(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const changeStatus = async (order, status) => {
    const res = await updateOrderStatus(order._id, status);
    if (res.error) return toast(res.error, "error");
    toast(res.success || "Updated");
    setActive(res.order || null);
    load();
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Orders" />
        <div className="flex flex-wrap gap-2 mb-3 text-sm">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded capitalize ${
                filter === f ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {!list ? (
          <Spinner />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="admin-table w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="p-3">Order #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-gray-400">
                      No orders.
                    </td>
                  </tr>
                )}
                {list.map((o) => (
                  <tr key={o._id} className="border-t">
                    <td className="p-3 font-mono text-gray-700" data-label="Order #">
                      {shortId(o._id)}
                    </td>
                    <td className="p-3 whitespace-nowrap" data-label="Date">
                      {when(o.createdAt)}
                    </td>
                    <td className="p-3" data-label="Customer">
                      <div className="font-medium text-gray-800">
                        {o.customer ? o.customer.name : "—"}
                      </div>
                      <div className="text-gray-500">
                        {o.customer ? o.customer.phone : ""}
                      </div>
                    </td>
                    <td className="p-3" data-label="Items">
                      {(o.items || []).reduce((n, it) => n + (it.qty || 0), 0)}
                    </td>
                    <td className="p-3" data-label="Total">{money(o.total)}</td>
                    <td className="p-3 capitalize" data-label="Payment">
                      {o.paymentMethod}
                    </td>
                    <td
                      className={`p-3 capitalize ${STATUS_STYLE[o.status] || ""}`}
                      data-label="Status"
                    >
                      {o.status}
                    </td>
                    <td
                      className="p-3 text-right whitespace-nowrap admin-actions"
                      data-label="Actions"
                    >
                      <div className="admin-actions-wrap">
                        <Btn variant="light" onClick={() => setActive(o)}>
                          View
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

      <Modal
        open={!!active}
        title={active ? `Order #${shortId(active._id)}` : ""}
        onClose={() => setActive(null)}
        width="max-w-xl"
      >
        {active && (
          <div className="text-sm text-gray-700">
            <div className="flex justify-between mb-3">
              <span className="text-gray-500">Placed</span>
              <span>{when(active.createdAt)}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-gray-500">Status</span>
              <span className={`capitalize font-medium ${STATUS_STYLE[active.status] || ""}`}>
                {active.status}
              </span>
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-gray-500">Payment</span>
              <span className="capitalize">{active.paymentMethod}</span>
            </div>

            <div className="border-t pt-3 mb-4">
              <div className="font-medium text-gray-800 mb-1">Customer</div>
              <div>{active.customer && active.customer.name}</div>
              <div className="text-gray-500">{active.customer && active.customer.phone}</div>
              <div className="text-gray-500 whitespace-pre-line">
                {active.customer && active.customer.address}
              </div>
            </div>

            <div className="border-t pt-3 mb-4">
              <div className="font-medium text-gray-800 mb-2">Items</div>
              {(active.items || []).map((it, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>
                    {it.productName} — {it.variantName} × {it.qty}
                  </span>
                  <span>{money((it.price || 0) * (it.qty || 0))}</span>
                </div>
              ))}
              <div className="flex justify-between border-t mt-2 pt-2 font-medium">
                <span>Total</span>
                <span>{money(active.total)}</span>
              </div>
            </div>

            {NEXT[active.status] && NEXT[active.status].length > 0 && (
              <div className="border-t pt-3 flex gap-2 justify-end">
                {NEXT[active.status].map(([status, label, variant]) => (
                  <Btn
                    key={status}
                    variant={variant}
                    onClick={() => changeStatus(active, status)}
                  >
                    {label}
                  </Btn>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
      {node}
    </AdminLayout>
  );
};

export default Orders;
