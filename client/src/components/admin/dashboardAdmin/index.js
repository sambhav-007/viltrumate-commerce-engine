import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import AdminLayout from "../layout";
import { getStats } from "../../../api/admin";
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

const DashboardAdmin = () => {
  const [stats, setStats] = useState(null);
  const history = useHistory();

  useEffect(() => {
    getStats().then((res) => setStats(res && !res.error ? res : {}));
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
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default DashboardAdmin;
