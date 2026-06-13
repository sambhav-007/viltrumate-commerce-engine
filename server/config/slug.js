const slugify = require("slugify");

const baseSlug = (str) => slugify(String(str), { lower: true, strict: true });

// Ensure slug uniqueness within a collection by appending -1, -2, ... on clash.
async function uniqueSlug(Model, str, ignoreId = null) {
  const base = baseSlug(str);
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Model.exists(ignoreId ? { slug, _id: { $ne: ignoreId } } : { slug })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

module.exports = { baseSlug, uniqueSlug };
