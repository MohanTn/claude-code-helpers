#!/usr/bin/env bash
# Stop — 4.2 pre-stop goal-achievement gate. Safety-critical: the
# stop_hook_active early-exit MUST be the first real check, before any
# transcript parsing, so a broken transcript_path can never suppress the
# at-most-once-per-turn guarantee.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

goal_file="$state_dir/goal.txt"
[ ! -f "$goal_file" ] && exit 0

already_forced=$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$already_forced" = "true" ] && exit 0

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)
goal=$(cat "$goal_file" 2>/dev/null)
last_msg=""
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  last_msg=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' "$transcript" 2>/dev/null | tail -1)
fi

if ! printf '%s' "$last_msg" | grep -q "GOAL_CHECK:"; then
  log "stop-gate: blocked, no GOAL_CHECK found"
  echo "You stated this goal earlier: \"$goal\". Before finishing, explicitly verify it — state 'GOAL_CHECK: ACHIEVED' or 'GOAL_CHECK: NOT_ACHIEVED — <reason>' and address any gap before stopping." >&2
  exit 2
fi

rm -f "$goal_file" 2>/dev/null
exit 0
