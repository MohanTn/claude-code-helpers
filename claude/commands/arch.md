# arch: Co-authored shared-understanding document via JSON → HTML injection

Take a concept the user has in mind, describe it back grounded in the real code, and expose every claim, fork, tension, and expected behaviour so the user can **co-author** the shared model with you **before any implementation**. The deliverable is a synced mental model that makes the eventual code 90%+ compliant with what the user actually meant, not a spec. You generate structured JSON; a deterministic script (`arch-inject.js`) injects it into the HTML template — you never rewrite the template.

**Prime directive:** the reader must be able to tell, quickly, where you understood their idea and where you drifted, and must be able to *fix* it in place, not just reject it. Optimise for legible understanding and honest uncertainty. A confident wrong claim is the worst outcome; a claim tagged `assumed / low`, a surfaced fork, or a rejected example that the user corrects is a success.

The rendered document is a two-author surface: the user confirms/corrects/**forks** claims, **adds claims you missed**, resolves **tensions** you found in the code, signs off **acceptance examples**, writes success **in their own words**, and exports it all as a structured review. Your JSON must give them enough real material to do that.

---

## Operating modes

**Mode A — First draft.** No `arch-<slug>.html` exists in the working directory.
1. Research the repo (see below), then produce: `aiOverview`; the `understanding` claim list (Section 5); `tensions` (Section 6); `examples` (Section 4); `openQuestions`; and HTML fragments for sections 1, 2, 3, 7, 9, 10.
2. Assemble JSON, save to `arch-<slug>.json` (temporary).
3. Run `node ~/.agents/skills/arch/arch-inject.js arch-<slug>.json arch-<slug>.html`.
4. Delete the temporary JSON. Status DRAFT, version v1, first revision-log row.

**Mode B — Refinement pass.** `arch-<slug>.html` exists and the user pastes the doc's **“Copy review for the AI”** block. It contains: their SUCCESS STATEMENT, CONFIRMED CLAIMS, FORK CHOICES, CORRECTIONS (each tagged `structured` or `prose`), NEW CLAIMS YOU ADDED, TENSIONS resolutions, ACCEPTANCE EXAMPLES (approved / rejected / unreviewed), OPEN QUESTION ANSWERS, and UNREVIEWED items.
1. Read the existing HTML for current version/status/revision log.
2. Apply the whole review: reconcile your `aiOverview` against their success statement (if they diverge, that gap is the priority); resolve each fork to the chosen reading; apply every correction; turn each NEW claim into a proper `understanding` entry (`source: user`); apply tension resolutions; fix or drop rejected examples; fold answers into the affected surfaces. Re-tag anything the user confirmed as `source: user, confidence: high`.
3. Increment version, add a revision-log row naming what changed, keep status unless the user approves.
4. Re-run the injection script; delete the temporary JSON.

**Derive `<slug>`** from $ARGUMENTS: a few words, lowercased, spaces→hyphens (e.g. "billing retry logic" → `billing-retry-logic`).

---

## Before generating (research, don't guess)

- Read the actual code the concept touches. Every Section 2 claim, every `source: code` claim, and every tension must be grounded in a real file/function — cite it in `evidence`.
- Reuse the repo's real names, paths, and patterns. Never do web research; invent realistic concrete values only for illustration and label them as assumptions.
- If you can't verify something, say so: tag the claim `assumed` / `low`, raise an Open Question, or fork it. Never launder a guess into a confident statement.

---

## ⛔ Honesty & completeness contract (MANDATORY)

1. **Every section is populated** with concrete, concept-specific content. No empty sections, "TBD", or one-liners.
2. **Tag confidence truthfully.** `source` (`user`/`code`/`inferred`/`assumed`) and `confidence` (`high`/`medium`/`low`) must reflect reality. Anything you'd be embarrassed to be wrong about silently belongs at `medium` or below (or as a fork).
3. **No placeholder strings:** `TODO`, `TBD`, `[PLACEHOLDER]`, `FIXME`, `...`, `lorem ipsum`, `XXX`.
4. **Every diagram is valid Mermaid** for its type and renders without error.
5. **No vague filler** ("etc.", "as needed", "various", "could") as body text. Genuine ambiguity becomes an Open Question, a fork, or a low-confidence claim.
6. **Ground it in this concept and this repo**, not generic examples.

---

## Section 5 — the Understanding Checklist (`understanding` array)

One **atomic claim** per entry, phrased so a human can verdict it ✓/≈/✗. Write 6–14 covering the concept, the code today, the change, and scope. Fields:
- `id` (`U1`…), `area` (short: `Concept`/`Code`/`Change`/`Scope`), `statement` (one decisive plain-language assertion; one idea per row).
- `source`, `confidence` (see contract).
- `evidence` *(opt)* — code ref backing a `code` claim.
- `impact` *(opt)* — what breaks if this is wrong. `impactLevel` *(opt: high/medium/low)* — used with confidence for triage. Add both to the claims that matter.
- **`alternatives` *(opt: array of strings)* — makes the row a FORK.** Use it wherever you genuinely had to *choose* a reading of the user's intent: put the reading options here and phrase `statement` as the open question. The template renders radios so the user picks the intended one. Forks are auto-flagged high-stakes.
- **`options` *(opt: array of strings)* — structured-correction choices** for a non-fork claim whose likely error is a specific value (a filename, an enum, a number). If the user marks it ≈/✗ they pick the right value instead of writing prose.

Claims that are uncertain (low/medium confidence or `assumed`) *and* impactful, plus all forks, are flagged **high stakes** and gate approval. Order by importance and risk.

---

## Section 6 — Tensions (`tensions` array)

Places where, reading the code, the user's stated or implied intent **conflicts** with what exists. This is how your code-derived knowledge flows back to the user instead of you silently bending their intent (a top source of non-compliance). Each: `id` (`T1`…), `youWant`, `butCode` (the conflicting reality), `evidence` *(opt)*, `options` (array of resolution paths the user picks from), `recommendation` *(opt)*. Raise one whenever intent is infeasible, costly, or self-contradictory given the code. Empty array is fine only if there genuinely are none.

---

## Section 4 — Acceptance Examples (`examples` array)

Concrete input→outcome pairs that turn understanding into a **testable, binding contract**. This is the single biggest lever on compliance: adjectives drift, examples don't. Write enough to pin every load-bearing and every high-stakes claim. Each: `id` (`E1`…), `kind` (`example` = must happen, or `counter` = must NOT happen), `given`, `when`, `then`, `claims` *(opt: the `U#` ids this example pins)*. The user marks each ✓/✗; the ✓ ones become the acceptance criteria the implementation is graded against, so make `then` an observable outcome, not a feeling. Always include at least one counter-example fencing off a plausible wrong behaviour.

---

## AI Overview (`aiOverview`) and the recall box

`aiOverview` is one condensed restatement of what the user wants and your approach — the single place the whole narrative is told, rendered top-of-page. The template also shows a **recall box the user fills in themselves** ("success in your own words"); you don't write it, but on the next pass reconcile your overview against it and treat divergence as the top priority.

---

## Free-form sections (clean HTML fragments — no `<section>`/`<h2>` wrapper)

- **1 · The Concept, In My Own Words** — restate the idea and *why it matters*; the problem avoided.
- **2 · What the Code Does Today** — current behaviour grounded in real files, with a Mermaid diagram of the current flow. Cite files.
- **3 · The Change — Before → After** — a Before/After table and/or a target-flow Mermaid diagram. Make the delta unmistakable.
- **7 · Scope Boundaries** — explicit In scope / Out of scope lists.
- **9 · Risks & Sharp Edges** — table: Risk · Likelihood · Impact · Mitigation. Cross-reference risky claim/tension ids.
- **10 · Implementation Sketch (Non-Binding)** — a *brief* ordered step list, clearly non-binding. Deliberately last and least detailed.

Sections 4, 5, 6, and 8 are rendered from the `examples`, `understanding`, `tensions`, and `openQuestions` arrays — do not hand-write those.

---

## Open Questions (`openQuestions` array)

Genuine decisions you need from the user. Each: `id` (`OQ1`…), `question`, `whyItMatters`, `proposedDefault`, `status` (`Open`/`Resolved-in-vN`). Rendered interactively; answers ride along in the copied review.

---

## JSON Output Format

Write this to `arch-<slug>.json`:

```json
{
  "title": "Concept name",
  "summary": "One-sentence summary",
  "stack": "Context badges separated by ·",
  "status": "DRAFT | IN REVIEW | APPROVED — READY FOR IMPLEMENTATION",
  "statusClass": "draft | review | approved",
  "version": "v1",
  "lastUpdated": "YYYY-MM-DD",
  "authorModel": "the model producing this pass",
  "aiOverview": "<p>…</p>",
  "revisionLog": [ { "version": "v1", "date": "YYYY-MM-DD", "summary": "…", "drivenBy": "First generation" } ],
  "understanding": [
    { "id": "U1", "area": "Concept", "statement": "…", "source": "user", "confidence": "high", "evidence": "path:line", "impact": "…", "impactLevel": "high" },
    { "id": "U2", "area": "Change", "statement": "How should X behave?", "source": "inferred", "confidence": "low", "alternatives": ["reading A", "reading B"] },
    { "id": "U3", "area": "Code", "statement": "Logic lives in charges.js", "source": "code", "confidence": "medium", "options": ["charges.js", "billing.js"] }
  ],
  "tensions": [
    { "id": "T1", "youWant": "…", "butCode": "…", "evidence": "path:line", "options": ["…", "…"], "recommendation": "…" }
  ],
  "examples": [
    { "id": "E1", "kind": "example", "given": "…", "when": "…", "then": "observable outcome", "claims": ["U1"] },
    { "id": "E2", "kind": "counter", "given": "…", "when": "…", "then": "the thing that must NOT happen" }
  ],
  "openQuestions": [ { "id": "OQ1", "question": "…", "whyItMatters": "…", "proposedDefault": "…", "status": "Open" } ],
  "sections": { "1": "<div class='card'>…</div>", "2": "…", "3": "…", "7": "…", "9": "…", "10": "…" }
}
```

Section HTML must be clean fragments. There are no `sections` keys for 4/5/6/8 (structured) or 0 (revision log comes from `revisionLog`).

---

## After saving

Print to chat:
1. Filename, version, status.
2. What changed (revision-log summary).
3. The forks, tensions, and lowest-confidence claims you most want decided.
4. Open Questions needing an answer.
5. Next step: "Open the file. Write your success statement, verdict the high-stakes claims and forks in Section 5, resolve the tensions, sign off the acceptance examples, add anything I missed, then click **Copy review for the AI** and paste it back — or say 'approved' once the high-stakes items are settled."

---

## 🔍 Self-retrospection (MANDATORY, before saving)

- Every section filled; no placeholder strings.
- `understanding` covers concept/code/change/scope; each claim is atomic and truthfully tagged; `code` claims cite evidence; genuine either/ors are forks, not confident picks.
- Every load-bearing and high-stakes claim is pinned by at least one acceptance example; at least one counter-example exists.
- Tensions raised wherever the code fights the intent.
- Nothing you're actually unsure about is dressed up as `high` confidence.
- `aiOverview` written once; Mermaid valid; names/versions consistent.

Report findings and the forks, tensions, and questions you most want the user to decide.

---

## Implementation

1. `arch-<slug>.html` exists? → Mode B, else Mode A.
2. **Mode A:** research the code, produce `aiOverview` + `understanding` + `tensions` + `examples` + `openQuestions` + section fragments, assemble JSON, run `node ~/.agents/skills/arch/arch-inject.js arch-<slug>.json arch-<slug>.html`, delete JSON.
3. **Mode B:** read existing HTML for metadata, apply the whole pasted review (reconcile overview vs. success statement, resolve forks, apply corrections, absorb new claims, resolve tensions, fix rejected examples, fold in answers), bump version + revision-log row, re-inject, delete JSON.
4. Run retrospection; report per "After saving".
