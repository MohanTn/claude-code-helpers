#!/usr/bin/env bash
# PostToolUse: Grep|Glob — verbose-result trimmer (analogue of the Bash 1.2 trimmer,
# but field-name-agnostic since Grep/Glob tool_response shape isn't documented:
# we pull every string leaf out of tool_response with `jq '.. | strings'` instead
# of assuming a specific key) + one-shot nudge toward the Explore subagent for
# sessions doing a lot of broad searching in the main thread.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

resp=$(printf '%s' "$input" | jq -c '.tool_response // empty' 2>/dev/null)
[ -z "$resp" ] && exit 0

text=$(printf '%s' "$resp" | jq -r '.. | strings' 2>/dev/null)

if [ -n "$text" ]; then
  lines=$(printf '%s\n' "$text" | wc -l)
  if [ "$lines" -gt 200 ]; then
    log_dir="$HOOKS_HOME/state/logs"
    mkdir -p "$log_dir" 2>/dev/null
    log_file="$log_dir/$(date +%s%N).log"
    printf '%s\n' "$text" > "$log_file" 2>/dev/null
    head_part=$(printf '%s\n' "$text" | head -60)
    log "search-trim: trimmed ${lines}-line $tool_name result, saved to $log_file"
    printf 'Result was %s lines; full output saved to %s.\nFirst 60 lines:\n%s\n' "$lines" "$log_file" "$head_part" >&2
    exit 2
  fi
fi

# One-shot nudge: many search calls in one session without delegating to Explore.
streak_file="$state_dir/search_call_count"
nudged_file="$state_dir/search_nudge_sent"
count=$(( $(cat "$streak_file" 2>/dev/null || echo 0) + 1 ))
printf '%s' "$count" > "$streak_file" 2>/dev/null

if [ "$count" -ge 8 ] && [ ! -f "$nudged_file" ]; then
  touch "$nudged_file" 2>/dev/null
  log "search-trim: nudge sent after $count search calls this session"
  echo "This session has made $count Grep/Glob calls in the main thread. For broad, open-ended exploration, consider delegating to the Explore subagent — it keeps raw search results out of this context." >&2
  exit 1
fi

exit 0
