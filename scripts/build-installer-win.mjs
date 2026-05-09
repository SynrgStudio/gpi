import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1"));
const scriptPath = resolve(root, "installer/gpi.iss");

const candidates = [
  process.env.ISCC,
  process.env.ProgramFiles ? join(process.env.ProgramFiles, "Inno Setup 6", "ISCC.exe") : undefined,
  process.env["ProgramFiles(x86)"] ? join(process.env["ProgramFiles(x86)"], "Inno Setup 6", "ISCC.exe") : undefined,
  "iscc",
].filter((value) => typeof value === "string" && value.length > 0);

const iscc = await findIscc(candidates);

if (!iscc) {
  console.error("Inno Setup compiler was not found.");
  console.error("Install Inno Setup 6 from https://jrsoftware.org/isinfo.php or set ISCC to the full ISCC.exe path.");
  process.exit(1);
}

await execFileAsync(iscc, [scriptPath], {
  cwd: root,
  env: process.env,
  windowsHide: true,
  maxBuffer: 2_000_000,
});

async function findIscc(paths) {
  for (const candidate of paths) {
    if (candidate.toLowerCase() === "iscc") return candidate;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return undefined;
}
