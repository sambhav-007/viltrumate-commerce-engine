import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import AdminLayout from "../layout";
import { getStats, getAnalytics } from "../../../api/admin";
import { useFeature } from "../../../context/SettingsContext";
import { Spinner, PageHeader } from "../ui";
import { money } from "../../../storefront/format";

const Card = ({ label, value, accent, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-lg shadow p-6 flex flex-col ${
      onClick ? "cursor-pointer hover:shadow-md transition" : ""
    }`}
  >
    <span className={`text-3xl font-bold ${accent}`}>{value}</span>
    <span className="text-gray-500 mt-1">{label}</span>
  </div>
);

// Dependency-free horizontal bar list.
const Bars = ({ title, rows, valueLabel }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
    {rows.length === 0 && <p className="text-sm text-gray-400">No data yet.</p>}
    {rows.map((r) => (
      <div key={r.label} className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="truncate pr-2">{r.label}</span>
          <span className="text-gray-500 whitespace-nowrap">{r.display}</span>
        </div>
        <div className="bg-gray-100 rounded h-2">
          <div
            className="bg-gray-800 rounded h-2"
            style={{ width: `${Math.max(2, r.pct)}%` }}
          />
        </div>
      </div>
    ))}
    {valueLabel && <p className="text-xs text-gray-400 mt-2">{valueLabel}</p>}
  </div>
);

const toBars = (rows, label, value, display) => {
  const max = Math.max(1, ...rows.map(value));
  return rows.map((r) => ({
    label: label(r),
    display: display(r),
    pct: (value(r) / max) * 100,
  }));
};

const DashboardAdmin = () => {
  const [stats, setStats] = useState(null);
  const [an, setAn] = useState(null);
  const inventoryOn = useFeature("inventory");
  const history = useHistory();

  useEffect(() => {
    getStats().then((res) => setStats(res && !res.error ? res : {}));
    getAnalytics().then((res) => setAn(res && !res.error ? res : null));
  }, []);

  const toOrders = (status) =>
    history.push(`/admin/dashboard/orders${status ? `?status=${status}` : ""}`);

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Dashboard" />
        {!stats ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card label="Categories" value={stats.categories || 0} accent="text-gray-800" />
              <Card label="Products" value={stats.products || 0} accent="text-gray-800" />
              <Card label="Shades" value={stats.shades || 0} accent="text-gray-800" />
              <Card
                label="Pending Reviews"
                value={stats.pendingReviews || 0}
                accent={stats.pendingReviews ? "text-red-600" : "text-gray-800"}
              />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mt-8 mb-3">Orders</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card
                label="Pending Orders"
                value={stats.pendingOrders || 0}
                accent={stats.pendingOrders ? "text-red-600" : "text-gray-800"}
                onClick={() => toOrders("pending")}
              />
              <Card
                label="Orders Today"
                value={stats.ordersToday || 0}
                accent="text-gray-800"
                onClick={() => toOrders("all")}
              />
              <Card
                label="Total Orders"
                value={stats.totalOrders || 0}
                accent="text-gray-800"
                onClick={() => toOrders("all")}
              />
              <Card label="Revenue" value={money(stats.revenue || 0)} accent="text-green-600" />
            </div>

            {inventoryOn && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <Card
                  label="Low Stock (≤5)"
                  value={stats.lowStock || 0}
                  accent={stats.lowStock ? "text-red-600" : "text-gray-800"}
                />
              </div>
            )}

            {an && (
              <>
                <h2 className="text-lg font-semibold text-gray-700 mt-8 mb-3">
                  Last {an.days} days
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Bars
                    title="Revenue by day"
                    rows={toBars(
                      (an.byDay || []).slice(-14),
                      (r) => r._id.slice(5),
                      (r) => r.revenue,
                      (r) => money(r.revenue)
                    )}
                    valueLabel="Realised sales (confirmed + fulfilled), last 14 days shown"
                  />
                  <Bars
                    title="Top products"
                    rows={toBars(
                      an.topProducts || [],
                      (r) => r._id || "—",
                      (r) => r.qty,
                      (r) => `${r.qty} pcs · ${money(r.revenue)}`
                    )}
                  />
                  <Bars
                    title="Orders by method"
                    rows={toBars(
                      an.byMethod || [],
                      (r) => r._id || "—",
                      (r) => r.orders,
                      (r) => `${r.orders} orders`
                    )}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default DashboardAdmin;
