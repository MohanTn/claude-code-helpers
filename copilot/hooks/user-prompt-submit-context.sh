#!/usr/bin/env bash
# userPromptSubmitted — context augmentation wrapper (reuses Claude's context-augment.py)
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.copilot/hooks/lib/common.sh"

payload=$(jq -n --arg sid "$session_id" --arg cwd "$cwd" '{session_id: $sid, cwd: $cwd}')
context=$(printf '%s' "$payload" | python3 "$CLAUDE_HOOKS_HOME/context-augment.py" 2>/dev/null)

if [ -n "$context" ]; then
  printf '%s' "$context" | jq -Rs '{additionalContext: .}'
fi
exit 0
