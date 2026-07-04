import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, readState, writeState, stateExists, walkUpTsConfig, walkUpCsproj, walkUpGit } from "./common";
import { loadHints, matchHint } from "./match-glob";

/**
 * Port of:
 *   pre-tool-use-edit-guard.sh  -> tool_call for "edit"/"write": no-op guard, architecture hints
 *   post-tool-use-edit.sh       -> tool_result for "edit"/"write": dirty flag, import resolution, tsc, dotnet build, citation check
 */

// Resolve config path relative to this file (jiti provides __dirname at runtime)
const HINTS_CONFIG = join(__dirname, "config", "architecture-hints.json");

interface EditGuardState {
  sessionDir: string;
}

function getState(ctx: ExtensionContext): EditGuardState {
  const file = ctx.sessionManager.getSessionFile();
  const id = file ? md5(file) : md5(ctx.cwd + "edit");
  return { sessionDir: getStateDir(id) };
}

const RUNTIME_TIMEOUT_MS = 15_000; // 15 seconds max for type-checking

export function setupEditGuard(pi: ExtensionAPI): void {
  // Pre-execution guards (port of pre-tool-use-edit-guard.sh)
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return undefined;

    const { sessionDir } = getState(ctx);
    const input = event.input as Record<string, unknown>;

    // 2.2 -- no-op guard for edit
    if (event.toolName === "edit") {
      const oldStr = input.old_string as string | undefined;
      const newStr = input.new_string as string | undefined;
      if (oldStr !== undefined && oldStr === newStr) {
        return { block: true, reason: "old_string and new_string are identical -- this edit is a no-op." };
      }
    }

    // No-op guard for write
    if (event.toolName === "write") {
      const filePath = input.file_path as string | undefined;
      const content = input.content as string | undefined;
      if (filePath && content !== undefined && existsSync(filePath)) {
        const existing = readFileSync(filePath, "utf-8");
        if (content === existing) {
          return { block: true, reason: "Write content is identical to the file's current content -- this write is a no-op." };
        }
      }
    }

    // 5.1/5.2 -- architecture/pattern hints (one-shot per file per session)
    const filePath = input.file_path as string | undefined;
    if (!filePath) return undefined;

    // Skip node_modules and non-relevant extensions
    if (filePath.includes("node_modules")) return undefined;
    if (!filePath.endsWith(".cs") && !filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return undefined;

    const hintKey = md5(filePath);
    const hintedFile = `hinted_${hintKey}`;
    if (stateExists(sessionDir, hintedFile)) return undefined;

    // Load and match hints
    let hints: { glob: string; hint: string }[] = [];
    try {
      hints = loadHints(HINTS_CONFIG);
    } catch {
      return undefined;
    }

    const hint = matchHint(hints, filePath, ctx.cwd);
    if (hint) {
      writeState(sessionDir, hintedFile, "1");
      if (ctx.hasUI) {
        ctx.ui.notify(`Architecture reminder for ${filePath.split("/").pop()}: ${hint}`, "warning");
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

    // 2.1 -- dirty flag: every successful Edit/Write invalidates bash dedup cache
    writeState(sessionDir, "dirty_since_last_command", "1");

    // Determine file content to analyze
    let content: string | null = null;
    if (event.toolName === "edit") {
      content = (input.new_string as string) || null;
    } else if (event.toolName === "write") {
      content = (input.content as string) || null;
    }
    const resolvedContent: string = content ?? (() => {
      // Fallback: read the current file
      try { return readFileSync(filePath, "utf-8"); } catch { return ""; }
    })();

    const fileDir = dirname(filePath);
    const fileName = filePath.split("/").pop() || "";
    const gitRoot = walkUpGit(fileDir);

    // 3.1 -- import resolution for .ts/.tsx files
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      if (gitRoot) {
        const issues = checkImports(resolvedContent, fileDir);
        if (issues.length > 0) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Import resolution errors in ${fileName}:\n${issues.join("\n")}` },
            ],
          };
        }
      }

      // 3.2 -- type-check gate (tsc --noEmit)
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
    }

    // 3.5 -- C# build gate
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
    }

    // 3.4 -- citation check for .md/.mdx/.txt files
    if (filePath.endsWith(".md") || filePath.endsWith(".mdx") || filePath.endsWith(".txt")) {
      if (gitRoot && resolvedContent) {
        const citationIssues = checkCitations(resolvedContent, gitRoot, fileName);
        if (citationIssues.length > 0) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Citation issues in ${fileName}:\n${citationIssues.join("\n")}` },
            ],
          };
        }
      }
    }

    return undefined;
  });
}

/**
 * Check relative imports in new file content (port of 3.1 symbol-existence verifier).
 */
function checkImports(content: string, fileDir: string): string[] {
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
    const output = execSync(
      `${tscCmd} --noEmit --pretty false -p ${tsconfigDir}`,
      {
        cwd: tsconfigDir,
        timeout: RUNTIME_TIMEOUT_MS,
        stdio: "pipe",
        encoding: "utf-8",
      }
    ).toString();
    return []; // No errors (or errors that produced stdout but didn't exit non-zero)
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
 * Check that file:line citations in markdown files resolve (port of 3.4 citation checker).
 */
function checkCitations(content: string, repoRoot: string, _fileName: string): string[] {
  const issues: string[] = [];
  const citationRe = /([a-zA-Z0-9_./-]+\.(?:ts|tsx|js|py|sh|json)):(\d+)/g;
  let match: RegExpExecArray | null;

  const addedLines = content.split("\n");

  for (const line of addedLines) {
    while ((match = citationRe.exec(line)) !== null) {
      const path = match[1];
      const lineNum = parseInt(match[2], 10);
      const fullPath = join(repoRoot, path);

      if (!existsSync(fullPath)) {
        issues.push(`Referenced file '${path}' does not exist.`);
        continue;
      }

      try {
        const totalLines = readFileSync(fullPath, "utf-8").split("\n").length;
        if (lineNum > totalLines) {
          issues.push(`Referenced line ${lineNum} in '${path}' exceeds file length (${totalLines}).`);
        }
      } catch {
        // skip unreadable
      }
    }
  }

  return issues;
}
