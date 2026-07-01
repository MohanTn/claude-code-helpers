#!/usr/bin/env bash
# UserPromptSubmit — inject goal-statement + YAGNI principles; skip trivial prompts
input=$(cat)
session_id=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
session_id=${session_id:-default}
state_dir="$HOME/.claude/hooks/state/${session_id}"
mkdir -p "$state_dir"
rm -f "$state_dir/goal.txt" "$state_dir/loop_last_sig" "$state_dir/loop_count" 2>/dev/null

prompt=$(printf '%s' "$input" | jq -r '.prompt // ""' 2>/dev/null)

# Inject MCP tool instruction when supported document files are referenced
if printf '%s' "$prompt" | grep -qiE '@[^ ]+\.(pdf|docx|xlsx|xls)'; then
  echo "IMPORTANT: For any .pdf, .docx, .xlsx, or .xls files referenced in this prompt, use the mcp__files-mcp__convert_file tool to read them — do NOT use the Read tool for these file types."
fi

# Skip GOAL/YAGNI injection for short/conversational prompts (continuations, acks, simple questions)
word_count=$(printf '%s' "$prompt" | wc -w)
if [ "$word_count" -lt 6 ]; then
  exit 0
fi

cat <<'EOF'
Before doing substantial work this turn, state your working goal as a single line:
GOAL: <one-sentence objective for this turn>

Apply lazy-dev/YAGNI principles to all work this turn, stopping at the first rung that holds:
1. Does this need to exist at all? Speculative need = skip it, say so in one line.
2. Stdlib/native platform feature covers it? Use it over custom code or a new dependency.
3. Already-installed dependency solves it? Use it.
4. Can it be one line, or the minimum code that works? Prefer that over abstractions, boilerplate, or scaffolding "for later".
Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, or anything explicitly requested.

Perform a harsh code review of every file you changed — each line change must have a clear purpose and follow maintainable, enterprise-grade design. Then run it as a feedback loop: implement a fix for every review comment, re-review the changed files, and repeat — feeding each pass's comments back into the next fix — until a review pass surfaces no actionable comments (cap at 3 passes to avoid churn). For each pass, briefly report the comments found and how they were resolved.

Execute build and run tests, if any, and report the results. If there are no tests, say so in one line.

Right before you finish, self-check it explicitly with one of:
GOAL_CHECK: ACHIEVED
GOAL_CHECK: NOT_ACHIEVED — <what's missing>
EOF
exit 0
