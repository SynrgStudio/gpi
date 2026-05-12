import { readFile } from "node:fs/promises";

export async function readPackageVersion(packageJsonPath = "package.json") {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (typeof packageJson.version !== "string") throw new Error("package.json version is missing");
  return packageJson.version;
}

export async function readChangelog(changelogPath = "CHANGELOG.md") {
  return readFile(changelogPath, "utf8");
}

export function extractVersionSection(changelog, version) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^## \\[${escapedVersion}\\][^\\n]*\\n`, "m");
  const match = pattern.exec(changelog);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  const nextHeader = changelog.slice(start).search(/^## \[/m);
  const end = nextHeader === -1 ? changelog.length : start + nextHeader;
  return changelog.slice(start, end).trim();
}

export function assertVersionSection(changelog, version) {
  const section = extractVersionSection(changelog, version);
  if (!section) throw new Error(`CHANGELOG.md is missing a section for version ${version}`);
  if (section.includes("- None.") && section.replaceAll("- None.", "").trim().length === 0) {
    throw new Error(`CHANGELOG.md section for ${version} has no release notes`);
  }
  return section;
}
