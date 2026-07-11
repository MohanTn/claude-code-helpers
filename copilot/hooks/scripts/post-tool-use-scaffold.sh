#!/usr/bin/env bash
# postToolUse: bash — scaffold soft nudge, ported from post-tool-use.mjs in
# the scaffold-toolkit adapter-claude-code package. Fires only after a real
# `scaffold generate` invocation (bare binary or `npx @mohantn/scaffold-core
# generate`, which puts the package name's "-core" suffix directly before
# "generate"); every other bash command is a silent no-op. When it does act,
# it runs `scaffold status --json` in the same cwd and, if anything is still
# pending, surfaces that as additionalContext. This is a nudge, not a block:
# postToolUse fires after the tool already ran, so there is nothing left to
# prevent. The hard, un-skippable enforcement is the agentStop gate
# (agent-stop-scaffold-check.sh).
input=$(cat)
export HOOK_INPUT="$input"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

[ "$tool_name" = "bash" ] || exit 0
command_str=$(tool_arg '.command')
printf '%s' "$command_str" | grep -qE '\bscaffold(-core)?[[:space:]]+generate\b' || exit 0

# Fail open when `scaffold` isn't on PATH, so a machine without it installed
# never surfaces a false nudge.
command -v scaffold >/dev/null 2>&1 || exit 0

status_stdout=$(cd "$cwd" 2>/dev/null && scaffold status --json 2>/dev/null)
status_exit=$?
[ "$status_exit" -eq 0 ] && exit 0

summary=$(printf '%s' "$status_stdout" | jq -r 'if (.unresolved // []) == [] then empty else [.unresolved[] | "\(.file):\(.startLine)-\(.endLine)"] | join(", ") end' 2>/dev/null)
if [ -z "$summary" ]; then
  trimmed=$(printf '%s' "$status_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  [ -n "$trimmed" ] && summary="$trimmed"
fi

if [ -n "$summary" ]; then
  detail=": $summary"
else
  detail=" (see scaffold status --json for detail)."
fi

log "post-tool-use-scaffold: unresolved AI_IMPLEMENTATION block(s) after generate$detail"
reason="scaffold status reports unfilled AI_IMPLEMENTATION block(s) after this generate run${detail} Fill each one with your edit tool, using each block's current-content from the generate report so an already-completed block is never re-filled."
jq -n --arg ctx "$reason" '{additionalContext: $ctx}'
