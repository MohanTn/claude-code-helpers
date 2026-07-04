import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, readState, writeState } from "./common";

/**
 * Port of pre-tool-use-loop-breaker.sh: detect >3 consecutive identical tool calls.
 * Uses in-memory state keyed by a signature of {tool_name, tool_input}.
 */

interface LoopState {
  sessionDir: string;
  lastSig: string;
  count: number;
}

const stateMap = new Map<string, LoopState>();

function getLoopState(ctx: ExtensionContext): LoopState {
  const file = ctx.sessionManager.getSessionFile();
  const id = file ? md5(file) : md5(ctx.cwd + "loop");
  if (!stateMap.has(id)) {
    stateMap.set(id, { sessionDir: getStateDir(id), lastSig: "", count: 0 });
  }
  return stateMap.get(id)!;
}

export function setupLoopBreaker(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    // Skip for bash - let bash-guard handle that
    if (event.toolName === "bash") return undefined;

    // Generate signature from tool name + input (excluding timeout for bash)
    const sig = md5(JSON.stringify({ tool_name: event.toolName, tool_input: event.input }));

    const ls = getLoopState(ctx);

    if (sig === ls.lastSig) {
      ls.count += 1;
    } else {
      ls.count = 1;
    }
    ls.lastSig = sig;

    // Persist to file state as well for visibility
    writeState(ls.sessionDir, "loop_last_sig", sig);
    writeState(ls.sessionDir, "loop_count", String(ls.count));

    if (ls.count >= 3) {
      return {
        block: true,
        reason: `This exact tool call has been attempted ${ls.count} times in a row with nothing different in between. Stop and explain what's failing instead of retrying the same call again.`,
      };
    }

    return undefined;
  });

  // Reset loop state on session start
  pi.on("session_start", async (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    const id = file ? md5(file) : md5(ctx.cwd + "loop");
    stateMap.set(id, { sessionDir: getStateDir(id), lastSig: "", count: 0 });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    const id = file ? md5(file) : md5(ctx.cwd + "loop");
    stateMap.delete(id);
  });
}
