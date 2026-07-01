#!/usr/bin/env bash
# PreCompact — 1.4 snapshot file paths touched via Edit/Write, from the transcript
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)
out="$HOOKS_HOME/state/pre-compact-$(date +%s).json"
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  jq -c 'select(.message.content[]?.input.file_path? != null) | .message.content[].input.file_path' \
    "$transcript" 2>/dev/null | sort -u > "$out" 2>/dev/null
  log "pre-compact: snapshot written to $out"
fi
exit 0
