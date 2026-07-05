# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- This commit consolidates pi/agent/extensions/hooks to match the claude/hooks refactoring by removing less-critical hooks (bash-guard, read-cache, output-trimmers, tts-ding, architecture hints), integrating sonar_lite.py for unified static analysis, fixing a latent bug where project digest was computed but never surfaced to the session, adding a full unit test suite, fixing test-hook.sh selftest which referenced deleted hooks, and bootstrapping the pi CLI in install.sh.
- Refactors the hooks system by introducing test-hook.sh (a comprehensive testing framework), sonar_lite.py (unified static analysis for TS/JS/C#), and removing less-critical hooks (bash-guard, read-cache, pre-compact, post-bash, stop-ding, stop-speak). Consolidates post-tool-use-edit to use sonar_lite instead of separate linting and citation checks.
- This change attempts to exclude pipeline-worker operational state files from git, but contains a critical typo in .gitignore that prevents the actual directory from being ignored. Also includes configuration changes to Claude settings and tmux keybindings.
- Brings `pi/agent/extensions/hooks` back to parity with the claude/hooks consolidation above: removes the pi-side equivalents of the dropped hooks (bash-guard, read-cache, output-trimmers, tts-ding, architecture hints, citation checks) and adds the sonar_lite.py gate. Also fixes a latent bug where the ported project-digest generation was computed but never surfaced to the model; it's now injected once per session. Adds a matching unit test suite (`node:test` + `tsx`) for the extension's pure logic, and fixes `test-hook.sh selftest`, which had been failing 2/7 checks since it still referenced the just-removed `pre-compact.sh`/`stop-ding.sh`.
- `install.sh` now bootstraps the `pi` CLI itself (`npm install -g @earendil-works/pi-coding-agent`) on machines where it isn't already on `PATH`, alongside the existing symlinks for the pi extensions.

### Added

- Introduces a new Lua configuration module that enhances Neovim's Snacks file explorer with comprehensive mouse support: double-click to open/toggle files, ctrl-click for multi-selection, and right-click context menu with file operations (new, rename, copy, cut, paste, delete, open, refresh).
