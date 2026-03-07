const fs = require("fs");
const path = require("path");

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function check(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  const base = "http://localhost:4321";
  const root = process.cwd();

  const towns = readJson(path.join(root, "src", "data", "towns", "ma-towns.json"));
  const companies = readJson(path.join(root, "src", "data", "companies", "ma-companies.json"));

  let pass = 0;
  let fail = 0;

  console.log("Testing routes...\n");

  // Test town pages
  for (const t of towns.slice(0, 50)) {
    const url = `${base}/ma/${norm(t.slug)}/`;
    const status = await check(url);
    if (status === 200) pass++;
    else {
      fail++;
      console.log("FAIL:", status, url);
    }
  }

  // Test company pages (sample 50)
  for (const c of companies.slice(0, 50)) {
    const url = `${base}/ma/${norm(c.townSlug)}/${norm(c.serviceId)}/${c.id}`;
    const status = await check(url);
    if (status === 200) pass++;
    else {
      fail++;
      console.log("FAIL:", status, url);
    }
  }

  console.log("\nDone.");
  console.log("PASS:", pass);
  console.log("FAIL:", fail);
}

main();
