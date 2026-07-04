#!/usr/bin/env bash
# PostToolUse: Edit|Write — 2.1 dirty-flag + 3.1 symbol-existence + 3.2 type-check gate + 3.4 citation check
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0

# 2.1 — edit generation counter: every successful Edit/Write advances this so the
# Bash dedup/failure-memory guards can tell "no changes since X" apart per-command
# instead of via a single global flag any unrelated Bash call would clear.
gen_file="$state_dir/edit_gen"
gen=$(( $(cat "$gen_file" 2>/dev/null || echo 0) + 1 ))
printf '%s' "$gen" > "$gen_file" 2>/dev/null

file_dir=$(dirname "$file")
in_git_repo=0
git -C "$file_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 && in_git_repo=1

case "$file" in
*.ts|*.tsx)
  if [ "$in_git_repo" = "1" ]; then
    # 3.1 — symbol-existence verifier (local relative imports only)
    new_imports=$(git -C "$file_dir" diff -- "$file" 2>/dev/null | grep '^+import' | grep -oE "from ['\"][^'\"]+['\"]")
    while IFS= read -r imp; do
      [ -z "$imp" ] && continue
      mod=$(printf '%s' "$imp" | sed -E "s/from ['\"](.+)['\"]/\1/")
      case "$mod" in
        .*)
          # Strip a trailing extension first: NodeNext/ESM TS projects commonly
          # import "./foo.js" for a source file that's actually "./foo.ts" —
          # checking "${resolved}.js.ts" etc. without stripping would false-positive.
          stripped="$mod"
          case "$stripped" in
            *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) stripped="${stripped%.*}" ;;
          esac
          resolved="${file_dir}/${stripped}"
          if [ ! -f "${file_dir}/${mod}" ] && [ ! -f "${resolved}.ts" ] && [ ! -f "${resolved}.tsx" ] && [ ! -f "${resolved}/index.ts" ] && [ ! -f "${resolved}.js" ] && [ ! -f "${resolved}.jsx" ]; then
            log "post-edit: unresolved import '$mod' in $file"
            echo "Import '$mod' in $file does not resolve to an existing file." >&2
            exit 2
          fi
          ;;
      esac
    done <<< "$new_imports"
  fi

  # 3.2 — type-check gate: discover nearest tsconfig.json by walking up from file_dir (max 6 levels), never CLAUDE_PROJECT_DIR
  tsconfig_dir=""
  search_dir="$file_dir"
  for _ in 1 2 3 4 5 6; do
    if [ -f "$search_dir/tsconfig.json" ]; then
      tsconfig_dir="$search_dir"
      break
    fi
    parent=$(dirname "$search_dir")
    [ "$parent" = "$search_dir" ] && break
    search_dir="$parent"
  done

  if [ -n "$tsconfig_dir" ]; then
    tsc_bin=""
    if [ -x "$tsconfig_dir/node_modules/.bin/tsc" ]; then
      tsc_bin="$tsconfig_dir/node_modules/.bin/tsc"
    elif command -v npx >/dev/null 2>&1; then
      tsc_bin="npx --no-install tsc"
    fi
    if [ -n "$tsc_bin" ]; then
      errors=$(cd "$tsconfig_dir" && timeout 8 $tsc_bin --noEmit --pretty false -p "$tsconfig_dir" 2>&1 | grep "$(basename "$file")")
      if [ -n "$errors" ]; then
        log "post-edit: type errors in $file"
        printf 'Type errors introduced:\n%s\n' "$errors" >&2
        exit 2
      fi
    fi
  fi
  ;;
*.cs)
  # 3.5 — dotnet build gate, the C# analogue of the tsc gate above. There's no
  # equivalent of 3.1's relative-import check here: C# resolves by namespace via
  # project/assembly references, not relative file paths, so it doesn't map.
  if command -v dotnet >/dev/null 2>&1; then
    csproj_dir=""
    csproj_file=""
    search_dir="$file_dir"
    for _ in 1 2 3 4 5 6; do
      found=$(find "$search_dir" -maxdepth 1 -name "*.csproj" 2>/dev/null | head -1)
      if [ -n "$found" ]; then
        csproj_dir="$search_dir"
        csproj_file="$found"
        break
      fi
      parent=$(dirname "$search_dir")
      [ "$parent" = "$search_dir" ] && break
      search_dir="$parent"
    done

    if [ -n "$csproj_dir" ]; then
      # --no-restore: a missing/stale restore produces NuGet errors that won't
      # mention this file's basename, so the filter below naturally ignores them
      # rather than false-blocking on an unrelated restore problem.
      errors=$(cd "$csproj_dir" && timeout 20 dotnet build "$csproj_file" --no-restore -nologo -v q 2>&1 | grep -E 'error (CS|MSB)' | grep -F "$(basename "$file")")
      if [ -n "$errors" ]; then
        log "post-edit: build errors in $file"
        printf 'Build errors introduced:\n%s\n' "$errors" >&2
        exit 2
      fi
    fi
  fi
  ;;
*.md|*.mdx|*.txt)
  if [ "$in_git_repo" = "1" ]; then
    # 3.4 — path/citation cross-checker
    repo_root=$(git -C "$file_dir" rev-parse --show-toplevel 2>/dev/null)
    added=$(git -C "$file_dir" diff -- "$file" 2>/dev/null | grep '^+' | grep -oE '[a-zA-Z0-9_./-]+\.(ts|tsx|js|py|sh|json):[0-9]+')
    while IFS= read -r ref; do
      [ -z "$ref" ] && continue
      path="${ref%%:*}"
      line="${ref##*:}"
      full="${repo_root:-$file_dir}/$path"
      if [ ! -f "$full" ]; then
        log "post-edit: stale citation '$path' in $file"
        echo "Referenced file '$path' does not exist." >&2
        exit 2
      fi
      total=$(wc -l < "$full" 2>/dev/null || echo 0)
      if [ "$line" -gt "$total" ]; then
        log "post-edit: citation line $line exceeds $path length $total"
        echo "Referenced line $line in '$path' exceeds file length ($total)." >&2
        exit 2
      fi
    done <<< "$added"
  fi
  ;;
esac

exit 0
