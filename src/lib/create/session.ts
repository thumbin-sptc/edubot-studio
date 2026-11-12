import { isRecord, promptIdPattern } from "../prompt-template.ts";
import { draftPrefix } from "../prompt-drafts.ts";
import { isSavingEnabled } from "../save-preference.ts";
import { guideRevision } from "./engine.ts";
import {
  environments, isDevice, isPlatform, personalizationFields, schoolLevels,
  type Device, type Personalization, type Platform, type PublishedGuide,
} from "./model.ts";

export const createPrefix = "edubot-studio:create:";
export const createStorageKey = `${createPrefix}session`;
const revisionPattern = /^(chatgpt|claude|gemini)\/(desktop-web|mobile-web)\/[A-Za-z][\w-]*@\d+\.\d+\.\d+\/[A-Za-z][\w-]*@\d+\.\d+\.\d+\/[a-f0-9]{64}$/;

export type CreateProgress = {
  stepId: string | null;
  checked: string[];
  selections: Record<string, boolean>;
};
export type CreateSession = {
  schemaVersion: 1;
  selection: { platform?: Platform; device?: Device };
  personalization: Personalization;
  progress: Record<string, CreateProgress>;
  updatedAt: string;
};
export type CreateRecord = { raw: string | null; session: CreateSession | null };
type LocalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function newCreateSession(): CreateSession {
  return { schemaVersion: 1, selection: {}, personalization: {}, progress: {}, updatedAt: "1970-01-01T00:00:00.000Z" };
}

function parsePersonalization(raw: unknown): Personalization | null {
  if (!isRecord(raw)) return null;
  const parsed: Personalization = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!Object.hasOwn(personalizationFields, key) || typeof value !== "string") return null;
    if (key === "schoolLevel" && value && !schoolLevels.some((level) => level === value)) return null;
    if (key === "environment" && value && !environments.some((environment) => environment === value)) return null;
    parsed[key as keyof Personalization] = value;
  }
  return parsed;
}

function parseProgress(raw: unknown): CreateProgress | null {
  if (!isRecord(raw) || (raw.stepId !== null && (typeof raw.stepId !== "string" || !promptIdPattern.test(raw.stepId))) ||
      !Array.isArray(raw.checked) || !raw.checked.every((id) => typeof id === "string" && promptIdPattern.test(id)) ||
      !isRecord(raw.selections) ||
      !Object.entries(raw.selections).every(([id, selected]) => promptIdPattern.test(id) && typeof selected === "boolean")) {
    return null;
  }
  return { stepId: raw.stepId, checked: raw.checked, selections: raw.selections as Record<string, boolean> };
}

export function parseCreateSession(raw: string | null): CreateSession | null {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.schemaVersion !== 1 || !isRecord(data.selection) || !isRecord(data.progress) ||
        typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))) return null;
    const { platform, device } = data.selection;
    if ((platform !== undefined && !isPlatform(platform)) || (device !== undefined && !isDevice(device))) return null;
    const personalization = parsePersonalization(data.personalization);
    if (!personalization) return null;
    const progress: CreateSession["progress"] = {};
    for (const [key, value] of Object.entries(data.progress)) {
      const step = parseProgress(value);
      if (!revisionPattern.test(key) || !step) return null;
      progress[key] = step;
    }
    return { schemaVersion: 1, selection: { platform, device }, personalization, progress, updatedAt: data.updatedAt };
  } catch {
    return null;
  }
}

export function getCreateProgress(session: CreateSession, guide: PublishedGuide): CreateProgress {
  const progress = session.progress[guideRevision(guide)];
  return progress && (progress.stepId === null || guide.steps.some(({ id }) => id === progress.stepId))
    ? progress : { stepId: guide.steps[0].id, checked: [], selections: {} };
}

export function updateCreateProgress(session: CreateSession, guide: PublishedGuide, progress: CreateProgress): CreateSession {
  return { ...session, progress: { ...session.progress, [guideRevision(guide)]: progress } };
}

export function hasPreviousProgress(session: CreateSession, guide: PublishedGuide): boolean {
  const prefix = `${guide.platform}/${guide.device}/`;
  const revision = guideRevision(guide);
  return !Object.hasOwn(session.progress, revision) &&
    Object.keys(session.progress).some((key) => key.startsWith(prefix));
}

export function readCreateRecord(storage: Pick<Storage, "getItem">): CreateRecord {
  const raw = storage.getItem(createStorageKey);
  return { raw, session: parseCreateSession(raw) };
}

export function writeCreateRecord(storage: Pick<Storage, "getItem" | "setItem">, session: CreateSession, expected: string | null) {
  if (!isSavingEnabled(storage)) return { kind: "disabled" as const };
  const existing = readCreateRecord(storage);
  if (existing.raw !== expected) return { kind: "conflict" as const, existing };
  const raw = JSON.stringify(session);
  storage.setItem(createStorageKey, raw);
  return { kind: "saved" as const, raw };
}

export function deleteCreateData(storage: LocalStorage, includePrompts = false): boolean {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(createPrefix) || (includePrompts && key?.startsWith(draftPrefix))) keys.push(key);
  }
  let complete = true;
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      complete = false;
    }
  }
  return complete;
}
