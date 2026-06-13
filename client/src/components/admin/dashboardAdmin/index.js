import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import { getStats } from "../../../api/admin";
import { Spinner, PageHeader } from "../ui";

const Card = ({ label, value, accent }) => (
  <div className="bg-white rounded-lg shadow p-6 flex flex-col">
    <span className={`text-3xl font-bold ${accent}`}>{value}</span>
    <span className="text-gray-500 mt-1">{label}</span>
  </div>
);

const DashboardAdmin = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getStats().then((res) => setStats(res && !res.error ? res : {}));
  }, []);

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Dashboard" />
        {!stats ? (
          <Spinner />
        ) : (
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
        )}
      </div>
    </AdminLayout>
  );
};

export default DashboardAdmin;
