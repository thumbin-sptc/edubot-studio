import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDraft, currentOutput, deleteAllDrafts, deleteDraft, draftKey, isSavingEnabled, needsRegenerationConfirmation,
  parseDraft, readDraft, readDrafts, restoreGeneratedOutput, savePreferenceKey, setSavingEnabled, withGeneratedOutput, writeDraft,
} from "../src/lib/prompt-drafts.ts";
import { parsePromptTemplate } from "../src/lib/prompt-template.ts";
import { syntheticWizard, validInputs } from "./fixtures/synthetic-prompts.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function makeDraft(version = "1.0.0") {
  return {
    ...createDraft(parsePromptTemplate({ ...syntheticWizard, version })),
    ...validInputs(),
    generatedOutput: "생성된 합성 글",
    editedOutput: "편집한 합성 글",
    externalAiResult: "수동으로 보관한 합성 답변",
    currentStepId: "result",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("edited output survives cancelled regeneration and unchanged generation, and restore preserves the generated source", () => {
  const draft = makeDraft();
  assert.equal(currentOutput(draft), "편집한 합성 글");
  assert.equal(needsRegenerationConfirmation(draft, "다시 생성한 합성 글"), true);
  assert.equal(currentOutput(draft), "편집한 합성 글");
  assert.equal(needsRegenerationConfirmation(draft, draft.generatedOutput), false);
  assert.equal(withGeneratedOutput(draft, draft.generatedOutput), draft);
  const regenerated = withGeneratedOutput(draft, "다시 생성한 합성 글");
  assert.equal(currentOutput(regenerated), "다시 생성한 합성 글");
  assert.equal(regenerated.editedOutput, null);
  assert.equal(currentOutput(restoreGeneratedOutput(draft)), draft.generatedOutput);
});

test("storage defaults OFF, opt-in round-trips all state, and OFF keeps prior storage", () => {
  const storage = memoryStorage();
  const draft = makeDraft();
  assert.equal(isSavingEnabled(storage), false);
  assert.equal(writeDraft(storage, draft, null).kind, "disabled");
  assert.equal(storage.length, 0);
  setSavingEnabled(storage, true);
  const result = writeDraft(storage, draft, null);
  assert.equal(result.kind, "saved");
  assert.deepEqual(readDraft(storage, draft).draft, draft);
  setSavingEnabled(storage, false);
  const changed = { ...draft, editedOutput: "메모리 전용 수정" };
  assert.equal(writeDraft(storage, changed, result.raw).kind, "disabled");
  assert.equal(readDraft(storage, draft).draft.editedOutput, draft.editedOutput);
});

test("re-enabling, another tab, and deletion cannot overwrite a different record without its observed revision", () => {
  const storage = memoryStorage();
  const draft = makeDraft();
  setSavingEnabled(storage, true);
  const first = writeDraft(storage, draft, null);
  setSavingEnabled(storage, false);
  setSavingEnabled(storage, true);
  const changed = { ...draft, editedOutput: "새로운 입력" };
  assert.equal(writeDraft(storage, changed, null).kind, "conflict");
  assert.equal(readDraft(storage, draft).draft.editedOutput, draft.editedOutput);
  const second = writeDraft(storage, changed, first.raw);
  assert.equal(second.kind, "saved");
  assert.equal(writeDraft(storage, draft, first.raw).kind, "conflict");
  deleteDraft(storage, draft);
  assert.equal(writeDraft(storage, changed, second.raw).kind, "conflict");
  assert.equal(readDraft(storage, draft).raw, null);
});

test("a new template version has an independent record and does not read or migrate the old one", () => {
  const storage = memoryStorage();
  setSavingEnabled(storage, true);
  const previous = makeDraft();
  const next = createDraft(parsePromptTemplate({ ...syntheticWizard, version: "2.0.0" }));
  assert.match(draftKey(previous), /TEST-WIZARD@1\.0\.0$/);
  writeDraft(storage, previous, null);
  assert.equal(readDraft(storage, next).draft, null);
  writeDraft(storage, next, null);
  assert.deepEqual(readDraft(storage, previous).draft, previous);
  assert.equal(readDraft(storage, next).draft.generatedOutput, null);
  assert.deepEqual(readDraft(storage, next).draft.fieldValues, {});
});

test("corrupt, unsupported, and identity-mismatched records are retained until the user deletes them", () => {
  const storage = memoryStorage();
  const draft = makeDraft();
  assert.equal(parseDraft("not JSON"), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, schemaVersion: 2 })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, fieldValues: { count: 3 } })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, completedStepIds: [42] })), null);
  assert.deepEqual(parseDraft(JSON.stringify({ ...draft, completedStepIds: undefined })).completedStepIds, []);
  assert.equal(parseDraft(JSON.stringify({ ...draft, updatedAt: "bad-date" })), null);
  storage.setItem(draftKey(draft), JSON.stringify(makeDraft("2.0.0")));
  assert.equal(readDraft(storage, draft).draft, null);
  assert.equal(readDrafts(storage).unreadable, 1);
  setSavingEnabled(storage, true);
  assert.equal(writeDraft(storage, draft, null).kind, "conflict");
});

test("individual and bulk deletion affect only app drafts and preserve the preference and unrelated data", () => {
  const storage = memoryStorage();
  const first = makeDraft();
  const second = makeDraft("2.0.0");
  storage.setItem("other-app:draft:one", "keep");
  setSavingEnabled(storage, true);
  writeDraft(storage, first, null);
  writeDraft(storage, second, null);
  deleteDraft(storage, first);
  assert.equal(readDraft(storage, first).raw, null);
  assert.ok(readDraft(storage, second).draft);
  deleteAllDrafts(storage);
  assert.equal(readDrafts(storage).drafts.length, 0);
  assert.equal(storage.getItem(savePreferenceKey), "true");
  assert.equal(storage.getItem("other-app:draft:one"), "keep");
});

test("write failure does not alter the memory draft or replace a previously stored record", () => {
  const storage = memoryStorage();
  setSavingEnabled(storage, true);
  const draft = makeDraft();
  const first = writeDraft(storage, draft, null);
  const next = { ...draft, editedOutput: "저장되지 못한 메모리 입력" };
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => writeDraft(storage, next, first.raw), /QuotaExceededError/);
  assert.equal(currentOutput(next), "저장되지 못한 메모리 입력");
  assert.equal(readDraft(storage, draft).draft.editedOutput, "편집한 합성 글");
});
