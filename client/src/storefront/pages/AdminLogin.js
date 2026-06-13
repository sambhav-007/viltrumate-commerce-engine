import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { loginReq } from "../../components/shop/auth/fetchApi";

const AdminLogin = () => {
  const history = useHistory();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await loginReq(f);
    setBusy(false);
    if (!res || res.error) return setErr((res && res.error) || "Login failed");
    if (res.user.role !== 1) return setErr("This account is not an admin.");
    localStorage.setItem("jwt", JSON.stringify({ token: res.token, user: res.user }));
    history.push("/admin/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <form onSubmit={submit} className="bg-card p-8 rounded shadow w-full max-w-sm">
        <img
          src="/logo.png"
          alt="Aura Rare"
          className="h-20 w-auto mx-auto mb-4"
          onError={(e) => (e.target.style.display = "none")}
        />
        <h1 className="font-display text-2xl mb-6 text-center">Admin Login</h1>
        <input
          className="w-full border border-hairline rounded px-3 py-2 mb-3"
          placeholder="Email"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <input
          className="w-full border border-hairline rounded px-3 py-2 mb-4"
          placeholder="Password"
          type="password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <button className="btn-accent w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
