const fs = require("fs");

const file = "./src/data/towns/ma-towns.json";
const towns = JSON.parse(fs.readFileSync(file, "utf8"));

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

let fixed = 0;

for (const t of towns) {
  if (!t.slug || String(t.slug).trim() === "") {
    t.slug = slugify(t.name);
    fixed++;
  }
}

fs.writeFileSync(file, JSON.stringify(towns, null, 2) + "\n", "utf8");
console.log("Fixed slugs:", fixed);
