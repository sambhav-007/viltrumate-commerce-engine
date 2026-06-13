import React from "react";

// Lightweight shared admin UI primitives (no external deps).

export const Spinner = () => (
  <div className="flex justify-center py-10 text-gray-500">Loading…</div>
);

export const PageHeader = ({ title, action }) => (
  <div className="flex items-center justify-between mb-4">
    <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
    {action}
  </div>
);

export const Btn = ({ variant = "dark", className = "", ...rest }) => {
  const styles = {
    dark: "bg-gray-800 text-white hover:bg-gray-900",
    light: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-gray-600 hover:text-gray-900",
  };
  return (
    <button
      className={`px-4 py-2 rounded text-sm font-medium transition ${styles[variant]} ${className}`}
      {...rest}
    />
  );
};

export const Field = ({ label, children }) => (
  <label className="block mb-3">
    {label && (
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    )}
    {children}
  </label>
);

export const Input = (props) => (
  <input
    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-gray-500"
    {...props}
  />
);

export const Textarea = (props) => (
  <textarea
    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-gray-500"
    {...props}
  />
);

export const Select = ({ children, ...props }) => (
  <select
    className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:border-gray-500"
    {...props}
  >
    {children}
  </select>
);

export const Modal = ({ open, title, onClose, children, width = "max-w-lg" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black bg-opacity-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${width} my-8`}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// Minimal inline toast hook.
export const useToast = () => {
  const [msg, setMsg] = React.useState(null);
  const toast = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };
  const node = msg ? (
    <div
      className={`fixed bottom-5 right-5 z-50 px-4 py-2 rounded shadow text-white ${
        msg.type === "error" ? "bg-red-600" : "bg-green-600"
      }`}
    >
      {msg.text}
    </div>
  ) : null;
  return { toast, node };
};

// Resolve our { url } image shape (or null) to a src string.
export const imgUrl = (image) => (image && image.url) || null;
