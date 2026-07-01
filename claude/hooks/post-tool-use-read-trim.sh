#!/usr/bin/env bash
# PostToolUse: Read — backstop truncation. pre-tool-use-read-cache.sh's 1.5 nudge
# only fires once per file per session; if it's ignored on a retry, this catches
# the large read after the fact instead of letting the full content into context.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

resp=$(printf '%s' "$input" | jq -c '.tool_response // empty' 2>/dev/null)
[ -z "$resp" ] && exit 0

text=$(printf '%s' "$resp" | jq -r '.. | strings' 2>/dev/null)
[ -z "$text" ] && exit 0

lines=$(printf '%s\n' "$text" | wc -l)
if [ "$lines" -gt 1500 ]; then
  log_dir="$HOOKS_HOME/state/logs"
  mkdir -p "$log_dir" 2>/dev/null
  log_file="$log_dir/$(date +%s%N).log"
  printf '%s\n' "$text" > "$log_file" 2>/dev/null
  head_part=$(printf '%s\n' "$text" | head -80)
  tail_part=$(printf '%s\n' "$text" | tail -40)
  log "read-trim: backstop-truncated ${lines}-line read, saved to $log_file"
  printf 'This read returned %s lines and was not bounded by offset/limit. Full content saved to %s.\nFirst 80 lines:\n%s\n...\nLast 40 lines:\n%s\n' "$lines" "$log_file" "$head_part" "$tail_part" >&2
  exit 2
fi

exit 0
