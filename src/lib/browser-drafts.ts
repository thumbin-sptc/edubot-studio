"use client";

import { useSyncExternalStore } from "react";
import {
  deleteAllDrafts,
  deleteDraft,
  draftPrefix,
  isSavingEnabled,
  readDraft,
  readDrafts,
  savePreferenceKey,
  setSavingEnabled,
  writeDraft,
  type Draft,
  type SavedDraftRecord,
} from "./prompt-drafts";

type StorageSnapshot = {
  ready: boolean;
  enabled: boolean;
  available: boolean;
  drafts: SavedDraftRecord[];
  unreadable: number;
};

const initialSnapshot: StorageSnapshot = {
  ready: false,
  enabled: false,
  available: false,
  drafts: [],
  unreadable: 0,
};

let snapshot = initialSnapshot;
let listening = false;
const subscribers = new Set<() => void>();

function refresh() {
  try {
    const storage = window.localStorage;
    snapshot = { ready: true, enabled: isSavingEnabled(storage), available: true, ...readDrafts(storage) };
  } catch {
    snapshot = { ...initialSnapshot, ready: true };
  }
  for (const subscriber of subscribers) subscriber();
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  if (!listening) {
    listening = true;
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === savePreferenceKey || event.key.startsWith(draftPrefix)) refresh();
    });
    refresh();
  }
  return () => { subscribers.delete(subscriber); };
}

export function useDraftStorage() {
  return useSyncExternalStore(subscribe, () => snapshot, () => initialSnapshot);
}

export function readBrowserDraft(draft: Draft) {
  try {
    return readDraft(window.localStorage, draft);
  } catch {
    return null;
  }
}

export function changeBrowserPreference(enabled: boolean): boolean {
  try {
    setSavingEnabled(window.localStorage, enabled);
    return true;
  } catch {
    return false;
  } finally {
    refresh();
  }
}

export function saveBrowserDraft(draft: Draft, expected: string | null) {
  try {
    return writeDraft(window.localStorage, draft, expected);
  } catch {
    return { kind: "unavailable" as const };
  } finally {
    refresh();
  }
}

export function removeBrowserDraft(draft: Draft | "all"): boolean {
  try {
    const storage = window.localStorage;
    if (draft === "all") deleteAllDrafts(storage);
    else deleteDraft(storage, draft);
    return true;
  } catch {
    return false;
  } finally {
    refresh();
  }
}
