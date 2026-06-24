#!/usr/bin/env bash
# PreToolUse: Bash — 3.3 command-existence + 2.3 failed-cmd memory + 2.1 command dedup
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

# 3.3 — command-existence check (npm run <script>), project-detected via cwd, never CLAUDE_PROJECT_DIR
if [[ "$cmd" =~ ^npm\ run\ ([a-zA-Z0-9:_-]+) ]]; then
  script="${BASH_REMATCH[1]}"
  pkg="${cwd:-.}/package.json"
  if [ -f "$pkg" ]; then
    if ! jq -e --arg s "$script" '.scripts[$s]' "$pkg" >/dev/null 2>&1; then
      log "bash-guard: no npm script '$script' in $pkg"
      echo "No npm script named '$script' exists in $pkg." >&2
      exit 2
    fi
  fi
  # no package.json at cwd — not a Node project here, skip silently
fi

cmd_sig=$(printf '%s' "$cmd" | md5sum | cut -d' ' -f1)

# 2.3 — failed-approach memory
failed_file="$state_dir/failed_${cmd_sig}"
dirty_flag="$state_dir/dirty_since_last_command"
if [ -f "$failed_file" ] && [ ! -f "$dirty_flag" ]; then
  log "bash-guard: blocked repeat of previously-failed command"
  echo "This exact command already failed earlier this session with no file changes since: $(cat "$failed_file" 2>/dev/null | tail -1)" >&2
  exit 2
fi

# 2.1 — command dedup guard
last_cmd_file="$state_dir/last_command"
if [ -f "$last_cmd_file" ] && [ "$(cat "$last_cmd_file" 2>/dev/null)" = "$cmd" ] && [ ! -f "$dirty_flag" ]; then
  log "bash-guard: blocked exact repeat with no changes since"
  echo "This exact command was already run with no file changes since. Re-running will give the same result; see prior output in the transcript." >&2
  exit 2
fi
printf '%s' "$cmd" > "$last_cmd_file" 2>/dev/null
rm -f "$dirty_flag" 2>/dev/null

exit 0
