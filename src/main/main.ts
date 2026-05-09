import { Menu, app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { SdkPiBridge } from "../bridge/sdk-pi-bridge.js";
import { WorkerPiRuntimeManager } from "./worker-pi-runtime.js";
import type { GpiPiSessionHandle } from "../bridge/pi-bridge.js";
import type { ContinuityWorkflowStatus, GpiPiUpdateResult, GpiUpdateStatus, TurnSnapshotFileSaveInput, TurnSnapshotSaveRequest, WorkflowSkillName, WorkflowSkillStatus } from "../domain/types.js";
import { TurnSnapshotStorage } from "./turn-snapshot-storage.js";
import { WorkspaceStorage } from "./workspace-storage.js";

const execFileAsync = promisify(execFile);
const currentDir = fileURLToPath(new URL(".", import.meta.url));
const isDevelopment = process.env.GPI_DEV_SERVER_URL !== undefined;
const bridge = new SdkPiBridge(process.cwd());
const workerRuntimeManager = new WorkerPiRuntimeManager(join(currentDir, "../worker/pi-runtime-worker.js"));
const workspaceStorage = new WorkspaceStorage(app.getPath("userData"));
const turnSnapshotStorage = new TurnSnapshotStorage(app.getPath("userData"));
const sessionHandles = new Map<string, GpiPiSessionHandle>();
const WORKFLOW_SKILLS: readonly WorkflowSkillName[] = ["init-cont", "plan-cont", "start-cont", "end-cont"];
const PRIMARY_PI_PACKAGE_NAME = "@earendil-works/pi-coding-agent";
const LEGACY_PI_PACKAGE_NAME = "@mariozechner/pi-coding-agent";
const PI_PACKAGE_NAMES: readonly string[] = [PRIMARY_PI_PACKAGE_NAME, LEGACY_PI_PACKAGE_NAME];

void bridge.prewarm().then((snapshot) => {
  if (snapshot.status === "ready") {
    console.log(`[gpi] Pi bridge prewarm ready in ${snapshot.durationMs?.toString() ?? "unknown"}ms (${snapshot.sessionCount?.toString() ?? "unknown"} sessions)`);
    return;
  }

  console.log(`[gpi] Pi bridge prewarm ${snapshot.status}: ${snapshot.error ?? "no details"}`);
});

async function createMainWindow(): Promise<void> {
  Menu.setApplicationMenu(null);

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#070A12",
    title: "GPi",
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(currentDir, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isExternalHttpUrl(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  registerIpc(window);

  if (isDevelopment) {
    await window.loadURL(process.env.GPI_DEV_SERVER_URL ?? "http://127.0.0.1:5173");
    return;
  }

  await window.loadFile(join(currentDir, "../renderer/index.html"));
}

function isExternalHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

function registerIpc(window: BrowserWindow): void {
  ipcMain.handle("gpi:window-minimize", () => window.minimize());
  ipcMain.handle("gpi:window-toggle-maximize", () => {
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle("gpi:window-close", () => window.close());
  ipcMain.handle("gpi:get-continuity-status", async (_event, projectId: unknown) => getContinuityStatus(await resolveProjectPath(requireString(projectId, "projectId"))));
  ipcMain.handle("gpi:get-workflow-skills-status", async () => getWorkflowSkillsStatus());
  ipcMain.handle("gpi:get-update-status", async () => getUpdateStatus());
  ipcMain.handle("gpi:update-pi", async () => updatePi());
  ipcMain.handle("gpi:get-workflow-skill-text", async (_event, skillName: unknown) => readBundledWorkflowSkill(requireWorkflowSkillName(skillName)));
  ipcMain.handle("gpi:install-workflow-skills", async () => installWorkflowSkills());
  ipcMain.handle("gpi:update-workflow-skills", async () => updateWorkflowSkills());
  ipcMain.handle("gpi:get-workspace-snapshot", async () => bridge.getWorkspaceSnapshot());
  ipcMain.handle("gpi:load-workspace", async () => workspaceStorage.load());
  ipcMain.handle("gpi:list-project-sessions", async (_event, projectId: unknown) => {
    const projectPath = await resolveProjectPath(requireString(projectId, "projectId"));
    return workerRuntimeManager.listSessions(projectPath);
  });

  ipcMain.handle("gpi:choose-project-path", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
      title: "Choose GPi project folder",
    });
    return { path: result.canceled ? undefined : result.filePaths[0] };
  });
  ipcMain.handle("gpi:validate-project-path", async (_event, projectPath: unknown) => {
    try {
      await resolveExistingPath(requireString(projectPath, "projectPath"));
      return { ok: true, error: undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  });
  ipcMain.handle("gpi:save-workspace", async (_event, workspace: unknown) => {
    if (!isWorkspacePayload(workspace)) throw new Error("Invalid GPi workspace payload");
    return workspaceStorage.save(workspace);
  });
  ipcMain.handle("gpi:save-turn-snapshot", async (_event, snapshot: unknown) => turnSnapshotStorage.save(requireTurnSnapshotSaveRequest(snapshot)));
  ipcMain.handle("gpi:get-turn-snapshot-manifest", async (_event, manifestPath: unknown) => turnSnapshotStorage.loadManifest(requireString(manifestPath, "manifestPath")));
  ipcMain.handle("gpi:revert-turn-snapshot", async (_event, manifestPath: unknown) => turnSnapshotStorage.revert(requireString(manifestPath, "manifestPath")));
  ipcMain.handle("gpi:get-prewarm-status", () => bridge.getPrewarmSnapshot());
  ipcMain.handle("gpi:get-worker-runtime-health", async () => {
    const { health } = await workerRuntimeManager.createWorkerAndGetHealth();
    return health;
  });
  ipcMain.handle("gpi:get-file-diff", async (_event, projectId: unknown, filePath: unknown) => {
    const projectPath = await resolveProjectPath(requireString(projectId, "projectId"));
    return getSafeFileDiff(projectPath, requireString(filePath, "filePath"));
  });

  ipcMain.handle("gpi:get-model-options", async (_event, sessionHandleId: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    return getHandleModelOptions(handle);
  });

  ipcMain.handle("gpi:set-model", async (_event, sessionHandleId: unknown, provider: unknown, modelId: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    await handle.setModel(requireString(provider, "provider"), requireString(modelId, "modelId"));
    return getHandleModelOptions(handle);
  });

  ipcMain.handle("gpi:set-thinking-level", async (_event, sessionHandleId: unknown, level: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    const thinkingLevel = requireThinkingLevel(level);
    if (handle.setThinkingLevelAsync) return handle.setThinkingLevelAsync(thinkingLevel);
    handle.setThinkingLevel(thinkingLevel);
    return getHandleModelOptions(handle);
  });

  ipcMain.handle("gpi:get-compaction-options", async (_event, sessionHandleId: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    return getHandleCompactionOptions(handle);
  });

  ipcMain.handle("gpi:compact-session", async (_event, sessionHandleId: unknown, customInstructions: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    return handle.compact(requireOptionalString(customInstructions, "customInstructions"));
  });

  ipcMain.handle("gpi:abort-compaction", async (_event, sessionHandleId: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    if (handle.abortCompactionAsync) return handle.abortCompactionAsync();
    return handle.abortCompaction();
  });

  ipcMain.handle("gpi:set-auto-compaction", async (_event, sessionHandleId: unknown, enabled: unknown) => {
    const handle = requireSessionHandle(sessionHandleId);
    const autoCompactionEnabled = requireBoolean(enabled, "enabled");
    if (handle.setAutoCompactionEnabledAsync) return handle.setAutoCompactionEnabledAsync(autoCompactionEnabled);
    return handle.setAutoCompactionEnabled(autoCompactionEnabled);
  });

  ipcMain.handle("gpi:create-session", async (_event, projectId: unknown) => {
    const validProjectId = requireString(projectId, "projectId");
    const projectPath = await resolveProjectPath(validProjectId);
    const prewarm = bridge.getPrewarmSnapshot();
    console.log(`[gpi] creating Pi SDK session for project ${validProjectId} at ${projectPath} (prewarm: ${prewarm.status}${prewarm.durationMs === undefined ? "" : ` ${prewarm.durationMs.toString()}ms`})`);
    const handle = await withTimeout(workerRuntimeManager.createSession({ projectId: validProjectId, projectPath }), 15_000, "Timed out creating Pi worker session");
    storeSessionHandle(window, handle);
    console.log(`[gpi] created Pi SDK session ${handle.id}`);
    return { id: handle.id, sessionFile: handle.sessionFile };
  });

  ipcMain.handle("gpi:open-session", async (_event, sessionPath: unknown, projectPath: unknown) => {
    const validSessionPath = await resolveExistingPath(requireString(sessionPath, "sessionPath"));
    const cwd = await resolveExistingPath(requireOptionalString(projectPath, "projectPath") ?? process.cwd());
    console.log(`[gpi] opening Pi SDK session ${validSessionPath} at ${cwd}`);
    const handle = await withTimeout(workerRuntimeManager.openSession({ sessionPath: validSessionPath, projectPath: cwd }), 15_000, "Timed out opening Pi worker session");
    storeSessionHandle(window, handle);
    console.log(`[gpi] opened Pi SDK session ${handle.id}`);
    return { id: handle.id, sessionFile: handle.sessionFile };
  });

  ipcMain.handle("gpi:prompt", async (_event, sessionHandleId: unknown, text: unknown) => {
    const handle = sessionHandles.get(requireString(sessionHandleId, "sessionHandleId"));
    if (!handle) throw new Error(`Unknown GPi session handle: ${sessionHandleId}`);
    await handle.prompt(requireString(text, "text"));
    return { ok: true };
  });

  ipcMain.handle("gpi:follow-up", async (_event, sessionHandleId: unknown, text: unknown) => {
    const handle = sessionHandles.get(requireString(sessionHandleId, "sessionHandleId"));
    if (!handle) throw new Error(`Unknown GPi session handle: ${sessionHandleId}`);
    await handle.followUp(requireString(text, "text"));
    return { ok: true };
  });

  ipcMain.handle("gpi:steer", async (_event, sessionHandleId: unknown, text: unknown) => {
    const handle = sessionHandles.get(requireString(sessionHandleId, "sessionHandleId"));
    if (!handle) throw new Error(`Unknown GPi session handle: ${sessionHandleId}`);
    await handle.steer(requireString(text, "text"));
    return { ok: true };
  });

  ipcMain.handle("gpi:abort", async (_event, sessionHandleId: unknown) => {
    const handle = sessionHandles.get(requireString(sessionHandleId, "sessionHandleId"));
    if (!handle) throw new Error(`Unknown GPi session handle: ${sessionHandleId}`);
    await handle.abort();
    return { ok: true };
  });
}

async function getSafeFileDiff(projectPath: string, filePath: string): Promise<{ ok: true; diff: string; kind: "git" | "created" | "unavailable"; message: string | undefined }> {
  const relativePath = normalize(filePath.replaceAll("\\", "/"));
  if (isAbsolute(relativePath) || relativePath.startsWith("..")) return { ok: true, diff: "", kind: "unavailable", message: "Path is outside the project root" };

  const absolutePath = resolve(projectPath, relativePath);
  if (relative(projectPath, absolutePath).startsWith("..")) return { ok: true, diff: "", kind: "unavailable", message: "Path is outside the project root" };

  try {
    const { stdout } = await execFileAsync("git", ["-C", projectPath, "diff", "--", relativePath], { timeout: 5_000, maxBuffer: 512_000 });
    if (stdout.trim().length > 0) return { ok: true, diff: stdout, kind: "git", message: undefined };

    const status = await execFileAsync("git", ["-C", projectPath, "status", "--porcelain", "--", relativePath], { timeout: 5_000, maxBuffer: 64_000 });
    if (status.stdout.startsWith("??")) {
      const content = await readFile(absolutePath, "utf8");
      const diff = [`diff --git a/${relativePath} b/${relativePath}`, "new file mode 100644", "--- /dev/null", `+++ b/${relativePath}`, ...content.split("\n").map((line) => `+${line}`)].join("\n");
      return { ok: true, diff, kind: "created", message: undefined };
    }

    const content = await readFile(absolutePath, "utf8");
    const diff = [`--- /dev/null`, `+++ ${relativePath}`, ...content.split("\n").map((line) => `+${line}`)].join("\n");
    return { ok: true, diff, kind: "created", message: "Git has no diff for this file; showing current file contents as a safe snapshot" };
  } catch (error) {
    try {
      const content = await readFile(absolutePath, "utf8");
      const diff = [`--- /dev/null`, `+++ ${relativePath}`, ...content.split("\n").map((line) => `+${line}`)].join("\n");
      return { ok: true, diff, kind: "created", message: "Project is not a git repository; showing current file contents as a safe snapshot" };
    } catch {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: true, diff: "", kind: "unavailable", message };
    }
  }
}

async function getContinuityStatus(projectPath: string): Promise<ContinuityWorkflowStatus> {
  const fileNames = ["AUTONOMOUS_EXECUTION.md", "ACTIVE_QUEUE.md", "STATE.md"] as const;
  const files = await Promise.all(fileNames.map(async (fileName) => {
    try {
      return { fileName, text: await readFile(join(projectPath, fileName), "utf8") };
    } catch (error) {
      if (isNodeErrorCode(error, "ENOENT")) return { fileName, text: undefined };
      throw error;
    }
  }));
  if (files.some((file) => file.text === undefined)) return emptyContinuityStatus("missing", "Continuity files not found", projectPath);
  const frontMatters = files.map((file) => parseFrontMatter(file.text ?? ""));
  const sessions = new Set(frontMatters.map((frontMatter) => frontMatter.continuity_session).filter((value): value is string => value !== undefined));
  if (sessions.size !== 1) return emptyContinuityStatus("conflict", "Continuity session metadata mismatch", projectPath);
  const continuitySession = [...sessions][0];
  const statuses = new Set(frontMatters.map((frontMatter) => frontMatter.status));
  if (!statuses.has("active")) return { ...emptyContinuityStatus("blocked", "Continuity session is not active", projectPath), continuitySession };
  const activeQueue = files.find((file) => file.fileName === "ACTIVE_QUEUE.md")?.text ?? "";
  const counts = countQueueStatuses(activeQueue);
  const totalTasks = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (totalTasks === 0) return { ...emptyContinuityStatus("initialized", "Continuity initialized; plan queue next", projectPath), continuitySession, counts };
  if (counts.pending > 0 || counts.partial > 0 || counts.inProgress > 0) return { phase: "executable", summary: "Queue has executable work", projectPath, continuitySession, counts };
  if (counts.blocked > 0) return { phase: "blocked", summary: "Queue has blocked work", projectPath, continuitySession, counts };
  return { phase: "complete", summary: "Queue appears complete", projectPath, continuitySession, counts };
}

function emptyContinuityStatus(phase: ContinuityWorkflowStatus["phase"], summary: string, projectPath: string): ContinuityWorkflowStatus {
  return { phase, summary, projectPath, continuitySession: undefined, counts: { blocked: 0, cancelled: 0, done: 0, inProgress: 0, partial: 0, pending: 0 } };
}

function parseFrontMatter(text: string): Record<string, string | undefined> {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  return Object.fromEntries(text.slice(3, end).split("\n").map((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return [line.trim(), undefined];
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
}

function countQueueStatuses(text: string): ContinuityWorkflowStatus["counts"] {
  const counts = { blocked: 0, cancelled: 0, done: 0, inProgress: 0, partial: 0, pending: 0 };
  for (const match of text.matchAll(/^Status: (\w+)$/gm)) {
    const status = match[1];
    if (status === "blocked") counts.blocked += 1;
    if (status === "cancelled") counts.cancelled += 1;
    if (status === "done") counts.done += 1;
    if (status === "in_progress") counts.inProgress += 1;
    if (status === "partial") counts.partial += 1;
    if (status === "pending") counts.pending += 1;
  }
  return counts;
}

function workflowSkillsDirectory(): string {
  return join(app.getPath("home"), ".pi", "agent", "skills");
}

function workflowSkillInstalledPath(skillName: WorkflowSkillName): string {
  return join(workflowSkillsDirectory(), skillName, "SKILL.md");
}

function bundledWorkflowSkillsRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, "skills", "continuity");
  return resolve(currentDir, "../../resources/skills/continuity");
}

function bundledWorkflowSkillPath(skillName: WorkflowSkillName): string {
  return join(bundledWorkflowSkillsRoot(), skillName, "SKILL.md");
}

async function readBundledWorkflowSkill(skillName: WorkflowSkillName): Promise<{ name: WorkflowSkillName; text: string }> {
  return { name: skillName, text: await readFile(bundledWorkflowSkillPath(skillName), "utf8") };
}

async function getWorkflowSkillStatus(skillName: WorkflowSkillName): Promise<WorkflowSkillStatus> {
  const installedPath = workflowSkillInstalledPath(skillName);
  const bundled = await readFile(bundledWorkflowSkillPath(skillName), "utf8");
  try {
    const installed = await readFile(installedPath, "utf8");
    return { name: skillName, installedPath, status: installed === bundled ? "installed" : "conflict" };
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) return { name: skillName, installedPath, status: "missing" };
    throw error;
  }
}

async function getUpdateStatus(): Promise<GpiUpdateStatus> {
  const appVersion = await readPackageVersion(join(currentDir, "../../package.json")) ?? app.getVersion();
  const packageInfo = await resolveInstalledPiPackage();
  const bundledPiVersion = packageInfo.packageJsonPath ? await readPackageVersion(packageInfo.packageJsonPath) : undefined;
  const installedPiVersion = await readInstalledPiCliVersion() ?? bundledPiVersion;
  let latestPiVersion: string | undefined;
  let error: string | undefined;

  try {
    latestPiVersion = await fetchLatestPiVersion();
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : String(unknownError);
    error = `Latest Pi version unavailable: ${message}`;
  }

  return {
    appVersion,
    piPackageName: packageInfo.packageName,
    installedPiVersion,
    latestPiVersion,
    piUpdateAvailable: installedPiVersion && latestPiVersion ? compareSemver(installedPiVersion, latestPiVersion) < 0 : undefined,
    piUpdateCommand: "pi update",
    checkedAt: Date.now(),
    error: installedPiVersion ? error : `Pi CLI/package not found: ${PI_PACKAGE_NAMES.join(" or ")}`,
  };
}

async function readInstalledPiCliVersion(): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await runPiCommand(["--version"], 8_000);
    return parseVersionText(`${stdout}\n${stderr}`);
  } catch {
    return undefined;
  }
}

function parseVersionText(text: string): string | undefined {
  return text.match(/\d+\.\d+\.\d+(?:[-+][\w.-]+)?/)?.[0];
}

async function updatePi(): Promise<GpiPiUpdateResult> {
  const command = "pi update";
  try {
    const { stdout, stderr } = await runPiCommand(["update"], 120_000);
    return { ok: true, command, output: [stdout, stderr].filter((text) => text.trim().length > 0).join("\n"), error: undefined };
  } catch (unknownError) {
    const failed = commandErrorText(unknownError);
    if (shouldTryPiPackageMigration(failed)) return updatePiByPackageMigration(failed);
    return { ok: false, command, output: failed.output, error: friendlyPiUpdateError(failed.message, failed.output) };
  }
}

async function updatePiByPackageMigration(previousFailure: { message: string; output: string }): Promise<GpiPiUpdateResult> {
  const command = `npm uninstall -g ${LEGACY_PI_PACKAGE_NAME} && npm install -g ${PRIMARY_PI_PACKAGE_NAME}`;
  try {
    const uninstall = await runNpmCommand(["uninstall", "-g", LEGACY_PI_PACKAGE_NAME], 120_000)
      .then((result) => [result.stdout, result.stderr].filter((text) => text.trim().length > 0).join("\n"))
      .catch((error: unknown) => commandErrorText(error).output);
    await removeGlobalPiShims();
    const install = await runNpmCommand(["install", "-g", PRIMARY_PI_PACKAGE_NAME], 120_000);
    return {
      ok: true,
      command,
      output: ["pi update hit the legacy package migration path; GPi completed it with npm.", uninstall, install.stdout, install.stderr]
        .filter((text) => text.trim().length > 0)
        .join("\n"),
      error: undefined,
    };
  } catch (unknownError) {
    const failed = commandErrorText(unknownError);
    return {
      ok: false,
      command,
      output: [previousFailure.output, failed.output].filter((text) => text.trim().length > 0).join("\n\n"),
      error: friendlyPiUpdateError(failed.message, failed.output),
    };
  }
}

function commandErrorText(error: unknown): { message: string; output: string } {
  const commandError = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  const message = typeof commandError.message === "string" ? commandError.message : String(error);
  const output = [commandError.stdout, commandError.stderr].filter((text): text is string => typeof text === "string" && text.trim().length > 0).join("\n");
  return { message, output };
}

function shouldTryPiPackageMigration(error: { message: string; output: string }): boolean {
  const text = `${error.message}\n${error.output}`;
  return text.includes(LEGACY_PI_PACKAGE_NAME) && text.includes(PRIMARY_PI_PACKAGE_NAME);
}

function friendlyPiUpdateError(message: string, output: string): string {
  const text = `${message}\n${output}`;
  if (text.includes("EBUSY") || text.includes("EPERM")) {
    return `Pi update is blocked by a locked Windows file. Close every Pi/GPi window and retry. If it still fails, run: npm uninstall -g ${LEGACY_PI_PACKAGE_NAME} && npm install -g ${PRIMARY_PI_PACKAGE_NAME}`;
  }
  return message;
}

async function removeGlobalPiShims(): Promise<void> {
  const npmPrefix = await getNpmPrefix();
  if (!npmPrefix) return;
  await Promise.all(["pi", "pi.cmd", "pi.ps1"].map((fileName) => rm(join(npmPrefix, fileName), { force: true })));
}

async function getNpmPrefix(): Promise<string | undefined> {
  try {
    const { stdout } = await runNpmCommand(["prefix", "-g"], 8_000);
    return stdout.trim() || undefined;
  } catch {
    return process.env.APPDATA ? join(process.env.APPDATA, "npm") : undefined;
  }
}

async function runPiCommand(args: string[], timeout: number): Promise<{ stdout: string; stderr: string }> {
  return runCommand(await findPiExecutable(), args, timeout);
}

async function runNpmCommand(args: string[], timeout: number): Promise<{ stdout: string; stderr: string }> {
  return runCommand(await findExecutable(process.platform === "win32" ? ["npm.cmd", "npm.exe", "npm"] : ["npm"]), args, timeout);
}

async function runCommand(executable: string, args: string[], timeout: number): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === "win32" && executable.toLowerCase().endsWith(".cmd")) {
    return execFileAsync(executable, args, { timeout, windowsHide: true, maxBuffer: 2_000_000, shell: true });
  }
  return execFileAsync(executable, args, { timeout, windowsHide: true, maxBuffer: 2_000_000 });
}

async function findPiExecutable(): Promise<string> {
  return findExecutable(process.platform === "win32" ? ["pi.cmd", "pi.exe", "pi"] : ["pi"]);
}

async function findExecutable(executableNames: string[]): Promise<string> {
  const pathEntries = (process.env.PATH ?? process.env.Path ?? "").split(process.platform === "win32" ? ";" : ":").filter((entry) => entry.trim().length > 0);
  const extraDirs = [
    process.env.APPDATA ? join(process.env.APPDATA, "npm") : undefined,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "pnpm") : undefined,
    process.env.USERPROFILE ? join(process.env.USERPROFILE, ".bun", "bin") : undefined,
    process.env.HOME ? join(process.env.HOME, ".bun", "bin") : undefined,
  ].filter((entry): entry is string => Boolean(entry));

  for (const directory of [...extraDirs, ...pathEntries]) {
    for (const executableName of executableNames) {
      const candidate = join(directory, executableName);
      try {
        await access(candidate);
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }
  }

  return executableNames[0]!;
}

async function fetchLatestPiVersion(): Promise<string | undefined> {
  try {
    return await fetchLatestPackageVersion(PRIMARY_PI_PACKAGE_NAME);
  } catch {
    const response = await fetch("https://pi.dev/api/latest-version");
    if (!response.ok) throw new Error(`pi.dev returned ${response.status.toString()}`);
    const text = (await response.text()).trim();
    if (!text) return undefined;
    try {
      const parsed = JSON.parse(text) as { version?: unknown; latestVersion?: unknown };
      if (typeof parsed.version === "string") return parsed.version;
      if (typeof parsed.latestVersion === "string") return parsed.latestVersion;
    } catch {
      // Plain-text semver is also accepted.
    }
    return text.replace(/^v/, "");
  }
}

async function fetchLatestPackageVersion(packageName: string): Promise<string | undefined> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName).replace("%2F", "%2f")}/latest`);
  if (!response.ok) throw new Error(`npm registry returned ${response.status.toString()}`);
  const parsed = await response.json() as { version?: unknown };
  return typeof parsed.version === "string" ? parsed.version : undefined;
}

async function resolveInstalledPiPackage(): Promise<{ packageName: string; packageJsonPath: string | undefined }> {
  for (const packageName of PI_PACKAGE_NAMES) {
    const packageJsonPath = await resolveInstalledPackageJson(packageName);
    if (packageJsonPath) return { packageName, packageJsonPath };
  }
  return { packageName: PRIMARY_PI_PACKAGE_NAME, packageJsonPath: undefined };
}

async function resolveInstalledPackageJson(packageName: string): Promise<string | undefined> {
  const packageRoot = packageName.startsWith("@") ? join(...packageName.split("/")) : packageName;
  const candidates = [
    join(process.cwd(), "node_modules", packageRoot, "package.json"),
    join(currentDir, "../../node_modules", packageRoot, "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

async function readPackageVersion(packageJsonPath: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index]! : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index]! : 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
}

async function getWorkflowSkillsStatus(): Promise<{ skillsDirectory: string; skills: WorkflowSkillStatus[] }> {
  return { skillsDirectory: workflowSkillsDirectory(), skills: await Promise.all(WORKFLOW_SKILLS.map((skillName) => getWorkflowSkillStatus(skillName))) };
}

async function updateWorkflowSkills(): Promise<{ skillsDirectory: string; updated: WorkflowSkillName[]; skipped: WorkflowSkillName[] }> {
  const updated: WorkflowSkillName[] = [];
  const skipped: WorkflowSkillName[] = [];
  for (const skillName of WORKFLOW_SKILLS) {
    const status = await getWorkflowSkillStatus(skillName);
    if (status.status === "installed") {
      skipped.push(skillName);
      continue;
    }
    await mkdir(resolve(workflowSkillsDirectory(), skillName), { recursive: true });
    await writeFile(status.installedPath, await readFile(bundledWorkflowSkillPath(skillName), "utf8"), "utf8");
    updated.push(skillName);
  }
  return { skillsDirectory: workflowSkillsDirectory(), updated, skipped };
}

async function installWorkflowSkills(): Promise<{ skillsDirectory: string; installed: WorkflowSkillName[]; skipped: WorkflowSkillName[]; conflicts: WorkflowSkillName[] }> {
  const installed: WorkflowSkillName[] = [];
  const skipped: WorkflowSkillName[] = [];
  const conflicts: WorkflowSkillName[] = [];
  for (const skillName of WORKFLOW_SKILLS) {
    const status = await getWorkflowSkillStatus(skillName);
    if (status.status === "installed") {
      skipped.push(skillName);
      continue;
    }
    if (status.status === "conflict") {
      conflicts.push(skillName);
      continue;
    }
    await mkdir(resolve(workflowSkillsDirectory(), skillName), { recursive: true });
    await writeFile(status.installedPath, await readFile(bundledWorkflowSkillPath(skillName), "utf8"), "utf8");
    installed.push(skillName);
  }
  return { skillsDirectory: workflowSkillsDirectory(), installed, skipped, conflicts };
}

function requireWorkflowSkillName(value: unknown): WorkflowSkillName {
  if (typeof value !== "string" || !WORKFLOW_SKILLS.includes(value as WorkflowSkillName)) throw new Error("Invalid workflow skill name");
  return value as WorkflowSkillName;
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function resolveProjectPath(projectId: string): Promise<string> {
  const snapshot = await workspaceStorage.load();
  const projectPath = snapshot.workspace?.projects.find((project) => project.id === projectId)?.path ?? process.cwd();
  return resolveExistingPath(projectPath);
}

async function resolveExistingPath(path: string): Promise<string> {
  await access(path);
  return path;
}

function isWorkspacePayload(value: unknown): value is Parameters<WorkspaceStorage["save"]>[0] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.projects) &&
    Array.isArray(record.sessions) &&
    typeof record.selectedProjectId === "string" &&
    typeof record.selectedSessionId === "string" &&
    typeof record.messages === "object" &&
    record.messages !== null &&
    typeof record.drafts === "object" &&
    record.drafts !== null &&
    typeof record.details === "object" &&
    record.details !== null &&
    typeof record.backendHandles === "object" &&
    record.backendHandles !== null &&
    typeof record.sessionFiles === "object" &&
    record.sessionFiles !== null
  );
}

function requireTurnSnapshotSaveRequest(value: unknown): TurnSnapshotSaveRequest {
  if (!isRecord(value)) throw new Error("Invalid turn snapshot payload");
  return {
    projectId: requireString(value.projectId, "projectId"),
    projectPath: requireString(value.projectPath, "projectPath"),
    sessionId: requireString(value.sessionId, "sessionId"),
    turnId: requireString(value.turnId, "turnId"),
    userMessageId: requireOptionalString(value.userMessageId, "userMessageId"),
    createdAt: requireNumber(value.createdAt, "createdAt"),
    completedAt: value.completedAt === undefined ? undefined : requireNumber(value.completedAt, "completedAt"),
    files: requireArray(value.files, "files").map(requireTurnSnapshotFileSaveInput),
    captureErrors: requireArray(value.captureErrors, "captureErrors").map(requireCaptureError),
  };
}

function requireTurnSnapshotFileSaveInput(value: unknown): TurnSnapshotFileSaveInput {
  if (!isRecord(value)) throw new Error("Invalid turn snapshot file payload");
  return {
    path: requireString(value.path, "path"),
    absolutePath: requireString(value.absolutePath, "absolutePath"),
    existsBefore: requireBoolean(value.existsBefore, "existsBefore"),
    existsAfter: requireBoolean(value.existsAfter, "existsAfter"),
    contentBefore: requireOptionalString(value.contentBefore, "contentBefore"),
    contentAfter: requireOptionalString(value.contentAfter, "contentAfter"),
  };
}

function requireCaptureError(value: unknown): { path: string; message: string } {
  if (!isRecord(value)) throw new Error("Invalid capture error payload");
  return { path: requireString(value.path, "captureError.path"), message: requireString(value.message, "captureError.message") };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Invalid ${name}`);
  return value;
}

function requireOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, name);
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${name}`);
  return value;
}

function requireNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireThinkingLevel(value: unknown): Parameters<GpiPiSessionHandle["setThinkingLevel"]>[0] {
  const level = requireString(value, "thinking level");
  if (level === "off" || level === "minimal" || level === "low" || level === "medium" || level === "high" || level === "xhigh") return level;
  throw new Error(`Invalid thinking level: ${level}`);
}

function requireSessionHandle(sessionHandleId: unknown): GpiPiSessionHandle {
  const id = requireString(sessionHandleId, "sessionHandleId");
  const handle = sessionHandles.get(id);
  if (!handle) throw new Error(`Unknown GPi session handle: ${id}`);
  return handle;
}

async function getHandleModelOptions(handle: GpiPiSessionHandle) {
  return handle.getModelOptionsAsync ? handle.getModelOptionsAsync() : handle.getModelOptions();
}

async function getHandleCompactionOptions(handle: GpiPiSessionHandle) {
  return handle.getCompactionOptionsAsync ? handle.getCompactionOptionsAsync() : handle.getCompactionOptions();
}

function storeSessionHandle(window: BrowserWindow, handle: GpiPiSessionHandle): void {
  sessionHandles.set(handle.id, handle);
  handle.subscribe((event) => {
    window.webContents.send("gpi:pi-event", event);
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

app.whenReady().then(() => {
  void createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
});

app.on("window-all-closed", () => {
  for (const handle of sessionHandles.values()) handle.dispose();
  sessionHandles.clear();
  void workerRuntimeManager.shutdownAll();
  if (process.platform !== "darwin") app.quit();
});
