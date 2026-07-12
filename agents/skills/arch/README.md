# arch: shared template + injection script

The common layer behind Claude Code's `/arch` command (`claude/commands/arch.md`) and Copilot CLI's `arch` skill (`copilot/skills/arch/SKILL.md`): one HTML template and one Node.js injection script, no tool-specific content, deployed once to `~/.agents/skills/arch/` (see `nix/agents.nix`) and referenced by both tools at that fixed path. Neither `claude/` nor `copilot/` keeps its own copy.

## What the document is for

`/arch` produces a **co-authored shared-understanding document**, not a solution spec. The AI takes a concept the user has in mind, describes it back grounded in the real code, and lays out every claim, fork, tension, and expected behaviour so the human can confirm, correct, and *contribute* — with the goal that the eventual implementation is 90%+ aligned with what the user actually meant. The rendered file is a two-author surface, not a read-only report:

- **Understanding checklist (Section 5)** — one row per claim, tagged by **source** (you said / in code / inferred / assumed) and **confidence**. Each gets ✓ / ≈ / ✗ verdicts. A claim can be a **fork** (radio options when the AI had to guess a reading) or carry **structured-correction options** (pick the right value instead of writing prose). Claims that are uncertain *and* impactful, plus all forks, are flagged **high stakes** and gate approval. An **“add a claim I missed”** button lets the human author rows the AI never generated — the fix for omission blindness.
- **Acceptance examples (Section 4)** — Given/When/Then examples (and counter-examples for what must NOT happen) the human signs off ✓/✗. The approved ones are the binding behavioural contract, turning prose understanding into something testable.
- **Tensions (Section 6)** — conflicts the AI found between the user's intent and what the code allows, each with resolution options the human picks. Surfaces the AI's code-derived knowledge instead of letting it silently bend intent.
- **Recall box** — the human writes success "in their own words"; the next pass reconciles it against the AI's overview to catch framing drift.
- **Sync widget** — tallies agreed / to-fix / pending across claims, tensions, and examples, warns while high-stakes items are undecided, and exports a **“Copy review for the AI”** manifest (success statement, confirmed claims, fork choices, structured/prose corrections, new claims, tension resolutions, approved/rejected examples, answers) that the human pastes straight back for the next pass. On approval it names the confirmed claims + approved examples as the acceptance criteria to carry into `/feature`. All state persists per browser via `localStorage` keyed by title + version.

## Two-stage workflow

1. **Content (the AI).** Generates the concept-specific content as **structured JSON** — metadata, `aiOverview`, `understanding`, `tensions`, `examples`, `openQuestions`, and HTML fragments for the free-form sections. Cheap in tokens: no template boilerplate is regenerated.
2. **Injection (the script).** `arch-inject.js` merges that JSON into `arch-template.html` deterministically. The AI never reads or rewrites the template.

## Usage

```bash
# First draft
/arch billing retry logic

# Refinement: write your success statement, verdict the high-stakes claims and forks,
# resolve tensions, sign off examples, add anything missed, then click
# "Copy review for the AI" and paste the block back. The AI applies it all and re-injects.
```

Manual injection (either tool, same path):

```bash
node ~/.agents/skills/arch/arch-inject.js arch-feature.json arch-feature.html
# The third (template-path) argument is optional; it defaults to
# arch-template.html next to the script, so this also works from a checkout:
node agents/skills/arch/arch-inject.js arch-feature.json arch-feature.html
```

## JSON structure (abridged)

```json
{
  "title": "Billing retry logic",
  "summary": "Retry failed card charges with backoff before dunning",
  "stack": "Node.js · Postgres · Stripe",
  "status": "DRAFT", "statusClass": "draft", "version": "v1",
  "lastUpdated": "2026-07-12", "authorModel": "Claude Opus 4.8",
  "aiOverview": "<p>The single condensed restatement of what the user wants.</p>",
  "revisionLog": [ { "version": "v1", "date": "2026-07-12", "summary": "Initial", "drivenBy": "First generation" } ],
  "understanding": [
    { "id": "U1", "area": "Concept", "statement": "Retries stop once the invoice is paid by any means.", "source": "user", "confidence": "high", "impactLevel": "high", "impact": "Double-charge risk if wrong." },
    { "id": "U2", "area": "Change", "statement": "How many retries before dunning?", "source": "inferred", "confidence": "low", "alternatives": ["3 over 5 days", "5 over 10 days"] },
    { "id": "U3", "area": "Code", "statement": "Charges created in charges.js", "source": "code", "confidence": "medium", "evidence": "src/billing/charges.js:42", "options": ["charges.js", "billing.js"] }
  ],
  "tensions": [
    { "id": "T1", "youWant": "Instant refunds", "butCode": "Gateway settles nightly", "options": ["Accept next-day", "Add a ledger"], "recommendation": "Accept next-day" }
  ],
  "examples": [
    { "id": "E1", "kind": "example", "given": "invoice paid by transfer", "when": "a retry is scheduled", "then": "the retry is cancelled", "claims": ["U1"] },
    { "id": "E2", "kind": "counter", "given": "a paid invoice", "when": "the nightly job runs", "then": "the card is charged again" }
  ],
  "openQuestions": [ { "id": "OQ1", "question": "Max attempts?", "whyItMatters": "Bounds cost", "proposedDefault": "3 over 5 days", "status": "Open" } ],
  "sections": { "1": "…", "2": "…", "3": "…", "7": "…", "9": "…", "10": "…" }
}
```

Sections are clean HTML fragments (no `<section>`/`<h2>`/outer `<html>`). There are no `sections` keys for 4/5/6/8 (built from `examples`/`understanding`/`tensions`/`openQuestions`) or 0 (from `revisionLog`).

## Files

- **arch-template.html** — the template with `{{PLACEHOLDER}}` markers and the co-authoring engine: sticky TOC with scrollspy, lifecycle status banner, top AI-Overview card + recall box, acceptance-example cards with sign-off, the understanding checklist (verdicts, forks, structured corrections, add-a-claim, high-stakes triage), tension cards with resolution, an interactive Open Questions table, the floating sync widget + review-manifest export, and Mermaid rendering with a maximize/minimize toggle.
- **arch-inject.js** — reads JSON and injects it. Escapes metadata; builds the revision-log, understanding (with fork/options/priority logic — `isHighPriority` flags forks and uncertain-but-impactful claims, badge mapping falls back to the cautious `assumed`/`low`), tension, example, and open-question markup; injects section + overview HTML raw. Template path is optional.
- **arch-inject.test.js** — unit tests for the injection script and template contract. Run with `node --test agents/skills/arch/arch-inject.test.js`. Covers escaping, priority logic, all five builders (forks, structured corrections, tensions, examples, badges/fallbacks), placeholder completeness, tolerance of missing arrays, and raw-vs-escaped injection.

The instruction files that drive generation stay in each tool's directory (`claude/commands/arch.md`, `copilot/skills/arch/SKILL.md`): they're prose, not shared boilerplate, and differ in voice and path references. Both point at this folder's script and template by the same fixed `~/.agents/skills/arch/` path.

## Extending

To add a field or section: add the `{{PLACEHOLDER}}` (or a new builder) to `arch-template.html` / `arch-inject.js` with a test, then document the new JSON key in **both** `claude/commands/arch.md` and `copilot/skills/arch/SKILL.md` (they aren't shared). The AI's next generation picks up the new format.

## Known follow-up

The review manifest already names the confirmed claims + approved examples as acceptance criteria "to carry into `/feature`", but the `/feature` planner/verifier charters don't yet *consume* that manifest to grade the implementation per-anchor. Closing that last mile (making each approved example a verification the build must pass) is a separate change to `claude/agents/verifier.md`, its Copilot/Pi ports, and `feature.md`.
