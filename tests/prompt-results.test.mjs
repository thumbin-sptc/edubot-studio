import assert from "node:assert/strict";
import { test } from "node:test";
import { availableResults, withResultMemory } from "../src/lib/prompt-results.ts";

const source = { id: "QA-SOURCE", title: "승인된 합성 제목", version: "2.0.0" };
const old = {
  promptId: source.id,
  promptTitle: "임시 로컬 제목",
  templateVersion: "1.0.0",
  externalAiResult: "이전 버전의 합성 답변",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const current = {
  ...old, templateVersion: "2.0.0", externalAiResult: "현재 버전의 합성 답변", updatedAt: "2026-01-02T00:00:00.000Z",
};

test("OFF exposes only results saved to this tab's memory and reload starts with empty memory", () => {
  const memory = withResultMemory(new Map(), current);
  const results = availableResults([source], memory, [old], false);
  assert.deepEqual(results.map(({ origin, version, text }) => [origin, version, text]), [
    ["memory", "2.0.0", current.externalAiResult],
  ]);
  assert.equal(availableResults([source], new Map(), [old], false).length, 0);
});

test("ON distinguishes versions and differing copies, without duplicating the same saved answer", () => {
  let memory = withResultMemory(new Map(), current);
  let results = availableResults([source], memory, [old, current], true);
  assert.deepEqual(results.map(({ origin, version }) => [origin, version]), [["saved", "2.0.0"], ["saved", "1.0.0"]]);
  memory = withResultMemory(memory, { ...current, externalAiResult: "아직 저장되지 않은 수정 답변" });
  results = availableResults([source], memory, [old, current], true);
  assert.equal(results.length, 3);
  assert.equal(new Set(results.map(({ key }) => key)).size, 3);
  assert.ok(results.every(({ title }) => title === source.title));
});

test("deletion, blank results, and withdrawn or non-allowed origins cannot be offered for import", () => {
  const memory = withResultMemory(new Map(), current);
  assert.equal(availableResults([], memory, [old], true).length, 0);
  assert.equal(availableResults([source], memory, [{ ...old, promptId: "QA-DRAFT" }], true).length, 1);
  const deleted = withResultMemory(memory, { ...current, externalAiResult: undefined });
  assert.equal(deleted.size, 0);
  assert.equal(availableResults([source], deleted, [{ ...old, externalAiResult: " \n " }], true).length, 0);
});
