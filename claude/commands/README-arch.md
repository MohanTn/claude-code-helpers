# Architecture Command System

The `/arch` command generates enterprise-grade architecture documents for features and systems. The system is optimized for token efficiency using a two-stage process: content generation (Claude) and template injection (Node.js script).

## Workflow

### Stage 1: Content Generation (Claude)
Claude generates feature-specific architecture content as **structured JSON** (sections 0–10 plus metadata). This is token-efficient because:
- No HTML boilerplate regeneration
- Only actual content is generated
- JSON is smaller than full HTML

### Stage 2: Template Injection (Script)
A Node.js script (`arch-inject.js`) reads the JSON and merges it into a pre-built HTML template. This is fast and deterministic.

## Usage

### As a User
```bash
# First draft
/arch how does this repo work

# Refinement (if arch-how-does-this-repo-work.html already exists)
/arch how does this repo work
# Provide feedback; Claude updates the JSON and re-injects
```

### Manual Injection (if needed)
```bash
# If you have a JSON file and want to generate HTML manually
node ~/.claude/commands/arch-inject.js arch-feature.json arch-feature.html ~/.claude/commands/arch-template.html
```

## JSON Structure Example

Claude generates a file like `arch-feature.json`:

```json
{
  "title": "User Authentication Workflow",
  "summary": "OAuth 2.0 integration for single sign-on across all services",
  "stack": "Node.js · React · PostgreSQL · Auth0",
  "status": "DRAFT",
  "statusClass": "draft",
  "version": "v1",
  "lastUpdated": "2026-07-11",
  "authorModel": "Claude Haiku 4.5",
  "revisionLog": [
    {
      "version": "v1",
      "date": "2026-07-11",
      "summary": "Initial architecture draft covering OAuth flow, API design, and deployment model",
      "drivenBy": "First generation"
    }
  ],
  "sections": {
    "0": "<tr><td>v1</td><td>2026-07-11</td><td>Initial draft...</td><td>First generation</td></tr>",
    "1": "<div class='card'><h3>Feature Summary</h3><p>...</p></div>...",
    "2": "...",
    ... (sections 0-10)
    "10": "..."
  }
}
```

The script then runs:
```bash
node arch-inject.js arch-feature.json arch-feature.html ~/.claude/commands/arch-template.html
```

Output: `arch-feature.html` (fully rendered, ready to share)

## Files

- **arch-template.html** — Pre-built HTML template with `{{PLACEHOLDER}}` markers for content injection. Ships with light/dark mode (system default, toggle in the sidebar, persisted per browser), Mermaid diagrams rendered in the matching theme, per-diagram zoom controls plus a fullscreen viewer (maximize button or double-click; wheel to zoom, drag to pan, Esc to close), sticky table of contents with scroll highlighting, reading progress bar, back-to-top button, responsive layout, and print styles.
- **arch-inject.js** — Node.js script that reads JSON and injects content into template. Handles HTML escaping and placeholder replacement.
- **arch-inject.test.js** — Unit tests for the injection script and template contract. Run with `node --test claude/commands/arch-inject.test.js`.
- **arch.md** — Instruction file for Claude (this command's behavior definition).

## Token Savings

| Approach | Tokens | Notes |
|----------|--------|-------|
| Old (full HTML generation) | ~20,000 | Claude generates entire HTML + template |
| New (JSON + script injection) | ~5,000–7,000 | Claude generates only content; script handles template |
| **Savings** | **~65–75%** | Huge reduction, especially for refinement passes |

## Refinement Workflow

1. User provides feedback: "Add ADR section, clarify Section 5 on API endpoints"
2. Claude reads existing HTML to extract current version/status
3. Claude generates new JSON with updated sections only
4. Script injects new JSON (same filename, version increments v1 → v2)
5. User reviews updated HTML

Subsequent refinements reuse the template, so token cost stays low (~5K per pass).

## Extending

To add new metadata fields or sections:
1. Update `arch-template.html` with new `{{PLACEHOLDER}}` markers
2. Update `arch-inject.js` to handle the new replacements
3. Update `arch.md` to document the new JSON keys
4. Claude's next generation will use the new format automatically

---

For detailed instructions on section content, see **arch.md**.
