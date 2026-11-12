import assert from "node:assert/strict";
import { test } from "node:test";
import { copyPromptText, generatePrompt, validatePromptInputs } from "../src/lib/prompt-engine.ts";
import { parsePromptTemplate, parsePublishedPrompt } from "../src/lib/prompt-template.ts";
import { syntheticSimple, syntheticWizard, validInputs } from "./fixtures/synthetic-prompts.mjs";

test("the publication boundary admits only matching published templates", () => {
  for (const status of ["draft", "reviewed", "unknown", undefined]) {
    assert.equal(parsePublishedPrompt({ publicationStatus: status }, syntheticWizard.id), null);
  }
  assert.equal(parsePublishedPrompt(undefined, syntheticWizard.id), null);
  const published = { ...syntheticWizard, publicationStatus: "published" };
  assert.equal(parsePublishedPrompt(published, syntheticWizard.id).publicationStatus, "published");
  assert.throws(() => parsePublishedPrompt(published, "OTHER"), /filename/);
});

test("template normalization keeps actual schema keys and declared step order", () => {
  const template = parsePromptTemplate(syntheticWizard);
  assert.equal(template.sourceOriginalText, syntheticWizard.sourceOriginalText);
  assert.equal(template.templateText, syntheticWizard.templateText);
  assert.deepEqual(template.steps.map(({ kind }) => kind), ["input", "input", "input", "references", "generated-output"]);
  assert.equal(template.fields[1].privacySensitive, true);
  assert.deepEqual(template.fields.at(-1).exampleItems, ["참고 항목"]);
});

test("six field kinds, named choices, other text, attachments and bullets generate without altering the original", () => {
  const template = parsePromptTemplate(syntheticWizard);
  const before = structuredClone(template);
  const inputs = validInputs();
  assert.equal(validatePromptInputs(template, inputs).size, 0);
  assert.equal(generatePrompt(template, inputs), [
    "제목: 테스트 \$& {{리터럴}}", "설명: 가상의 설명", "두 번째 줄", "수: 2.5",
    "색: 초록", "모양: 삼각형, 사각형, 원", "목록:", "• 첫째", "• 둘째", "참고: 합성 텍스트",
  ].join("\n"));
  assert.deepEqual(template, before);
  assert.equal(syntheticWizard.sourceOriginalText, before.sourceOriginalText);
});

test("examples are never inputs and full validation includes skipped required fields", () => {
  const template = parsePromptTemplate(syntheticWizard);
  const empty = { fieldValues: {}, attachmentModes: {}, attachmentTexts: {} };
  assert.deepEqual([...validatePromptInputs(template, empty).keys()], ["heading", "count", "color", "items"]);
  assert.throws(() => generatePrompt(template, empty), /Invalid prompt inputs/);
});

test("missing, invalid and out-of-range numeric input is rejected", () => {
  const template = parsePromptTemplate(syntheticWizard);
  for (const value of ["", "-1", "11", "0xFF", "1e999", "12월"]) {
    const inputs = validInputs();
    inputs.fieldValues.count = value;
    assert.ok(validatePromptInputs(template, inputs).has("count"), value);
  }
  const inputs = validInputs();
  inputs.fieldValues.count = "0";
  assert.equal(validatePromptInputs(template, inputs).size, 0);
});

test("repeatable input rejects missing, empty, oversized, and incorrectly typed entries", () => {
  const template = parsePromptTemplate(syntheticWizard);
  for (const items of [[], ["하나"], ["하나", " "], ["하나", "둘", "셋", "넷"], "잘못된 형식"]) {
    const inputs = validInputs();
    inputs.fieldValues.items = items;
    assert.ok(validatePromptInputs(template, inputs).has("items"));
  }
  const numeric = structuredClone(syntheticWizard);
  numeric.fields.at(-1).itemType = "number";
  assert.ok(validatePromptInputs(parsePromptTemplate(numeric), validInputs()).has("items"));
  const optional = structuredClone(syntheticWizard);
  optional.fields.at(-1).required = false;
  const inputs = validInputs();
  inputs.fieldValues.items = [];
  assert.equal(validatePromptInputs(parsePromptTemplate(optional), inputs).size, 0);
  inputs.fieldValues.items = ["항목"];
  assert.ok(validatePromptInputs(parsePromptTemplate(optional), inputs).has("items"));
});

test("invalid and duplicate choices and blank or disallowed other inputs are rejected", () => {
  const template = parsePromptTemplate(syntheticWizard);
  for (const color of [
    { selected: ["unknown"], useOther: false, other: "" },
    { selected: [], useOther: true, other: " " },
    { selected: ["청색"], useOther: true, other: "기타" },
    { selected: ["청색", "청색"], useOther: false, other: "" },
  ]) {
    const inputs = validInputs();
    inputs.fieldValues.color = color;
    assert.ok(validatePromptInputs(template, inputs).has("color"));
  }
  const restricted = structuredClone(syntheticWizard);
  restricted.fields[3].allowOther = false;
  assert.ok(validatePromptInputs(parsePromptTemplate(restricted), validInputs()).has("color"));
});

test("unsupported options, malformed steps, and undeclared or missing tokens fail before publication", () => {
  for (const mutate of [
    (value) => { value.templateText += " {{undeclared}}"; },
    (value) => { value.templateText = value.templateText.replace("{{count}}", ""); },
    (value) => { value.fields[0].options = []; },
    (value) => { value.fields[0].defaultValue = "자동 입력"; },
    (value) => { value.fields.at(-1).format = "unsupported"; },
    (value) => { value.fields.at(-1).maxItems = 1; },
    (value) => { value.fields[3].options.push(value.fields[3].options[0]); },
    (value) => { value.steps[0].fieldIds.push("unknown"); },
    (value) => { value.attachments[0].allowedModes = ["upload"]; },
  ]) {
    const broken = structuredClone(syntheticWizard);
    mutate(broken);
    assert.throws(() => parsePromptTemplate(broken));
  }
  const parsed = parsePromptTemplate(syntheticWizard);
  assert.throws(() => generatePrompt({ ...parsed, templateText: "{{missing}}" }, validInputs()), /Undeclared/);
});

test("external-file mode leaves the declared slot empty and does not reuse hidden text", () => {
  const template = parsePromptTemplate(syntheticWizard);
  const inputs = validInputs();
  inputs.attachmentModes.reference = "external-file";
  assert.match(generatePrompt(template, inputs), /참고: $/);
  inputs.attachmentModes.reference = "text-input";
  inputs.attachmentTexts.reference = "";
  assert.ok(validatePromptInputs(template, inputs).has("reference"));
});

test("simple-copy requires no fields and produces the literal approved template", () => {
  const simple = parsePromptTemplate(syntheticSimple);
  assert.deepEqual(simple.steps.map(({ kind }) => kind), ["generated-output"]);
  assert.equal(generatePrompt(simple, { fieldValues: {}, attachmentModes: {}, attachmentTexts: {} }), simple.templateText);
  assert.throws(() => parsePromptTemplate({ ...syntheticSimple, templateText: "{{unknown}}" }), /Undeclared/);
});

test("clipboard success requires a successful write, otherwise manual copy is offered", async () => {
  const calls = [];
  const text = "수정된 합성 완성본";
  assert.equal(await copyPromptText(text, async (value) => { calls.push(value); }), "copied");
  assert.deepEqual(calls, [text]);
  assert.equal(await copyPromptText(text, async () => { throw new Error("clipboard denied"); }), "manual");
  assert.equal(await copyPromptText(text), "manual");
});
