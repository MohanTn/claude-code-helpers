---
name: repo-map-check
description: Check .claude/repo-map.md for cached file inventory before running filesystem queries.
---

# Repo Map Check

**Trigger:** File inventory discovery queries (ls, find, file-structure questions about agents/boilerplats, claude/hooks, or other tracked directories).

**What it does:** Before running filesystem queries to discover files, consult `.claude/repo-map.md` for cached inventory.

## Usage

When the agent needs to know what files exist in a tracked directory:

1. Check `.claude/repo-map.md` for the directory section (e.g., `## agents/boilerplats`)
2. If repo-map.md lists the files, use that data instead of running `ls`
3. Only run filesystem queries if:
   - repo-map.md doesn't cover the directory
   - Live state is needed (permissions, file contents, or freshness matters)
   - CLI availability or environment checks are required

## Example

Instead of:
```bash
ls ~/.agents/boilerplats/typescript/
```

Check repo-map.md:
```
## agents/boilerplats/typescript

Other files: commands.hbs, controller.hbs, ...
```

Use the cached data unless freshness is critical.
