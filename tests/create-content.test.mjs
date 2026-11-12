import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectCreateContent } from "../src/lib/create/content.ts";
import { syntheticGuides, writeCreateFixtures, writeFixture } from "./fixtures/synthetic-create.mjs";

function testRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "edubot-create-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("an empty creation catalog is valid and exposes no combination", (t) => {
  assert.deepEqual(inspectCreateContent(testRoot(t)), { entries: [], errors: [] });
});

test("all six combinations have independent step sequences and approved assets", (t) => {
  const root = testRoot(t);
  const guides = syntheticGuides();
  writeCreateFixtures(root, guides);
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 6);
  assert.equal(new Set(entries.map((entry) => entry.steps.map(({ id }) => id).join(","))).size, 6);
  for (const entry of entries) {
    assert.deepEqual(entry.steps.map(({ id }) => id), guides.find(({ id }) => id === entry.id).steps.map(({ id }) => id));
    assert.ok(entry.steps.every(({ media }) => media.path && media.fallbackText));
    assert.equal(entry.resources.length, 3);
    assert.equal(entry.checks.length, 3);
  }
});

test("draft and reviewed guides are excluded before parsing and verified unsupported entries remain status-only", (t) => {
  const root = testRoot(t);
  const guides = syntheticGuides();
  const [published, reviewed, draft, unsupported] = guides;
  writeCreateFixtures(root, [
    published,
    { ...reviewed, publicationStatus: "reviewed", steps: null, reason: "SECRET_REVIEWED" },
    { ...draft, publicationStatus: "draft", steps: null, reason: "SECRET_DRAFT" },
    { ...unsupported, support: "unsupported", steps: [], reason: "검수된 합성 지원 상태" },
  ]);
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(entries.map(({ id }) => id).sort(), [published.id, unsupported.id].sort());
  const status = entries.find(({ support }) => support === "unsupported");
  assert.ok(!Object.hasOwn(status, "steps"));
  assert.ok(!JSON.stringify(entries).includes("SECRET_"));
});

test("media, text fallback, assets and verified safe links are required for publication", (t) => {
  const cases = [
    [(entry) => { delete entry.steps[0].media; }, /Missing|Invalid approved demonstration/],
    [(entry) => { entry.steps[0].media.fallbackText = ""; }, /text alternative/],
    [(entry) => { entry.steps[0].media.path = "/tutorials/does-not-exist.gif"; }, /ENOENT/],
    [(entry) => { entry.steps[0].media.path = "/tutorials/../downloads/file.gif"; }, /Invalid tutorials asset path/],
    [(entry) => { entry.steps[0].media.licenseStatus = "pending"; }, /Missing rights approval/],
    [(entry) => { entry.steps[0].actions[0].url = "javascript:alert(1)"; }, /Unsafe external URL/],
    [(entry) => { delete entry.steps[0].actions[0].verifiedAt; }, /verifiedAt/],
    [(entry) => { entry.verifiedAt = "2025-02-30"; }, /Invalid verification date/],
    [(entry) => { entry.checks[0].stepId = "absent"; }, /Unknown completion check step/],
  ];
  for (const [mutate, expected] of cases) {
    const root = testRoot(t);
    const [guide] = syntheticGuides();
    mutate(guide);
    writeCreateFixtures(root, [guide]);
    const { entries, errors } = inspectCreateContent(root);
    assert.equal(entries.length, 0);
    assert.match(errors.join("\n"), expected);
  }
});

test("rights, exact source hash and approved knowledge membership are enforced", (t) => {
  const cases = [
    ["instructions/test-core", { sha256: "bad" }, /Instruction hash mismatch/],
    ["instructions/test-core", { publicationStatus: "reviewed" }, /requires an approved instruction/],
    ["knowledge/test-common", { licenseStatus: "pending" }, /Missing rights approval/],
    ["knowledge/test-common", { fileSize: 1 }, /Knowledge file size mismatch/],
    ["knowledge/test-common", { publicationStatus: "draft" }, /unapproved or missing knowledge/],
  ];
  for (const [name, change, expected] of cases) {
    const root = testRoot(t);
    writeCreateFixtures(root, [syntheticGuides()[0]]);
    const path = `content/${name}.json`;
    const raw = JSON.parse(readFileSync(join(root, path), "utf8"));
    writeFixture(root, path, { ...raw, ...change });
    const { entries, errors } = inspectCreateContent(root);
    assert.equal(entries.length, 0);
    assert.match(errors.join("\n"), expected);
  }
});

test("duplicate published combinations and unreferenced public assets are rejected", (t) => {
  const root = testRoot(t);
  const [guide, other] = syntheticGuides();
  writeCreateFixtures(root, [guide, { ...guide, id: "duplicate" }, other]);
  writeFixture(root, "public/downloads/orphan.txt", Buffer.from("SYNTHETIC UNAPPROVED ASSET"));
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(entries.map(({ id }) => id), [other.id]);
  assert.match(errors.join("\n"), /Duplicate published combination/);
  assert.ok(errors.includes("Unapproved public asset: /downloads/orphan.txt"));
});
