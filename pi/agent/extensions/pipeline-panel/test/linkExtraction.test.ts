import test from "node:test";
import assert from "node:assert/strict";
import { extractLinks } from "../runProcess.js";

test("extracts a GitLab MR link", () => {
  const { mrUrl, pipelineUrl } = extractLinks("https://gitlab.example.com/group/project/-/merge_requests/42");
  assert.equal(mrUrl, "https://gitlab.example.com/group/project/-/merge_requests/42");
  assert.equal(pipelineUrl, undefined);
});

test("extracts a GitHub PR link", () => {
  const { mrUrl } = extractLinks("opened https://github.com/MohanTn/pipeline_worker/pull/12 for review");
  assert.equal(mrUrl, "https://github.com/MohanTn/pipeline_worker/pull/12");
});

test("extracts a GitLab pipeline link from a real pipeline-worker log line", () => {
  const { pipelineUrl, mrUrl } = extractLinks("pipeline 28625523763: running — https://gitlab.example.com/group/project/-/pipelines/28625523763");
  assert.equal(pipelineUrl, "https://gitlab.example.com/group/project/-/pipelines/28625523763");
  assert.equal(mrUrl, undefined);
});

test("extracts a GitHub Actions run link", () => {
  const { pipelineUrl } = extractLinks("CI: https://github.com/MohanTn/pipeline_worker/actions/runs/999888777");
  assert.equal(pipelineUrl, "https://github.com/MohanTn/pipeline_worker/actions/runs/999888777");
});

test("returns both when a line mentions both", () => {
  const { mrUrl, pipelineUrl } = extractLinks(
    "see https://gitlab.example.com/g/p/-/merge_requests/1 and https://gitlab.example.com/g/p/-/pipelines/2",
  );
  assert.equal(mrUrl, "https://gitlab.example.com/g/p/-/merge_requests/1");
  assert.equal(pipelineUrl, "https://gitlab.example.com/g/p/-/pipelines/2");
});

test("returns undefined for lines with no relevant link", () => {
  const { mrUrl, pipelineUrl } = extractLinks("build: passed (3.2s)");
  assert.equal(mrUrl, undefined);
  assert.equal(pipelineUrl, undefined);
});
