#!/usr/bin/env bash
# PreToolUse: Edit|Write — 2.2 no-op guard + 5.1/5.2 architecture hints
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# 2.2 — edit no-op guard
old=$(printf '%s' "$input" | jq -r '.tool_input.old_string // empty' 2>/dev/null)
new=$(printf '%s' "$input" | jq -r '.tool_input.new_string // empty' 2>/dev/null)
if [ -n "$old" ] && [ "$old" = "$new" ]; then
  log "edit-guard: blocked no-op edit on $file"
  echo "old_string and new_string are identical — this edit is a no-op." >&2
  exit 2
fi

if [ "$tool_name" = "Write" ]; then
  content=$(printf '%s' "$input" | jq -r '.tool_input.content // empty' 2>/dev/null)
  if [ -n "$content" ] && [ -f "$file" ]; then
    existing=$(cat "$file" 2>/dev/null)
    if [ "$content" = "$existing" ]; then
      log "edit-guard: blocked no-op write on $file"
      echo "Write content is identical to the file's current content — this write is a no-op." >&2
      exit 2
    fi
  fi
fi

# 5.1/5.2 — architecture/pattern hints, one-shot per file per session
[ -z "$file" ] && exit 0
[[ "$file" == *"node_modules"* ]] && exit 0
case "$file" in
  *.cs|*.ts|*.tsx) ;;
  *) exit 0 ;;
esac

hint_key=$(printf '%s' "$file" | md5sum | cut -d' ' -f1)
hinted_file="$state_dir/hinted_${hint_key}"
[ -f "$hinted_file" ] && exit 0

hint=$(node "$HOOKS_HOME/lib/match-glob.js" "$HOOKS_HOME/config/architecture-hints.json" "$file" 2>/dev/null)
if [ -n "$hint" ]; then
  touch "$hinted_file" 2>/dev/null
  log "edit-guard: architecture hint for $file"
  echo "Architecture/design-pattern reminder for $(basename "$file"): $hint" >&2
  exit 1
fi

exit 0
