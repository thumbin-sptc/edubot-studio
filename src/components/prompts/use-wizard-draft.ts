"use client";

import { useRef, useState } from "react";
import { changeBrowserPreference, readBrowserDraft, saveBrowserDraft, type useDraftStorage } from "@/lib/browser-drafts";
import { forgetResult, rememberResult, useResultMemory } from "@/lib/browser-results";
import { createDraft, draftKey, type Draft, type DraftRecord, type SavedDraftRecord } from "@/lib/prompt-drafts";
import type { WizardTemplate } from "@/lib/prompt-template";

type SaveConflict = { existing: DraftRecord; enable: boolean };

function resumeDraft(template: WizardTemplate, stored: Draft): Draft {
  const step = template.steps.find(({ id }) => id === stored.currentStepId);
  if (step && (step.kind !== "generated-output" || stored.generatedOutput !== null)) return stored;
  return { ...stored, currentStepId: template.steps[0].id };
}

export function useWizardDraft(
  template: WizardTemplate,
  storage: ReturnType<typeof useDraftStorage>,
  initial: SavedDraftRecord | undefined,
) {
  const memory = useResultMemory();
  const [draft, setDraft] = useState(() => {
    if (initial) return resumeDraft(template, initial.draft);
    const blank = createDraft(template);
    return { ...blank, externalAiResult: memory.get(draftKey(blank))?.externalAiResult };
  });
  const lastSaved = useRef({ raw: initial?.raw ?? null, draft: initial ? draft : null });
  const changedWhileOff = useRef(false);
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState<SaveConflict | null>(null);

  function showConflict(existing: DraftRecord, enable: boolean) {
    if (!enable) {
      setPaused(true);
      setMessage("자동 저장을 일시 중지했습니다. 현재 입력은 화면에 남아 있습니다.");
    }
    setConflict({ existing, enable });
  }

  function showStorageError() {
    setPaused(true);
    setMessage("브라우저에 저장하지 못했습니다. 현재 입력은 화면에 남아 있습니다.");
  }

  function persist(next: Draft, expected: string | null) {
    const result = saveBrowserDraft(next, expected);
    switch (result.kind) {
      case "saved":
        lastSaved.current = { raw: result.raw, draft: next };
        forgetResult(next);
        changedWhileOff.current = false;
        setPaused(false);
        setMessage("");
        break;
      case "conflict":
        showConflict(result.existing, false);
        break;
      case "unavailable":
        showStorageError();
        break;
      case "disabled":
        changedWhileOff.current = true;
        break;
    }
  }

  function update(next: Draft, answerChanged = false) {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setDraft(updated);
    if (answerChanged) rememberResult(updated);
    if (!storage.enabled) {
      changedWhileOff.current = true;
      return;
    }
    if (!paused) retrySave(updated);
  }

  function retrySave(next = draft) {
    if (changedWhileOff.current) {
      const existing = readBrowserDraft(next);
      if (!existing) return showStorageError();
      if (existing.raw !== null) return showConflict(existing, false);
    }
    persist(next, lastSaved.current.raw);
  }

  function toggle() {
    if (storage.enabled) {
      if (changeBrowserPreference(false)) {
        rememberResult(draft);
        setMessage("");
        setPaused(false);
      } else {
        setMessage("저장 설정을 변경하지 못했습니다. 브라우저 설정을 확인해 주세요.");
      }
      return;
    }

    const existing = readBrowserDraft(draft);
    if (!existing) return showStorageError();
    if (existing.raw !== null && (existing.raw !== lastSaved.current.raw || draft !== lastSaved.current.draft)) {
      showConflict(existing, true);
      return;
    }
    if (changeBrowserPreference(true)) persist(draft, existing.raw);
    else showStorageError();
  }

  function resolveConflict(keep: "memory" | "saved"): boolean {
    if (!conflict) return false;
    const existing = readBrowserDraft(draft);
    if (!existing) {
      showStorageError();
      setConflict(null);
      return false;
    }
    if (existing.raw !== conflict.existing.raw) {
      showConflict(existing, conflict.enable);
      return false;
    }
    if (conflict.enable && !changeBrowserPreference(true)) {
      showStorageError();
      setConflict(null);
      return false;
    }

    setConflict(null);
    if (keep === "memory") {
      persist(draft, existing.raw);
      return false;
    }
    if (!existing.draft) return false;
    const restored = resumeDraft(template, existing.draft);
    lastSaved.current = { raw: existing.raw, draft: restored };
    changedWhileOff.current = false;
    setDraft(restored);
    forgetResult(restored);
    setPaused(false);
    setMessage("");
    return true;
  }

  return {
    draft, update, toggle, conflict, resolveConflict, paused, message,
    updateAnswer: (externalAiResult: string | undefined) => update({ ...draft, externalAiResult }, true),
    cancelConflict: () => setConflict(null),
    retry: () => retrySave(),
  };
}
