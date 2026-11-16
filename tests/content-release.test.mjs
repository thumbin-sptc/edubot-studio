import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { brokenPublishedReferences, promptLinkWarnings, validatePrompt } from "../scripts/validate-content.mjs";
import { parsePublishedPrompt } from "../src/lib/prompt-publication.ts";
import { inspectCreateContent } from "../src/lib/create/content.ts";
import { hiddenPrompts, sourcePrompt, syntheticInventory, targetPrompt } from "./fixtures/synthetic-catalog.mjs";
import { syntheticSimple, syntheticWizard, withSyntheticPublication } from "./fixtures/synthetic-prompts.mjs";
import { syntheticGuides, writeCreateFixtures, writeFixture } from "./fixtures/synthetic-create.mjs";

test("unknown public references fail validation while unpublished known targets remain warnings", () => {
  const ids = new Set(syntheticInventory.items.map(({ id }) => id));
  const templates = [sourcePrompt, targetPrompt, ...hiddenPrompts];
  assert.deepEqual(brokenPublishedReferences(templates, ids), []);
  assert.ok(promptLinkWarnings(templates, syntheticInventory).some((warning) => warning.includes("QA-DRAFT")));
  const broken = [
    { ...sourcePrompt, relatedPromptIds: ["UNKNOWN-RELATED"] },
    { ...targetPrompt, previousResultImports: [{ fieldId: "details", sourcePromptIds: ["UNKNOWN-SOURCE"] }] },
  ];
  assert.deepEqual(brokenPublishedReferences(broken, ids), [
    "QA-SOURCE: unknown public link reference UNKNOWN-RELATED",
    "QA-TARGET: unknown public link reference UNKNOWN-SOURCE",
  ]);
});

test("invalid public source metadata is rejected, and unknown optional location can be omitted", () => {
  assert.deepEqual(validatePrompt(sourcePrompt), []);
  assert.ok(validatePrompt({ ...sourcePrompt, source: { pdfPage: "2" } }).some((error) => error.includes("pdfPage")));
  assert.ok(validatePrompt({ ...sourcePrompt, source: { bookPage: 0 } }).some((error) => error.includes("bookPage")));
  assert.ok(validatePrompt({ ...sourcePrompt, display: { category: " " } }).some((error) => error.includes("category")));
});

test("asset validation detects hash mismatches, unregistered public files and wrong publication states", (t) => {
  const root = mkdtempSync(join(tmpdir(), "edubot-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const [guide] = syntheticGuides();
  writeCreateFixtures(root, [guide]);
  const metadataPath = "content/knowledge/test-common.json";
  const original = JSON.parse(readFileSync(join(root, metadataPath), "utf8"));
  writeFixture(root, metadataPath, { ...original, sha256: "0".repeat(64) });
  writeFixture(root, "public/leak.txt", Buffer.from("synthetic unregistered file"));
  writeFixture(root, "content/create/invalid-state.json", { id: "invalid-state", publicationStatus: "public" });
  const { entries, errors } = inspectCreateContent(root);
  assert.deepEqual(entries, []);
  assert.ok(errors.some((error) => error.includes("Knowledge file hash mismatch")));
  assert.ok(errors.some((error) => error.includes("Unapproved public asset: /leak.txt")));
  assert.ok(errors.some((error) => error.includes("Invalid publicationStatus")));
});

test("flipping a prompt to published requires recorded approval in both CI and the loader", () => {
  const unapproved = { ...sourcePrompt };
  delete unapproved.publicationApproval;
  assert.throws(() => parsePublishedPrompt(unapproved, unapproved.id), /publicationApproval/);
  assert.match(validatePrompt(unapproved).join("\n"), /publicationApproval/);
});

test("the release parser rejects changes to fixed text outside declared replacements", () => {
  const changed = withSyntheticPublication({ ...sourcePrompt, templateText: sourcePrompt.templateText + "\n합성 임의 문장" });
  assert.throws(() => parsePublishedPrompt(changed, changed.id), /original text reconstruction mismatch/i);
  assert.match(validatePrompt(changed).join("\n"), /original text reconstruction mismatch/i);
});

test("publication checks record fields, actual date, rights, version and exact source hash", () => {
  const approval = sourcePrompt.publicationApproval;
  for (const [override, reason] of [
    [{ recordId: " " }, /recordId/],
    [{ sourceVersion: "" }, /sourceVersion/],
    [{ approvedAt: "2025-02-29" }, /approvedAt/],
    [{ licenseStatus: "pending" }, /rights/],
    [{ releaseApproved: false }, /release approval/],
    [{ templateVersion: "1.0.0" }, /templateVersion/],
    [{ sourceSha256: "0".repeat(64) }, /sourceSha256/],
    [{ templateSha256: "0".repeat(64) }, /templateSha256/],
  ]) {
    const changed = { ...sourcePrompt, publicationApproval: { ...approval, ...override } };
    assert.throws(() => parsePublishedPrompt(changed, changed.id), reason);
    assert.match(validatePrompt(changed).join("\n"), reason);
  }
  const changedSource = { ...sourcePrompt, sourceOriginalText: sourcePrompt.sourceOriginalText + "\n" };
  assert.throws(() => parsePublishedPrompt(changedSource, changedSource.id), /sourceSha256/);
  assert.equal(Object.hasOwn(parsePublishedPrompt(sourcePrompt, sourcePrompt.id), "publicationApproval"), false);
});

test("every occurrence requires an approved literal in order, even for repeated tokens", () => {
  const token = "{{heading}}";
  const replacements = [{ token, originalText: "$&" }, { token, originalText: "둘째" }];
  const published = withSyntheticPublication({
    ...syntheticWizard,
    templateText: `첫째: ${token}\n둘째: ${token}`,
    sourceOriginalText: "첫째: $&\n둘째: 둘째",
    fields: [syntheticWizard.fields[0]],
    attachments: [],
    steps: [{ id: "basics", title: "기본 입력", fieldIds: ["heading"] }],
  }, replacements);
  assert.deepEqual(validatePrompt(published), []);
  for (const [entries, reason] of [
    [[replacements[0]], /match each placeholder/],
    [[...replacements, replacements[0]], /Unused/],
    [replacements.toReversed(), /reconstruction mismatch/i],
    [[{ ...replacements[0], token: "{{details}}" }, replacements[1]], /match each placeholder/],
  ]) {
    const changed = { ...published, publicationApproval: { ...published.publicationApproval, replacements: entries } };
    assert.throws(() => parsePublishedPrompt(changed, changed.id), reason);
  }
});

test("draft and reviewed workshop templates need no release record", () => {
  for (const publicationStatus of ["draft", "reviewed"]) {
    const hidden = { ...syntheticSimple, publicationStatus };
    assert.deepEqual(validatePrompt(hidden), []);
    assert.equal(parsePublishedPrompt(hidden, hidden.id), null);
  }
});

test("the approved template hash detects moving a token between identical source literals", () => {
  const token = "{{heading}}";
  const approval = withSyntheticPublication({
    ...syntheticWizard,
    templateText: `${token} / 같은 값`,
    sourceOriginalText: "같은 값 / 같은 값",
    fields: [syntheticWizard.fields[0]],
    attachments: [],
    steps: [{ id: "basics", title: "기본 입력", fieldIds: ["heading"] }],
  }, [{ token, originalText: "같은 값" }]);
  assert.deepEqual(validatePrompt(approval), []);
  const shifted = { ...approval, templateText: `같은 값 / ${token}` };
  assert.throws(() => parsePublishedPrompt(shifted, shifted.id), /templateSha256/);
});
