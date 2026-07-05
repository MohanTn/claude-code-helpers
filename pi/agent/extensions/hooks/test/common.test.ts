import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { md5, walkUpTsConfig, walkUpCsproj, walkUpGit } from "../common";

test("md5 is deterministic and content-sensitive", () => {
  assert.equal(md5("hello"), md5("hello"));
  assert.notEqual(md5("hello"), md5("world"));
});

test("walkUpTsConfig finds the nearest tsconfig.json walking up from a nested dir", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    writeFileSync(join(root, "tsconfig.json"), "{}");
    const nested = join(root, "src", "components");
    mkdirSync(nested, { recursive: true });

    assert.equal(walkUpTsConfig(nested), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("walkUpTsConfig returns null when no tsconfig.json exists up to the walk limit", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    assert.equal(walkUpTsConfig(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("walkUpCsproj finds the nearest .csproj file and reports both dir and file", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    const csproj = join(root, "MyApp.csproj");
    writeFileSync(csproj, "<Project />");
    const nested = join(root, "Controllers");
    mkdirSync(nested, { recursive: true });

    assert.deepEqual(walkUpCsproj(nested), { dir: root, file: csproj });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("walkUpGit finds the nearest .git directory", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-hooks-test-"));
  try {
    mkdirSync(join(root, ".git"));
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });

    assert.equal(walkUpGit(nested), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
