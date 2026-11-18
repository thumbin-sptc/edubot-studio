import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCreateContent } from "../src/lib/create/content.ts";
import { guideAssetPaths } from "../src/lib/create/model.ts";
import { syntheticGuides, syntheticIllustratedGuide, syntheticTextGuide, writeCreateFixtures, writeFixture } from "./fixtures/synthetic-create.mjs";

function testRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "edubot-create-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("an empty creation catalog is valid and exposes no combination", (t) => {
  assert.deepEqual(inspectCreateContent(testRoot(t)), { entries: [], materials: [], errors: [] });
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
    assert.ok(entry.steps.every(({ format, media }) => format === "media" && media.path && media.fallbackText));
    assert.equal(entry.resources.length, 3);
    assert.equal(entry.checks.length, 3);
  }
});

test("media cannot publish a guide without a hands-on login verification record", (t) => {
  const root = testRoot(t);
  const [guide] = syntheticGuides();
  delete guide.verification;
  writeCreateFixtures(root, [guide]);
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(entries, []);
  assert.match(errors.join("\n"), /hands-on verification/);
});

test("approved text-only stages have ordered instructions and only approved download assets", (t) => {
  const root = testRoot(t);
  const guide = syntheticTextGuide();
  writeCreateFixtures(root, [guide]);
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 1);
  for (const [index, step] of entries[0].steps.entries()) {
    assert.equal(step.format, "text-only");
    assert.deepEqual(step.instructions, guide.steps[index].instructions);
    assert.ok(!Object.hasOwn(step, "media"));
    assert.ok(step.actions.length && step.checkLabel);
  }
  assert.deepEqual(guideAssetPaths(entries[0]), ["/downloads/qa-common.txt", "/downloads/qa-context.txt", "/downloads/qa-optional.txt"]);
  assert.deepEqual(entries[0].resources.map(({ originalFilename }) => originalFilename),
    ["가상 공통 자료 (검수).txt", "qa-context.txt", "qa-optional.txt"]);
  assert.ok(!JSON.stringify(entries).includes("QA-SYNTHETIC-APPROVAL"));
});

test("illustrated publication requires verified, private-data-reviewed stills and separate external AI rights", (t) => {
  const valid = testRoot(t);
  const { guide, assets } = syntheticIllustratedGuide();
  writeCreateFixtures(valid, [guide], assets);
  const parsed = inspectCreateContent(valid);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(guideAssetPaths(parsed.entries[0]).filter((path) => path.startsWith("/tutorials/")), Object.keys(assets));
  const cases = [
    [(entry) => { delete entry.steps[0].example; }, /Every illustrated step/],
    [(entry) => { delete entry.illustratedJourney.completionExample; }, /Invalid screen example/],
    [(entry) => { entry.illustratedJourney.completionExample.privacyChecked = false; }, /privacy review/],
    [(entry) => { entry.steps[0].example.source = "mockup"; }, /hands-on capture/],
    [(entry) => { entry.steps[0].example.sha256 = "x"; }, /hash mismatch/],
    [(entry) => { entry.steps[0].example.alt = "TODO"; }, /Incomplete screen example alt/],
    [(entry) => { entry.steps[0].example.captureId = entry.steps[1].example.captureId; }, /Duplicate screen capture IDs/],
    [(entry) => { entry.steps[0].example.verifiedAt = "2025-01-02"; }, /postdate guide verification/],
    [(entry) => { entry.illustratedJourney.requiredIds = ["test-optional"]; }, /approved common files/],
    [(entry) => { delete entry.verification.completionChecked; }, /hands-on completion checks/],
  ];
  for (const [mutate, message] of cases) {
    const fresh = syntheticIllustratedGuide();
    mutate(fresh.guide);
    const root = testRoot(t);
    writeCreateFixtures(root, [fresh.guide], fresh.assets);
    const result = inspectCreateContent(root);
    assert.equal(result.entries.length, 0);
    assert.match(result.errors.join("\n"), message);
  }
  for (const path of ["content/instructions/test-core.json", "content/knowledge/test-common.json"]) {
    const root = testRoot(t);
    writeCreateFixtures(root, [guide], assets);
    const raw = JSON.parse(readFileSync(join(root, path), "utf8"));
    writeFixture(root, path, { ...raw, externalAiUse: ["claude"] });
    const result = inspectCreateContent(root);
    assert.equal(result.entries.length, 0);
    assert.match(result.errors.join("\n"), /separate external AI use rights/);
  }
});

test("filename metadata cannot loosen the ASCII asset path or create ambiguous ZIP entries", (t) => {
  for (const [name, field, expected] of [
    ["test-common", { originalFilename: null }, /Invalid originalFilename/],
    ["test-common", { originalFilename: "CON (자료)/가는.txt" }, /Invalid originalFilename/],
    ["test-common", { originalFilename: "대체 파일.pdf" }, /filename extension mismatch/],
    ["test-common", { path: "/downloads/가상 공통 자료 (검수).txt" }, /Invalid downloads asset path/],
    ["test-common", { path: "/downloads/%2e%2e/qa-common.txt" }, /Invalid downloads asset path/],
    ["test-context", { originalFilename: "가상 공통 자료 (검수).TXT".normalize("NFD") }, /Invalid or duplicate knowledge filenames/],
    ["test-common", { originalFilename: "QA-CONTEXT.TXT" }, /Invalid or duplicate knowledge filenames/],
  ]) {
    const root = testRoot(t);
    writeCreateFixtures(root, [syntheticTextGuide()]);
    const path = `content/knowledge/${name}.json`;
    const raw = JSON.parse(readFileSync(join(root, path), "utf8"));
    writeFixture(root, path, { ...raw, ...field });
    const { entries, errors } = inspectCreateContent(root);
    assert.equal(entries.length, 0);
    assert.match(errors.join("\n"), expected);
  }
});

test("text-only stages reject missing, incomplete, ambiguous or wrongly typed content", (t) => {
  const cases = [
    [(step) => { delete step.format; }, /Invalid approved demonstration media/],
    [(step) => { step.format = "text"; }, /Unknown step format/],
    [(step) => { step.format = "media"; }, /Invalid approved demonstration media/],
    [(step) => { step.media = null; }, /must not declare media/],
    [(step) => { delete step.description; }, /text-only step description/],
    [(step) => { step.title = "TODO."; }, /Incomplete text-only step title/],
    [(step) => { step.checkLabel = " "; }, /text-only self-check label/],
    [(step) => { step.actions = []; }, /requires an action/],
    [(step) => { delete step.instructions; }, /Invalid text-only instructions/],
    [(step) => { step.instructions = "설명만 한 줄"; }, /Invalid text-only instructions/],
    [(step) => { step.instructions = ["화면을 열어 확인합니다."]; }, /at least two ordered instructions/],
    [(step) => { step.instructions[0] = ""; }, /Missing text-only instruction/],
    [(step) => { step.instructions[0] = "검증 대기"; }, /Incomplete text-only instruction/],
    [(step) => { step.instructions = ["합성 문장", " 합성   문장 "]; }, /Duplicate text-only instructions/],
  ];
  for (const [change, expected] of cases) {
    const root = testRoot(t);
    const guide = syntheticTextGuide();
    change(guide.steps[0]);
    writeCreateFixtures(root, [guide]);
    const result = inspectCreateContent(root);
    assert.equal(result.entries.length, 0);
    assert.match(result.errors.join("\n"), expected);
  }
});

test("text-only publication requires hands-on coverage and a separate release decision", (t) => {
  const cases = [
    [(guide) => { delete guide.verification; }, /hands-on verification/],
    [(guide) => { guide.verification.method = "documentation"; }, /hands-on verification/],
    [(guide) => { guide.verification.stepIds.pop(); }, /cover every step/],
    [(guide) => { guide.verification.stepIds[1] = guide.verification.stepIds[0]; }, /Duplicate verified step IDs/],
    [(guide) => { guide.verification.stepIds[1] = "wrong"; }, /cover every step/],
    [(guide) => { delete guide.publicationApproval; }, /Invalid publication approval/],
    [(guide) => { guide.publicationApproval.releaseApproved = false; }, /separate release approval/],
    [(guide) => { guide.publicationApproval.approvedAt = "2024-12-31"; }, /predates hands-on verification/],
    [(guide) => { guide.publicationApproval.approvedAt = "2025-02-30"; }, /approvedAt/],
    [(guide) => { delete guide.verifiedAt; }, /verifiedAt/],
    [(guide) => { guide.knowledgeIds = ["test-optional"]; }, /approved common knowledge/],
  ];
  for (const [change, expected] of cases) {
    const root = testRoot(t);
    const guide = syntheticTextGuide();
    change(guide);
    writeCreateFixtures(root, [guide]);
    const result = inspectCreateContent(root);
    assert.equal(result.entries.length, 0);
    assert.match(result.errors.join("\n"), expected);
  }
});

test("legacy video and explicit media stages preserve captions in a mixed guide", (t) => {
  const root = testRoot(t);
  const [legacy] = syntheticGuides();
  const media = { ...legacy.steps[0].media, kind: "video", path: "/tutorials/qa-video.webm", captionsPath: "/tutorials/qa-video.vtt" };
  legacy.steps[0].media = media;
  const mixed = syntheticTextGuide({ ...syntheticGuides()[2] });
  mixed.steps[0] = { ...syntheticGuides()[2].steps[0], format: "media", media };
  writeCreateFixtures(root, [legacy, mixed], {
    "/tutorials/qa-video.webm": Buffer.from("synthetic unit fixture with video suffix"),
    "/tutorials/qa-video.vtt": Buffer.from("WEBVTT\n"),
  });
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    const { format, media } = entry.steps[0];
    assert.equal(format, "media");
    assert.equal(media.kind, "video");
    assert.equal(media.captionsPath, "/tutorials/qa-video.vtt");
    assert.ok(guideAssetPaths(entry).includes(media.path));
  }
});

test("draft and reviewed text-only guides cannot leak instructions or unapproved assets into a static export", (t) => {
  const root = testRoot(t);
  const guide = syntheticTextGuide();
  writeCreateFixtures(root, [guide]);
  const marker = "CODEX-19-PRIVATE-INSTRUCTIONS";
  const privateName = "CODEX-23 가상 비공개 자료 (초안).txt";
  const privateScreen = "QA32-PRIVATE-EXAMPLE-FOCUS";
  writeFixture(root, "content/knowledge/private-test.json", {
    id: "private-test", publicationStatus: "reviewed", originalFilename: privateName, path: "/downloads/private-test.txt",
  });
  for (const [index, publicationStatus] of ["draft", "reviewed"].entries()) {
    const { id, steps, platform, device } = syntheticTextGuide(syntheticGuides()[index + 2]);
    steps[0].instructions = [marker];
    const illustratedJourney = { completionExample: { focusText: privateScreen } };
    writeFixture(root, `content/create/${id}.json`, { id, publicationStatus, steps, platform, device, illustratedJourney });
  }
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(entries.map(({ id }) => id), [guide.id]);
  const exportCheck = () => spawnSync(process.execPath, [
    fileURLToPath(new URL("../scripts/check-public-build.mjs", import.meta.url)),
  ], { cwd: root, encoding: "utf8" });
  writeFixture(root, "out/404.html", Buffer.from("<p>404</p>"));
  for (const route of ["", "prompts/", "create/", "data/", "help/", "create/chatgpt/desktop-web/"]) {
    for (const name of ["index.html", "index.txt", "__next._full.txt", "__next._tree.txt"]) {
      writeFixture(root, `out/${route}${name}`, Buffer.from("<p>synthetic route</p>"));
    }
  }
  for (const path of guideAssetPaths(entries[0])) writeFixture(root, "out" + path, readFileSync(join(root, "public" + path)));
  const wordmark = readFileSync(new URL("../src/assets/brand/wordmark.svg", import.meta.url));
  const brandPath = "out/_next/static/media/wordmark.0123az-_x.svg";
  writeFixture(root, brandPath, wordmark);
  const passed = exportCheck();
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /1 public guides/);
  writeFixture(root, brandPath, Buffer.from("<svg></svg>"));
  const wrongBrand = exportCheck();
  assert.equal(wrongBrand.status, 1);
  assert.match(wrongBrand.stderr, /Exported brand asset differs/);
  writeFixture(root, brandPath, wordmark);
  for (const path of ["create/index.html", "create/__next._full.txt", "_next/static/chunks/guide.js"]) {
    for (const secret of [marker, privateName, "/downloads/private-test.txt", privateScreen]) {
      writeFixture(root, "out/" + path, Buffer.from(secret));
      const leaked = exportCheck();
      assert.equal(leaked.status, 1);
      assert.match(leaked.stderr, /Unpublished content found/);
    }
    writeFixture(root, "out/" + path, Buffer.from("synthetic route"));
  }
  writeFixture(root, "out/downloads/draft.txt", Buffer.from("synthetic private file"));
  const unexpected = exportCheck();
  assert.equal(unexpected.status, 1);
  assert.match(unexpected.stderr, /Unexpected file in Pages export/);
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
    ["knowledge/test-common", { sha256: "a".repeat(64) }, /Knowledge file hash mismatch/],
    ["knowledge/test-common", { publicationStatus: "draft" }, /unapproved or missing knowledge/],
  ];
  for (const [name, change, expected] of cases) {
    const root = testRoot(t);
    writeCreateFixtures(root, [syntheticTextGuide()]);
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
