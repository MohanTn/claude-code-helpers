#!/usr/bin/env bash
# agentStop — GOAL_CHECK gate, the Copilot port of stop-goal-check.sh. Reads
# Copilot's events.jsonl transcript (user.message / assistant.message events
# with .data.content) instead of Claude's transcript format, and captures the
# goal here directly, so no separate goal-capture pre-tool hook is needed.
#
# Copilot has no stop_hook_active flag; at-most-once-per-goal is enforced via
# a marker file holding the goal text hash. The forced turn's reason-prompt
# becomes the new last user.message, after which no fresh GOAL: line follows,
# so the gate also self-terminates even if the marker is cleared.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.copilot/hooks/lib/common.sh"

allow() { printf '{}'; exit 0; }

transcript=$(printf '%s' "$input" | jq -r '.transcriptPath // empty' 2>/dev/null)
if [ -z "$transcript" ] || [ ! -f "$transcript" ]; then
  allow
fi

# Scope to assistant text after the most recent user message, same pattern as
# the Claude stop gate, so an earlier turn's GOAL/GOAL_CHECK can't leak in.
last_user_line=$(jq -c 'select(.type=="user.message") | input_line_number' "$transcript" 2>/dev/null | tail -1)
last_user_line="${last_user_line:-0}"
turn_text=$(jq -r --argjson ln "$last_user_line" \
  'select(.type=="assistant.message" and input_line_number > $ln) | .data.content // empty' \
  "$transcript" 2>/dev/null)

goal=$(printf '%s' "$turn_text" | grep -m1 -oE '^GOAL:[[:space:]]*.*' 2>/dev/null | sed -E 's/^GOAL:[[:space:]]*//')
[ -z "$goal" ] && allow

marker="$state_dir/stop_forced_goal"
if printf '%s' "$turn_text" | grep -q "GOAL_CHECK:"; then
  rm -f "$marker" 2>/dev/null
  allow
fi

goal_sig=$(printf '%s' "$goal" | md5sum | cut -d' ' -f1)
if [ "$(cat "$marker" 2>/dev/null)" = "$goal_sig" ]; then
  rm -f "$marker" 2>/dev/null
  log "stop-gate: already forced once for this goal, allowing"
  allow
fi

printf '%s' "$goal_sig" > "$marker" 2>/dev/null
log "stop-gate: blocked, no GOAL_CHECK found"
jq -n --arg g "$goal" \
  '{decision: "block",
    reason: ("You stated this goal earlier: \"" + $g + "\". Before finishing, explicitly verify it — state GOAL_CHECK: ACHIEVED or GOAL_CHECK: NOT_ACHIEVED — <reason> and address any gap before stopping.")}'
exit 0
