import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { brokenPublishedReferences, promptLinkWarnings, validatePrompt } from "../scripts/validate-content.mjs";
import { inspectCreateContent } from "../src/lib/create/content.ts";
import { hiddenPrompts, sourcePrompt, syntheticInventory, targetPrompt } from "./fixtures/synthetic-catalog.mjs";
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
