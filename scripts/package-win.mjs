import { packager } from "@electron/packager";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "release");

await mkdir(outDir, { recursive: true });
await rm(resolve(outDir, "GPi-win32-x64"), { recursive: true, force: true });

await packager({
  dir: root,
  name: "GPi",
  platform: "win32",
  arch: "x64",
  out: outDir,
  overwrite: true,
  prune: true,
  asar: true,
  executableName: "GPi",
  appCopyright: "Copyright (c) Synrg Studio",
  appVersion: process.env.GPI_VERSION ?? process.env.npm_package_version ?? "0.0.1",
  ignore: [
    /^\/\.git(?:\/|$)/,
    /^\/\.github(?:\/|$)/,
    /^\/dist-test(?:\/|$)/,
    /^\/release(?:\/|$)/,
    /^\/test(?:\/|$)/,
    /^\/docs(?:\/|$)/,
    /^\/installer(?:\/|$)/,
    /^\/src(?:\/|$)/,
    /^\/.*\.log$/,
  ],
});

console.log(`Packaged GPi to ${resolve(outDir, "GPi-win32-x64")}`);
