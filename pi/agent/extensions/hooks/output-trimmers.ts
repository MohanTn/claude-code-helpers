import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, readState, writeState } from "./common";

/**
 * Port of post-tool-use-search-trim.sh: verbose result trimming for grep/glob/ls/find,
 * plus one-shot nudge to use Explore subagent for heavy search sessions.
 */

const SEARCH_TOOLS = new Set(["grep", "glob", "find", "ls"]);

interface SearchState {
  sessionDir: string;
  callCount: number;
}

const stateMap = new Map<string, SearchState>();

function getSearchState(ctx: ExtensionContext): SearchState {
  const file = ctx.sessionManager.getSessionFile();
  const id = file ? md5(file) : md5(ctx.cwd + "search");
  if (!stateMap.has(id)) {
    stateMap.set(id, { sessionDir: getStateDir(id), callCount: 0 });
  }
  return stateMap.get(id)!;
}

export function setupOutputTrimmers(pi: ExtensionAPI): void {
  pi.on("tool_result", async (event, ctx) => {
    if (!SEARCH_TOOLS.has(event.toolName)) return undefined;

    const ss = getSearchState(ctx);
    ss.callCount += 1;
    writeState(ss.sessionDir, "search_call_count", String(ss.callCount));

    // Extract all text from the result
    let text = "";
    if (event.content && Array.isArray(event.content)) {
      for (const block of event.content) {
        if (block.type === "text") {
          text += block.text + "\n";
        }
      }
    }

    if (!text.trim()) return undefined;

    // Verbosity trimming (>200 lines)
    const lines = text.split("\n").length;
    if (lines > 200) {
      const headPart = text.split("\n").slice(0, 60).join("\n");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Result was ${lines} lines; full output examined.\nFirst 60 lines:\n${headPart}\n`,
          },
        ],
      };
    }

    // One-shot nudge: after 8+ search calls, suggest subagent
    // (This doesn't exist in pi in the same way, but we keep the nudge)
    const nudgedFile = "search_nudge_sent";
    const nudged = readState(ss.sessionDir, nudgedFile);

    if (ss.callCount >= 8 && !nudged) {
      writeState(ss.sessionDir, nudgedFile, "1");
      if (ctx.hasUI) {
        ctx.ui.notify(
          `This session has made ${ss.callCount} search calls. For broad, open-ended exploration, consider delegating to a subagent -- it keeps raw search results out of this context.`,
          "info",
        );
      }
    }

    return undefined;
  });

  // Reset on session start
  pi.on("session_start", async (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    const id = file ? md5(file) : md5(ctx.cwd + "search");
    stateMap.set(id, { sessionDir: getStateDir(id), callCount: 0 });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    const id = file ? md5(file) : md5(ctx.cwd + "search");
    stateMap.delete(id);
  });
}
