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

cmd_sig=$(normalize_cmd "$cmd" | md5sum | cut -d' ' -f1)
gen=$(cat "$state_dir/edit_gen" 2>/dev/null || echo 0)

# 2.3 — failed-approach memory: block only if no edit happened since THIS command
# last failed (compares the edit-generation recorded at failure time, not a global flag).
failed_file="$state_dir/failed_${cmd_sig}"
if [ -f "$failed_file" ]; then
  last_line=$(tail -1 "$failed_file" 2>/dev/null)
  recorded_gen="${last_line%%|*}"
  if [ "$recorded_gen" = "$gen" ]; then
    log "bash-guard: blocked repeat of previously-failed command"
    echo "This exact command already failed earlier this session with no file changes since: ${last_line#*|}" >&2
    exit 2
  fi
fi

# 2.1 — command dedup guard: block only if the same command ran at the same
# edit-generation (i.e. nothing changed since).
last_cmd_file="$state_dir/last_command"
last_gen_file="$state_dir/last_command_gen"
if [ "$(cat "$last_cmd_file" 2>/dev/null)" = "$cmd" ] && [ "$(cat "$last_gen_file" 2>/dev/null || echo -1)" = "$gen" ]; then
  log "bash-guard: blocked exact repeat with no changes since"
  echo "This exact command was already run with no file changes since. Re-running will give the same result; see prior output in the transcript." >&2
  exit 2
fi
printf '%s' "$cmd" > "$last_cmd_file" 2>/dev/null
printf '%s' "$gen" > "$last_gen_file" 2>/dev/null

exit 0
