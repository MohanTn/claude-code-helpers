#!/usr/bin/env bash
# userPromptSubmitted — notification-only on Copilot (output is ignored), so
# this only clears per-turn state: loop-breaker counters and the agent-stop
# forced marker, same reset the Claude UserPromptSubmit hook performs.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.copilot/hooks/lib/common.sh"

rm -f "$state_dir/loop_last_sig" "$state_dir/loop_count" "$state_dir/stop_forced_goal" 2>/dev/null
exit 0
