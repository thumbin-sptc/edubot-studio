import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSelectedBundle, composeInstruction, getCompletionChecks, guideRevision, isSelected } from "../src/lib/create/engine.ts";
import {
  createStorageKey, deleteCreateData, getCreateProgress, hasPreviousProgress, newCreateSession,
  parseCreateSession, readCreateRecord, updateCreateProgress, writeCreateRecord,
} from "../src/lib/create/session.ts";
import { savePreferenceKey, setSavingEnabled } from "../src/lib/save-preference.ts";
import { core } from "./fixtures/synthetic-create.mjs";

const guide = {
  id: "test-guide", platform: "chatgpt", device: "desktop-web", version: "1.0.0",
  instruction: { id: "test-core", version: "1.0.0", sha256: "a".repeat(64), coreInstruction: core },
  steps: [{ id: "intro" }, { id: "files" }],
};
const common = { id: "common", category: "common", path: "/downloads/qa-common.txt" };
const contextual = {
  id: "contextual", category: "optional", path: "/downloads/qa-context.txt",
  recommendedFor: { schoolLevels: ["초등학교"], environments: ["특수학급"] },
};
const optional = { id: "optional", category: "optional", path: "/downloads/qa-optional.txt" };
const matching = { schoolLevel: "초등학교", environment: "특수학급" };

function memoryStorage() {
  const entries = new Map();
  return {
    get length() { return entries.size; },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test("personalization preserves the exact original and appends only declared nonempty fields in order", () => {
  assert.equal(composeInstruction(core, {}), core);
  assert.equal(composeInstruction(core, { educationFocus: "  " }), core);
  const input = { extraRequests: "합성 요청", educationFocus: "  가상 방향 ", schoolLevel: "초등학교", undeclared: "ignore" };
  assert.equal(composeInstruction(core, input), core + "\n\n[개인화 설정]\n학교급: 초등학교\n중요하게 생각하는 교육 방향: 가상 방향\n추가 요청: 합성 요청");
  assert.equal(composeInstruction(core, input), composeInstruction(core, input));
});

test("role and knowledge checks are always available and personalization checks require personalization", () => {
  const checks = ["role", "knowledge", "personalization"].map((kind) => ({ kind }));
  assert.deepEqual(getCompletionChecks(checks, {}).map(({ kind }) => kind), ["role", "knowledge"]);
  assert.equal(getCompletionChecks(checks, { extraRequests: "가상 요청" }).length, 3);
});

test("common, conditional and manual knowledge selections are independent", () => {
  assert.equal(isSelected(common, {}, {}), true);
  assert.equal(isSelected(contextual, {}, {}), false);
  assert.equal(isSelected(contextual, { schoolLevel: "초등학교" }, {}), false);
  assert.equal(isSelected(contextual, matching, {}), true);
  assert.equal(isSelected(optional, matching, {}), false);
  assert.equal(isSelected(contextual, matching, { contextual: false }), false);
  assert.equal(isSelected(common, matching, { common: false }), false);
  assert.equal(isSelected(optional, {}, { optional: true }), true);
});

test("ZIP boundary supplies only selected approved files and exposes individual links on failure", async () => {
  const resources = [common, contextual, optional];
  const loaded = [];
  const load = async (path) => { loaded.push(path); return new Blob(["synthetic file"]); };
  const zip = async (files) => {
    assert.deepEqual(files.map(({ name }) => name), ["qa-context.txt", "qa-optional.txt"]);
    return new Blob(["synthetic ZIP adapter output"], { type: "application/zip" });
  };
  const success = await buildSelectedBundle(resources, matching, { common: false, optional: true }, load, zip);
  assert.equal(success.kind, "ready");
  assert.deepEqual(loaded, [contextual.path, optional.path]);
  const failure = await buildSelectedBundle(resources, matching, {}, load, async () => { throw new Error("fixture failure"); });
  assert.deepEqual(failure, { kind: "failed", alternatives: [common, contextual] });
  assert.deepEqual(await buildSelectedBundle(resources, {}, { common: false }, load, zip), { kind: "empty" });
});

test("steps can advance without checking, and progress is independent by combination and version", () => {
  const input = { ...newCreateSession(), personalization: matching };
  const next = updateCreateProgress(input, guide, { stepId: "files", checked: [], selections: {} });
  assert.equal(getCreateProgress(next, guide).stepId, "files");
  assert.deepEqual(getCreateProgress(next, guide).checked, []);
  const differentPlatform = { ...guide, platform: "gemini" };
  assert.equal(getCreateProgress(next, differentPlatform).stepId, "intro");
  assert.equal(hasPreviousProgress(next, differentPlatform), false);
  for (const revision of [
    { ...guide, version: "2.0.0" },
    { ...guide, instruction: { ...guide.instruction, sha256: "b".repeat(64) } },
  ]) {
    assert.notEqual(guideRevision(revision), guideRevision(guide));
    assert.equal(getCreateProgress(next, revision).stepId, "intro");
    assert.equal(hasPreviousProgress(next, revision), true);
    const started = updateCreateProgress(next, revision, getCreateProgress(next, revision));
    assert.equal(getCreateProgress(started, guide).stepId, "files");
    assert.deepEqual(started.personalization, matching);
  }
});

test("opt-in creation storage retains prior data while OFF and protects conflicting revisions", () => {
  const storage = memoryStorage();
  const original = { ...newCreateSession(), personalization: matching };
  const newer = { ...original, personalization: { extraRequests: "합성 요청" } };
  assert.equal(writeCreateRecord(storage, original, null).kind, "disabled");
  assert.equal(readCreateRecord(storage).raw, null);
  setSavingEnabled(storage, true);
  const first = writeCreateRecord(storage, original, null);
  assert.equal(first.kind, "saved");
  assert.deepEqual(readCreateRecord(storage).session.personalization, matching);
  setSavingEnabled(storage, false);
  assert.equal(writeCreateRecord(storage, newer, first.raw).kind, "disabled");
  assert.equal(readCreateRecord(storage).raw, first.raw);
  setSavingEnabled(storage, true);
  assert.equal(writeCreateRecord(storage, newer, null).kind, "conflict");
  assert.equal(readCreateRecord(storage).raw, first.raw);
  const second = writeCreateRecord(storage, newer, first.raw);
  assert.equal(second.kind, "saved");
  assert.equal(writeCreateRecord(storage, original, first.raw).kind, "conflict");
  storage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => writeCreateRecord(storage, original, second.raw), /quota/);
  assert.equal(original.personalization.environment, "특수학급");
  assert.equal(readCreateRecord(storage).raw, second.raw);
});

test("creation storage parser rejects corrupt state and a round trip keeps revision-specific progress", () => {
  const session = updateCreateProgress(newCreateSession(), guide, { stepId: null, checked: ["intro"], selections: { common: false } });
  assert.deepEqual(parseCreateSession(JSON.stringify(session)).progress, session.progress);
  assert.equal(parseCreateSession("corrupt"), null);
  assert.equal(parseCreateSession(JSON.stringify({ ...session, schemaVersion: 2 })), null);
  assert.equal(parseCreateSession(JSON.stringify({ ...session, personalization: { schoolLevel: "invalid" } })), null);
  assert.equal(parseCreateSession(JSON.stringify({ ...session, progress: { old: {} } })), null);
});

test("creation-only deletion preserves prompt drafts, and global deletion preserves preferences and foreign keys", () => {
  const storage = memoryStorage();
  const prompt = "edubot-studio:draft:TEST@1.0.0";
  setSavingEnabled(storage, true);
  storage.setItem(prompt, "synthetic prompt draft");
  storage.setItem("other-app:keep", "untouched");
  writeCreateRecord(storage, newCreateSession(), null);
  assert.equal(deleteCreateData(storage), true);
  assert.equal(storage.getItem(createStorageKey), null);
  assert.equal(storage.getItem(prompt), "synthetic prompt draft");
  writeCreateRecord(storage, newCreateSession(), null);
  assert.equal(deleteCreateData(storage, true), true);
  assert.equal(storage.getItem(createStorageKey), null);
  assert.equal(storage.getItem(prompt), null);
  assert.equal(storage.getItem(savePreferenceKey), "true");
  assert.equal(storage.getItem("other-app:keep"), "untouched");
});
