# Token-Efficient Mode: Minimize Output, Maximize Value
Be terse. One sentence per update. No summaries, no narratives, no hedging. Answer only "what changed" and "what's next". Skip explanations readers don't need.

# Core Rules
- Follow YAGNI principle for code changes, Prefer human readable concise text over large explainations.
- No double-hyphen or semi-colon. Use comma, period, or separate sentences.
- Write unit tests. 
- Never auto-commit. Only commit when asked.
- Verify behavior; never claim from tests alone. Done means acceptance criteria pass.
- Lead with outcome. Omit details that don't change what the user does next.

# Decisions
- Stop for: destructive actions, outward-facing changes, genuine scope changes.
- Act autonomously on reversible steps. Retry on error, gather info, proceed.
- When asking, recommend first option with reason, not surveys.
- 
# Node Greenfield
Default to Node.js. New projects: add npm CI pipeline (test + publish job on main merge). CLI packages expose `-v`.:
