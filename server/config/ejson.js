// Minimal Extended-JSON codec for backup/restore (dependency-free).
// Preserves the two BSON types VCE actually stores beyond JSON primitives:
// ObjectId -> {"$oid": "<hex>"} and Date -> {"$date": "<iso>"}. Everything
// else round-trips as plain JSON.
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const isObjectId = (v) =>
  v != null &&
  typeof v === "object" &&
  (v._bsontype === "ObjectID" || v._bsontype === "ObjectId" || v instanceof ObjectId);

function encode(v) {
  if (isObjectId(v)) return { $oid: String(v) };
  if (v instanceof Date) return { $date: v.toISOString() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v)) out[k] = encode(v[k]);
    return out;
  }
  return v;
}

function decode(v) {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "$oid") return new ObjectId(v.$oid);
    if (keys.length === 1 && keys[0] === "$date") return new Date(v.$date);
    const out = {};
    for (const k of keys) out[k] = decode(v[k]);
    return out;
  }
  return v;
}

const stringify = (doc) => JSON.stringify(encode(doc));
const parse = (line) => decode(JSON.parse(line));

module.exports = { encode, decode, stringify, parse };
