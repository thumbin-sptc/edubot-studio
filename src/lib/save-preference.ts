export const savePreferenceKey = "edubot-studio:save-enabled";

export function isSavingEnabled(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(savePreferenceKey) === "true";
}

export function setSavingEnabled(storage: Pick<Storage, "setItem">, enabled: boolean): void {
  storage.setItem(savePreferenceKey, String(enabled));
}
