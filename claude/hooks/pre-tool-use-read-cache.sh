#!/usr/bin/env bash
# PreToolUse: Read — 1.1 duplicate-read cache + 1.5 unbounded-large-read guard
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

# 1.1 — duplicate-read cache (keyed on path + offset + limit so different sections don't collide)
offset=$(printf '%s' "$input" | jq -r '.tool_input.offset // "0"' 2>/dev/null)
limit=$(printf '%s' "$input" | jq -r '.tool_input.limit // "all"' 2>/dev/null)
cache_key=$(printf '%s|%s|%s' "$file" "$offset" "$limit" | md5sum | cut -d' ' -f1)
cache_file="$state_dir/read_${cache_key}"
current_hash=$(md5sum "$file" 2>/dev/null | cut -d' ' -f1)

if [ -n "$current_hash" ] && [ -f "$cache_file" ] && [ "$(cat "$cache_file" 2>/dev/null)" = "$current_hash" ]; then
  log "read-cache: blocked re-read of $file (unchanged)"
  echo "File '$file' was already read in this session and is unchanged since. Re-use what you already saw instead of reading it again; only re-read if you specifically need to re-verify content after an edit you're unsure about." >&2
  exit 2
fi
[ -n "$current_hash" ] && echo "$current_hash" > "$cache_file" 2>/dev/null

# 1.5 — unbounded-large-read guard: block every time, not one-shot, since this
# runs before the read happens and a PostToolUse hook can only append to output
# that's already in context, never remove it.
size=$(wc -l < "$file" 2>/dev/null || echo 0)
has_range=$(printf '%s' "$input" | jq -r '.tool_input.offset // .tool_input.limit // empty' 2>/dev/null)
if [ "$size" -gt 1500 ] && [ -z "$has_range" ]; then
  log "read-guard: blocked unbounded read of $file ($size lines)"
  echo "File has ${size} lines and no offset/limit was given. Grep for the relevant symbol first, or read a specific range." >&2
  exit 2
fi

exit 0
