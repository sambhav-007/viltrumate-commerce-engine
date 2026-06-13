import React, { Fragment, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

const links = [
  { path: "/admin/dashboard", label: "Dashboard" },
  { path: "/admin/dashboard/categories", label: "Categories" },
  { path: "/admin/dashboard/products", label: "Products" },
  { path: "/admin/dashboard/banners", label: "Banners" },
  { path: "/admin/dashboard/reviews", label: "Reviews" },
  { path: "/admin/dashboard/settings", label: "Store Settings" },
];

const AdminNavber = () => {
  const history = useHistory();
  const location = useLocation();
  const [userMenu, setUserMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const logout = () => {
    localStorage.removeItem("jwt");
    localStorage.removeItem("cart");
    localStorage.removeItem("wishList");
    window.location.href = "/";
  };

  const closeAll = () => {
    setUserMenu(false);
    setMobileMenu(false);
  };

  return (
    <Fragment>
      {/* click-away backdrop */}
      {(userMenu || mobileMenu) && (
        <div className="fixed inset-0 z-10" onClick={closeAll} />
      )}

      <nav className="sticky z-20 flex items-center shadow-md justify-between px-4 py-4 md:px-8 top-0 w-full bg-white">
        {/* Left: mobile hamburger */}
        <button
          className="lg:hidden text-gray-600 focus:outline-none"
          onClick={() => {
            setMobileMenu(!mobileMenu);
            setUserMenu(false);
          }}
          aria-label="Menu"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand */}
        <span
          onClick={() => history.push("/admin/dashboard")}
          style={{ letterSpacing: "0.5rem" }}
          className="font-bold uppercase text-gray-800 text-xl md:text-2xl cursor-pointer"
        >
          Aura Rare
        </span>

        {/* Right: actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.open("/", "_blank")}
            className="hover:bg-gray-200 rounded-lg p-2 text-gray-600 hover:text-gray-800"
            title="View Store"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* User dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setUserMenu(!userMenu);
                setMobileMenu(false);
              }}
              className="hover:bg-gray-200 rounded-lg p-2 text-gray-600 hover:text-gray-800"
              title="Account"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {userMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg border border-gray-100 z-20">
                <button
                  onClick={() => { closeAll(); history.push("/admin/dashboard/settings"); }}
                  className="block w-full text-left py-2 px-5 hover:bg-gray-100 text-gray-700"
                >
                  Store Settings
                </button>
                <button
                  onClick={() => window.open("/", "_blank")}
                  className="block w-full text-left py-2 px-5 hover:bg-gray-100 text-gray-700"
                >
                  View Store
                </button>
                <button
                  onClick={logout}
                  className="block w-full text-left py-2 px-5 hover:bg-gray-100 text-red-600"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile nav menu (sidebar is hidden on mobile) */}
      {mobileMenu && (
        <div className="lg:hidden sticky top-16 z-20 bg-white shadow-md border-t border-gray-100">
          {links.map((l) => (
            <button
              key={l.path}
              onClick={() => { closeAll(); history.push(l.path); }}
              className={`block w-full text-left py-3 px-6 hover:bg-gray-100 ${
                location.pathname === l.path ? "text-gray-900 font-semibold bg-gray-50" : "text-gray-600"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </Fragment>
  );
};

export default AdminNavber;
