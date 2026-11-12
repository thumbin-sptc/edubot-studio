"use client";

import { setSavingEnabled } from "./save-preference";

const changeEvent = "edubot-studio:storage-change";

export function observeStudioStorage(refresh: () => void) {
  window.addEventListener(changeEvent, refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key.startsWith("edubot-studio:")) refresh();
  });
}

export function notifyStudioStorage() {
  window.dispatchEvent(new Event(changeEvent));
}

export function changeBrowserPreference(enabled: boolean): boolean {
  try {
    setSavingEnabled(window.localStorage, enabled);
    return true;
  } catch {
    return false;
  } finally {
    notifyStudioStorage();
  }
}
