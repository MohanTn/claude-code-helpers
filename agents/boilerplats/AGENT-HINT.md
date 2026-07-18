## Boilerplate generator

For repository/controller/handler/validator/factory/commands/query/request/response/mapper/helper/di-injection boilerplate in csharp, typescript, javascript, python, or go (or script/function/validator/helper in sh), using the generator is MANDATORY, never hand-write it. On Claude Code and Copilot a PreToolUse hook deterministically blocks hand-written new boilerplate files:

    node ~/.agents/boilerplats/scaffold.js --lang <lang> --template <name> --out <path> --data '<json>' [--inject --marker '<comment>']

Templates live at `~/.agents/boilerplats/<lang>/<template>.hbs`; each starts with a `{{!-- Data: {...} --}}` comment documenting the fields to pass via `--data`. Omit `--inject` to create a new file (fails if it already exists unless `--force`); pass `--inject` to insert generated content above a marker comment in an existing file, which stays in place so the same file can be injected again. The default marker is `// scaffold:inject`; python and sh templates use `# scaffold:inject` and require `--marker '# scaffold:inject'` to be passed explicitly.

Editing generated files: add a new member to a scaffold-marked file with `--inject --template member` (a deliberately generic named-member stub, `Signature` + optional `Body`), then fill in the logic with ordinary edits. Never remove a `scaffold:inject` marker — the guard hook blocks edits and overwrites that drop it. The templates are intentionally generic starting points; run them, then correct and fill in whatever the skeleton got wrong.
