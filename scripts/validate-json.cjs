// C:\Users\16035\Desktop\NewEnglandSnowDirectory\scripts\validate-json.cjs
const fs = require("fs");
const path = require("path");

function mustParse(p) {
  const raw = fs.readFileSync(p, "utf8");
  JSON.parse(raw);
}

function main() {
  const root = process.cwd();
  const files = [
    path.join(root, "src", "data", "towns", "ma-towns.json"),
    path.join(root, "src", "data", "services", "ma-services.json"),
    path.join(root, "src", "data", "companies", "ma-companies.json"),
  ];

  console.log("Validating JSON files...");
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error("MISSING:", f);
      process.exit(1);
    }
    mustParse(f);
    console.log("OK:", f);
  }
  console.log("All JSON valid.");
}

main();
