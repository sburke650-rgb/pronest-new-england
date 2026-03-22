const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "src", "data", "companies", "ma-companies.json");

const companies = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));

const BAD_FACEBOOK_HOME_VALUES = new Set([
  "facebook.com",
  "www.facebook.com",
  "http://facebook.com",
  "http://www.facebook.com",
  "https://facebook.com",
  "https://www.facebook.com",
  "m.facebook.com",
  "http://m.facebook.com",
  "https://m.facebook.com",
]);

function cleanString(value) {
  return String(value ?? "").trim();
}

function stripTrailingSlashes(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function normalizeUrl(raw) {
  let value = cleanString(raw);
  if (!value) return "";

  value = value.replace(/\s+/g, "");
  value = stripTrailingSlashes(value);

  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }

  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return stripTrailingSlashes(parsed.toString());
  } catch {
    return "";
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getPathname(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function isFacebookHost(host) {
  return host === "facebook.com" || host === "m.facebook.com";
}

function cleanFacebook(raw) {
  const normalized = normalizeUrl(raw);
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  if (BAD_FACEBOOK_HOME_VALUES.has(lower)) return "";

  const host = getHostname(normalized);
  const pathname = getPathname(normalized);

  if (!isFacebookHost(host)) return "";
  if (!pathname || pathname === "/") return "";

  return normalized;
}

function cleanWebsite(raw) {
  const normalized = normalizeUrl(raw);
  if (!normalized) return "";

  const host = getHostname(normalized);
  const pathname = getPathname(normalized);

  if (!host) return "";

  if (host === "localhost") return "";

  if (isFacebookHost(host)) {
    return "";
  }

  if (
    host === "instagram.com" ||
    host === "m.instagram.com" ||
    host === "linkedin.com" ||
    host === "www.linkedin.com" ||
    host === "x.com" ||
    host === "twitter.com" ||
    host === "t.co"
  ) {
    return "";
  }

  if (!pathname) {
    return normalized;
  }

  return normalized;
}

let changedWebsite = 0;
let changedFacebook = 0;
let clearedWebsite = 0;
let clearedFacebook = 0;

for (const company of companies) {
  const originalWebsite = cleanString(company.website);
  const originalFacebook = cleanString(company.facebook);

  const cleanedWebsite = cleanWebsite(originalWebsite);
  const cleanedFacebook = cleanFacebook(originalFacebook);

  if (originalWebsite !== cleanedWebsite) {
    company.website = cleanedWebsite;
    changedWebsite++;
    if (!cleanedWebsite && originalWebsite) clearedWebsite++;
  }

  if (originalFacebook !== cleanedFacebook) {
    company.facebook = cleanedFacebook;
    changedFacebook++;
    if (!cleanedFacebook && originalFacebook) clearedFacebook++;
  }
}

fs.writeFileSync(FILE_PATH, JSON.stringify(companies, null, 2) + "\n");

console.log("Done.");
console.log("Website fields changed:", changedWebsite);
console.log("Website fields cleared:", clearedWebsite);
console.log("Facebook fields changed:", changedFacebook);
console.log("Facebook fields cleared:", clearedFacebook);