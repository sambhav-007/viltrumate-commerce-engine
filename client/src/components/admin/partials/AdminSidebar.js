import React, { Fragment } from "react";
import { useLocation, useHistory } from "react-router-dom";

const Item = ({ to, label, active, onClick }) => (
  <Fragment>
    <div
      onClick={onClick}
      className={`${
        active ? "border-r-4 border-gray-800 bg-gray-100" : ""
      } hover:bg-gray-200 cursor-pointer flex items-center px-6 py-4 text-gray-700`}
    >
      <span className="hover:text-gray-900">{label}</span>
    </div>
    <hr className="border-b border-gray-200" />
  </Fragment>
);

const links = [
  { path: "/admin/dashboard", label: "Dashboard" },
  { path: "/admin/dashboard/categories", label: "Categories" },
  { path: "/admin/dashboard/products", label: "Products" },
  { path: "/admin/dashboard/orders", label: "Orders" },
  { path: "/admin/dashboard/banners", label: "Banners" },
  { path: "/admin/dashboard/reviews", label: "Reviews" },
  { path: "/admin/dashboard/settings", label: "Store Settings" },
];

const AdminSidebar = () => {
  const location = useLocation();
  const history = useHistory();
  return (
    <div
      style={{ boxShadow: "1px 1px 8px 0.2px #aaaaaa" }}
      id="sidebar"
      className="hidden md:block sticky top-0 left-0 h-screen md:w-3/12 lg:w-2/12 bg-white"
    >
      {links.map((l) => (
        <Item
          key={l.path}
          label={l.label}
          active={
            l.path === "/admin/dashboard"
              ? location.pathname === l.path
              : location.pathname.startsWith(l.path) ||
                (l.label === "Products" &&
                  location.pathname.includes("/products/"))
          }
          onClick={() => history.push(l.path)}
        />
      ))}
    </div>
  );
};

export default AdminSidebar;
