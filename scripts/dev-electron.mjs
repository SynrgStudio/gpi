import { spawn } from "node:child_process";

const viteUrl = "http://127.0.0.1:5173";
const children = new Set();
let shuttingDown = false;

function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${child.spawnargs.join(" ")} exited with ${code ?? "unknown"}`));
    });
  });
}

function killProcessTree(child) {
  if (child.pid === undefined || child.killed) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", child.pid.toString(), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killProcessTree(child);
  windowlessExit(exitCode);
}

function windowlessExit(exitCode) {
  setTimeout(() => process.exit(exitCode), 250).unref();
}

await waitForExit(run("npm", ["run", "compile:electron"]));

const vite = run("npm", ["run", "dev"]);
const electron = run("npx", ["electron", "."], {
  env: { ...process.env, GPI_DEV_SERVER_URL: viteUrl },
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

vite.on("exit", (code) => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1);
});

electron.on("exit", (code) => {
  shutdown(code ?? 0);
});
