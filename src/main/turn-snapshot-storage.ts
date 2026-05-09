import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { TurnSnapshotFileEntry, TurnSnapshotFileSaveInput, TurnSnapshotFileStatus, TurnSnapshotManifest, TurnSnapshotRevertConflict, TurnSnapshotRevertResult, TurnSnapshotSaveRequest, TurnSnapshotSaveResult } from "../domain/types.js";

const snapshotSchemaVersion = 1 as const;

export class TurnSnapshotStorage {
  private readonly snapshotsRoot: string;

  constructor(userDataPath: string) {
    this.snapshotsRoot = join(userDataPath, "snapshots");
  }

  async loadManifest(manifestPath: string): Promise<TurnSnapshotManifest> {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    if (!isTurnSnapshotManifest(parsed)) throw new Error("Invalid turn snapshot manifest");
    return parsed;
  }

  async revert(manifestPath: string): Promise<TurnSnapshotRevertResult> {
    const manifest = await this.loadManifest(manifestPath);
    const conflicts = await this.findConflicts(manifest);
    if (conflicts.length > 0) return { ok: false, conflicts };
    for (const file of manifest.files) await applyRevertFile(file);
    return { ok: true, revertedFiles: manifest.files.map((file) => file.path) };
  }

  private async findConflicts(manifest: TurnSnapshotManifest): Promise<TurnSnapshotRevertConflict[]> {
    const conflicts: TurnSnapshotRevertConflict[] = [];
    for (const file of manifest.files) {
      if (!isPathInside(manifest.projectPath, file.absolutePath)) {
        conflicts.push({ path: file.path, reason: "Path is outside the project root" });
        continue;
      }
      const current = await readOptionalFile(file.absolutePath);
      if (file.existsAfter && current === undefined) conflicts.push({ path: file.path, reason: "File was deleted after snapshot" });
      else if (!file.existsAfter && current !== undefined) conflicts.push({ path: file.path, reason: "File was recreated after snapshot" });
      else if (current !== undefined && file.hashAfter !== hashContent(current)) conflicts.push({ path: file.path, reason: "File changed after snapshot" });
    }
    return conflicts;
  }

  async save(request: TurnSnapshotSaveRequest): Promise<TurnSnapshotSaveResult> {
    const snapshotId = `${sanitizePathSegment(request.sessionId)}-${sanitizePathSegment(request.turnId)}`;
    const snapshotRoot = join(this.snapshotsRoot, sanitizePathSegment(request.projectId), sanitizePathSegment(request.sessionId), sanitizePathSegment(request.turnId));
    const beforeRoot = join(snapshotRoot, "before");
    const afterRoot = join(snapshotRoot, "after");
    await mkdir(beforeRoot, { recursive: true });
    await mkdir(afterRoot, { recursive: true });

    const files = await Promise.all(request.files.map((file, index) => this.saveFileEntry(file, index, beforeRoot, afterRoot)));
    const manifest: TurnSnapshotManifest = {
      schemaVersion: snapshotSchemaVersion,
      snapshotId,
      projectId: request.projectId,
      projectPath: request.projectPath,
      sessionId: request.sessionId,
      turnId: request.turnId,
      userMessageId: request.userMessageId,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      files: files.filter(isSavedSnapshotFileEntry),
      captureErrors: request.captureErrors,
    };

    const manifestPath = join(snapshotRoot, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    return {
      manifest,
      indexEntry: {
        snapshotId,
        sessionId: request.sessionId,
        turnId: request.turnId,
        userMessageId: request.userMessageId,
        createdAt: request.createdAt,
        completedAt: request.completedAt,
        fileCount: manifest.files.length,
        hasCaptureErrors: request.captureErrors.length > 0,
        manifestPath,
      },
    };
  }

  private async saveFileEntry(file: TurnSnapshotFileSaveInput, index: number, beforeRoot: string, afterRoot: string): Promise<CapturedSnapshotFileEntry> {
    const before = await saveContentBlob(beforeRoot, index, file.contentBefore);
    const after = await saveContentBlob(afterRoot, index, file.contentAfter);
    const status = snapshotStatus(file.existsBefore, file.existsAfter, before.hash, after.hash);
    return {
      path: file.path,
      absolutePath: file.absolutePath,
      status,
      existsBefore: file.existsBefore,
      existsAfter: file.existsAfter,
      hashBefore: before.hash,
      hashAfter: after.hash,
      sizeBefore: before.size,
      sizeAfter: after.size,
      contentBeforePath: before.path,
      contentAfterPath: after.path,
    };
  }
}

async function applyRevertFile(file: TurnSnapshotFileEntry): Promise<void> {
  if (!file.existsBefore) {
    await rm(file.absolutePath, { force: true });
    return;
  }
  if (!file.contentBeforePath) throw new Error(`Missing before snapshot for ${file.path}`);
  await mkdir(dirname(file.absolutePath), { recursive: true });
  await writeFile(file.absolutePath, await readFile(file.contentBeforePath, "utf8"), "utf8");
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function isPathInside(root: string, path: string): boolean {
  const relativePath = relative(resolve(root), resolve(path));
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !relativePath.startsWith("/") && !relativePath.startsWith("\\"));
}

async function saveContentBlob(root: string, index: number, content: string | undefined): Promise<{ hash: string | undefined; size: number | undefined; path: string | undefined }> {
  if (content === undefined) return { hash: undefined, size: undefined, path: undefined };
  const hash = hashContent(content);
  const path = join(root, `${index.toString().padStart(4, "0")}-${hash}.txt`);
  await writeFile(path, content, "utf8");
  return { hash, size: Buffer.byteLength(content, "utf8"), path };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function snapshotStatus(existsBefore: boolean, existsAfter: boolean, hashBefore: string | undefined, hashAfter: string | undefined): TurnSnapshotFileStatus | undefined {
  if (!existsBefore && existsAfter) return "created";
  if (existsBefore && !existsAfter) return "deleted";
  if (existsBefore && existsAfter && hashBefore !== hashAfter) return "modified";
  return undefined;
}

type CapturedSnapshotFileEntry = Omit<TurnSnapshotFileEntry, "status"> & { status: TurnSnapshotFileStatus | undefined };

function isSavedSnapshotFileEntry(file: CapturedSnapshotFileEntry): file is TurnSnapshotFileEntry {
  return file.status !== undefined;
}

function isTurnSnapshotManifest(value: unknown): value is TurnSnapshotManifest {
  if (!isRecord(value)) return false;
  return value.schemaVersion === snapshotSchemaVersion && typeof value.snapshotId === "string" && typeof value.projectId === "string" && typeof value.sessionId === "string" && typeof value.turnId === "string" && Array.isArray(value.files) && Array.isArray(value.captureErrors);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 96) || "snapshot";
}
