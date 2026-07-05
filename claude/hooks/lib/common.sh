#!/usr/bin/env bash
# Sourced by every hook script. Caller must read stdin into $input and
# `export HOOK_INPUT="$input"` BEFORE sourcing this file (stdin can only be
# read once). Sets: input, tool_name, cwd, session_id, HOOKS_HOME, state_dir.
# Provides: log().
set -uo pipefail   # NOT -e: callers expect non-zero exits from git/jq/grep as normal control flow

input="${HOOK_INPUT:-}"
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -z "$session_id" ] && session_id="default"

HOOKS_HOME="$HOME/.claude/hooks"
state_dir="$HOOKS_HOME/state/${session_id}"
mkdir -p "$state_dir" 2>/dev/null || true

log() { printf '[%(%H:%M:%S)T] %s\n' -1 "$*" >> "${state_dir}/hook.log" 2>/dev/null || true; }
