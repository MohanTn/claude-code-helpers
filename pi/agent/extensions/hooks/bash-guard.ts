import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5, getStateDir, readState, writeState, deleteState, stateExists } from "./common";

/**
 * Port of:
 *   pre-tool-use-bash-guard.sh   -> tool_call for "bash": npm script existence, failed-cmd memory, cmd dedup
 *   post-tool-use-bash.sh        -> tool_result for "bash": failure recording, verbose output trimming
 */

interface BashSessionState {
  sessionDir: string;
}

function getState(ctx: ExtensionContext): BashSessionState {
  const file = ctx.sessionManager.getSessionFile();
  const id = file ? md5(file) : md5(ctx.cwd + "bash");
  return { sessionDir: getStateDir(id) };
}

export function setupBashGuard(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const input = event.input as { command?: string; timeout?: number };
    const cmd = input.command || "";
    if (!cmd) return undefined;

    const { sessionDir } = getState(ctx);

    // 3.3 -- npm run script existence check
    const npmRunMatch = cmd.match(/^npm\s+run\s+([a-zA-Z0-9:_/-]+)/);
    if (npmRunMatch) {
      const script = npmRunMatch[1];
      const pkgPath = join(ctx.cwd, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          if (!pkg.scripts || !pkg.scripts[script]) {
            return {
              block: true,
              reason: `No npm script named '${script}' exists in ${pkgPath}.`,
            };
          }
        } catch {
          // Parse error, let it proceed and fail naturally
        }
      }
    }

    // 2.3 -- failed-command memory
    const cmdSig = md5(cmd);
    const failedFile = `failed_${cmdSig}`;
    const dirtyFlag = "dirty_since_last_command";

    if (stateExists(sessionDir, failedFile) && !stateExists(sessionDir, dirtyFlag)) {
      const errMsg = readState(sessionDir, failedFile);
      return {
        block: true,
        reason: `This exact command already failed earlier this session with no file changes since: ${errMsg}`,
      };
    }

    // 2.1 -- command dedup guard
    const lastCmd = readState(sessionDir, "last_command");
    if (lastCmd === cmd && !stateExists(sessionDir, dirtyFlag)) {
      return {
        block: true,
        reason: "This exact command was already run with no file changes since. Re-running will give the same result; see prior output in the transcript.",
      };
    }

    // Write current command as last
    writeState(sessionDir, "last_command", cmd);
    // Clear dirty flag (will be re-set by edit-guard on file changes)
    deleteState(sessionDir, dirtyFlag);

    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "bash" || !event.input) return undefined;

    const input = event.input as { command?: string; timeout?: number };
    const cmd = input.command || "";
    if (!cmd) return undefined;

    const { sessionDir } = getState(ctx);
    const details = event.details as { exit_code?: number; stdout?: string } | undefined;
    const exitCode = details?.exit_code ?? 0;

    // Note: in pi, `tool_result` fires after tool execution. The result isn't in
    // `event.isError` in the same way as Claude Code's exit_code. We check details
    // for exit_code if available, but also check isError.

    const isError = event.isError || exitCode !== 0;

    // 2.3 -- record failures (always, before any blocking)
    if (cmd && isError) {
      // Normalize: strip absolute paths and numeric tokens
      const normalized = cmd
        .replace(/\/[^ ]*/g, "")
        .replace(/[0-9]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const sig = md5(normalized);
      const firstErr = details?.stdout
        ? details.stdout.split("\n").filter((l) => /error|fail/i.test(l))[0] || ""
        : "";
      const errMsg = `${cmd} (exit ${exitCode}) -- ${firstErr}`;

      // Append to failed file
      const existing = readState(sessionDir, `failed_${sig}`) || "";
      writeState(sessionDir, `failed_${sig}`, `${existing}\n${errMsg}`.trim());
    }

    // Skip trimming for meta-inspection commands
    if (cmd.includes(".pi/agent") || cmd.includes(".claude/hooks") || cmd.includes(".claude/settings")) {
      return undefined;
    }

    // 1.2 -- verbose output trimming
    const output = details?.stdout || "";
    const lines = output.split("\n").length;
    if (lines > 200) {
      // Return modified result with truncated content
      const summary = output
        .split("\n")
        .filter((l) => /error|fail|warn/i.test(l))
        .slice(0, 40)
        .join("\n");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Output was ${lines} lines; full log saved to state.\nFiltered errors/warnings below:\n${summary}\n`,
          },
        ],
        details: { ...details, stdout: undefined, _truncated: true, _lineCount: lines },
      };
    }

    return undefined;
  });

  // Register a handler for tool_execution_end to match the bash tool name
  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    // No additional logic needed here currently
  });
}
