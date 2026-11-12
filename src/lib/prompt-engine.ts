import {
  bulletFormat,
  isRecord,
  tokenPattern,
  type AttachmentMode,
  type PromptAttachment,
  type PromptField,
  type PromptTemplate,
} from "./prompt-template.ts";

export type ChoiceValue = { selected: string[]; useOther: boolean; other: string };
export type FieldValue = string | string[] | ChoiceValue;
export type PromptInputs = {
  fieldValues: Record<string, FieldValue>;
  attachmentModes: Record<string, AttachmentMode>;
  attachmentTexts: Record<string, string>;
};

export const emptyChoice: ChoiceValue = { selected: [], useOther: false, other: "" };

export function isChoiceValue(value: unknown): value is ChoiceValue {
  return isRecord(value) && typeof value.useOther === "boolean" && typeof value.other === "string" &&
    Array.isArray(value.selected) && value.selected.every((choice) => typeof choice === "string");
}

export function isAttachmentMode(value: unknown): value is AttachmentMode {
  return value === "external-file" || value === "text-input";
}

function parseNumber(text: string): number | undefined {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function validateChoices(
  field: Extract<PromptField, { options: unknown }>,
  value: FieldValue | undefined,
): string | undefined {
  if (value !== undefined && !isChoiceValue(value)) return "선택 항목을 다시 확인해 주세요.";
  const { selected, useOther, other } = value ?? emptyChoice;
  const count = selected.length + Number(useOther);
  if (field.required && !count) return "항목을 선택해 주세요.";
  if (field.kind === "single-select" && count > 1) return "항목을 하나만 선택해 주세요.";
  const options = new Set(field.options.map((option) => option.value));
  if (new Set(selected).size !== selected.length || selected.some((option) => !options.has(option))) {
    return "지원되는 항목을 다시 선택해 주세요.";
  }
  if (useOther && !field.allowOther) return "기타 항목은 사용할 수 없습니다.";
  if (useOther && !other.trim()) return "기타 항목의 내용을 입력해 주세요.";
}

export function validateFieldValue(field: PromptField, value: FieldValue | undefined): string | undefined {
  if (field.kind === "single-select" || field.kind === "multi-select") return validateChoices(field, value);
  if (field.kind === "repeatable") {
    if (value !== undefined && !Array.isArray(value)) return "반복 항목을 다시 확인해 주세요.";
    const items = value ?? [];
    if (!field.required && !items.length) return;
    const min = Math.max(field.minItems, Number(field.required));
    if (items.length < min) return `항목을 ${min}개 이상 입력해 주세요.`;
    if (field.maxItems !== null && items.length > field.maxItems) {
      return `항목은 ${field.maxItems}개까지 입력할 수 있습니다.`;
    }
    const empty = items.findIndex((item) => !item.trim());
    if (empty >= 0) return `${empty + 1}번째 항목을 입력하거나 삭제해 주세요.`;
    if (field.itemType === "number") {
      const invalid = items.findIndex((item) => parseNumber(item.trim()) === undefined);
      if (invalid >= 0) return `${invalid + 1}번째 항목에 숫자를 입력해 주세요.`;
    }
    return;
  }
  if (value !== undefined && typeof value !== "string") return "입력 형식을 다시 확인해 주세요.";
  const text = value?.trim() ?? "";
  if (!text) return field.required ? "필수 항목을 입력해 주세요." : undefined;
  if (field.kind === "number") {
    const number = parseNumber(text);
    if (number === undefined) return "숫자를 입력해 주세요.";
    if (field.min !== undefined && number < field.min) return `${field.min} 이상의 값을 입력해 주세요.`;
    if (field.max !== undefined && number > field.max) return `${field.max} 이하의 값을 입력해 주세요.`;
  }
}

export function validateAttachment(attachment: PromptAttachment, inputs: PromptInputs): string | undefined {
  const mode = Object.hasOwn(inputs.attachmentModes, attachment.id) ? inputs.attachmentModes[attachment.id] : undefined;
  if (!mode) return attachment.required ? "참고 자료 제공 방법을 선택해 주세요." : undefined;
  if (!attachment.allowedModes.includes(mode)) return "지원되는 제공 방법을 선택해 주세요.";
  const text = Object.hasOwn(inputs.attachmentTexts, attachment.id) ? inputs.attachmentTexts[attachment.id] : undefined;
  if (mode === "text-input" && !text?.trim()) return "참고 자료의 내용을 입력해 주세요.";
}

export function getFieldValue(inputs: PromptInputs, id: string): FieldValue | undefined {
  return Object.hasOwn(inputs.fieldValues, id) ? inputs.fieldValues[id] : undefined;
}

export function validatePromptInputs(template: PromptTemplate, inputs: PromptInputs): Map<string, string> {
  const errors = new Map<string, string>();
  for (const field of template.fields) {
    const error = validateFieldValue(field, getFieldValue(inputs, field.id));
    if (error) errors.set(field.id, error);
  }
  for (const attachment of template.attachments) {
    const error = validateAttachment(attachment, inputs);
    if (error) errors.set(attachment.id, error);
  }
  return errors;
}

export function formatFieldValue(field: PromptField, value: FieldValue | undefined): string {
  if (field.kind === "repeatable" && Array.isArray(value)) {
    const prefix = field.format === bulletFormat ? "• " : "";
    return value.map((item) => prefix + item.trim()).join("\n");
  }
  if (isChoiceValue(value)) {
    const selected = field.kind === "single-select" || field.kind === "multi-select"
      ? field.options.filter(({ value: option }) => value.selected.includes(option)).map((option) => option.value)
      : [];
    return [...selected, ...(value.useOther ? [value.other.trim()] : [])].join(", ");
  }
  return typeof value === "string" ? value.trim() : "";
}

export function generatePrompt(template: PromptTemplate, inputs: PromptInputs): string {
  if (validatePromptInputs(template, inputs).size) throw new Error("Invalid prompt inputs");
  const values = new Map(template.fields.map((field) => [
    field.placeholderToken,
    formatFieldValue(field, getFieldValue(inputs, field.id)),
  ]));
  for (const { id, inputToken } of template.attachments) {
    if (inputToken) {
      const text = inputs.attachmentModes[id] === "text-input" ? inputs.attachmentTexts[id].trim() : "";
      values.set(inputToken, text);
    }
  }
  // The replacement callback leaves text inserted by the author untouched, even if it contains braces.
  return template.templateText.replace(tokenPattern, (token) => {
    const value = values.get(token);
    if (value === undefined) throw new Error("Undeclared template placeholder");
    return value;
  });
}

export async function copyPromptText(
  text: string,
  writeText?: (text: string) => Promise<void>,
): Promise<"copied" | "manual"> {
  if (!writeText) return "manual";
  try {
    await writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}
