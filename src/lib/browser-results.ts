"use client";

import { useSyncExternalStore } from "react";
import { draftKey, type Draft } from "./prompt-drafts";
import { withResultMemory, type ResultMemory } from "./prompt-results";

const empty: ResultMemory = new Map();
let memory = empty;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(next: ResultMemory) {
  memory = next;
  for (const listener of listeners) listener();
}

export function useResultMemory() {
  return useSyncExternalStore(subscribe, () => memory, () => empty);
}

export function rememberResult(draft: Draft) {
  publish(withResultMemory(memory, draft));
}

export function forgetResult(draft: Pick<Draft, "promptId" | "templateVersion"> | "all") {
  if (draft === "all") {
    publish(empty);
    return;
  }
  const next = new Map(memory);
  if (next.delete(draftKey(draft))) publish(next);
}
