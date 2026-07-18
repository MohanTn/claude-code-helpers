#!/usr/bin/env bash
# PostToolUse (Edit/Write) — Auto-detect stack, run lint/build/test, inject error summary only.
# Detects: Node.js, .NET, Python, Go, Rust. Captures only the error pack, not full output.
# This prevents the AI from re-running tests 2-3x to parse errors.

input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

[ "$tool_name" = "Edit" ] || [ "$tool_name" = "Write" ] || exit 0

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file" ] || exit 0

# Find project root (first dir with a known marker going up from cwd)
find_project_root() {
  local d="$cwd"
  while [ "$d" != "/" ]; do
    [ -f "$d/package.json" ] && echo "$d" && return
    [ -f "$d/ThetaDesk.sln" ] && echo "$d" && return
    [ -f "$d/setup.py" ] || [ -f "$d/pyproject.toml" ] && echo "$d" && return
    [ -f "$d/go.mod" ] && echo "$d" && return
    [ -f "$d/Cargo.toml" ] && echo "$d" && return
    d=$(dirname "$d")
  done
  echo "$cwd"
}

project_root=$(find_project_root)
cd "$project_root" || exit 0

# Detect stack
detect_stack() {
  if [ -f "package.json" ]; then
    echo "node"
  elif [ -f "*.csproj" ] || [ -f "ThetaDesk.sln" ]; then
    echo "dotnet"
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    echo "python"
  elif [ -f "go.mod" ]; then
    echo "go"
  elif [ -f "Cargo.toml" ]; then
    echo "rust"
  else
    echo "unknown"
  fi
}

run_tests() {
  local stack="$1"
  local errors=""

  case "$stack" in
    node)
      log "post-test: running npm test for Node.js"
      if ! npm test 2>&1 | tee /tmp/test.log | head -100 >/dev/null; then
        errors=$(grep -A 20 "FAIL\|Error\|failed" /tmp/test.log | head -30)
      fi
      ;;
    dotnet)
      log "post-test: running dotnet test"
      if ! dotnet test 2>&1 | tee /tmp/test.log | head -100 >/dev/null; then
        errors=$(grep -E "^.*error|FAILED|failed test" /tmp/test.log | head -20)
      fi
      ;;
    python)
      log "post-test: detecting Python test framework"
      if [ -f "pyproject.toml" ] && grep -q "pytest" pyproject.toml; then
        if ! pytest -q 2>&1 | tee /tmp/test.log >/dev/null; then
          errors=$(grep -E "FAILED|ERROR|assert" /tmp/test.log | head -20)
        fi
      elif command -v pytest >/dev/null 2>&1; then
        if ! pytest -q 2>&1 | tee /tmp/test.log >/dev/null; then
          errors=$(grep -E "FAILED|ERROR" /tmp/test.log | head -20)
        fi
      fi
      ;;
    go)
      log "post-test: running go test"
      if ! go test ./... 2>&1 | tee /tmp/test.log >/dev/null; then
        errors=$(grep -E "FAIL|--- FAIL" /tmp/test.log | head -20)
      fi
      ;;
  esac

  echo "$errors"
}

run_build() {
  local stack="$1"
  local errors=""

  case "$stack" in
    node)
      log "post-build: running npm run build"
      if ! npm run build 2>&1 | tee /tmp/build.log >/dev/null 2>&1; then
        errors=$(grep -E "error|Error|ERR!" /tmp/build.log | head -15)
      fi
      ;;
    dotnet)
      log "post-build: running dotnet build"
      if ! dotnet build 2>&1 | tee /tmp/build.log >/dev/null 2>&1; then
        errors=$(grep -E "error CS|error:" /tmp/build.log | head -15)
      fi
      ;;
    python)
      log "post-build: python does not require build, checking imports"
      if ! python -m py_compile $(find . -name "*.py" -type f 2>/dev/null | head -10) 2>&1 | tee /tmp/build.log >/dev/null 2>&1; then
        errors=$(grep -E "SyntaxError|Error" /tmp/build.log | head -15)
      fi
      ;;
  esac

  echo "$errors"
}

stack=$(detect_stack)
log "post-test: detected stack=$stack project=$project_root"

if [ "$stack" = "unknown" ]; then
  log "post-test: unknown stack, skipping"
  exit 0
fi

# Run build (most stacks)
if [ "$stack" != "python" ]; then
  build_errors=$(run_build "$stack")
  if [ -n "$build_errors" ]; then
    log "post-test: build failed, injecting errors"
    printf '%s\n' "$build_errors" >&2
    echo "Build failed:" >&2
    echo "$build_errors" >&2
    exit 1
  fi
fi

# Run tests
test_errors=$(run_tests "$stack")
if [ -n "$test_errors" ]; then
  log "post-test: tests failed, injecting error summary"
  printf '%s\n' "Test failures detected:" >&2
  printf '%s\n' "$test_errors" >&2
  exit 1
fi

log "post-test: all checks passed"
exit 0
