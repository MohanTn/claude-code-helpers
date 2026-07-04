import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, HOOKS_STATE_DIR } from "./common";

/**
 * Port of:
 *   session-start.sh        -> session_start (generate project digest, inject at first turn)
 *   session-end-cleanup.sh  -> session_shutdown (prune stale state directories)
 */

let cachedDigest: string | null = null;
let digestCwd: string | null = null;

function getSessionId(ctx: ExtensionContext): string {
  const file = ctx.sessionManager.getSessionFile();
  return file ? md5(file) : md5(ctx.cwd + Date.now());
}

function generateProjectDigest(cwd: string): string[] {
  const lines: string[] = [];
  const claudeMd = join(cwd, "CLAUDE.md");
  const agentsMd = join(cwd, "AGENTS.md");

  lines.push(`## Project digest for: ${cwd}`);
  lines.push("");

  // Context files
  for (const ctxFile of [claudeMd, agentsMd]) {
    if (existsSync(ctxFile)) {
      const content = readFileSync(ctxFile, "utf-8");
      const firstLines = content.split("\n").slice(0, 15).join("\n");
      lines.push(`### ${ctxFile.split("/").pop()}`);
      lines.push("");
      lines.push(firstLines);
      lines.push("");
    }
  }

  // package.json scripts
  const pkgJson = join(cwd, "package.json");
  if (existsSync(pkgJson)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJson, "utf-8"));
      lines.push("### package.json");
      if (pkg.name) lines.push(`name: ${pkg.name}`);
      if (pkg.scripts) {
        lines.push("scripts:");
        for (const [key, val] of Object.entries(pkg.scripts)) {
          lines.push(`  ${key}: ${val}`);
        }
      }
      lines.push("");
    } catch { /* ignore parse errors */ }
  }

  // .NET projects (walk up to 3 levels)
  const csprojFiles: string[] = [];
  function walkCsproj(dir: string, depth: number): void {
    if (depth > 3) return;
    try {
      const entries = readdirSync(dir);
      for (const e of entries) {
        const full = join(dir, e);
        if (e.endsWith(".csproj")) {
          csprojFiles.push(join(dir, e));
        } else {
          try {
            if (statSync(full).isDirectory()) walkCsproj(full, depth + 1);
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }
  walkCsproj(cwd, 0);
  if (csprojFiles.length > 0) {
    lines.push("### .NET projects");
    for (const cp of csprojFiles.slice(0, 5)) {
      lines.push(`  ${cp}`);
    }
    lines.push("");
  }

  // Docker Compose
  for (const dc of ["docker-compose.yml", "docker-compose.yaml"]) {
    const dcPath = join(cwd, dc);
    if (existsSync(dcPath)) {
      lines.push("### docker-compose services");
      try {
        const content = readFileSync(dcPath, "utf-8");
        const services = content
          .split("\n")
          .filter((l) => /^\s{2}[a-zA-Z]/.test(l))
          .map((l) => l.replace(":", "").trim())
          .slice(0, 10);
        for (const s of services) lines.push(`  ${s}`);
      } catch { /* ok */ }
      lines.push("");
    }
  }

  // Top-level entries
  lines.push("### Top-level entries");
  try {
    const top = readdirSync(cwd);
    for (const e of top.slice(0, 20)) lines.push(e);
  } catch { /* ok */ }
  lines.push("");

  return lines;
}

export function setupSessionLifecycle(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    const sessionId = getSessionId(ctx);
    const sessionDir = getStateDir(sessionId);

    // Digest cache check
    const digestKey = md5(ctx.cwd);
    const digestDir = join(HOOKS_STATE_DIR, "digests");
    mkdirSync(digestDir, { recursive: true });
    const digestFile = join(digestDir, `${digestKey}.md`);

    const claudeMdPath = join(ctx.cwd, "CLAUDE.md");
    const agentsMdPath = join(ctx.cwd, "AGENTS.md");

    let needsRegen = false;
    if (!existsSync(digestFile)) {
      needsRegen = true;
    } else {
      const digMtime = statSync(digestFile).mtimeMs;
      for (const f of [claudeMdPath, agentsMdPath]) {
        if (existsSync(f) && statSync(f).mtimeMs > digMtime) {
          needsRegen = true;
          break;
        }
      }
      if (!needsRegen && !existsSync(claudeMdPath) && !existsSync(agentsMdPath)) {
        // No context file: regen if older than 24h
        if (Date.now() - digMtime > 86400_000) needsRegen = true;
      }
    }

    if (needsRegen) {
      const lines = generateProjectDigest(ctx.cwd);
      const content = lines.join("\n");
      writeFileSync(digestFile, content, "utf-8");
      cachedDigest = content;
    } else {
      cachedDigest = readFileSync(digestFile, "utf-8");
    }
    digestCwd = ctx.cwd;
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const sessionId = getSessionId(ctx);

    // Prune state directories older than 7 days (skip digests, logs, current)
    try {
      const entries = readdirSync(HOOKS_STATE_DIR);
      const now = Date.now();
      for (const entry of entries) {
        if (entry === "digests" || entry === "logs" || entry === md5(sessionId)) continue;
        const fullPath = join(HOOKS_STATE_DIR, entry);
        try {
          const st = statSync(fullPath);
          if (st.isDirectory() && (now - st.mtimeMs > 7 * 86400_000)) {
            rmSync(fullPath, { recursive: true, force: true });
          }
        } catch { /* skip */ }
      }
    } catch { /* state dir missing */ }

    // Prune digests older than 30 days
    try {
      const digDir = join(HOOKS_STATE_DIR, "digests");
      if (existsSync(digDir)) {
        const entries = readdirSync(digDir);
        const now = Date.now();
        for (const entry of entries) {
          const fullPath = join(digDir, entry);
          try {
            if (statSync(fullPath).isFile() && (now - statSync(fullPath).mtimeMs > 30 * 86400_000)) {
              rmSync(fullPath, { force: true });
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* digests dir missing */ }

    cachedDigest = null;
    digestCwd = null;
  });

  pi.on("session_before_compact", async (_event, _ctx) => {
    // Port of pre-compact.sh: snapshot touched files.
    // In pi, file tracking is handled in-memory by edit-guard.ts.
    // Let compaction proceed normally.
    return undefined;
  });
}

/** Retrieve the cached project digest for the given cwd (used by entry point for before_agent_start injection). */
export function getCachedDigest(cwd: string): string | null {
  if (cachedDigest && digestCwd === cwd) return cachedDigest;
  // Fallback: try filesystem cache
  const digestDir = join(HOOKS_STATE_DIR, "digests");
  const digestFile = join(digestDir, `${md5(cwd)}.md`);
  try {
    return readFileSync(digestFile, "utf-8");
  } catch {
    return null;
  }
}
