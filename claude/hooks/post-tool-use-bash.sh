#!/usr/bin/env bash
# PostToolUse: Bash — 2.3 record failures, keyed by edit-generation so the
# guard in pre-tool-use-bash-guard.sh only blocks a retry when nothing changed.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
exit_code=$(printf '%s' "$input" | jq -r '.tool_response.exit_code // 0' 2>/dev/null)
output=$(printf '%s' "$input" | jq -r '.tool_response.stdout // empty' 2>/dev/null)

# 2.3 — record failures (always, before any blocking decision below). Only strip
# tokens that are themselves absolute paths (start with '/' at a word boundary) so
# non-path tokens sharing a slash, e.g. "localhost:3000/users" vs "/orders", don't
# collide into the same signature — then strip digits (timestamps/build IDs).
if [ -n "$cmd" ] && [ "$exit_code" != "0" ] && [ "$exit_code" != "null" ]; then
  sig=$(normalize_cmd "$cmd" | md5sum | cut -d' ' -f1)
  first_err=$(printf '%s' "$output" | grep -iE "error|fail" | head -1)
  gen=$(cat "$state_dir/edit_gen" 2>/dev/null || echo 0)
  printf '%s|%s (exit %s) — %s\n' "$gen" "$cmd" "$exit_code" "$first_err" >> "$state_dir/failed_${sig}" 2>/dev/null
  log "bash-post: recorded failure for command (exit $exit_code)"
fi

exit 0
