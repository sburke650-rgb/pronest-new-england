// C:\Users\16035\Desktop\NewEnglandSnowDirectory\scripts\report-ma-coverage.cjs
// MA coverage report: counts companies per town + per service, and shows empty/thin towns.

const fs = require("fs");
const path = require("path");

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function parseArgs() {
  const out = { thin: 3, top: 50 };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--thin=")) out.thin = Number(a.split("=")[1]) || out.thin;
    if (a.startsWith("--top=")) out.top = Number(a.split("=")[1]) || out.top;
  }
  return out;
}

function padRight(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function main() {
  const args = parseArgs();
  const root = process.cwd();

  const townsPath = path.join(root, "src", "data", "towns", "ma-towns.json");
  const servicesPath = path.join(root, "src", "data", "services", "ma-services.json");
  const companiesPath = path.join(root, "src", "data", "companies", "ma-companies.json");

  for (const p of [townsPath, servicesPath, companiesPath]) {
    if (!fs.existsSync(p)) {
      console.error("ERROR: Missing file:", p);
      console.error("Run from: C:\\Users\\16035\\Desktop\\NewEnglandSnowDirectory");
      process.exit(1);
    }
  }

  const towns = readJson(townsPath).filter((t) => norm(t.state) === "ma");
  const services = readJson(servicesPath);
  const companies = readJson(companiesPath).filter((c) => norm(c.state) === "ma");

  const townCounts = new Map();
  const serviceCounts = new Map();

  for (const c of companies) {
    const townSlug = norm(c.townSlug);
    const serviceId = norm(c.serviceId);
    if (!townSlug || !serviceId) continue;

    townCounts.set(townSlug, (townCounts.get(townSlug) || 0) + 1);
    serviceCounts.set(serviceId, (serviceCounts.get(serviceId) || 0) + 1);
  }

  const emptyTowns = [];
  const thinTowns = [];

  for (const t of towns) {
    const slug = norm(t.slug);
    const count = townCounts.get(slug) || 0;
    if (count === 0) emptyTowns.push({ slug, name: t.name });
    if (count > 0 && count < args.thin) thinTowns.push({ slug, name: t.name, count });
  }

  const townsSorted = towns
    .map((t) => {
      const slug = norm(t.slug);
      return { slug, name: t.name, count: townCounts.get(slug) || 0 };
    })
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));

  const servicesSorted = services
    .map((s) => {
      const id = norm(s.id);
      return { id, name: s.name || s.id, count: serviceCounts.get(id) || 0 };
    })
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));

  console.log("");
  console.log("=== MA Coverage Report ===");
  console.log("Project root:", root);
  console.log("Companies (MA):", companies.length);
  console.log("Towns (MA):", towns.length);
  console.log("Services:", services.length);
  console.log("Thin threshold:", args.thin);
  console.log("");

  console.log("=== Towns: Top " + args.top + " by company count ===");
  const townNameWidth = 28;
  for (const row of townsSorted.slice(0, args.top)) {
    console.log(`${padRight(row.name, townNameWidth)}  ${row.count}   /ma/${row.slug}/`);
  }
  console.log("");

  console.log("=== Services: Top " + args.top + " by company count ===");
  const svcNameWidth = 28;
  for (const row of servicesSorted.slice(0, args.top)) {
    console.log(`${padRight(row.name, svcNameWidth)}  ${row.count}   /ma/services/${row.id}`);
  }
  console.log("");

  console.log("=== Empty towns (0 companies): " + emptyTowns.length + " ===");
  emptyTowns.sort((a, b) => a.name.localeCompare(b.name));
  for (const row of emptyTowns.slice(0, 100)) {
    console.log(`${row.name}   /ma/${row.slug}/`);
  }
  if (emptyTowns.length > 100) console.log("... (more hidden)");
  console.log("");

  console.log(`=== Thin towns (1 to ${args.thin - 1} companies): ${thinTowns.length} ===`);
  thinTowns.sort((a, b) => (a.count - b.count) || a.name.localeCompare(b.name));
  for (const row of thinTowns.slice(0, 100)) {
    console.log(`${row.name}  (${row.count})   /ma/${row.slug}/`);
  }
  if (thinTowns.length > 100) console.log("... (more hidden)");
  console.log("");

  console.log("Done.");
}

main();
