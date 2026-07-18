#!/usr/bin/env bash
# PreToolUse: Edit|Write — deterministic enforcement of the boilerplate mandate
# (agents/boilerplats/AGENT-HINT.md) on boilerplate-shaped files
# (controller/repository/handler/validator/factory/mapper).
#   Write: a new (or empty) file must carry the generator's scaffold:inject
#     marker, and overwriting a marked file must keep the marker.
#   Edit: removing the scaffold:inject marker is blocked, so the file stays
#     injectable (scaffold.js --inject inserts above the marker).
# scaffold.js itself writes through Bash, so it is never caught here; filling
# in logic with ordinary Edits passes through untouched.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file" ] || exit 0
printf '%s' "$file" | grep -qiE '(controller|repository|handler|validator|factory|mapper)\.(cs|ts|js|py)$' || exit 0

marker='scaffold:inject'

deny() {
  log "boilerplate-guard: $1 ($file)"
  printf '%s\n' "$2" >&2
  exit 2
}

if [ "$tool_name" = "Edit" ]; then
  old=$(printf '%s' "$input" | jq -r '.tool_input.old_string // empty' 2>/dev/null)
  new=$(printf '%s' "$input" | jq -r '.tool_input.new_string // empty' 2>/dev/null)
  if printf '%s' "$old" | grep -q "$marker" && ! printf '%s' "$new" | grep -q "$marker"; then
    deny "blocked marker removal" \
      "Blocked: this edit removes the $marker marker. Keep the marker in place — scaffold.js --inject inserts new members above it. Re-apply the edit with the marker retained."
  fi
  exit 0
fi

[ "$tool_name" = "Write" ] || exit 0
content=$(printf '%s' "$input" | jq -r '.tool_input.content // empty' 2>/dev/null)

if [ -f "$file" ] && [ -s "$file" ]; then
  # Overwrite of an existing file: only rule is that a marker, once there, stays.
  if grep -q "$marker" "$file" && ! printf '%s' "$content" | grep -q "$marker"; then
    deny "blocked marker-dropping overwrite" \
      "Blocked: this overwrite drops the $marker marker the file currently has. Keep the marker so scaffold.js --inject keeps working."
  fi
  exit 0
fi

# New or empty file: the shell must come from the generator.
printf '%s' "$content" | grep -q "$marker" && exit 0
deny "blocked hand-written file" \
"Blocked: boilerplate files must be created with the generator, not hand-written.
Create the shell first:
  node ~/.agents/boilerplats/scaffold.js --lang <csharp|typescript|javascript|python> --template <controller|repository|handler|validator|factory|mapper> --out <path> --data '<json>'
then fill in the logic with Edit above the scaffold:inject marker. To add a member to an existing scaffold-marked file, use --inject --template member.
See ~/.agents/boilerplats/AGENT-HINT.md for template data fields."
