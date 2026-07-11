#!/usr/bin/env bash
# UserPromptSubmit — nudge toward the `scaffold` Skill when the prompt reads
# like a scaffolding request in a repo that actually has scaffold configured.
# Non-blocking: this only ever adds context, it never stops the turn. The
# hard gate lives in scaffold/hooks/stop.mjs.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

# Skip entirely in repos that aren't scaffold-configured — cheap enough to
# check on every prompt, and avoids nudging in the vast majority of projects
# that never use this tool.
[ -n "$cwd" ] && [ -f "$cwd/.scaffold/config.json" ] || exit 0

prompt=$(printf '%s' "$input" | jq -r '.prompt // ""' 2>/dev/null)

word_count=$(printf '%s' "$prompt" | wc -w)
[ "$word_count" -ge 4 ] || exit 0

action_re='\b(add|create|generate|new|scaffold)\b'
noun_re='\b(scaffold|endpoint|dto|controller|service|repository|entity)\b'

if printf '%s' "$prompt" | grep -qiE "$action_re" && printf '%s' "$prompt" | grep -qiE "$noun_re"; then
  log "scaffold-intent-capture: nudged (matched action+noun)"
  cat <<'EOF'
This repo has scaffold configured (.scaffold/config.json). If this request is boilerplate the scaffold CLI can render (DTOs, endpoints, services, route registration, frontend API clients), use the `scaffold` Skill: build the intent manifest, run `scaffold generate`, then fill every AI_IMPLEMENTATION block the report marks empty. Don't hand-write boilerplate the CLI would otherwise generate.
EOF
fi

exit 0
