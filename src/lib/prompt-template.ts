export const promptIdPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const versionPattern = /^\d+\.\d+\.\d+$/;
export const tokenPattern = /\{\{([^{}]*)\}\}/g;
export const bulletFormat = "각 항목을 • 기호로 시작하는 줄로 정리";

type TextKind = "short-text" | "long-text";
export type AttachmentMode = "external-file" | "text-input";

type FieldBase = {
  id: string;
  label: string;
  required: boolean;
  placeholderToken: string;
  helpText?: string;
  example?: string;
  privacySensitive?: boolean;
};

export type PromptOption = { value: string; label: string };
export type PreviousResultImport = { fieldId: string; sourcePromptIds: string[] };
export type PromptCatalogMetadata = {
  category?: string;
  schoolEnvironment?: string;
  schoolLevel?: string;
  source?: string;
  section?: string;
  pdfPage?: number;
  bookPage?: number;
};
export type PromptField = FieldBase & (
  | { kind: TextKind }
  | { kind: "number"; min?: number; max?: number }
  | { kind: "single-select" | "multi-select"; options: PromptOption[]; allowOther: boolean }
  | { kind: "repeatable"; itemType: TextKind | "number"; minItems: number; maxItems: number | null;
      format?: typeof bulletFormat; exampleItems: string[] }
);

export type PromptAttachment = {
  id: string;
  label: string;
  required: boolean;
  allowedModes: AttachmentMode[];
  inputToken?: string;
  helpText?: string;
  privacySensitive?: boolean;
};

export type PromptStep = { id: string; title: string; description?: string } & (
  | { kind: "input"; fieldIds: string[] }
  | { kind: "references" | "generated-output" }
);

export type PromptTemplate = {
  id: string;
  title: string;
  summary?: string;
  version: string;
  publicationStatus: "draft" | "reviewed" | "published";
  sourceOriginalText: string;
  templateText: string;
  mode: "wizard" | "simple-copy";
  fields: PromptField[];
  attachments: PromptAttachment[];
  steps: PromptStep[];
  catalog: PromptCatalogMetadata;
  relatedPromptIds?: string[];
  previousResultImports: PreviousResultImport[];
};

export type PublishedPrompt = PromptTemplate & { publicationStatus: "published" };
export type WizardTemplate = Pick<PromptTemplate, "id" | "title" | "summary" | "version" | "mode" |
  "templateText" | "fields" | "attachments" | "steps">;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function requireText(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${name}`);
  return value;
}

function optionalText(value: unknown, name: string): string | undefined {
  return value === undefined ? undefined : requireText(value, name);
}

function requireId(value: unknown, name: string): string {
  const id = requireText(value, name);
  if (!promptIdPattern.test(id)) throw new Error(`Invalid ${name}`);
  return id;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${name}`);
  return value;
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  return value === undefined ? undefined : requireBoolean(value, name);
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function optionalNumber(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function count(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function inputToken(value: unknown, id: string): string {
  if (value !== `{{${id}}}`) throw new Error(`Invalid placeholder for ${id}`);
  return value;
}

function validateUnique(values: string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${name}`);
}

export function isResultImportField(field: { kind?: unknown }): boolean {
  return field.kind === "long-text";
}

function parsePromptIds(raw: unknown, name: string, ownerId: string) {
  const ids = requireArray(raw, name).map((entry) => requireId(entry, name));
  validateUnique(ids, name);
  if (ids.includes(ownerId)) throw new Error(`Self reference in ${name}`);
  return ids;
}

export function parsePromptLinks(data: Record<string, unknown>, ownerId: string, fields: Array<{ id?: unknown; kind?: unknown }>) {
  const relatedPromptIds = data.relatedPromptIds === undefined
    ? undefined : parsePromptIds(data.relatedPromptIds, "relatedPromptIds", ownerId);
  const imports = data.previousResultImports === undefined ? [] : requireArray(data.previousResultImports, "previousResultImports");
  const previousResultImports = imports.map((raw): PreviousResultImport => {
    const rule = requireRecord(raw, "previousResultImports entry");
    const fieldId = requireId(rule.fieldId, "import fieldId");
    const field = fields.find(({ id }) => id === fieldId);
    if (!field || !isResultImportField(field)) throw new Error(`Import field ${fieldId} must be an existing long-text field`);
    if (Object.keys(rule).some((key) => key !== "fieldId" && key !== "sourcePromptIds")) {
      throw new Error(`Unsupported import option for ${fieldId}`);
    }
    const sourcePromptIds = parsePromptIds(rule.sourcePromptIds, "sourcePromptIds", ownerId);
    if (!sourcePromptIds.length) throw new Error(`No approved source ids for import field ${fieldId}`);
    return { fieldId, sourcePromptIds };
  });
  validateUnique(previousResultImports.map(({ fieldId }) => fieldId), "previous result import fields");
  return { relatedPromptIds, previousResultImports };
}

function positivePage(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
}

function catalogText(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function parseInventoryMetadata(raw: Record<string, unknown>): PromptCatalogMetadata {
  return {
    category: catalogText(raw.category),
    schoolEnvironment: catalogText(raw.schoolEnvironment),
    schoolLevel: catalogText(raw.schoolLevel),
    source: catalogText(raw.source),
    section: catalogText(raw.section),
    pdfPage: positivePage(raw.pdfPage),
    bookPage: positivePage(raw.bookPage),
  };
}

function parseCatalogMetadata(data: Record<string, unknown>): PromptCatalogMetadata {
  const display = isRecord(data.display) ? data.display : {};
  const source = isRecord(data.source) ? data.source : {};
  return {
    category: catalogText(display.category),
    schoolEnvironment: catalogText(display.schoolEnvironment),
    schoolLevel: catalogText(display.schoolLevel),
    source: catalogText(source.document),
    section: catalogText(source.section),
    pdfPage: positivePage(source.pdfPage),
    bookPage: positivePage(source.bookPage),
  };
}

function parseField(raw: unknown): PromptField {
  const field = requireRecord(raw, "field");
  const id = requireId(field.id, "field id");
  const base: FieldBase = {
    id,
    label: requireText(field.label, `${id} label`),
    required: requireBoolean(field.required, `${id} required`),
    placeholderToken: inputToken(field.placeholderToken, id),
    helpText: optionalText(field.helpText, `${id} helpText`),
    example: optionalText(field.example, `${id} example`),
    privacySensitive: optionalBoolean(field.privacySensitive, `${id} privacySensitive`),
  };
  const kind = field.kind;
  const select = kind === "single-select" || kind === "multi-select";

  if (!select && (field.options !== undefined || field.allowOther !== undefined)) {
    throw new Error(`Unsupported choices for ${id}`);
  }
  if (kind !== "repeatable" &&
      ["itemType", "exampleItems", "minItems", "maxItems", "format"].some((key) => field[key] !== undefined)) {
    throw new Error(`Unsupported repeat settings for ${id}`);
  }
  if (kind !== "number" && (field.min !== undefined || field.max !== undefined)) {
    throw new Error(`Unsupported numeric bounds for ${id}`);
  }
  const blankRepeatDefault = kind === "repeatable" && Array.isArray(field.defaultValue) && !field.defaultValue.length;
  if (field.defaultValue !== undefined && !blankRepeatDefault) {
    throw new Error(`Unsupported default value for ${id}`);
  }

  if (kind === "short-text" || kind === "long-text") return { ...base, kind };
  if (kind === "number") {
    const min = optionalNumber(field.min, `${id} min`);
    const max = optionalNumber(field.max, `${id} max`);
    if (min !== undefined && max !== undefined && min > max) throw new Error(`Invalid bounds for ${id}`);
    return { ...base, kind, min, max };
  }
  if (select) {
    const options = requireArray(field.options, `${id} options`).map((rawOption) => {
      const option = requireRecord(rawOption, `${id} option`);
      return {
        value: requireText(option.value, `${id} option value`),
        label: requireText(option.label, `${id} option label`),
      };
    });
    const allowOther = optionalBoolean(field.allowOther, `${id} allowOther`) ?? false;
    if (!options.length && !allowOther) throw new Error(`No choices for ${id}`);
    validateUnique(options.map(({ value }) => value), `${id} option values`);
    return { ...base, kind, options, allowOther };
  }
  if (kind === "repeatable") {
    const itemType = field.itemType ?? "short-text";
    if (itemType !== "short-text" && itemType !== "long-text" && itemType !== "number") {
      throw new Error(`Unsupported itemType for ${id}`);
    }
    const minItems = count(field.minItems ?? 0, `${id} minItems`);
    const maxItems = field.maxItems === null || field.maxItems === undefined
      ? null : count(field.maxItems, `${id} maxItems`);
    if (maxItems !== null && maxItems < Math.max(minItems, Number(base.required))) {
      throw new Error(`Invalid item bounds for ${id}`);
    }
    const format = field.format;
    if (format !== undefined && format !== bulletFormat) throw new Error(`Unsupported format for ${id}`);
    const exampleItems = requireArray(field.exampleItems ?? [], `${id} exampleItems`)
      .map((example) => requireText(example, `${id} example item`));
    return { ...base, kind, itemType, minItems, maxItems, format, exampleItems };
  }
  throw new Error(`Unsupported field kind for ${id}`);
}

function parseAttachment(raw: unknown): PromptAttachment {
  const attachment = requireRecord(raw, "attachment");
  const id = requireId(attachment.id, "attachment id");
  const allowedModes = requireArray(attachment.allowedModes, `${id} allowedModes`).map((mode) => {
    if (mode !== "external-file" && mode !== "text-input") throw new Error(`Unsupported attachment mode for ${id}`);
    return mode;
  });
  validateUnique(allowedModes, `${id} attachment modes`);
  if (!allowedModes.length) throw new Error(`No attachment modes for ${id}`);
  if (!allowedModes.includes("text-input") && attachment.inputToken !== undefined) {
    throw new Error(`Unsupported attachment placeholder for ${id}`);
  }
  return {
    id,
    label: requireText(attachment.label, `${id} label`),
    required: requireBoolean(attachment.required, `${id} required`),
    allowedModes,
    inputToken: allowedModes.includes("text-input") ? inputToken(attachment.inputToken, id) : undefined,
    helpText: optionalText(attachment.helpText, `${id} helpText`),
    privacySensitive: optionalBoolean(attachment.privacySensitive, `${id} privacySensitive`),
  };
}

function parseSteps(raw: unknown, fields: PromptField[], attachments: PromptAttachment[], mode: PromptTemplate["mode"]): PromptStep[] {
  const steps = requireArray(raw, "steps").map((item): PromptStep => {
    const step = requireRecord(item, "step");
    const id = requireId(step.id, "step id");
    const title = requireText(step.title, `${id} title`);
    const description = optionalText(step.description ?? step.helpText, `${id} description`);
    const fieldIds = requireArray(step.fieldIds ?? [], `${id} fieldIds`).map((fieldId) => requireId(fieldId, "step field id"));
    if (step.kind === "generated-output" && !fieldIds.length) return { id, title, description, kind: step.kind };
    if ((step.kind === undefined || step.kind === "input") && fieldIds.length) {
      return { id, title, description, kind: "input", fieldIds };
    }
    throw new Error(`Unsupported step configuration for ${id}`);
  });
  validateUnique(steps.map(({ id }) => id), "step ids");
  const inputSteps = steps.filter((step) => step.kind === "input");
  const usedFields = inputSteps.flatMap(({ fieldIds }) => fieldIds);
  validateUnique(usedFields, "step field references");
  if (usedFields.length !== fields.length || fields.some(({ id }) => !usedFields.includes(id))) {
    throw new Error("Steps must reference all and only declared fields");
  }
  const results = steps.filter((step) => step.kind === "generated-output");
  if (results.length > 1 || (results.length && steps.at(-1) !== results[0])) {
    throw new Error("The generated-output step must be last");
  }
  if (mode === "wizard" && !inputSteps.length && !attachments.length) throw new Error("No wizard input steps");
  return [
    ...inputSteps,
    ...(attachments.length ? [{ id: "@references", title: "참고 자료", kind: "references" as const }] : []),
    results[0] ?? { id: "@result", title: "프롬프트 완성", kind: "generated-output" },
  ];
}

export function parsePromptTemplate(raw: unknown): PromptTemplate {
  const data = requireRecord(raw, "prompt template");
  const id = requireId(data.id, "prompt id");
  const version = requireText(data.version, "template version");
  if (!versionPattern.test(version)) throw new Error("Invalid template version");
  const publicationStatus = data.publicationStatus;
  if (publicationStatus !== "draft" && publicationStatus !== "reviewed" && publicationStatus !== "published") {
    throw new Error("Invalid publication status");
  }
  const mode = data.mode ?? "wizard";
  if (mode !== "wizard" && mode !== "simple-copy") throw new Error("Unsupported prompt mode");
  const sourceOriginalText = requireText(data.sourceOriginalText, "sourceOriginalText");
  const templateText = requireText(data.templateText, "templateText");
  if ([...sourceOriginalText.matchAll(tokenPattern)].length) throw new Error("Original text contains a placeholder");
  if (data.optionalBlocks !== undefined && requireArray(data.optionalBlocks, "optionalBlocks").length) {
    throw new Error("Unsupported optional blocks");
  }
  const fields = requireArray(data.fields, "fields").map(parseField);
  const attachments = requireArray(data.attachments ?? [], "attachments").map(parseAttachment);
  validateUnique([...fields, ...attachments].map((entry) => entry.id), "field and attachment ids");
  const tokens = new Set([...templateText.matchAll(tokenPattern)].map(([token]) => token));
  const declared = new Set([
    ...fields.map(({ placeholderToken }) => placeholderToken),
    ...attachments.flatMap(({ inputToken }) => inputToken ? [inputToken] : []),
  ]);
  if ([...tokens].some((token) => !declared.has(token))) throw new Error("Undeclared template placeholder");
  if ([...declared].some((token) => !tokens.has(token))) throw new Error("Missing template placeholder");
  if (mode === "simple-copy" && (fields.length || attachments.length || tokens.size)) {
    throw new Error("Simple-copy must not declare inputs or placeholders");
  }
  return {
    id,
    version,
    title: requireText(data.title, "title"),
    summary: optionalText(data.summary, "summary"),
    publicationStatus,
    mode,
    sourceOriginalText,
    templateText,
    fields,
    attachments,
    steps: parseSteps(data.steps, fields, attachments, mode),
    catalog: parseCatalogMetadata(data),
    ...parsePromptLinks(data, id, fields),
  };
}

export function parsePublishedPrompt(raw: unknown, expectedId: string): PublishedPrompt | null {
  if (!isRecord(raw) || raw.publicationStatus !== "published") return null;
  const template = parsePromptTemplate(raw);
  if (template.id !== expectedId) throw new Error("Published prompt id does not match its filename");
  return { ...template, publicationStatus: "published" };
}
