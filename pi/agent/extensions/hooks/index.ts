// TypeScript port of claude/hooks for the Pi coding agent. Gates whose logic
// doesn't depend on Pi's tool-input shape (loop breaker, digest generation,
// the post-edit import/type-check/build chain, session cleanup)
// shell out to the existing claude/hooks/*.sh scripts via lib.ts's
// runClaudeHook, the same reuse pattern copilot/hooks uses. Two gates are
// reimplemented natively instead of shelled out, because Pi's tool/event
// shapes don't map onto Claude's closely enough to translate faithfully:
//
// - edit no-op guard: Pi's edit tool takes `{path, edits: [{oldText,
//   newText}]}` (an array, for multi-edit-in-one-call), not Claude's single
//   `{file_path, old_string, new_string}`. Re-checked directly against
//   Pi's own type defs (dist/core/tools/edit.d.ts) rather than assumed.
// - goal-capture/goal-check: checked once against the session transcript,
//   scoped to entries after the last user message — same scope
//   pre-tool-use-goal-capture.sh and stop-goal-check.sh use against the
//   JSONL transcript for Claude Code. This runs on `agent_settled`, not
//   `turn_end`: a "turn" in Pi is one LLM response, and repeats internally
//   while the LLM keeps calling tools (see docs/extensions.md's lifecycle
//   diagram), so a single user prompt can produce many turn_end events
//   before the agent is actually done. Checking on turn_end fired a false
//   "never checked off" warning on every intermediate tool-calling round,
//   not just when the agent was genuinely finished. agent_settled fires
//   once, only when Pi will not continue automatically (no retry/compaction/
//   follow-up left) — the closest match to Claude Code's Stop hook timing.
//
// Enforcement: mirrors Claude Code's Stop hook (exit 2 blocks the turn until
// a GOAL_CHECK: line appears) by forcing a follow-up turn via
// pi.sendUserMessage(..., { deliverAs: "followUp" }) — documented in
// extensions.md as triggering a new turn when not streaming — the first time
// a stated GOAL: goes unchecked at agent_settled. Only forces once per goal
// (see goalCheckForced below) to avoid looping forever if the model never
// complies, matching stop-goal-check.sh's stop_hook_active guard.
import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { findUncheckedGoal, runClaudeHook, toClaudeToolName } from "./lib.js";

interface EditInput {
  path: string;
  edits: Array<{ oldText: string; newText: string }>;
}

interface WriteInput {
  path: string;
  content: string;
}

export default function (pi: ExtensionAPI) {
  let sessionId = randomUUID();
  let digest = "";
  let digestInjected = false;
  let goalCheckForced = false;

  pi.on("session_start", async (event, ctx) => {
    sessionId = crypto.randomUUID();
    digestInjected = false;
    goalCheckForced = false;

    const result = runClaudeHook("session-start.sh", {
      session_id: sessionId,
      cwd: ctx.cwd,
      hook_event_name: "SessionStart",
      source: event.reason,
    });
    digest = result.stdout.trim();
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const parts: string[] = [];
    if (!digestInjected && digest) {
      parts.push(digest);
      digestInjected = true;
    }

    const promptResult = runClaudeHook("user-prompt-submit.sh", {
      session_id: sessionId,
      cwd: ctx.cwd,
      hook_event_name: "UserPromptSubmit",
      prompt: event.prompt,
    });
    if (promptResult.stdout.trim()) {
      parts.push(promptResult.stdout.trim());
    }

    if (parts.length === 0) return;
    return {
      message: {
        customType: "claude-hooks-port",
        content: parts.join("\n\n"),
        display: false,
      },
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "edit") {
      const input = event.input as EditInput;
      const noop = input.edits?.some((e) => e.oldText === e.newText);
      if (noop) {
        return { block: true, reason: "oldText and newText are identical — this edit is a no-op." };
      }
    }

    if (event.toolName === "write") {
      const input = event.input as WriteInput;
      const guard = runClaudeHook("pre-tool-use-edit-guard.sh", {
        session_id: sessionId,
        cwd: ctx.cwd,
        tool_name: "Write",
        tool_input: { file_path: input.path, content: input.content },
      });
      if (guard.exitCode === 2) {
        return { block: true, reason: guard.stderr.trim() };
      }
    }

    const loop = runClaudeHook("pre-tool-use-loop-breaker.sh", {
      session_id: sessionId,
      cwd: ctx.cwd,
      tool_name: toClaudeToolName(event.toolName),
      tool_input: event.input,
    });
    if (loop.exitCode === 2) {
      return { block: true, reason: loop.stderr.trim() };
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    const filePath = (event.input as { path?: string } | undefined)?.path;
    if (!filePath) return;

    const gate = runClaudeHook("post-tool-use-edit.sh", {
      session_id: sessionId,
      cwd: ctx.cwd,
      hook_event_name: "PostToolUse",
      tool_name: toClaudeToolName(event.toolName),
      tool_input: { file_path: filePath },
    });
    if (gate.exitCode !== 2) return;

    return {
      content: [...event.content, { type: "text", text: gate.stderr.trim() }],
      details: event.details,
      isError: true,
    };
  });

  // Native goal-capture + goal-check (see the module-level comment on why
  // this isn't shelled out, why it runs on agent_settled instead of
  // turn_end, and its enforcement gap vs. the Claude version).
  pi.on("agent_settled", async (_event, ctx) => {
    const goal = findUncheckedGoal(ctx.sessionManager.getEntries());
    if (!goal) {
      goalCheckForced = false;
      return;
    }

    const reminder = `You stated this goal earlier: "${goal}". Before finishing, explicitly verify it — state 'GOAL_CHECK: ACHIEVED' or 'GOAL_CHECK: NOT_ACHIEVED — <reason>' and address any gap before stopping.`;

    if (goalCheckForced) {
      // Already forced one follow-up for this goal and it's still unchecked —
      // don't loop forever, just warn like the Claude-side loop guard does.
      ctx.ui?.notify?.(`Goal check still missing after follow-up: ${reminder}`, "warning");
      goalCheckForced = false;
      return;
    }

    goalCheckForced = true;
    pi.sendUserMessage(reminder, { deliverAs: "followUp" });
  });

  pi.on("session_shutdown", async () => {
    runClaudeHook("session-end-cleanup.sh", {});
  });
}
