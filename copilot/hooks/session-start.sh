#!/usr/bin/env bash
# sessionStart — project digest (reuses the Claude hook) + the GOAL/GOAL_CHECK
# standing instruction. On Claude Code that instruction is injected per turn
# via UserPromptSubmit; Copilot fires userPromptSubmitted but ignores its
# output, so the once-per-session injection here is the available equivalent
# (agent-stop.sh enforces it).
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.copilot/hooks/lib/common.sh"

payload=$(jq -n --arg sid "$session_id" --arg cwd "$cwd" \
  '{session_id:$sid, cwd:$cwd, hook_event_name:"SessionStart", source:"startup"}')
digest=$(printf '%s' "$payload" | bash "$CLAUDE_HOOKS_HOME/session-start.sh" 2>/dev/null)

printf '%s\n\n%s' "$digest" \
'Standing instruction for every substantial request in this session: begin your reply with "GOAL: <one-sentence objective>" and, before finishing that turn, state "GOAL_CHECK: ACHIEVED" or "GOAL_CHECK: NOT_ACHIEVED — <gap>".' \
  | jq -Rs '{additionalContext: .}'
exit 0
