// C:\Users\16035\Desktop\NewEnglandSnowDirectory\scripts\test-all.cjs
// One-command full project test:
// 1) JSON validation
// 2) Production build
// 3) Optional route smoke test IF dev server is running at http://localhost:4321
//
// Run:
//   cd C:\Users\16035\Desktop\NewEnglandSnowDirectory
//   node scripts\test-all.cjs
//
// Tip: For the route test to run, start dev server in another window:
//   npm run dev

const { spawnSync } = require("child_process");
const http = require("http");

function runCmdWindows(commandLine, label) {
  console.log("");
  console.log("===", label, "===");
  console.log(commandLine);

  // Use cmd.exe to execute, which avoids spawnSync EINVAL issues with npm.cmd on Windows
  const r = spawnSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
    stdio: "inherit",
    windowsHide: true,
  });

  if (r.error) {
    console.error("ERROR running:", label);
    console.error(r.error);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error("");
    console.error("FAILED:", label, "(exit code", r.status + ")");
    process.exit(r.status);
  }
}

function httpGetStatus(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => resolve(res.statusCode || 0));
    req.on("error", () => resolve(0));
    req.setTimeout(1500, () => {
      try {
        req.destroy();
      } catch {}
      resolve(0);
    });
  });
}

async function main() {
  console.log("Full project test starting...");
  console.log("Project root should be:", process.cwd());

  // 1) JSON validation
  runCmdWindows("node scripts\\validate-json.cjs", "Validate JSON");

  // 2) Production build
  runCmdWindows("npm run build", "Production build");

  // 3) Optional route smoke test (requires dev server already running)
  console.log("");
  console.log("=== Route smoke test (optional) ===");
  console.log("Checking if dev server is running at http://localhost:4321 ...");

  const status = await httpGetStatus("http://localhost:4321/");
  if (status === 0) {
    console.log("Dev server not detected. Skipping route smoke test.");
    console.log("To run it: start dev server in another window with:");
    console.log("  cd C:\\Users\\16035\\Desktop\\NewEnglandSnowDirectory");
    console.log("  npm run dev");
    console.log("Then run:");
    console.log("  node scripts\\smoke-routes.cjs");
  } else {
    console.log("Dev server detected (status " + status + "). Running smoke routes...");
    runCmdWindows("node scripts\\smoke-routes.cjs", "Smoke routes");
  }

  console.log("");
  console.log("✅ ALL CHECKS PASSED");
  console.log("Done.");
}

main().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
