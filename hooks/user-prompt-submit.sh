#!/usr/bin/env bash
# UserPromptSubmit — 4.1a inject the goal-statement convention + 4.3 YAGNI/lazy-dev principles
cat <<'EOF'
Before doing substantial work this turn, state your working goal as a single line:
GOAL: <one-sentence objective for this turn>

Apply lazy-dev/YAGNI principles to all work this turn, stopping at the first rung that holds:
1. Does this need to exist at all? Speculative need = skip it, say so in one line.
2. Stdlib/native platform feature covers it? Use it over custom code or a new dependency.
3. Already-installed dependency solves it? Use it.
4. Can it be one line, or the minimum code that works? Prefer that over abstractions, boilerplate, or scaffolding "for later".
Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, or anything explicitly requested.

Right before you finish, self-check it explicitly with one of:
GOAL_CHECK: ACHIEVED
GOAL_CHECK: NOT_ACHIEVED — <what's missing>
EOF
exit 0
