import { writeFile } from "node:fs/promises";
import { assertVersionSection, readChangelog, readPackageVersion } from "./changelog-utils.mjs";

const requestedVersion = process.argv[2]?.replace(/^v/, "");
const packageVersion = await readPackageVersion();
const version = requestedVersion ?? packageVersion;

if (version !== packageVersion) {
  throw new Error(`Release tag version ${version} does not match package.json version ${packageVersion}`);
}

const changelog = await readChangelog();
const section = assertVersionSection(changelog, version);
const outputPath = process.argv[3];
if (outputPath) await writeFile(outputPath, section.endsWith("\n") ? section : `${section}\n`);

console.log(`Release notes found for ${version}`);
