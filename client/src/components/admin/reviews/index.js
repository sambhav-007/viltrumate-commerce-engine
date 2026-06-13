import React, { useEffect, useState } from "react";
import AdminLayout from "../layout";
import { getAllReviews, approveReview, deleteReview } from "../../../api/admin";
import { Spinner, PageHeader, Btn, useToast } from "../ui";

const Stars = ({ n }) => (
  <span className="text-yellow-500">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>
);

const Reviews = () => {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("pending");
  const { toast, node } = useToast();

  const load = () => getAllReviews().then((res) => setList(res.reviews || []));
  useEffect(() => {
    load();
  }, []);

  const approve = async (r) => {
    const res = await approveReview(r._id);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    load();
  };
  const remove = async (r) => {
    if (!window.confirm("Delete this review?")) return;
    const res = await deleteReview(r._id);
    if (res.error) return toast(res.error, "error");
    toast(res.success);
    load();
  };

  const shown = (list || []).filter((r) =>
    filter === "all" ? true : filter === "pending" ? !r.approved : r.approved
  );

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <PageHeader title="Reviews" />
        <div className="flex gap-2 mb-3 text-sm">
          {["pending", "approved", "all"].map((f) => (
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
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="p-3">Product / Shade</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">Review</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-gray-400">
                      No reviews.
                    </td>
                  </tr>
                )}
                {shown.map((r) => (
                  <tr key={r._id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium text-gray-800">
                        {r.product ? r.product.name : "—"}
                      </div>
                      <div className="text-gray-500">
                        {r.shade ? r.shade.name : ""}
                      </div>
                    </td>
                    <td className="p-3">{r.customerName}</td>
                    <td className="p-3"><Stars n={r.rating} /></td>
                    <td className="p-3 max-w-xs">{r.text}</td>
                    <td className="p-3">
                      {r.approved ? (
                        <span className="text-green-600">Approved</span>
                      ) : (
                        <span className="text-yellow-600">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      {!r.approved && (
                        <Btn onClick={() => approve(r)}>Approve</Btn>
                      )}
                      <Btn variant="danger" onClick={() => remove(r)}>
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
      {node}
    </AdminLayout>
  );
};

export default Reviews;
