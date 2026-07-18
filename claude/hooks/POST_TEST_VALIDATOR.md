# Post-Tool-Use Validate & Test Hook

**Purpose:** Auto-detect project stack (Node.js, .NET, Python, Go, Rust), run lint/build/test, inject only error summaries back to AI.

**Why:** Prevents AI from re-running tests 2-3x to parse errors. Captures the error pack once, distills it, and surfaces only actionable failures.

## How it works

1. **Triggers:** After every Edit or Write tool use (configurable in `settings.json`)
2. **Detection:** Walks up directory tree looking for `package.json`, `*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`
3. **Stack identification:**
   - Node.js → `npm test`, `npm run build`
   - .NET → `dotnet test`, `dotnet build`
   - Python → `pytest` (or unittest/nose if pyproject.toml lacks pytest config)
   - Go → `go test ./...`
   - Rust → `cargo test`, `cargo build`
4. **Error extraction:**
   - Runs full build/test output into `/tmp/build.log` or `/tmp/test.log`
   - Greps for lines matching `error`, `FAIL`, `failed`, etc.
   - Limits output to **15–30 lines** (first N failures, not full stack trace)
5. **Error injection:** Dumps error summary to stderr (caught by Claude Code and passed to AI as context)
6. **Exit code:** Returns 1 if errors found, 0 if all checks pass

## What gets filtered out

- Full verbose test output (summary only)
- Passing test lines
- Progress spinners, timing info, warnings
- Long stack traces (first 15 lines of actual failures)

## Configuration

**In `settings.json`:**
```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "bash \"$HOME/.claude/hooks/post-tool-use-validate-and-test.sh\"",
      "timeout": 120,
      "onError": "continue"
    }
  ]
}
```

- `timeout: 120` — tests can take a while; 2 minutes is safe for most projects
- `onError: "continue"` — test failure doesn't block the AI, just annotates the turn

## Example flow

1. AI edits `src/OrdersController.cs`
2. Hook detects `.csproj` → stack = "dotnet"
3. Runs `dotnet build` → finds compilation error in 3 files
4. Greps errors: extracts 15 lines of actual `error CS` messages
5. Returns stderr (captured by Claude Code):
   ```
   Build failed:
   /src/OrdersController.cs(21,5): error CS1520: Method must have a return type
   /src/OrdersController.cs(26,8): error CS1520: Method must have a return type
   ...
   ```
6. AI sees the error pack, fixes it, and tries again
7. Next hook run finds no errors, exits 0 (silent success)

## Supported edge cases

- **No test runner found:** Hook exits silently (stack detected but no test bin)
- **Mixed stacks** (monorepo): Hook walks from edited file's directory up; finds nearest `package.json` or `.csproj` first
- **Python import-only check:** If no pytest/unittest, does a `python -m py_compile` on .py files
- **Timeout:** If build/test takes >120s, hook times out (doesn't block AI, just annotates)

## Logging

All hook steps logged to `$state_dir/hook.log` (e.g. `~/.local/state/claude-hooks/default/hook.log`):
```
[14:23:45] post-test: detected stack=dotnet project=/home/user/repo
[14:23:45] post-build: running dotnet build
[14:23:52] post-build: failed, injecting errors
```

## Future enhancements

- Caching: skip test re-run if file edit is in docs/comments only
- Diffs: only run tests affected by changed files (via git diff)
- Custom rules: allow `.claude/post-test.json` to override lint/test commands per project
