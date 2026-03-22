const fs = require("fs");
const http = require("http");
const https = require("https");

const INPUT_FILE = "./src/data/companies/ma-companies.json";
const OUTPUT_FILE = "./verified-website-audit.json";
const TIMEOUT_MS = 8000;
const CONCURRENCY = 6;

function isVerifiedCompany(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return value === true || v === "true" || v === "1" || v === "yes";
}

function normalizeRawWebsite(value) {
  return String(value ?? "").trim();
}

function buildUrl(rawWebsite) {
  const raw = normalizeRawWebsite(rawWebsite);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function fetchUrl(url, redirectsLeft = 5) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({
        ok: false,
        status: 0,
        finalUrl: "",
        title: "",
        snippet: "",
        error: "empty url",
      });
      return;
    }

    const lib = url.startsWith("https://") ? https : http;

    const req = lib.request(
      url,
      {
        method: "GET",
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VerifiedWebsiteAudit/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location || "";
        const chunks = [];

        if (
          status >= 300 &&
          status < 400 &&
          location &&
          redirectsLeft > 0
        ) {
          res.resume();
          let nextUrl = location;
          if (!/^https?:\/\//i.test(nextUrl)) {
            try {
              nextUrl = new URL(location, url).toString();
            } catch (err) {
              resolve({
                ok: false,
                status,
                finalUrl: url,
                title: "",
                snippet: "",
                error: "bad redirect url",
              });
              return;
            }
          }

          fetchUrl(nextUrl, redirectsLeft - 1).then(resolve);
          return;
        }

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch
            ? titleMatch[1].replace(/\s+/g, " ").trim()
            : "";

          const snippet = body
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 500);

          resolve({
            ok: status >= 200 && status < 400,
            status,
            finalUrl: url,
            title,
            snippet,
            error: "",
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.on("error", (err) => {
      resolve({
        ok: false,
        status: 0,
        finalUrl: url,
        title: "",
        snippet: "",
        error: err && err.message ? err.message : "request error",
      });
    });

    req.end();
  });
}

function evaluateSuspicion(result, company) {
  const haystack = `${result.finalUrl} ${result.title} ${result.snippet}`.toLowerCase();

  const suspiciousTerms = [
    "parked free",
    "domain for sale",
    "buy this domain",
    "get this domain",
    "courtesy of godaddy",
    "related searches",
    "this domain is for sale",
    "parked domain",
    "sedo",
    "bodis",
    "privacy error",
    "not secure",
  ];

  const matches = suspiciousTerms.filter((term) => haystack.includes(term));

  const companyName = String(company?.name ?? "").trim().toLowerCase();
  const companyWords = companyName
    .split(/[^a-z0-9]+/i)
    .map((x) => x.trim())
    .filter((x) => x.length >= 4);

  let nameSignal = false;
  for (const word of companyWords.slice(0, 4)) {
    if (haystack.includes(word)) {
      nameSignal = true;
      break;
    }
  }

  let verdict = "ok";

  if (!company.website) {
    verdict = "missing";
  } else if (!result.ok) {
    verdict = "failed";
  } else if (matches.length > 0) {
    verdict = "suspicious";
  } else if (!nameSignal && result.title && result.snippet) {
    verdict = "review";
  }

  return {
    verdict,
    suspiciousMatches: matches,
    nameSignal,
  };
}

async function runPool(items, worker, limit) {
  const results = new Array(items.length);
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => runner()
  );

  await Promise.all(runners);
  return results;
}

async function main() {
  const companies = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  const verified = companies.filter((c) => isVerifiedCompany(c?.verified));

  let checked = 0;

  const audit = await runPool(
    verified,
    async (company) => {
      const url = buildUrl(company.website);
      const result = url
        ? await fetchUrl(url)
        : {
            ok: false,
            status: 0,
            finalUrl: "",
            title: "",
            snippet: "",
            error: "missing website",
          };

      const evaluation = evaluateSuspicion(result, company);

      checked++;
      process.stdout.write(`Checked ${checked}/${verified.length}\r`);

      return {
        id: company.id || "",
        name: company.name || "",
        townSlug: company.townSlug || "",
        serviceId: company.serviceId || "",
        website: company.website || "",
        status: result.status,
        finalUrl: result.finalUrl,
        title: result.title,
        snippet: result.snippet,
        error: result.error,
        verdict: evaluation.verdict,
        suspiciousMatches: evaluation.suspiciousMatches,
        nameSignal: evaluation.nameSignal,
      };
    },
    CONCURRENCY
  );

  const summary = {
    totalVerified: audit.length,
    ok: audit.filter((x) => x.verdict === "ok").length,
    review: audit.filter((x) => x.verdict === "review").length,
    suspicious: audit.filter((x) => x.verdict === "suspicious").length,
    failed: audit.filter((x) => x.verdict === "failed").length,
    missing: audit.filter((x) => x.verdict === "missing").length,
  };

  const output = {
    summary,
    flagged: audit.filter((x) => x.verdict !== "ok"),
    all: audit,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + "\n");

  console.log("\nDone.");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});