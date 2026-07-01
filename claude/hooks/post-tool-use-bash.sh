#!/usr/bin/env bash
# PostToolUse: Bash — 2.3 record failures + 1.2 verbose-output trimmer
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
exit_code=$(printf '%s' "$input" | jq -r '.tool_response.exit_code // 0' 2>/dev/null)
output=$(printf '%s' "$input" | jq -r '.tool_response.stdout // empty' 2>/dev/null)

# 2.3 — record failures (always, before any blocking decision below)
if [ -n "$cmd" ] && [ "$exit_code" != "0" ] && [ "$exit_code" != "null" ]; then
  # Normalize: strip absolute paths and numeric tokens so repeated semantically-identical
  # commands (differing only in timestamps, temp paths, or build IDs) hash to the same key.
  normalized=$(printf '%s' "$cmd" \
    | sed 's|/[^ ]*||g' \
    | sed 's/[0-9]\+//g' \
    | tr -s ' ')
  sig=$(printf '%s' "$normalized" | md5sum | cut -d' ' -f1)
  first_err=$(printf '%s' "$output" | grep -iE "error|fail" | head -1)
  printf '%s (exit %s) — %s\n' "$cmd" "$exit_code" "$first_err" >> "$state_dir/failed_${sig}" 2>/dev/null
  log "bash-post: recorded failure for command (exit $exit_code)"
fi

# 1.2 — verbose output trimmer (skip meta-inspection of hook/settings files)
if [[ "$cmd" == *".claude/hooks"* ]] || [[ "$cmd" == *".claude/settings"* ]]; then
  exit 0
fi
lines=$(printf '%s\n' "$output" | wc -l)
if [ "$lines" -gt 200 ]; then
  log_dir="$HOOKS_HOME/state/logs"
  mkdir -p "$log_dir" 2>/dev/null
  log_file="$log_dir/$(date +%s%N).log"
  printf '%s\n' "$output" > "$log_file" 2>/dev/null
  summary=$(printf '%s\n' "$output" | grep -iE "error|fail|warn" | head -40)
  log "bash-post: trimmed ${lines}-line output, saved to $log_file"
  printf 'Output was %s lines; full log saved to %s.\nFiltered errors/warnings below:\n%s\n' "$lines" "$log_file" "$summary" >&2
  exit 2
fi

exit 0
