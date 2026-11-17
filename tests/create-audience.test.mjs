import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { buildAudienceBundle, resolveAudience } from "../src/lib/create/audience.ts";
import { createKnowledgeZip } from "../src/lib/create/zip-client.ts";
import { getCreateProgress, hasPreviousProgress, newCreateSession, parseCreateSession, updateCreateProgress } from "../src/lib/create/session.ts";

const selection = {
  sourceFamily: "GPTs", schoolLevel: "초등학교", environment: "특수학급", platform: "chatgpt", device: "desktop-web",
};
const file = (id) => ({
  id, sha256: "a".repeat(64), category: "common", path: `/downloads/${id}.txt`, originalFilename: `${id}.txt`, fileSize: 7,
});
const base = file("synthetic-required");
const optional = file("synthetic-recommended");
const unrelated = file("synthetic-unrelated");
const selectable = file("synthetic-selectable");
const instruction = { id: "synthetic-instruction", version: "1.0.0", sha256: "b".repeat(64) };
const guide = {
  platform: "chatgpt", device: "desktop-web", instruction: { ...instruction, coreInstruction: "합성 원문" },
  resources: [base, optional, unrelated], support: "supported",
};
const exact = ({ id, sha256 }) => ({ status: "exact", assets: [{ id, sha256 }] });
const required = { id: "ref-required", label: "가상 필수", applicability: "required", match: exact(base) };
const recommended = { id: "ref-recommended", label: "가상 권장", applicability: "recommended", match: exact(optional) };
const target = {
  platform: "chatgpt", device: "desktop-web", compatibility: "verified", review: "approved",
  handsOn: "verified", redistribution: "confirmed",
  references: [required, recommended],
};
const scope = { schoolLevel: "초등학교", environment: "특수학급", status: "verified" };
const candidate = { sourceFamily: "GPTs", instruction, classification: "candidate", coverage: [scope], targets: [target] };
const withReferences = (...references) => [{ ...candidate, targets: [{ ...target, references }] }];

test("audience, source family and explicit supported target must all match", () => {
  const result = resolveAudience([candidate], selection, guide);
  assert.equal(result.kind, "ready");
  assert.deepEqual(result.required, [base]);
  assert.deepEqual(result.recommended, [optional]);
  for (const change of [
    { schoolLevel: "전공과" }, { environment: "특수학교" }, { sourceFamily: "GEMS" },
    { platform: "claude" }, { device: "mobile-web" },
  ]) assert.deepEqual(resolveAudience([candidate], { ...selection, ...change }, guide), { kind: "unavailable" });
  const archive = { ...candidate, classification: "archive" };
  assert.equal(resolveAudience([archive], selection, guide).kind, "unavailable");
  assert.equal(resolveAudience([archive, candidate], selection, guide).kind, "ready");
});

test("a wizard receives the exact source and only files connected to its selected scope", async () => {
  const core = "합성 원문  \r\n두 번째 줄\r\n";
  const currentGuide = { ...guide, instruction: { ...instruction, coreInstruction: core },
    resources: [...guide.resources, selectable], id: "fixture-guide", version: "1.0.0", steps: [{ id: "intro" }] };
  const choice = { id: "ref-selectable", label: "가상 선택", applicability: "optional", match: exact(selectable) };
  const catalog = withReferences(required, recommended, choice, { ...choice, id: "ref-optional-repeat", match: exact(optional) });
  const result = resolveAudience(catalog, selection, currentGuide);
  assert.equal(result.kind, "ready");
  assert.equal(result.journey.guide.instruction.coreInstruction, core);
  assert.deepEqual(result.journey.guide.resources, [base, optional, selectable]);
  assert.deepEqual(result.journey.requiredIds, [base.id]);
  assert.deepEqual(result.journey.recommendedIds, [optional.id]);
  assert.deepEqual(result.optional, [selectable]);
  const archive = await buildAudienceBundle(catalog, selection, currentGuide, [selectable.id],
    async (path) => new Blob([path]), createKnowledgeZip);
  assert.equal(archive.kind, "ready");
  assert.deepEqual(Object.keys(unzipSync(new Uint8Array(await archive.zip.arrayBuffer()))),
    [base.originalFilename, selectable.originalFilename]);
  const blocked = resolveAudience(catalog, selection, { ...currentGuide, instruction: { ...instruction, version: "2.0.0" } });
  assert.equal(blocked.kind, "blocked");
  assert.ok(!Object.hasOwn(blocked, "journey"));
});

test("wizard progress and optional personalization resume only in the same audience and revision", () => {
  const currentGuide = { ...guide, id: "fixture-guide", version: "1.0.0", steps: [{ id: "intro" }, { id: "files" }] };
  const catalog = [{ ...candidate, coverage: [scope, { ...scope, schoolLevel: "고등학교" }] }];
  const first = resolveAudience(catalog, selection, currentGuide).journey;
  const second = resolveAudience(catalog, { ...selection, schoolLevel: "고등학교" }, currentGuide).journey;
  assert.notEqual(first.scope, second.scope);
  const progress = { stepId: "files", checked: ["intro"], selections: { [optional.id]: false },
    personalization: { classDescription: "가상 학급" } };
  const state = updateCreateProgress(newCreateSession(), first.guide, progress, first.scope);
  const restored = parseCreateSession(JSON.stringify(state));
  assert.deepEqual(getCreateProgress(restored, first.guide, first.scope), progress);
  assert.deepEqual(getCreateProgress(restored, second.guide, second.scope), { stepId: "intro", checked: [], selections: {} });
  assert.equal(hasPreviousProgress(restored, second.guide, second.scope), false);
  assert.equal(hasPreviousProgress(restored, { ...first.guide, version: "1.0.1" }, first.scope), true);
  assert.deepEqual(getCreateProgress(restored, currentGuide), { stepId: "intro", checked: [], selections: {} });
});

test("overlapping editions and duplicate scope or target records fail closed", () => {
  const other = { ...candidate, instruction: { ...instruction, version: "2.0.0" } };
  for (const catalog of [
    [candidate, other], [{ ...candidate, coverage: [scope, scope] }], [{ ...candidate, targets: [target, target] }],
  ]) assert.deepEqual(resolveAudience(catalog, selection, guide), { kind: "conflict" });
});

test("verification and the exact approved instruction revision are both required", () => {
  const unknownScope = [{ ...candidate, coverage: [{ ...scope, status: "unverified" }] }];
  assert.deepEqual(resolveAudience(unknownScope, selection, guide).pendingChecks, ["scope"]);
  const unsupported = [{ ...candidate, targets: [{ ...target, compatibility: "unsupported" }] }];
  assert.deepEqual(resolveAudience(unsupported, selection, guide), { kind: "unsupported" });
  const untested = [{ ...candidate, targets: [{ ...target, compatibility: "unsupported", handsOn: "unverified" }] }];
  assert.deepEqual(resolveAudience(untested, selection, guide).pendingChecks, ["compatibility", "hands-on"]);
  for (const invalid of [
    undefined, { ...guide, platform: "gemini" }, { ...guide, device: "mobile-web" },
    { ...guide, instruction: { ...guide.instruction, id: "other" } },
    { ...guide, instruction: { ...guide.instruction, version: "2.0.0" } },
    { ...guide, instruction: { ...guide.instruction, sha256: "f".repeat(64) } },
  ]) {
    const result = resolveAudience([candidate], selection, invalid);
    assert.equal(result.kind, "blocked");
    assert.deepEqual(result.pendingChecks, ["guide"]);
    assert.equal(result.references[0].status, "unapproved");
    assert.equal("required" in result, false);
    assert.equal("coreInstruction" in result.instruction, false);
  }
  const candidateWithText = { ...candidate, instruction: guide.instruction };
  const unpublished = resolveAudience([candidateWithText], selection);
  assert.deepEqual(unpublished.instruction, instruction);
});

test("platform, operation checks, rights and release approval are independent ZIP requirements", async () => {
  for (const [change, pending] of [
    [{ compatibility: "unverified" }, "compatibility"],
    [{ handsOn: "unverified" }, "hands-on"],
    [{ redistribution: "unverified" }, "rights"],
    [{ review: "pending" }, "release"],
  ]) {
    const catalog = [{ ...candidate, targets: [{ ...target, ...change }] }];
    const result = resolveAudience(catalog, selection, guide);
    assert.equal(result.kind, "blocked");
    assert.deepEqual(result.pendingChecks, [pending]);
    assert.equal("required" in result, false);
    assert.equal("recommended" in result, false);
    assert.deepEqual(await buildAudienceBundle(catalog, selection, guide, [],
      () => assert.fail("file loaded"), () => assert.fail("ZIP called")), { kind: "blocked" });
  }
});

test("missing, ambiguous or pending dependencies block release; explicitly inapplicable dependencies do not", () => {
  for (const status of ["missing", "ambiguous", "not-required"]) {
    const match = { status };
    for (const reference of [required, recommended]) {
      const result = resolveAudience(withReferences({ ...reference, match }), selection, guide);
      assert.equal(result.kind, "blocked");
      assert.equal(result.references[0].status, status === "not-required" ? "ambiguous" : status);
    }
  }
  const pending = resolveAudience(withReferences({ ...required, applicability: "scope-pending" }), selection, guide);
  assert.equal(pending.references[0].status, "scope-pending");
  assert.equal(pending.kind, "blocked");
  const excluded = { ...recommended, applicability: "out-of-scope", match: { status: "missing" } };
  const result = resolveAudience(withReferences(required, excluded), selection, guide);
  assert.equal(result.kind, "ready");
  assert.equal(result.references[1].status, "out-of-scope");
  assert.deepEqual(result.recommended, []);
});

test("file SHA mismatches block ZIP and aliases can bind multiple reviewed files", () => {
  const alias = { ...required, match: { status: "verified-alias", assets: [...exact(base).assets, ...exact(optional).assets] } };
  const catalog = withReferences(alias, recommended);
  const changed = { ...guide, resources: [base, { ...optional, sha256: "f".repeat(64) }] };
  assert.equal(resolveAudience(catalog, selection, changed).references[0].status, "unapproved");
  const result = resolveAudience(catalog, selection, guide);
  assert.equal(result.kind, "ready");
  assert.deepEqual(result.required, [base, optional]);
  assert.deepEqual(result.recommended, []);
});

test("ZIP always contains mandatory files and rejects forged IDs before file access", async () => {
  const loaded = [];
  const load = async (path) => {
    loaded.push(path);
    return new Blob(["fixture"]);
  };
  async function archiveNames(ids) {
    const result = await buildAudienceBundle([candidate], selection, guide, ids, load, createKnowledgeZip);
    assert.equal(result.kind, "ready");
    return Object.keys(unzipSync(new Uint8Array(await result.zip.arrayBuffer())));
  }
  assert.deepEqual(await archiveNames([optional.id, optional.id]), ["synthetic-required.txt", "synthetic-recommended.txt"]);
  assert.deepEqual(await archiveNames([]), ["synthetic-required.txt"]);
  assert.deepEqual(loaded, [base.path, optional.path, base.path]);
  loaded.length = 0;
  for (const [catalog, ids] of [
    [[candidate], [unrelated.id]], [[candidate], [base.id]],
    [withReferences({ ...required, match: { status: "missing" } }), []],
    [withReferences({ ...required, match: exact({ ...base, sha256: "f".repeat(64) }) }), []],
  ]) {
    assert.deepEqual(await buildAudienceBundle(catalog, selection, guide, ids, load, () => assert.fail("ZIP called")),
      { kind: "blocked" });
  }
  assert.deepEqual(loaded, []);
});
