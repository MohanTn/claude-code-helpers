import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const HOOKS_STATE_DIR = join(homedir(), ".pi", "agent", "state", "hooks");

export function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function getStateDir(sessionId: string): string {
  const dir = join(HOOKS_STATE_DIR, sessionId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readState(stateDir: string, name: string): string | null {
  try {
    return readFileSync(join(stateDir, name), "utf-8").trim();
  } catch {
    return null;
  }
}

export function writeState(stateDir: string, name: string, content: string): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, name), content, "utf-8");
}

export function deleteState(stateDir: string, name: string): void {
  try {
    rmSync(join(stateDir, name), { force: true });
  } catch {
    // ok
  }
}

export function stateExists(stateDir: string, name: string): boolean {
  return existsSync(join(stateDir, name));
}

export function fileHash(filePath: string): string | null {
  try {
    return md5(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function walkUpTsConfig(fileDir: string): string | null {
  let search = fileDir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(search, "tsconfig.json"))) return search;
    const parent = join(search, "..");
    if (parent === search) break;
    search = parent;
  }
  return null;
}

export function walkUpCsproj(fileDir: string): { dir: string; file: string } | null {
  let search = fileDir;
  for (let i = 0; i < 6; i++) {
    let entries: string[] = [];
    try { entries = readdirSync(search); } catch { break; }
    const csproj = entries.find((f) => f.endsWith(".csproj"));
    if (csproj) return { dir: search, file: join(search, csproj) };
    const parent = join(search, "..");
    if (parent === search) break;
    search = parent;
  }
  return null;
}

export function walkUpGit(fileDir: string): string | null {
  let search = fileDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(search, ".git"))) return search;
    const parent = join(search, "..");
    if (parent === search) break;
    search = parent;
  }
  return null;
}
