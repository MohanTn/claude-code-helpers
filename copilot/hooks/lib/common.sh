#!/usr/bin/env bash
# Sourced by every Copilot CLI hook script. Caller must read stdin into $input
# and `export HOOK_INPUT="$input"` BEFORE sourcing this file (stdin can only be
# read once). Sets: input, tool_name, tool_args, cwd, session_id, HOOKS_HOME,
# HOOKS_STATE_HOME, state_dir. Provides: log(), claude_payload().
#
# Copilot's envelope is camelCase (sessionId, toolName, toolArgs) and toolArgs
# arrives as a JSON-encoded STRING, not an object (observed on 1.0.70).
# claude_payload() translates all of that into the Claude Code hook stdin
# shape so the scripts in ~/.claude/hooks can be reused unchanged.
#
# State deliberately shares ~/.local/state/claude-hooks with the Claude hooks:
# the reused scripts read/write their state there keyed by session_id, and
# Copilot session ids are UUIDs that can never collide with Claude's.
set -uo pipefail   # NOT -e: callers expect non-zero exits from jq/grep as normal control flow

input="${HOOK_INPUT:-}"
tool_name=$(printf '%s' "$input" | jq -r '.toolName // empty' 2>/dev/null)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
session_id=$(printf '%s' "$input" | jq -r '.sessionId // empty' 2>/dev/null)
[ -z "$session_id" ] && session_id="default"

tool_args=$(printf '%s' "$input" | jq -c 'if (.toolArgs|type)=="string" then (.toolArgs|fromjson? // {}) else (.toolArgs // {}) end' 2>/dev/null)
[ -z "$tool_args" ] && tool_args='{}'

HOOKS_HOME="$HOME/.copilot/hooks"
CLAUDE_HOOKS_HOME="$HOME/.claude/hooks"
HOOKS_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}/claude-hooks"
state_dir="$HOOKS_STATE_HOME/${session_id}"
mkdir -p "$state_dir" 2>/dev/null || true

log() { printf '[%(%H:%M:%S)T] %s\n' -1 "$*" >> "${state_dir}/hook.log" 2>/dev/null || true; }

# Copilot file-tool names (doc-confirmed): `create` writes new files;
# `edit`, `str_replace_editor`, `apply_patch` modify existing ones.
claude_tool_name() {
  case "$tool_name" in
    create) echo "Write" ;;
    edit | str_replace_editor | apply_patch) echo "Edit" ;;
    *) echo "$tool_name" ;;
  esac
}

# Prints a Claude Code hook payload for the current Copilot tool call.
# toolArgs field names inside are not pinned down by the docs; tolerate the
# observed (path, old_str, new_str) plus common variants.
claude_payload() {
  jq -n --arg sid "$session_id" --arg cwd "$cwd" \
    --arg tn "$(claude_tool_name)" --argjson ta "$tool_args" '
    {session_id: $sid, cwd: $cwd, tool_name: $tn,
     tool_input: ($ta + ({file_path: ($ta.path // $ta.file_path // $ta.filePath),
                          old_string: ($ta.old_str // $ta.oldString // $ta.old_string),
                          new_string: ($ta.new_str // $ta.newString // $ta.new_string),
                          content:    ($ta.file_text // $ta.fileText // $ta.content)}
                         | with_entries(select(.value != null))))}' 2>/dev/null
}
