---
name: scaffold-pack-author
description: Author an in-tree scaffold-toolkit template pack for the repo you are in — any language, any architecture. Asks whether the repo intends to migrate toward a different target architecture (author a second, additive pack if so) and splits out external/infra packages (cloud SDKs, message brokers, secret managers) into their own packs. Study the repo's recurring pattern, turn one real instance into a versioned pack (Handlebars templates + descriptor + AI_IMPLEMENTATION markers + registry injections + test_data + a real build-check), wire the markers into the existing brownfield files, and point `.scaffold/config.json` at it so the pack lives in the repo's own git tree and the team maintains its coding standards there. Use when the user says "author/create a scaffold pack", "make a pack for this repo", "cut a new pack version", or "wire scaffold into this codebase". This is the producer side; the `scaffold` skill is the consumer side that runs `generate`.
---

# scaffold-pack-author — author an in-tree template pack for this repo

You are the **producer** side of `scaffold-toolkit`. The `scaffold` skill *consumes* a pack (runs `generate`). This skill *creates* the pack the team will consume, living **inside the target repo's git tree** so coding standards are versioned and maintained in the same codebase.

The CLI (`@mohantn/scaffold-core`, binary `scaffold`) is LLM-agnostic and deterministic: it renders Handlebars templates and injects marker-delimited boilerplate. It never calls a model. Your job is the probabilistic half the CLI cannot do:

1. **Read this repo** and find the one recurring unit that follows a pattern (a controller+service+DTO+DI registration, a NestJS/feature module, a React feature + route + barrel export, a Go handler + wire.go entry, …).
2. **Factor that unit** into: fixed boilerplate → `.hbs` templates; variable parts → `inputs`/`{{placeholders}}`; wiring/registration points → **injection markers**; logic-only bodies → **`AI_IMPLEMENTATION` markers**.
3. **Author the pack** (descriptor + templates + `test_data` + a real build-check), **validate** it, **adopt** it into the brownfield repo (init + bootstrap markers), and hand off to the `scaffold` consumer skill.

Everything you author is committed to the repo. A future `scaffold generate` run must produce byte-identical output from the same manifest — determinism is the whole point, so no nondeterministic template logic (timestamps, random ids, unordered maps).

---

## CLI availability

Prefer a repo-local or global `scaffold`; otherwise `npx -y @mohantn/scaffold-core <cmd>`. Confirm before starting:

```bash
scaffold --version || npx -y @mohantn/scaffold-core --version
```

Everywhere below, `scaffold` means "the resolved binary or the `npx` form".

---

## Phase 0 — Study the repo (do not guess)

### 0.1 Clarify scope: existing convention only, or a migration pair?

Ask the user directly, before studying any code — do not infer this from the codebase:

> Is the intention to migrate this repo toward a different target architecture over time (e.g. a Clean Architecture / CQRS shape), or should the pack just capture how this repo already does things?

- **No migration intent (the common case)** → author exactly **one** pack from the repo's existing pattern. Continue to 0.2.
- **Yes, migration intent** → author **two** packs that live side by side in this repo:
  1. the existing-convention pack (unchanged — features that aren't part of the migration still need it), and
  2. a second, target-architecture pack (e.g. modeled on `packages/templates-dotnet/v8-controller` in scaffold-toolkit for a CQRS/Clean Architecture target).

  The "pick ONE representative existing file" rule below still applies per pack — a pack can only be derived from a real instance. If the repo has no example of the target shape yet, the user must hand-write one reference feature in that shape first; do not invent the target shape from a generic template.

  Register each under its own stack key in `.scaffold/config.json` (e.g. `backend` and `backend-cqrs`) and run Phases 1-3 once per pack. See "Wire pack-selection routing" in Phase 4 for wiring the guidance that tells the agent which pack to use per feature.

### 0.2 Find the repeating unit(s)

Per pack you're authoring (one, or two if migrating), find the **repeating unit** and answer:

- **What is identical** across every existing instance? → becomes `.hbs` template bodies.
- **What varies**? (entity/module/component name, route, fields) → becomes `inputs[]` and `{{placeholders}}`.
- **Where does each new instance get registered/wired?** (DI container, route table, `index.ts` barrel, module list, `urls.py`, `wire.go`) → each such spot becomes an **injection** with a `SCAFFOLD:<MARKER>` pair in the wiring file.
- **What can only a human/AI write?** (the actual business logic in a method body) → wrap in an `AI_IMPLEMENTATION` marker so `generate` leaves a hole and enforcement makes the agent fill it.
- **Comment syntax** of each file extension (`//`, `#`, `<!-- -->`, `--`) → the descriptor's `commentSyntax`, so markers are valid comments in that language.

Pick ONE representative existing file per target as your source of truth. You will parameterize a copy of it, not invent a new shape.

### 0.3 Separate out external/infra packages into their own pack

While studying the repo, also look for recurring usage of an **external SDK or cross-cutting infra concern** — a cloud provider client (GCP Pub/Sub, Secret Manager, IAM/service-account auth), a message broker, a payments SDK, anything wired into multiple features the same way. These do **not** belong inside the main business-logic pack:

- **One-time setup/deployment plumbing** (Dockerfile, CI pipeline, production config, initial client DI wiring) → an additive sibling pack with zero injections, `skip-if-exists` targets, and a single `options` object input for nested config values. Reference shape: `packages/templates-dotnet/v8-controller-gcp` in scaffold-toolkit.
- **Repeatable in-code usage** (a new Pub/Sub topic + handler, a new Secret-Manager-backed config accessor) → still needs its own `targets` (repeatable, `{{entity}}`-shaped) **and** its own **uniquely-named injection markers** (e.g. `PUBSUB-DI`, never reuse the base pack's `DI` marker) so it can inject into a shared wiring file (like `Program.cs`) without colliding with another pack's injection into the same file.
- Never hardcode real project IDs, secret names, or service-account emails into a template — they become `inputs`/`options`, the same way `v8-controller-gcp` parameterizes `options.gcp.projectId`.

Each such pack is a full pack in its own right — its own stack key, its own `test_data`, its own `validate-build.mjs` — run Phases 1-3 per pack, same as 0.1's migration pair.

---

## Phase 1 — Scaffold the skeleton, in-tree

Put the pack in the repo's git tree. Default location: `.scaffold/packs/<name>/` (co-located with the config the team already commits). In this monorepo the convention is `packages/templates-<name>/`; match whatever the target repo prefers.

```bash
scaffold pack new --dir .scaffold/packs/<name> --pack-version v1 --stack <label>
```

This writes an empty-but-valid `.scaffold/packs/<name>/v1/manifest.templates.json` and a **failing** `tools/validate-build.mjs` stub (a pack is not "validated" until a real build-check passes). Everything else you author by hand.

---

## Phase 2 — Author the pack

### 2a. Templates (`<version>/*.hbs`)

Copy your representative file to `<name>/<hbs>`, then:

- Replace the varying identifiers with `{{name}}` (or your declared input names).
- Wrap every method body that holds real logic:

  ```ts
  run(input: {{name}}Input): {{name}}Result {
    /// SCAFFOLD:AI_IMPLEMENTATION:START:required
    throw new Error('not implemented');
    /// SCAFFOLD:AI_IMPLEMENTATION:END
  }
  ```

  The marker prefix (`///`, `//`, `#`, …) must match the file's `commentSyntax`. `:required` means `generate` reports the block as `empty` and the enforcement hooks block turn-end until it is filled. Never place an `AI_IMPLEMENTATION` block in a registry/wiring file — those hold no logic.

- For the **wiring file** (the barrel/registry/route table), author it with an injection marker pair and a tiny link template:

  ```ts
  // Registry.ts.hbs
  /// SCAFFOLD:REGISTRY:START
  /// SCAFFOLD:REGISTRY:END
  ```
  ```ts
  // registry-link.hbs  (one appended line per generated unit)
  export { {{name}} } from './{{name}}/{{name}}.js';
  ```

### 2b. Descriptor (`<version>/manifest.templates.json`, schema v2)

```jsonc
{
  "descriptorSchemaVersion": 2,
  "packVersion": "v1",
  "requires": { "scaffoldCli": ">=0.2.0 <1.0.0" },

  "inputs": [
    { "name": "name", "type": "string", "required": true, "pattern": "^[A-Z][A-Za-z0-9]+$" }
  ],

  "commentSyntax": {
    ".ts": { "prefix": "///" }        // OR wrap: { ".html": { "wrap": ["<!--", "-->"] } }
  },

  "targets": [
    // mode: create | skip-if-exists | overwrite
    { "output": "src/features/index.ts",              "template": "Registry.ts.hbs", "mode": "skip-if-exists" },
    { "output": "src/features/{{name}}/{{name}}.ts",  "template": "Module.ts.hbs",   "mode": "create" },
    { "output": "src/features/{{name}}/{{name}}.test.ts", "template": "Module.test.ts.hbs", "mode": "create" }
  ],

  "injections": [
    {
      "file": "src/features/index.ts",
      "marker": "REGISTRY",                 // matches SCAFFOLD:REGISTRY:START/END, never "AI_IMPLEMENTATION*"
      "template": "registry-link.hbs",
      "position": "before-end",             // before-end | after-start
      "strategy": "append",                 // append (per-unit) | replace (single block)
      "hashTrailerPrefix": "/// scaffold-hash:"
    }
  ],

  // Brownfield only (Phase 4): where bootstrap-markers inserts marker pairs into EXISTING files.
  "bootstrapAnchors": [
    {
      "candidateFilenames": ["src/features/index.ts"],
      "anchor": { "kind": "after-line", "pattern": "^// features" },
      // or: { "kind": "after-class-brace", "declarationPattern": "class AppModule" }
      "markers": ["REGISTRY"]               // must NOT start with AI_IMPLEMENTATION
    }
  ]
}
```

`_comment` (or any `_`-prefixed key) is allowed anywhere as author documentation.

### 2c. Fixtures (`test_data/*.json`)

One manifest **per distinct scenario**, not per-file clones of the same entity:

```json
{ "manifestSchemaVersion": 1, "targetStack": "<name>", "name": "Billing" }
```

### 2d. Real build-check (`tools/validate-build.mjs`)

Replace the failing stub with a script that scaffolds each `test_data` fixture through the **real** `scaffold generate` into a throwaway sample project, then **builds/tests it with this stack's own toolchain** (`tsc`/`go build`/`dotnet build`/`pytest`…). Reference: `packages/templates-dotnet/tools/validate-build.mjs` and `packages/templates-node/tools/validate-build.mjs` in the scaffold-toolkit repo. `validate-pack` only proves generate did not throw — it never catches a missing import, wrong method name, or namespace mismatch. Only the real build does.

---

## Phase 3 — Validate

```bash
# Render/injection smoke test (does generate throw?)
scaffold validate-pack --pack .scaffold/packs/<name> --pack-version v1 \
  --manifest .scaffold/packs/<name>/test_data/<scenario>.json

# Real compile/test of the rendered output
node .scaffold/packs/<name>/tools/validate-build.mjs
```

Both must pass before the pack is real. Wire `validate-build.mjs` into the repo's CI so no pack change merges without it.

---

## Phase 4 — Adopt into the brownfield repo

```bash
# 1. Point the repo's config at the in-tree pack
scaffold init --pack <name>=.scaffold/packs/<name>@v1

# 2. Map targets/injections onto the repo's real files and insert empty marker pairs
scaffold bootstrap-markers --pack .scaffold/packs/<name> --pack-version v1 --dry-run
#   review the plan, then drop --dry-run to write
scaffold bootstrap-markers --pack .scaffold/packs/<name> --pack-version v1
```

`bootstrap-markers` reads `bootstrapAnchors` to insert `SCAFFOLD:<MARKER>:START/END` into existing wiring files, and records adopted paths in `.scaffold/config.json` so the enforcement hooks gate them exactly like generated files. Read the report channels: `placed`/`alreadyPresent` (done), `pendingGenerate` (the file is a `generate` target, marker arrives on first generate — nothing to do), anything else needs a hand fix or a better anchor.

Repeat the `init`/`bootstrap-markers` pair once per pack if 0.1 or 0.3 produced more than one.

### Wire pack-selection routing into this repo's own instructions file (when more than one pack)

If more than one pack is now registered for this repo, write a short routing section into **this repo's own** agent-instructions file — one line per pack naming the concrete decision rule for when to use it, and an explicit "ambiguous → ask the user" fallback rather than a silent default. Use `CLAUDE.md` if the repo already has one, or `AGENTS.md` if that's the convention this repo/team uses (e.g. for GitHub Copilot). Create the file if the repo has neither.

Never write this routing guidance into a **user-global or personal** instructions file (e.g. `~/.claude/CLAUDE.md`, `~/.agents/AGENTS.md`). Those load for every repo that user touches, most of which won't have these packs registered at all — the routing rule is only meaningful inside this repo.

Then **hand off to the `scaffold` consumer skill** to install the enforcement hooks (Claude Code: merge into `.claude/settings.json`; GitHub Copilot CLI: write `.github/hooks/scaffold-toolkit.json`) and run the first `scaffold generate`.

---

## Phase 5 — A new pack version

- **Config-only change** (swap a value, add a conditional): a `manifest.options`/`inputs` conditional inside the **existing** version's templates. No new folder.
- **Real architectural addition** (a new target shape, a different framework variant): a **new additive sibling version folder** (`v2`, `v8-controller-gcp`, …) with its **own** descriptor, its **own non-colliding marker names**, and its **own** `test_data` + passing build-check. It inherits none of the base version's fixtures or build-check. Consumers opt in with `--pack <name>=<path>@v2`.

---

## Guardrails

- **Determinism:** identical manifest + repo state ⇒ byte-identical output. No timestamps, randomness, locale-dependent ordering, or network calls in templates.
- **Author only through the CLI's shapes.** Markers, `hashTrailerPrefix`, and `strategy: append` give idempotency and re-run safety — do not hand-edit generated regions or invent your own marker format.
- **`AI_IMPLEMENTATION` is for logic bodies only.** Registry/wiring markers use plain names (`REGISTRY`, `ROUTES`); they may never start with `AI_IMPLEMENTATION`.
- **No pack is "done" until `validate-build.mjs` passes and is in CI.** `validate-pack` alone is not sufficient.
- **The pack stays in the repo's git tree.** That is what lets the team change coding standards by editing templates in the same PR as the code.

---

## Quick reference

| Step | Command |
| --- | --- |
| Skeleton | `scaffold pack new --dir .scaffold/packs/<name> --pack-version v1 --stack <label>` |
| Render check | `scaffold validate-pack --pack .scaffold/packs/<name> --pack-version v1 --manifest <fixture>` |
| Build check | `node .scaffold/packs/<name>/tools/validate-build.mjs` |
| Point repo at pack | `scaffold init --pack <name>=.scaffold/packs/<name>@v1` |
| Wire brownfield markers | `scaffold bootstrap-markers --pack .scaffold/packs/<name> --pack-version v1 [--dry-run]` |
| Consume (other skill) | `scaffold generate` |

**Descriptor cheat-sheet:** `targets.mode` ∈ `create|skip-if-exists|overwrite` · `injections.position` ∈ `before-end|after-start` · `injections.strategy` ∈ `append|replace` · `commentSyntax` entry is `{prefix}` or `{wrap:[open,close]}` · `bootstrapAnchors.anchor.kind` ∈ `after-line{pattern}|after-class-brace{declarationPattern}`.
