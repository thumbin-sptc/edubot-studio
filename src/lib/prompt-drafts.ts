import { isAttachmentMode, isChoiceValue, type FieldValue, type PromptInputs } from "./prompt-engine.ts";
import { isRecord, promptIdPattern, versionPattern, type PromptTemplate } from "./prompt-template.ts";

export const draftPrefix = "edubot-studio:draft:";
export const savePreferenceKey = "edubot-studio:save-enabled";

export type Draft = PromptInputs & {
  schemaVersion: 1;
  promptId: string;
  promptTitle: string;
  templateVersion: string;
  currentStepId: string;
  completedStepIds: string[];
  labels: Record<string, string>;
  generatedOutput: string | null;
  editedOutput: string | null;
  externalAiResult?: string;
  updatedAt: string;
};

export type DraftRecord = { raw: string | null; draft: Draft | null };
export type SavedDraftRecord = { raw: string; draft: Draft };
type DraftIdentity = Pick<Draft, "promptId" | "templateVersion">;
type DraftStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

export function draftKey({ promptId, templateVersion }: DraftIdentity): string {
  if (!promptIdPattern.test(promptId) || !versionPattern.test(templateVersion)) {
    throw new Error("Invalid draft identity");
  }
  return `${draftPrefix}${promptId}@${templateVersion}`;
}

export function createDraft(template: PromptTemplate): Draft {
  return {
    schemaVersion: 1,
    promptId: template.id,
    promptTitle: template.title,
    templateVersion: template.version,
    currentStepId: template.steps[0].id,
    completedStepIds: [],
    labels: Object.fromEntries([...template.fields, ...template.attachments].map(({ id, label }) => [id, label])),
    fieldValues: {},
    attachmentModes: {},
    attachmentTexts: {},
    generatedOutput: template.mode === "simple-copy" ? template.templateText : null,
    editedOutput: null,
    updatedAt: new Date().toISOString(),
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((text) => typeof text === "string");
}

function isFieldValue(value: unknown): value is FieldValue {
  return typeof value === "string" || isChoiceValue(value) ||
    (Array.isArray(value) && value.every((entry) => typeof entry === "string"));
}

function isFieldValueRecord(value: unknown): value is Draft["fieldValues"] {
  return isRecord(value) && Object.values(value).every(isFieldValue);
}

function isModeRecord(value: unknown): value is Draft["attachmentModes"] {
  return isRecord(value) && Object.values(value).every(isAttachmentMode);
}

function isOutput(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const completedStepIds = data.completedStepIds ?? [];
  if (data.schemaVersion !== 1 ||
      typeof data.promptId !== "string" || !promptIdPattern.test(data.promptId) ||
      typeof data.promptTitle !== "string" || !data.promptTitle.trim() ||
      typeof data.templateVersion !== "string" || !versionPattern.test(data.templateVersion) ||
      typeof data.currentStepId !== "string" || !data.currentStepId ||
      !Array.isArray(completedStepIds) || !completedStepIds.every((step) => typeof step === "string") ||
      !isStringRecord(data.labels) || !isFieldValueRecord(data.fieldValues) ||
      !isModeRecord(data.attachmentModes) || !isStringRecord(data.attachmentTexts) ||
      !isOutput(data.generatedOutput) || !isOutput(data.editedOutput) ||
      (data.generatedOutput === null && data.editedOutput !== null) ||
      (data.externalAiResult !== undefined && typeof data.externalAiResult !== "string") ||
      typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))) return null;

  return {
    schemaVersion: 1,
    promptId: data.promptId,
    promptTitle: data.promptTitle,
    templateVersion: data.templateVersion,
    currentStepId: data.currentStepId,
    completedStepIds,
    labels: data.labels,
    fieldValues: data.fieldValues,
    attachmentModes: data.attachmentModes,
    attachmentTexts: data.attachmentTexts,
    generatedOutput: data.generatedOutput,
    editedOutput: data.editedOutput,
    externalAiResult: data.externalAiResult,
    updatedAt: data.updatedAt,
  };
}

function readRecord(storage: DraftStorage, key: string): DraftRecord {
  const raw = storage.getItem(key);
  const draft = parseDraft(raw);
  return { raw, draft: draft && draftKey(draft) === key ? draft : null };
}

export function readDraft(storage: DraftStorage, identity: DraftIdentity): DraftRecord {
  return readRecord(storage, draftKey(identity));
}

function storedKeys(storage: DraftStorage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(draftPrefix)) keys.push(key);
  }
  return keys;
}

export function readDrafts(storage: DraftStorage): { drafts: SavedDraftRecord[]; unreadable: number } {
  const keys = storedKeys(storage);
  const drafts = keys.flatMap((key) => {
    const { raw, draft } = readRecord(storage, key);
    return raw !== null && draft ? [{ raw, draft }] : [];
  });
  drafts.sort((left, right) => Date.parse(right.draft.updatedAt) - Date.parse(left.draft.updatedAt));
  return { drafts, unreadable: keys.length - drafts.length };
}

export function isSavingEnabled(storage: DraftStorage): boolean {
  return storage.getItem(savePreferenceKey) === "true";
}

export function setSavingEnabled(storage: DraftStorage, enabled: boolean): void {
  storage.setItem(savePreferenceKey, String(enabled));
}

export function writeDraft(storage: DraftStorage, draft: Draft, expected: string | null) {
  if (!isSavingEnabled(storage)) return { kind: "disabled" as const };
  const key = draftKey(draft);
  const existing = readRecord(storage, key);
  if (existing.raw !== expected) return { kind: "conflict" as const, existing };
  const raw = JSON.stringify(draft);
  storage.setItem(key, raw);
  return { kind: "saved" as const, raw };
}

export function deleteDraft(storage: DraftStorage, identity: DraftIdentity): void {
  storage.removeItem(draftKey(identity));
}

export function deleteAllDrafts(storage: DraftStorage): void {
  for (const key of storedKeys(storage)) storage.removeItem(key);
}

export function currentOutput(draft: Draft): string | null {
  return draft.editedOutput ?? draft.generatedOutput;
}

export function needsRegenerationConfirmation(draft: Draft, nextOutput: string): boolean {
  return draft.editedOutput !== null && draft.editedOutput !== draft.generatedOutput &&
    draft.generatedOutput !== nextOutput;
}

export function withGeneratedOutput(draft: Draft, output: string): Draft {
  if (draft.generatedOutput === output) return draft;
  return { ...draft, generatedOutput: output, editedOutput: null };
}

export function restoreGeneratedOutput(draft: Draft): Draft {
  return { ...draft, editedOutput: null };
}
