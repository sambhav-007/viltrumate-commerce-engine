import React, { useState } from "react";
import { Modal, Btn, useToast } from "../ui";
import { previewProductImport, runProductImport } from "../../../api/admin";

// Single source of truth for the template columns + example rows.
const TEMPLATE = [
  "product_name,category,product_description,featured,product_image_url,variant_name,price,mrp,variant_image_url,status",
  "Oak Dining Table,Furniture,Solid oak table,true,,Natural,12999,15999,,Active",
  "Oak Dining Table,Furniture,Solid oak table,,,Walnut,13499,,,Active",
  "Desk Lamp,Lighting,Adjustable desk lamp,false,,Standard,899,,,Active",
].join("\n");

const downloadTemplate = () => {
  const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const Stat = ({ label, value, accent }) => (
  <div className="bg-gray-50 rounded p-3 text-center">
    <div className={`text-2xl font-bold ${accent || "text-gray-800"}`}>{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

const ImportModal = ({ open, onClose, onImported }) => {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  const reset = () => {
    setCsv("");
    setFileName("");
    setPreview(null);
    setReport(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    setReport(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || "");
      setCsv(text);
      setBusy(true);
      const res = await previewProductImport(text);
      setBusy(false);
      if (res.error) {
        setPreview(null);
        return toast(res.error, "error");
      }
      setPreview(res);
    };
    reader.readAsText(f);
  };

  const doImport = async () => {
    setBusy(true);
    const res = await runProductImport(csv);
    setBusy(false);
    if (res.error) return toast(res.error, "error");
    setReport(res);
    if (onImported) onImported();
  };

  const invalid = preview ? preview.rows.filter((r) => !r.ok) : [];

  return (
    <Modal open={open} title="Import Products from CSV" onClose={close} width="max-w-3xl">
      {/* Step 1 — template + file */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Btn variant="light" type="button" onClick={downloadTemplate}>
          ⤓ Download template
        </Btn>
        <label className="text-sm">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        </label>
      </div>

      {busy && !report && <p className="text-sm text-gray-500 py-4">Working…</p>}

      {/* Step 2 — preview */}
      {preview && !report && (
        <div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            <Stat label="Total rows" value={preview.summary.totalRows} />
            <Stat label="Valid" value={preview.summary.validRows} accent="text-green-600" />
            <Stat
              label="Invalid"
              value={preview.summary.invalidRows}
              accent={preview.summary.invalidRows ? "text-red-600" : "text-gray-800"}
            />
            <Stat label="Products" value={preview.summary.productsToCreate} />
            <Stat label="Variants" value={preview.summary.variantsToCreate} />
            <Stat label="New cats" value={preview.summary.categoriesToCreate} />
          </div>

          {invalid.length > 0 && (
            <div className="mb-4 max-h-48 overflow-auto border border-gray-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 text-left sticky top-0">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Errors (row will be skipped)</th>
                  </tr>
                </thead>
                <tbody>
                  {invalid.map((r) => (
                    <tr key={r.rowNum} className="border-t">
                      <td className="p-2 font-mono">{r.rowNum}</td>
                      <td className="p-2 text-red-600">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Btn type="button" variant="light" onClick={close}>
              Cancel
            </Btn>
            <Btn
              type="button"
              onClick={doImport}
              disabled={busy || preview.summary.validRows === 0}
            >
              {busy
                ? "Importing…"
                : `Import ${preview.summary.validRows} valid row${
                    preview.summary.validRows === 1 ? "" : "s"
                  }`}
            </Btn>
          </div>
        </div>
      )}

      {/* Step 3 — report */}
      {report && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Stat label="Categories" value={report.created.categories} accent="text-green-600" />
            <Stat label="Products" value={report.created.products} accent="text-green-600" />
            <Stat label="Variants" value={report.created.variants} accent="text-green-600" />
            <Stat
              label="Skipped"
              value={report.skippedRows}
              accent={report.skippedRows ? "text-red-600" : "text-gray-800"}
            />
          </div>
          {report.imageWarnings && report.imageWarnings.length > 0 && (
            <div className="mb-4 text-xs text-yellow-700 bg-yellow-50 rounded p-3 max-h-40 overflow-auto">
              <div className="font-medium mb-1">Image warnings:</div>
              {report.imageWarnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
          <p className="text-sm text-green-700 mb-4">{report.success}.</p>
          <div className="flex justify-end">
            <Btn type="button" onClick={close}>
              Done
            </Btn>
          </div>
        </div>
      )}

      {!preview && !report && !busy && (
        <p className="text-xs text-gray-400">
          {fileName ? `Selected: ${fileName}` : "Choose a .csv file to preview the import."}
        </p>
      )}
      {node}
    </Modal>
  );
};

export default ImportModal;
