#!/usr/bin/env bash
# agentStop — scaffold determinism gate, ported from stop.mjs in the
# scaffold-toolkit adapter-claude-code package (the Claude Code side wires
# that file directly via node in claude/settings.json's Stop hooks). Runs
# `scaffold status --json` in the session's cwd; a nonzero exit means an
# AI_IMPLEMENTATION block is still unfilled, so the turn is blocked rather
# than softly warned, same rationale as the original: a soft nudge just
# reintroduces the non-determinism scaffold exists to remove. No at-most-once
# marker (unlike agent-stop-goal-check.sh): the upstream hook blocks every
# time status is unresolved, trusting the model to eventually fill the
# blocks, and this port follows that design rather than softening it.
input=$(cat)
export HOOK_INPUT="$input"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

# Fail open when `scaffold` isn't on PATH, so a machine without it installed
# never blocks every agentStop in every repo.
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

log "agent-stop-scaffold-check: blocked, unresolved AI_IMPLEMENTATION block(s)$detail"
reason="scaffold status still reports unfilled AI_IMPLEMENTATION block(s)${detail} Fill each one with your edit tool (use the current-content field from the generate report so an already-completed block is never re-filled), then try to stop again."
jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
