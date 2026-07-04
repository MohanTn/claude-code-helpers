import { existsSync, readFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, readState, writeState, stateExists, fileHash } from "./common";

/**
 * Port of:
 *   pre-tool-use-read-cache.sh  -> tool_call for "read": duplicate-read cache, read-before-grep nudge
 *   post-tool-use-read-trim.sh  -> tool_result for "read": backstop truncation of large reads
 */

interface ReadCacheState {
  sessionDir: string;
}

function getState(ctx: ExtensionContext): ReadCacheState {
  const file = ctx.sessionManager.getSessionFile();
  const id = file ? md5(file) : md5(ctx.cwd + "read");
  return { sessionDir: getStateDir(id) };
}

export function setupReadCache(pi: ExtensionAPI): void {
  // Pre-read: duplicate cache + nudge
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "read") return undefined;

    const input = event.input as { path?: string; offset?: number; limit?: number };
    const filePath = input.path || "";
    if (!filePath) return undefined;
    if (!existsSync(filePath)) return undefined;

    const { sessionDir } = getState(ctx);
    const offset = input.offset ?? 0;
    const limit = input.limit ?? "all";

    // 1.1 -- duplicate-read cache (keyed on path + offset + limit)
    const cacheKey = md5(`${filePath}|${offset}|${limit}`);
    const cacheFile = `read_${cacheKey}`;
    const currentHash = fileHash(filePath);

    if (currentHash && stateExists(sessionDir, cacheFile)) {
      const cachedHash = readState(sessionDir, cacheFile);
      if (cachedHash === currentHash) {
        return {
          block: true,
          reason: `File '${filePath}' was already read in this session and is unchanged since. Re-use what you already saw instead of reading it again; only re-read if you specifically need to re-verify content after an edit you're unsure about.`,
        };
      }
    }

    // Store current hash
    if (currentHash) {
      writeState(sessionDir, cacheFile, currentHash);
    }

    // 1.5 -- read-before-grep nudge (only once per file per session)
    const fileKey = md5(filePath);
    const nudgeFile = `nudged_${fileKey}`;
    if (!stateExists(sessionDir, nudgeFile)) {
      let lineCount = 0;
      try {
        const content = readFileSync(filePath, "utf-8");
        lineCount = content.split("\n").length;
      } catch { /* skip */ }

      const hasRange = input.offset !== undefined || input.limit !== undefined;

      if (lineCount > 1500 && !hasRange) {
        writeState(sessionDir, nudgeFile, "1");
        return {
          block: true,
          reason: `File has ${lineCount} lines and no offset/limit was given. Consider Grep-ing for the relevant symbol first, or reading a specific range.`,
        };
      }
    }

    return undefined;
  });

  // Post-read: backstop truncation
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "read") return undefined;

    // Check if the read content is too large
    if (event.content && Array.isArray(event.content)) {
      for (const block of event.content) {
        if (block.type === "text" && typeof block.text === "string") {
          const lines = block.text.split("\n").length;
          if (lines > 1500) {
            const headPart = block.text.split("\n").slice(0, 80).join("\n");
            const tailPart = block.text.split("\n").slice(-40).join("\n");

            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `This read returned ${lines} lines and was not bounded by offset/limit.\nFirst 80 lines:\n${headPart}\n...\nLast 40 lines:\n${tailPart}\n`,
                },
              ],
            };
          }
        }
      }
    }

    return undefined;
  });
}
