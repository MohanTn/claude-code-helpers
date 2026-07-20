#!/usr/bin/env bash
# PreToolUse: Read — block re-reading a file context-augment.py already
# injected at full fidelity this session (ledger: state_dir/context_shown.json).
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file" ] || exit 0

ledger="$state_dir/context_shown.json"
[ -f "$ledger" ] || exit 0

hit=$(jq -r --arg f "$file" 'has($f)' "$ledger" 2>/dev/null)
if [ "$hit" = "true" ]; then
  log "read-guard: blocked re-read of $file (already injected via context-augment)"
  echo "$file was already injected in full via context-augment.py earlier this session — use that content instead of re-reading. If you need something not shown, search with different terms." >&2
  exit 2
fi

exit 0
