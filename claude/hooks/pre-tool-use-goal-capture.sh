#!/usr/bin/env bash
# PreToolUse: * — 4.1b capture the stated GOAL: line (companion to user-prompt-submit.sh)
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

goal_file="$state_dir/goal.txt"
[ -f "$goal_file" ] && exit 0

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)
if [ -z "$transcript" ] || [ ! -f "$transcript" ]; then
  exit 0
fi

# Scope the scan to assistant text written AFTER the most recent user message —
# an unbounded whole-transcript scan will eventually grab a false match from
# meta-discussion (e.g. an earlier turn's prose that mentions "GOAL:" while
# *describing* this very convention, rather than *stating* a goal).
last_user_line=$(jq -c 'select(.type=="user") | input_line_number' "$transcript" 2>/dev/null | tail -1)
last_user_line="${last_user_line:-0}"

goal=$(jq -r --argjson ln "$last_user_line" \
  'select(.type=="assistant" and input_line_number > $ln) | .message.content[]? | select(.type=="text") | .text' \
  "$transcript" 2>/dev/null \
  | grep -m1 -oE '^GOAL:[[:space:]]*.*' 2>/dev/null \
  | sed -E 's/^GOAL:[[:space:]]*//' 2>/dev/null)

if [ -n "$goal" ]; then
  printf '%s' "$goal" > "$goal_file" 2>/dev/null
  log "goal-capture: captured goal: $goal"
fi

exit 0
