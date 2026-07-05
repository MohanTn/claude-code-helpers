import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { md5 } from "./common";
import { getCachedDigest } from "./session-lifecycle";

/**
 * Port of:
 *   session-start.sh              -> surface the cached project digest once per session
 *   pre-tool-use-goal-capture.sh  -> capture GOAL: line from assistant transcript
 *   user-prompt-submit.sh          -> inject YAGNI/GOAL/self-check instructions
 *   stop-goal-check.sh             -> verify GOAL_CHECK before turn ends
 */

const YAGNI_INSTRUCTIONS = `
## Working Goal & Self-Check

Before doing substantial work this turn, state your working goal as a single line:
GOAL: <one-sentence objective for this turn>

Apply lazy-dev/YAGNI principles to all work this turn, stopping at the first rung that holds:
1. Does this need to exist at all? Speculative need = skip it, say so in one line.
2. Stdlib/native platform feature covers it? Use it over custom code or a new dependency.
3. Already-installed dependency solves it? Use it.
4. Can it be one line, or the minimum code that works? Prefer that over abstractions, boilerplate, or scaffolding "for later".

Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, or anything explicitly requested.

Perform a harsh code review of every file you changed — each line change must have a clear purpose and follow maintainable, enterprise-grade design. Then run it as a feedback loop: implement a fix for every review comment, re-review the changed files, and repeat — feeding each pass's comments back into the next fix — until a review pass surfaces no actionable comments (cap at 3 passes to avoid churn). For each pass, briefly report the comments found and how they were resolved.

Right before you finish, self-check it explicitly with one of:
GOAL_CHECK: ACHIEVED
GOAL_CHECK: NOT_ACHIEVED — <what's missing>
`;

/** Extract the first `GOAL: <text>` line from assistant text, if present. */
export function extractGoal(text: string): string | null {
  const match = text.match(/^GOAL:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

// In-memory per-session state
const goals = new Map<string, string>();
const goalFiles = new Map<string, string>(); // sessionId -> captured goal text
const digestInjected = new Set<string>(); // sessionIds that already received the project digest

export function setupGoalYagni(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    const sessionId = getSessionId(ctx);
    goals.set(sessionId, "");
    goalFiles.set(sessionId, "");
    digestInjected.delete(sessionId);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const sessionId = getSessionId(ctx);
    goals.delete(sessionId);
    goalFiles.delete(sessionId);
    digestInjected.delete(sessionId);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const sessionId = getSessionId(ctx);
    const prompt = event.prompt || "";
    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    const currentGoal = goals.get(sessionId) || "";

    let additionalPrompt = "";

    // Port of session-start.sh: surface the cached project digest once per session,
    // independent of prompt length (unlike the YAGNI block below).
    if (!digestInjected.has(sessionId)) {
      const digest = getCachedDigest(ctx.cwd);
      if (digest) {
        additionalPrompt += `\n${digest}\n`;
      }
      digestInjected.add(sessionId);
    }

    // Check for file references that need special tools (port of docx/pdf check)
    const fileRefMatch = prompt.match(/@\S+\.(pdf|docx|xlsx|xls)\b/i);
    if (fileRefMatch) {
      additionalPrompt += `\nIMPORTANT: For any .pdf, .docx, .xlsx, or .xls files referenced in this prompt, use the mcp__files-mcp__convert_file tool to read them — do NOT use the Read tool for these file types.\n`;
    }

    // Skip YAGNI injection for trivial prompts (less than 6 words)
    if (wordCount < 6) {
      return additionalPrompt
        ? { systemPrompt: event.systemPrompt ? event.systemPrompt + additionalPrompt : additionalPrompt }
        : undefined;
    }

    // If goal was captured from a previous turn, remind the LLM
    if (currentGoal) {
      additionalPrompt += `\nYour stated goal for this session: "${currentGoal}"\n`;
    }

    additionalPrompt += YAGNI_INSTRUCTIONS;

    return {
      systemPrompt: event.systemPrompt
        ? event.systemPrompt + additionalPrompt
        : additionalPrompt,
    };
  });

  pi.on("turn_end", async (event, ctx) => {
    const sessionId = getSessionId(ctx);

    // Capture GOAL: from the assistant message
    const msg = event.message as { role: string; content?: { type: string; text: string }[] } | null;
    const blocks = msg?.content ?? [];

    for (const block of blocks) {
      if (block.type === "text") {
        const goal = extractGoal(block.text);
        if (goal) {
          goals.set(sessionId, goal);
        }
      }
    }

    // Check for GOAL_CHECK in the assistant message
    // Port of stop-goal-check.sh logic
    const hasGoalCheck = blocks.some(
      (c) => c.type === "text" && c.text?.includes("GOAL_CHECK:")
    );

    if (!hasGoalCheck) {
      const currentGoal = goals.get(sessionId);
      if (currentGoal) {
        // Send a follow-up message nudging the model to add GOAL_CHECK
        pi.sendMessage({
          customType: "pi-hooks-goal-check",
          content: `You stated this goal earlier: "${currentGoal}". Before finishing, explicitly verify it — state 'GOAL_CHECK: ACHIEVED' or 'GOAL_CHECK: NOT_ACHIEVED — <reason>' and address any gap before stopping.`,
          display: true,
        }, { deliverAs: "followUp" });
      }
    } else {
      // Goal check found, clear the stored goal
      goals.set(sessionId, "");
    }
  });

  // Capture GOAL from tool_call (port of pre-tool-use-goal-capture.sh)
  // The goal is now captured in turn_end above from the assistant message directly,
  // which is more reliable than scanning the transcript.
}

function getSessionId(ctx: ExtensionContext): string {
  const file = ctx.sessionManager.getSessionFile();
  return file ? md5(file) : md5(ctx.cwd + "yagni");
}
