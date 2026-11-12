import assert from "node:assert/strict";
import { test } from "node:test";
import { promptLinkWarnings, validateInventory, validatePrompt } from "../scripts/validate-content.mjs";
import {
  approvedResultSources, catalogOptions, filterCatalog, groupCatalog, indexInventory, publicPromptSummary, relatedPublicPrompts, sortCatalog,
} from "../src/lib/prompt-catalog.ts";
import { parsePublishedPrompt, parsePromptTemplate } from "../src/lib/prompt-template.ts";
import { hiddenPrompts, locationlessPrompt, sourcePrompt, syntheticInventory, targetPrompt } from "./fixtures/synthetic-catalog.mjs";

const templates = [sourcePrompt, targetPrompt, locationlessPrompt, ...hiddenPrompts];
const published = templates.flatMap((template) => parsePublishedPrompt(template, template.id) ?? []);
const inventory = indexInventory(syntheticInventory);
const catalog = published.map((template) => publicPromptSummary(template, inventory.get(template.id)));

test("the catalog DTO only merges allowlisted metadata for published IDs", () => {
  assert.equal(catalog.length, 3);
  const source = catalog.find(({ id }) => id === sourcePrompt.id);
  assert.equal(source.title, sourcePrompt.title);
  assert.equal(source.source, "합성 교재 A");
  assert.equal(source.pdfPage, 4);
  assert.equal(source.schoolEnvironment, "특수학급");
  const target = catalog.find(({ id }) => id === targetPrompt.id);
  assert.equal(target.category, "IEP");
  assert.equal(target.schoolLevel, "중등");
  assert.equal(target.section, "2장");
  assert.equal(target.pdfPage, 12);
  assert.equal(target.bookPage, undefined);
  assert.doesNotMatch(JSON.stringify(catalog), /QA_ONLY_|QA-DRAFT|QA-REVIEWED|QA-INVENTORY/);
});

test("absent textbook location is omitted, and a changed section cannot inherit obsolete page numbers", () => {
  const absent = catalog.find(({ id }) => id === locationlessPrompt.id);
  assert.equal(absent.source, undefined);
  assert.equal(absent.section, undefined);
  assert.equal(absent.pdfPage, undefined);
  const updated = parsePublishedPrompt({ ...sourcePrompt, source: { document: "합성 교재 A", section: "다른 장" } }, sourcePrompt.id);
  assert.equal(publicPromptSummary(updated, inventory.get(sourcePrompt.id)).pdfPage, undefined);
});

test("search matches public metadata in Korean with flexible spacing and case", () => {
  assert.deepEqual(filterCatalog(catalog, "  ai수 업 사 례  ", {}).map(({ id }) => id), [sourcePrompt.id]);
  assert.deepEqual(filterCatalog(catalog, "교수학습", {}).map(({ id }) => id), [sourcePrompt.id]);
  assert.deepEqual(filterCatalog(catalog, "PDF 12쪽", {}).map(({ id }) => id), [targetPrompt.id]);
  assert.equal(filterCatalog(catalog, "QA_ONLY", {}).length, 0);
  assert.equal(filterCatalog(catalog, " ", {}).length, 3);
});

test("both catalog views group the same public set and filter options exclude unpublished data", () => {
  const byPurpose = groupCatalog(catalog, "category");
  const bySource = groupCatalog(sortCatalog([...catalog].reverse(), "contents"), "source");
  assert.deepEqual(catalogOptions(catalog, "category").sort(), ["IEP", "수업 설계"].sort());
  assert.equal(byPurpose.find(([name]) => name === "IEP")[1][0].id, targetPrompt.id);
  const textbook = bySource.find(([name]) => name === "합성 교재 A")[1];
  assert.deepEqual(textbook.map(({ id }) => id), [sourcePrompt.id, targetPrompt.id]);
  assert.deepEqual(groupCatalog(textbook, "section").map(([name]) => name), ["1장", "2장"]);
  assert.equal(bySource.at(-1)[1][0].id, locationlessPrompt.id);
  assert.equal(filterCatalog(catalog, "", { category: "IEP", schoolLevel: "중등" }).length, 1);
  assert.equal(filterCatalog(catalog, "", { category: "IEP", schoolEnvironment: "특수학급" }).length, 0);
});

test("recommendations and import permissions intersect with published sources independently", () => {
  const source = published.find(({ id }) => id === sourcePrompt.id);
  const target = published.find(({ id }) => id === targetPrompt.id);
  assert.deepEqual(relatedPublicPrompts(source, catalog), [{ id: target.id, title: target.title }]);
  assert.deepEqual(relatedPublicPrompts({ ...source, relatedPromptIds: undefined }, catalog), []);
  assert.deepEqual(approvedResultSources(target, published), [{
    fieldId: "details", sources: [{ id: source.id, title: source.title, version: source.version }],
  }]);
  assert.deepEqual(approvedResultSources({ ...target, previousResultImports: [] }, published), []);
  assert.deepEqual(approvedResultSources(target, [target]), [{ fieldId: "details", sources: [] }]);
});

test("runtime and content checks reject invalid fields, missing allowlists, and duplicate or self links", () => {
  for (const options of [
    { previousResultImports: [{ fieldId: "heading", sourcePromptIds: [sourcePrompt.id] }] },
    { previousResultImports: [{ fieldId: "count", sourcePromptIds: [sourcePrompt.id] }] },
    { previousResultImports: [{ fieldId: "missing", sourcePromptIds: [sourcePrompt.id] }] },
    { previousResultImports: [{ fieldId: "details" }] },
    { previousResultImports: [{ fieldId: "details", sourcePromptIds: [] }] },
    { previousResultImports: [{ fieldId: "details", sourcePromptIds: [targetPrompt.id] }] },
    { previousResultImports: [{ fieldId: "details", sourcePromptIds: [sourcePrompt.id, sourcePrompt.id] }] },
    { previousResultImports: [{ fieldId: "details", sourcePromptIds: [sourcePrompt.id] }, ...targetPrompt.previousResultImports] },
    { relatedPromptIds: [sourcePrompt.id, sourcePrompt.id] },
    { relatedPromptIds: [targetPrompt.id] },
  ]) {
    const invalid = { ...targetPrompt, ...options };
    assert.throws(() => parsePromptTemplate(invalid));
    assert.ok(validatePrompt(invalid).length);
  }
  for (const template of published) assert.deepEqual(validatePrompt(templates.find(({ id }) => id === template.id), new Set()), []);
});

test("validation surfaces inventory mismatches and unpublished destinations without treating inventory suggestions as approvals", () => {
  const warnings = promptLinkWarnings(templates, syntheticInventory);
  assert.ok(warnings.some((warning) => warning.includes("relatedPromptIds와 suggestedNextIds")));
  for (const id of ["QA-DRAFT", "QA-REVIEWED", "QA-INVENTORY"]) {
    assert.ok(warnings.some((warning) => warning.includes(id)));
  }
  assert.ok(!warnings.some((warning) => warning.includes("QA-LOCATIONLESS")));
  const invalidInventory = { items: [{ id: "QA-SOURCE", suggestedNextIds: ["QA-SOURCE", "QA-SOURCE"] }] };
  assert.equal(validateInventory(invalidInventory).filter((error) => error.includes("duplicate")).length, 1);
});
