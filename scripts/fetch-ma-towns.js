
const fs = require("fs");
const path = require("path");

const BASE =
  "https://gisstg.massdot.state.ma.us/arcgis/rest/services/Boundaries/Towns/FeatureServer/0/query";

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchPage(resultOffset, resultRecordCount) {
  const url =
    `${BASE}?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "TOWN,TOWN_ID",
      returnGeometry: "false",
      orderByFields: "TOWN_ID",
      resultOffset: String(resultOffset),
      resultRecordCount: String(resultRecordCount),
      f: "json",
    }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}

async function main() {
  const outPath = path.join(
    process.cwd(),
    "src",
    "data",
    "towns",
    "ma-towns.json"
  );

  const all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const data = await fetchPage(offset, pageSize);
    const features = data.features || [];

    for (const f of features) {
      const a = f.attributes;
      all.push({
        id: a.TOWN_ID,
        name: a.TOWN,
        slug: slugify(a.TOWN),
        state: "MA",
      });
    }

    if (!data.exceededTransferLimit) break;
    offset += features.length;
  }

  console.log("Fetched towns:", all.length);

  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log("Saved ma-towns.json");
}

main();
