// Semantic version helper for the Deployment Engine. The first deployment of a
// store is 1.0.0; subsequent generations bump patch (default), minor, or major.
function bumpVersion(current, level = "patch") {
  if (!current || !/^\d+\.\d+\.\d+$/.test(current)) return "1.0.0";
  const [maj, min, pat] = current.split(".").map(Number);
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

module.exports = { bumpVersion };
