#!/usr/bin/env bash
# Stop - speak the turn's GOAL line and final summary.
# Prefers the Piper neural voice (natural-sounding); falls back to
# spd-say/espeak-ng if the Piper venv or model is missing.
# Extracts independently from the transcript rather than reusing
# state_dir/goal.txt: stop-goal-check.sh deletes that file and must keep
# running first (safety-critical gate), so this hook can't depend on
# file-deletion ordering between Stop hooks.
input=$(cat)

piper_bin="$HOME/.claude/tools/piper-venv/bin/piper"
piper_model="$HOME/.claude/tools/piper-voices/en_US-lessac-medium.onnx"
have_piper=0
[ -x "$piper_bin" ] && [ -f "$piper_model" ] && have_piper=1
if [ "$have_piper" -eq 0 ] && ! command -v spd-say >/dev/null 2>&1; then
  exit 0
fi

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)
if [ -z "$transcript" ] || [ ! -f "$transcript" ]; then
  exit 0
fi

last_user_line=$(jq -c 'select(.type=="user") | input_line_number' "$transcript" 2>/dev/null | tail -1)
last_user_line="${last_user_line:-0}"

# -c (compact) guarantees one JSON-encoded value per output line even when
# a block's text itself contains newlines, so mapfile can split blocks safely.
mapfile -t blocks < <(jq -c --argjson ln "$last_user_line" \
  'select(.type=="assistant" and input_line_number > $ln) | .message.content[]? | select(.type=="text") | .text' \
  "$transcript" 2>/dev/null)

if [ "${#blocks[@]}" -eq 0 ]; then
  exit 0
fi

first_block=$(jq -r . <<<"${blocks[0]}" 2>/dev/null)
last_block=$(jq -r . <<<"${blocks[-1]}" 2>/dev/null)

goal=$(printf '%s' "$first_block" | grep -m1 -oE '^GOAL:[[:space:]]*.*' | sed -E 's/^GOAL:[[:space:]]*//')

msg=""
[ -n "$goal" ] && msg="Goal: ${goal}."
[ -n "$last_block" ] && msg="${msg} ${last_block}"

msg=$(printf '%s' "$msg" \
  | sed -E 's/GOAL_CHECK:/Goal check:/' \
  | tr '\n' ' ' \
  | sed -E 's/[`*_#]+//g; s/ +/ /g; s/^ +| +$//g')

if [ -z "$msg" ]; then
  exit 0
fi

log "stop-speak: speaking ${#msg} chars (piper=$have_piper)"

if [ "$have_piper" -eq 1 ]; then
  wav="$state_dir/speak_$$.wav"
  (
    printf '%s' "$msg" | "$piper_bin" -m "$piper_model" --length-scale 1.05 -f "$wav" >/dev/null 2>&1
    [ -s "$wav" ] && pw-play "$wav" >/dev/null 2>&1
    rm -f "$wav"
  ) &
else
  spd-say -r -5 "$msg" >/dev/null 2>&1 &
fi
exit 0
