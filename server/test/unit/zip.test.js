const { test } = require("node:test");
const assert = require("node:assert");
const { zipSync, crc32 } = require("../../platform/deploy/zip");

test("crc32: known value for 'abc'", () => {
  // CRC-32 of "abc" is 0x352441C2
  assert.equal(crc32(Buffer.from("abc")) >>> 0, 0x352441c2);
});

test("zipSync: valid archive with correct EOCD + entry count", () => {
  const entries = [
    { name: "a.txt", content: "hello" },
    { name: "b.json", content: JSON.stringify({ x: 1 }) },
  ];
  const buf = zipSync(entries);
  // End-of-central-directory signature at the tail
  assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50);
  // total entries recorded
  assert.equal(buf.readUInt16LE(buf.length - 22 + 10), 2);
  // first local file header signature
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  // filename present
  assert.ok(buf.includes(Buffer.from("a.txt")));
});
