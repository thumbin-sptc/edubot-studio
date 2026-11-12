import type { PublishedResultSource } from "./prompt-catalog.ts";
import { draftKey, type Draft } from "./prompt-drafts.ts";

type ResultDraft = Pick<Draft, "promptId" | "templateVersion" | "externalAiResult" | "updatedAt">;
export type ResultMemory = ReadonlyMap<string, ResultDraft>;

export function withResultMemory(memory: ResultMemory, draft: ResultDraft): ResultMemory {
  const { promptId, templateVersion, externalAiResult, updatedAt } = draft;
  const key = draftKey(draft);
  if (!externalAiResult?.trim() && !memory.has(key)) return memory;
  const next = new Map(memory);
  if (externalAiResult?.trim()) next.set(key, { promptId, templateVersion, externalAiResult, updatedAt });
  else next.delete(key);
  return next;
}

export type ResultCandidate = Readonly<{
  key: string;
  title: string;
  version: string;
  currentVersion: string;
  origin: "memory" | "saved";
  text: string;
  updatedAt: string;
}>;

export function availableResults(
  sources: readonly PublishedResultSource[],
  memory: ResultMemory,
  saved: readonly ResultDraft[],
  storageEnabled: boolean,
): ResultCandidate[] {
  const allowed = new Map(sources.map((source) => [source.id, source]));
  function candidate(draft: ResultDraft, origin: ResultCandidate["origin"]): ResultCandidate[] {
    const source = allowed.get(draft.promptId);
    if (!source || !draft.externalAiResult?.trim()) return [];
    return [{
      key: `${origin}:${draftKey(draft)}`,
      title: source.title,
      version: draft.templateVersion,
      currentVersion: source.version,
      origin,
      text: draft.externalAiResult,
      updatedAt: draft.updatedAt,
    }];
  }
  const savedResults = storageEnabled ? saved : [];
  const savedByKey = new Map(savedResults.map((draft) => [draftKey(draft), draft]));
  return [
    ...savedResults.flatMap((draft) => candidate(draft, "saved")),
    ...Array.from(memory.values()).flatMap((draft) =>
      savedByKey.get(draftKey(draft))?.externalAiResult === draft.externalAiResult ? [] : candidate(draft, "memory")),
  ].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}
