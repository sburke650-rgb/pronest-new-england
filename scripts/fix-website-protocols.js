const fs = require("fs");
const http = require("http");
const https = require("https");

const FILE = "./src/data/companies/ma-companies.json";
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

function normalizeRawWebsite(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, "");
}

function stripProtocol(url) {
  return url.replace(/^https?:\/\//i, "");
}

function buildCandidates(rawWebsite) {
  const raw = normalizeRawWebsite(rawWebsite);
  if (!raw) return [];

  if (/^https?:\/\//i.test(raw)) {
    const noProto = stripProtocol(raw);
    return [`https://${noProto}`, `http://${noProto}`];
  }

  return [`https://${raw}`, `http://${raw}`];
}

function requestUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https://") ? https : http;

    const req = lib.request(
      url,
      {
        method: "GET",
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ProtocolFixBot/1.0)",
          Accept: "*/*",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        res.resume();

        resolve({
          ok: status >= 200 && status < 400,
          status,
          finalUrl: url,
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
        error: err && err.message ? err.message : "request error",
      });
    });

    req.end();
  });
}

async function chooseBestUrl(rawWebsite) {
  const candidates = buildCandidates(rawWebsite);
  if (candidates.length === 0) {
    return { chosen: "", reason: "empty" };
  }

  for (const candidate of candidates) {
    const result = await requestUrl(candidate);
    if (result.ok) {
      return {
        chosen: candidate,
        reason: `working ${candidate.startsWith("https://") ? "https" : "http"} (${result.status})`,
      };
    }
  }

  return {
    chosen: /^https?:\/\//i.test(rawWebsite)
      ? rawWebsite.trim()
      : `http://${normalizeRawWebsite(rawWebsite)}`,
    reason: "no working response; kept/fell back to http",
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

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

  let checked = 0;
  let changed = 0;
  const changes = [];

  await runPool(
    data,
    async (item, i) => {
      const original = normalizeRawWebsite(item.website);
      if (!original) return;

      checked++;

      const { chosen, reason } = await chooseBestUrl(original);
      const oldNormalized = /^https?:\/\//i.test(original) ? original : original;
      const newNormalized = chosen;

      if (newNormalized && newNormalized !== oldNormalized) {
        data[i].website = newNormalized;
        changed++;
        changes.push({
          id: item.id,
          name: item.name,
          from: original,
          to: newNormalized,
          reason,
        });
      } else if (/^https?:\/\//i.test(original)) {
        data[i].website = original;
      } else if (newNormalized) {
        data[i].website = newNormalized;
      }

      process.stdout.write(`Checked ${checked}\r`);
    },
    CONCURRENCY
  );

  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");

  console.log("\nDone.");
  console.log("Websites checked:", checked);
  console.log("Websites changed:", changed);

  if (changes.length) {
    console.log("\nChanged entries:");
    for (const change of changes) {
      console.log(`- ${change.id}`);
      console.log(`  ${change.from} -> ${change.to}`);
      console.log(`  ${change.reason}`);
    }
  } else {
    console.log("\nNo website protocol changes were needed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});