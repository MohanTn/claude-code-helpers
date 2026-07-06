import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync, spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, writeState, walkUpTsConfig, walkUpCsproj, walkUpGit } from "./common";

/**
 * Port of:
 *   pre-tool-use-edit-guard.sh  -> tool_call for "edit"/"write": no-op guard
 *   post-tool-use-edit.sh       -> tool_result for "edit"/"write": dirty flag, import resolution, tsc/dotnet build gate, sonar-lite
 */

const SONAR_LITE_PATH = join(__dirname, "sonar_lite.py");

interface EditGuardState {
  sessionDir: string;
}

function getState(ctx: ExtensionContext): EditGuardState {
  const file = ctx.sessionManager.getSessionFile();
  const id = file ? md5(file) : md5(ctx.cwd + "edit");
  return { sessionDir: getStateDir(id) };
}

const RUNTIME_TIMEOUT_MS = 15_000; // 15 seconds max for type-checking
const SONAR_TIMEOUT_MS = 20_000; // 20 seconds max for sonar-lite

export function setupEditGuard(pi: ExtensionAPI): void {
  // Pre-execution guards (port of pre-tool-use-edit-guard.sh)
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return undefined;

    const input = event.input as Record<string, unknown>;

    // 2.2 — no-op guard for edit
    if (event.toolName === "edit") {
      const oldStr = input.old_string as string | undefined;
      const newStr = input.new_string as string | undefined;
      if (oldStr !== undefined && oldStr === newStr) {
        return { block: true, reason: "old_string and new_string are identical — this edit is a no-op." };
      }
    }

    // No-op guard for write
    if (event.toolName === "write") {
      const filePath = input.file_path as string | undefined;
      const content = input.content as string | undefined;
      if (filePath && content !== undefined && existsSync(filePath)) {
        const existing = readFileSync(filePath, "utf-8");
        if (content === existing) {
          return { block: true, reason: "Write content is identical to the file's current content — this write is a no-op." };
        }
      }
    }

    return undefined;
  });

  // Post-execution verifiers (port of post-tool-use-edit.sh)
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return undefined;

    const { sessionDir } = getState(ctx);
    const input = event.input as Record<string, unknown>;
    const filePath = input.file_path as string | undefined;
    if (!filePath) return undefined;

    // 2.1 — dirty flag: every successful Edit/Write invalidates bash dedup cache
    writeState(sessionDir, "dirty_since_last_command", "1");

    const fileDir = dirname(filePath);
    const fileName = filePath.split("/").pop() || "";
    const gitRoot = walkUpGit(fileDir);

    // 3.1/3.2 — import resolution + type-check gate for .ts/.tsx files
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      const content = resolveEditedContent(event.toolName, input, filePath);

      if (gitRoot) {
        const issues = checkImports(content, fileDir);
        if (issues.length > 0) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Import resolution errors in ${fileName}:\n${issues.join("\n")}` },
            ],
          };
        }
      }

      const tsconfigDir = walkUpTsConfig(fileDir);
      if (tsconfigDir) {
        const tscErrors = runTypeCheck(tsconfigDir, fileName);
        if (tscErrors.length > 0) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Type errors in ${fileName}:\n${tscErrors.join("\n")}` },
            ],
          };
        }
      }

      const sonarOutput = runSonarLite(filePath);
      if (sonarOutput) {
        return { isError: true, content: [{ type: "text", text: sonarOutput }] };
      }
    }

    // 3.6 — sonar-lite for .js/.jsx files
    if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) {
      const sonarOutput = runSonarLite(filePath);
      if (sonarOutput) {
        return { isError: true, content: [{ type: "text", text: sonarOutput }] };
      }
    }

    // 3.5 — C# build gate, then sonar-lite
    if (filePath.endsWith(".cs")) {
      const csprojInfo = walkUpCsproj(fileDir);
      if (csprojInfo) {
        const buildErrors = runDotnetBuild(csprojInfo.dir, csprojInfo.file, fileName);
        if (buildErrors.length > 0) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Build errors in ${fileName}:\n${buildErrors.join("\n")}` },
            ],
          };
        }
      }

      const sonarOutput = runSonarLite(filePath);
      if (sonarOutput) {
        return { isError: true, content: [{ type: "text", text: sonarOutput }] };
      }
    }

    return undefined;
  });
}

/** Determine the file content to analyze for the just-applied edit/write. */
function resolveEditedContent(toolName: string, input: Record<string, unknown>, filePath: string): string {
  const content = toolName === "edit" ? (input.new_string as string) : (input.content as string);
  if (content) return content;
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Check relative imports in new file content (port of 3.1 symbol-existence verifier).
 */
export function checkImports(content: string, fileDir: string): string[] {
  const issues: string[] = [];
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(content)) !== null) {
    const mod = match[1];

    // Only check relative imports
    if (!mod.startsWith(".")) continue;

    // Strip trailing extension (NodeNext/ESM: "./foo.js" may refer to "./foo.ts")
    let stripped = mod;
    if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(stripped)) {
      stripped = stripped.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, "");
    }

    const resolved = join(fileDir, stripped);
    const candidates = [
      mod,                           // exact relative
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      join(resolved, "index.ts"),
      join(resolved, "index.tsx"),
      join(resolved, "index.js"),
      join(resolved, "index.jsx"),
      join(fileDir, mod),            // relative from file dir
    ];

    const exists = candidates.some((c) => {
      try { return existsSync(c); } catch { return false; }
    });

    if (!exists) {
      issues.push(`Import '${mod}' does not resolve to an existing file.`);
    }
  }

  return issues;
}

/**
 * Run tsc --noEmit with timeout (port of 3.2 type-check gate).
 */
function runTypeCheck(tsconfigDir: string, fileName: string): string[] {
  // Find tsc binary
  let tscCmd: string | null = null;
  const localTsc = join(tsconfigDir, "node_modules", ".bin", "tsc");
  if (existsSync(localTsc)) {
    tscCmd = localTsc;
  } else {
    // Try global tsc
    try {
      execSync("which tsc", { stdio: "ignore", timeout: 2000 });
      tscCmd = "tsc";
    } catch {
      return []; // tsc not available
    }
  }

  try {
    execSync(
      `${tscCmd} --noEmit --pretty false -p ${tsconfigDir}`,
      {
        cwd: tsconfigDir,
        timeout: RUNTIME_TIMEOUT_MS,
        stdio: "pipe",
        encoding: "utf-8",
      }
    );
    return []; // No errors
  } catch (err: unknown) {
    const e = err as { stderr?: { toString(): string }; stdout?: { toString(): string }; message?: string };
    const stderr = e?.stderr?.toString() || "";
    const msg = e?.message || "";
    const allOutput = stderr || msg;

    // Filter errors for the edited file only
    const errors = allOutput
      .split("\n")
      .filter((l: string) => l.includes(fileName) && (l.includes("error") || l.includes("Error")))
      .map((l: string) => l.trim());

    return errors;
  }
}

/**
 * Run dotnet build with --no-restore (port of 3.5 C# build gate).
 */
function runDotnetBuild(projectDir: string, csprojFile: string, fileName: string): string[] {
  try {
    execSync(
      `dotnet build "${csprojFile}" --no-restore -nologo -v q`,
      {
        cwd: projectDir,
        timeout: RUNTIME_TIMEOUT_MS + 5000, // 20s for dotnet
        stdio: "pipe",
        encoding: "utf-8",
      }
    );
    return [];
  } catch (err: unknown) {
    const e = err as { stderr?: { toString(): string }; stdout?: { toString(): string }; message?: string };
    const stderr = e?.stderr?.toString() || "";
    const stdout = e?.stdout?.toString() || "";
    const allOutput = stderr || stdout;

    // Filter for CS/MSB errors mentioning the edited file
    const errors = allOutput
      .split("\n")
      .filter((l: string) => l.includes(fileName) && /error (CS|MSB)/.test(l))
      .map((l: string) => l.trim());

    return errors;
  }
}

/**
 * Run sonar_lite.py against the edited file (port of 3.6 sonar-lite gate).
 * Exit code 1 means findings were reported on stdout; 0 means clean.
 */
function runSonarLite(filePath: string): string | null {
  const result = spawnSync("python3", [SONAR_LITE_PATH, filePath], {
    timeout: SONAR_TIMEOUT_MS,
    encoding: "utf-8",
  });
  if (result.status === 1) {
    return (result.stdout || "").trim() || null;
  }
  return null;
}
