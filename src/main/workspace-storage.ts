import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { WorkspaceState } from "../domain/types.js";

const workspaceFileName = "workspace.v1.json";
const currentStorageVersion = 1 as const;

export interface WorkspaceStorageLoadResult {
  workspace: WorkspaceState | undefined;
  path: string;
  recoveredFromCorruption: boolean;
  error: string | undefined;
}

export class WorkspaceStorage {
  private readonly workspacePath: string;
  private saveQueue: Promise<{ ok: true; path: string }> = Promise.resolve({ ok: true, path: "" });
  private saveSequence = 0;

  constructor(userDataPath: string) {
    this.workspacePath = join(userDataPath, workspaceFileName);
  }

  async load(): Promise<WorkspaceStorageLoadResult> {
    try {
      const content = await readFile(this.workspacePath, "utf8");
      const parsed = JSON.parse(content) as unknown;
      if (!isWorkspaceState(parsed)) throw new Error("Workspace file has invalid shape");
      if (parsed.storageVersion > currentStorageVersion) throw new Error(`Workspace file version ${parsed.storageVersion.toString()} is newer than GPi supports`);
      return { workspace: migrateWorkspace(parsed), path: this.workspacePath, recoveredFromCorruption: false, error: undefined };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { workspace: undefined, path: this.workspacePath, recoveredFromCorruption: false, error: undefined };
      }

      const message = error instanceof Error ? error.message : String(error);
      await this.backupCorruptWorkspace();
      return { workspace: undefined, path: this.workspacePath, recoveredFromCorruption: true, error: message };
    }
  }

  save(workspace: WorkspaceState): Promise<{ ok: true; path: string }> {
    const payload = { ...workspace, storageVersion: currentStorageVersion, backendHandles: {} };
    const saveOperation = this.saveQueue.catch(() => ({ ok: true as const, path: this.workspacePath })).then(() => this.saveNow(payload));
    this.saveQueue = saveOperation;
    return saveOperation;
  }

  private async saveNow(workspace: WorkspaceState): Promise<{ ok: true; path: string }> {
    await mkdir(dirname(this.workspacePath), { recursive: true });
    this.saveSequence += 1;
    const temporaryPath = `${this.workspacePath}.${process.pid.toString()}.${this.saveSequence.toString()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
    await replaceFileWithRetry(temporaryPath, this.workspacePath);
    return { ok: true, path: this.workspacePath };
  }

  private async backupCorruptWorkspace(): Promise<void> {
    const backupPath = `${this.workspacePath}.corrupt-${Date.now().toString()}`;
    try {
      await rename(this.workspacePath, backupPath);
    } catch {
      // Best effort: load should still recover to an empty in-memory workspace.
    }
  }
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  if (!isRecord(value)) return false;
  return (
    (value.storageVersion === undefined || value.storageVersion === currentStorageVersion) &&
    Array.isArray(value.projects) &&
    Array.isArray(value.sessions) &&
    typeof value.selectedProjectId === "string" &&
    typeof value.selectedSessionId === "string" &&
    isRecord(value.messages) &&
    (value.chatMessages === undefined || isRecord(value.chatMessages)) &&
    isRecord(value.drafts) &&
    isRecord(value.details) &&
    isRecord(value.backendHandles) &&
    isRecord(value.sessionFiles) &&
    (value.sessionSelectionRanks === undefined || isRecord(value.sessionSelectionRanks)) &&
    (value.turnSnapshots === undefined || isRecord(value.turnSnapshots)) &&
    (value.settings === undefined || isRecord(value.settings))
  );
}

async function replaceFileWithRetry(source: string, destination: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      lastError = error;
      if (!isNodeError(error) || error.code !== "EPERM") throw error;
      await delay(40 * (attempt + 1));
    }
  }

  try {
    await copyFile(source, destination);
    await rm(source, { force: true });
    return;
  } catch {
    // Throw original rename error; it contains the useful source/destination context.
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function migrateWorkspace(workspace: WorkspaceState): WorkspaceState {
  return { ...workspace, storageVersion: currentStorageVersion };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
