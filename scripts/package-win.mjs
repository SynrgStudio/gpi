import { packager } from "@electron/packager";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "release");
const packageDir = resolve(root, ".gpi-package");

await mkdir(outDir, { recursive: true });
await rm(resolve(outDir, "GPi-win32-x64"), { recursive: true, force: true });
await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

await cp(resolve(root, "dist"), resolve(packageDir, "dist"), { recursive: true });
await cp(resolve(root, "resources"), resolve(packageDir, "resources"), { recursive: true });
await cp(resolve(root, "node_modules"), resolve(packageDir, "node_modules"), { recursive: true });
await writeFile(resolve(packageDir, "package.json"), JSON.stringify({
  name: "gpi",
  version: process.env.GPI_VERSION ?? process.env.npm_package_version ?? "0.0.1",
  description: "GPi: a glass cockpit GUI for Pi.",
  type: "module",
  main: "dist/main/main.js",
  dependencies: {
    "@earendil-works/pi-coding-agent": "latest",
  },
}, null, 2));

await packager({
  dir: packageDir,
  name: "GPi",
  platform: "win32",
  arch: "x64",
  out: outDir,
  overwrite: true,
  prune: true,
  asar: true,
  extraResource: [resolve(packageDir, "resources", "skills"), resolve(packageDir, "resources", "assets")],
  executableName: "GPi",
  icon: resolve(root, "resources", "assets", "gpi-logo.ico"),
  appCopyright: "Copyright (c) Synrg Studio",
  appVersion: process.env.GPI_VERSION ?? process.env.npm_package_version ?? "0.0.1",
  ignore: [
    /^\/node_modules\/\.vite(?:\/|$)/,
    /^\/node_modules\/\.vite-temp(?:\/|$)/,
    /^\/.*\.log$/,
  ],
});

await rm(packageDir, { recursive: true, force: true });

console.log(`Packaged GPi to ${resolve(outDir, "GPi-win32-x64")}`);
