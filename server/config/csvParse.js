// Minimal RFC4180-ish CSV parser (no dependency). Handles quoted fields,
// escaped quotes (""), commas and newlines inside quotes, and CRLF/LF. Strips a
// leading UTF-8 BOM. Returns an array of row objects keyed by the header row.
function parseCsv(text) {
  if (typeof text !== "string") return [];
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // handled by the \n (or end); ignore lone CR
    } else {
      field += c;
    }
  }
  // flush trailing field/row if the file doesn't end with a newline
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop fully empty rows (e.g. trailing blank lines).
  const nonEmpty = rows.filter((r) => r.some((v) => String(v).trim() !== ""));
  if (!nonEmpty.length) return [];

  const headers = nonEmpty[0].map((h) => String(h).trim());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] !== undefined ? String(r[idx]) : "").trim();
    });
    return obj;
  });
}

module.exports = { parseCsv };
