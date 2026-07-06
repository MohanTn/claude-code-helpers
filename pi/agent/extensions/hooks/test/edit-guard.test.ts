import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkImports } from "../edit-guard";

test("checkImports allows a relative import that resolves to a sibling .ts file", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    writeFileSync(join(dir, "helper.ts"), "export const x = 1;");
    const issues = checkImports(`import { x } from "./helper";`, dir);
    assert.deepEqual(issues, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkImports allows a relative import that resolves via an index.ts", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    mkdirSync(join(dir, "utils"));
    writeFileSync(join(dir, "utils", "index.ts"), "export const x = 1;");
    const issues = checkImports(`import { x } from "./utils";`, dir);
    assert.deepEqual(issues, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkImports flags a relative import that does not resolve to any file", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    const issues = checkImports(`import { x } from "./missing";`, dir);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /'\.\/missing' does not resolve/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkImports ignores bare package imports", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    const issues = checkImports(`import { readFileSync } from "node:fs";\nimport React from "react";`, dir);
    assert.deepEqual(issues, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
