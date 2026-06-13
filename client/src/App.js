import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import { SettingsProvider } from "./context/SettingsContext";
import { CartProvider } from "./context/CartContext";
import AdminProtectedRoute from "./components/shop/auth/AdminProtectedRoute";
import TopLoader from "./storefront/TopLoader";
import ScrollToTop from "./storefront/ScrollToTop";

// Storefront (customer-critical path, bundled eagerly)
import Home from "./storefront/pages/Home";
import Collections from "./storefront/pages/Collections";
import Category from "./storefront/pages/Category";
import Product from "./storefront/pages/Product";
import Search from "./storefront/pages/Search";
import Cart from "./storefront/pages/Cart";
import Checkout from "./storefront/pages/Checkout";
import ThankYou from "./storefront/pages/ThankYou";
import About from "./storefront/pages/About";
import Contact from "./storefront/pages/Contact";
import AdminLogin from "./storefront/pages/AdminLogin";
import NotFound from "./storefront/pages/NotFound";

// Admin (lazy — keeps the customer bundle lean)
const DashboardAdmin = lazy(() => import("./components/admin/dashboardAdmin"));
const Categories = lazy(() => import("./components/admin/categories"));
const Products = lazy(() => import("./components/admin/products"));
const ShadeManager = lazy(() => import("./components/admin/shades"));
const Banners = lazy(() => import("./components/admin/banners"));
const Reviews = lazy(() => import("./components/admin/reviews"));
const Settings = lazy(() => import("./components/admin/settings"));

const AdminFallback = (
  <div className="flex items-center justify-center min-h-screen text-muted">Loading…</div>
);

function App() {
  return (
    <SettingsProvider>
      <CartProvider>
        <TopLoader />
        <Router>
          <ScrollToTop />
          <Suspense fallback={AdminFallback}>
            <Switch>
              {/* Storefront */}
              <Route exact path="/" component={Home} />
              <Route exact path="/category" component={Collections} />
              <Route exact path="/category/:slug" component={Category} />
              <Route exact path="/product/:slug" component={Product} />
              <Route exact path="/search" component={Search} />
              <Route exact path="/cart" component={Cart} />
              <Route exact path="/checkout" component={Checkout} />
              <Route exact path="/thank-you" component={ThankYou} />
              <Route exact path="/about" component={About} />
              <Route exact path="/contact" component={Contact} />

              {/* Admin */}
              <Route exact path="/admin/login" component={AdminLogin} />
              <AdminProtectedRoute exact path="/admin/dashboard" component={DashboardAdmin} />
              <AdminProtectedRoute
                exact
                path="/admin/dashboard/categories"
                component={Categories}
              />
              <AdminProtectedRoute exact path="/admin/dashboard/products" component={Products} />
              <AdminProtectedRoute
                exact
                path="/admin/dashboard/products/:id/shades"
                component={ShadeManager}
              />
              <AdminProtectedRoute exact path="/admin/dashboard/banners" component={Banners} />
              <AdminProtectedRoute exact path="/admin/dashboard/reviews" component={Reviews} />
              <AdminProtectedRoute exact path="/admin/dashboard/settings" component={Settings} />

              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </Router>
      </CartProvider>
    </SettingsProvider>
  );
}

export default App;
