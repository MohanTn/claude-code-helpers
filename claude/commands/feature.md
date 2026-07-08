Run the feature-team pipeline (see "Feature team: dynamic sub-agent workflow" in `~/.claude/CLAUDE.md`) for: **$ARGUMENTS**

You are the coordinator. The phases run in the sub-agents, not inline in this session; your job is orchestration, relaying substance, and holding the two checkpoints.

1. Restate the goal in one sentence. If $ARGUMENTS is too thin to scope at all, ask now, once, before spawning anything.
2. If the task is genuinely small (single file, obvious change), say so, offer to do it inline instead, and wait; the pipeline earns its overhead only on multi-file work.
3. Spawn **scout** with the goal. Relay the substance of its FINDINGS to the user in two or three sentences, not the whole block.
4. Spawn **planner** with the goal plus the full FINDINGS block (plus the `arch-<slug>.html` document if one is APPROVED for this feature). Present the PLAN: the steps, the test plan, and every open question with its recommended default.
5. **Checkpoint 1:** get explicit approval, ideally via AskUserQuestion (approve as the recommended first option, adjust as the second). Nothing is built before it. Fold any adjustments back through the same planner via SendMessage.
6. Spawn **implementer** with the approved PLAN verbatim. Relay BUILT with the real test output.
7. Spawn **reviewer** and **verifier** in parallel on the result.
8. While REVIEW has findings or VERDICT fails: send the findings to the same implementer via SendMessage (never a fresh spawn), then re-run only the gate that failed. Cap the loop at 3 rounds; if still failing, stop and present the situation honestly, including what remains broken.
9. **Checkpoint 2:** present the outcome in charter style: what works now, the test and verification evidence, known gaps. Commits, version bumps, and publishes wait for the user's go.
