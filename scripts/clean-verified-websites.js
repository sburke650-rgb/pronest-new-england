const fs = require("fs");

const COMPANIES_FILE = "./src/data/companies/ma-companies.json";
const AUDIT_FILE = "./verified-website-audit.json";

const companies = JSON.parse(fs.readFileSync(COMPANIES_FILE, "utf8"));
const audit = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8"));

const flagged = new Set(
  audit.flagged
    .filter((x) => x.verdict === "failed" || x.verdict === "suspicious")
    .map((x) => x.id)
);

let cleaned = 0;

for (const company of companies) {
  if (flagged.has(company.id) && company.website) {
    company.website = "";
    cleaned++;
  }
}

fs.writeFileSync(
  COMPANIES_FILE,
  JSON.stringify(companies, null, 2) + "\n"
);

console.log("Cleaned websites:", cleaned);