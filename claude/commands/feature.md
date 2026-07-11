Orchestrate feature-team pipeline for **$ARGUMENTS**: scout → planner (checkpoint) → implementer → reviewer/verifier (checkpoint) → ship.

Restate goal in one sentence; ask once if $ARGUMENTS is too thin. For single-file edits, offer inline instead.

**Scout:** find relevant code, conventions, risks.  
**Planner:** ingest FINDINGS + `arch-<slug>.html` if APPROVED; produce step-by-step PLAN with test plan and open questions.  
**Checkpoint 1:** approval via AskUserQuestion (recommend first option). Fold adjustments back via SendMessage to planner.

**Implementer:** execute approved PLAN verbatim; write unit tests; relay real test output.  
**Reviewer + Verifier (parallel):** review BUILT diff for correctness bugs and reuse; verify behavior end-to-end.  
**Loop (max 3 rounds):** if REVIEW or VERDICT has findings, SendMessage the same implementer (never fresh spawn), re-run failing gate. Cap at 3; stop if still broken and present situation honestly.

**Checkpoint 2:** outcome in charter style: what works, test/verification evidence, known gaps. User green-lights commits/versions/publish.
