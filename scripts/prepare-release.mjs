import { readFile, writeFile } from "node:fs/promises";
import { assertVersionSection, readChangelog } from "./changelog-utils.mjs";

const nextVersion = process.argv[2]?.replace(/^v/, "");
if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  throw new Error("Usage: npm run release:prepare -- <major.minor.patch>");
}

const today = new Date().toISOString().slice(0, 10);
await updatePackageVersion("package.json", nextVersion);
await updatePackageVersion("package-lock.json", nextVersion);
await updateInstallerVersion("installer/gpi.iss", nextVersion);
await updateChangelog("CHANGELOG.md", nextVersion, today);

console.log(`Prepared release ${nextVersion}. Review CHANGELOG.md, then commit and tag v${nextVersion}.`);

async function updatePackageVersion(path, version) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  parsed.version = version;
  if (parsed.packages?.[""]?.version) parsed.packages[""].version = version;
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
}

async function updateInstallerVersion(path, version) {
  const text = await readFile(path, "utf8");
  await writeFile(path, text.replace(/#define MyAppVersion "[^"]+"/, `#define MyAppVersion "${version}"`));
}

async function updateChangelog(path, version, date) {
  const text = await readChangelog(path);
  const unreleasedMatch = text.match(/^## \[Unreleased\]\n([\s\S]*?)(?=^## \[|\z)/m);
  if (!unreleasedMatch?.[1]?.trim()) throw new Error("CHANGELOG.md [Unreleased] section is empty");

  const releaseSection = `## [${version}] - ${date}\n${unreleasedMatch[1].trim()}\n\n`;
  assertVersionSection(`${text}\n${releaseSection}`, version);

  const emptyUnreleased = `## [Unreleased]\n\n### Added\n\n- None.\n\n### Changed\n\n- None.\n\n### Fixed\n\n- None.\n\n### Packaging\n\n- None.\n\n### Known issues\n\n- None.\n\n`;
  const next = text.replace(/^## \[Unreleased\]\n[\s\S]*?(?=^## \[|\z)/m, `${emptyUnreleased}${releaseSection}`);
  await writeFile(path, next);
}
