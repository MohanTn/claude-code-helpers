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

# Grep the full assistant text stream — not tail -1, which only checked the final line
# and missed GOAL_CHECK: when a closing sentence followed it.
found_check=0
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' \
    "$transcript" 2>/dev/null | grep -q "GOAL_CHECK:" && found_check=1
fi

if [ "$found_check" = "0" ]; then
  log "stop-gate: blocked, no GOAL_CHECK found"
  echo "You stated this goal earlier: \"$goal\". Before finishing, explicitly verify it — state 'GOAL_CHECK: ACHIEVED' or 'GOAL_CHECK: NOT_ACHIEVED — <reason>' and address any gap before stopping." >&2
  exit 2
fi

rm -f "$goal_file" 2>/dev/null
exit 0
