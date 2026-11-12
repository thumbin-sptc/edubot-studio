"use client";

import { useSyncExternalStore } from "react";
import { notifyStudioStorage, observeStudioStorage } from "../browser-storage";
import { isSavingEnabled } from "../save-preference";
import {
  deleteCreateData, newCreateSession, readCreateRecord, writeCreateRecord, type CreateRecord, type CreateSession,
} from "./session";

type Snapshot = {
  ready: boolean;
  available: boolean;
  enabled: boolean;
  stored: CreateRecord;
  session: CreateSession;
  paused: boolean;
  message: string;
  conflict: CreateRecord | null;
};

const emptyRecord: CreateRecord = { raw: null, session: null };
const initial: Snapshot = {
  ready: false, available: false, enabled: false, stored: emptyRecord, session: newCreateSession(),
  paused: false, message: "", conflict: null,
};
let snapshot = initial;
let expectedRaw: string | null = null;
let dirty = false;
let reviewRequired = false;
let observing = false;
const subscribers = new Set<() => void>();

function publish(changes: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...changes };
  for (const listener of subscribers) listener();
}

function showConflict(conflict: CreateRecord) {
  reviewRequired = true;
  publish({ conflict, paused: true, message: "자동 저장을 일시 중지했습니다. 현재 제작 입력은 화면에 남아 있습니다." });
}

function showSaveError() {
  publish({ paused: true, message: "브라우저에 저장하지 못했습니다. 현재 제작 입력은 화면에 남아 있습니다." });
}

function persist(expected: string | null) {
  try {
    const result = writeCreateRecord(window.localStorage, snapshot.session, expected);
    if (result.kind === "conflict") showConflict(result.existing);
    if (result.kind === "saved") {
      expectedRaw = result.raw;
      dirty = false;
      reviewRequired = false;
      publish({ paused: false, conflict: null, message: "" });
      notifyStudioStorage();
    }
  } catch {
    showSaveError();
  }
}

function refresh() {
  try {
    const storage = window.localStorage;
    const enabled = isSavingEnabled(storage);
    const stored = readCreateRecord(storage);
    const newlyEnabled = enabled && !snapshot.enabled;
    publish({ ready: true, available: true, enabled, stored });

    if (!enabled) {
      reviewRequired = false;
      if (snapshot.conflict || snapshot.paused) publish({ conflict: null, paused: false, message: "" });
      return;
    }
    if (!newlyEnabled) return;
    if (dirty) {
      if (stored.raw === null) persist(null);
      else showConflict(stored);
    } else if (stored.session) {
      expectedRaw = stored.raw;
      publish({ session: stored.session, paused: false, message: "" });
    } else if (stored.raw !== null) {
      showConflict(stored);
    }
  } catch {
    publish({
      ready: true, available: false, enabled: false, stored: emptyRecord, conflict: null,
      message: "브라우저 저장소를 읽지 못했습니다. 현재 제작 입력은 화면에 남아 있습니다.",
    });
  }
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (!observing) {
    observing = true;
    observeStudioStorage(refresh);
    refresh();
  }
  return () => { subscribers.delete(listener); };
}

export function useCreateSession() {
  return useSyncExternalStore(subscribe, () => snapshot, () => initial);
}

export function updateCreateSession(change: (previous: CreateSession) => CreateSession) {
  const next = change(snapshot.session);
  if (next === snapshot.session) return;
  dirty = true;
  publish({ session: { ...next, updatedAt: new Date().toISOString() } });
  if (snapshot.enabled && !snapshot.paused) persist(expectedRaw);
}

export function retryCreateSave() {
  if (!snapshot.enabled) return;
  if (!reviewRequired) return persist(expectedRaw);
  try {
    showConflict(readCreateRecord(window.localStorage));
  } catch {
    showSaveError();
  }
}

export function cancelCreateConflict() {
  publish({ conflict: null });
}

export function resolveCreateConflict(keep: "memory" | "saved") {
  const conflict = snapshot.conflict;
  if (!conflict || !snapshot.enabled) return;
  try {
    const current = readCreateRecord(window.localStorage);
    if (current.raw !== conflict.raw) {
      showConflict(current);
      return;
    }
    if (keep === "memory") {
      expectedRaw = current.raw;
      reviewRequired = false;
      publish({ conflict: null });
      persist(current.raw);
    } else if (current.session) {
      expectedRaw = current.raw;
      dirty = false;
      reviewRequired = false;
      publish({ session: current.session, paused: false, conflict: null, message: "" });
    }
  } catch {
    publish({ conflict: null });
    showSaveError();
  }
}

export function removeBrowserCreateData(includePrompts: boolean): boolean {
  try {
    return deleteCreateData(window.localStorage, includePrompts);
  } catch {
    return false;
  } finally {
    notifyStudioStorage();
  }
}
