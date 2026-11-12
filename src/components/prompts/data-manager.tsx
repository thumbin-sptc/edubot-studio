"use client";

import { useState } from "react";
import { changeBrowserPreference, removeBrowserDraft, useDraftStorage } from "@/lib/browser-drafts";
import { draftKey, type Draft } from "@/lib/prompt-drafts";
import { DraftArchive } from "./draft-output";
import { DecisionDialog, StorageToggle } from "./prompt-controls";

export function DataManager() {
  const storage = useDraftStorage();
  const [selected, setSelected] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<Draft | "all" | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  function toggleStorage() {
    const ok = changeBrowserPreference(!storage.enabled);
    setMessage(ok ? null : { error: true, text: "저장 설정을 변경하지 못했습니다. 브라우저 설정을 확인해 주세요." });
  }

  function confirmDelete() {
    if (!deletion) return;
    if (removeBrowserDraft(deletion)) {
      if (deletion === "all" || selected === draftKey(deletion)) setSelected(null);
      setMessage({ error: false, text: "저장된 작성본을 삭제했습니다." });
    } else {
      setMessage({ error: true, text: "삭제를 완료하지 못했습니다. 남은 작성본을 확인하고 다시 시도해 주세요." });
    }
    setDeletion(null);
  }

  if (!storage.ready) return <p role="status">브라우저 저장 설정을 확인하고 있습니다.</p>;

  return (
    <>
      <section className="info-panel">
        <h2>자동 저장 설정</h2>
        <StorageToggle enabled={storage.enabled} available={storage.available} onToggle={toggleStorage} />
        <p>작성본은 이 브라우저에 평문으로 저장됩니다. 학생 실명, 개인 식별자, 민감정보는 넣지 마세요. 공용 기기에서는 저장을 끄고, 브라우저를 초기화하거나 기기를 바꾸면 작성본이 사라질 수 있습니다.</p>
      </section>
      <section className="info-panel">
        <div className="draft-list-heading">
          <h2>저장된 작성본</h2>
          <button className="action action-secondary" type="button"
            disabled={!storage.available || (!storage.drafts.length && !storage.unreadable)}
            onClick={() => setDeletion("all")}>전체 삭제</button>
        </div>
        {storage.available && !storage.drafts.length && <p>열람할 수 있는 저장본이 없습니다.</p>}
        {storage.unreadable > 0 && <p>이 버전에서 열 수 없는 작성본 {storage.unreadable}개가 있습니다. 전체 삭제로 제거할 수 있습니다.</p>}
        {storage.drafts.length > 0 && (
          <ul className="draft-list">
            {storage.drafts.map(({ draft }) => {
              const key = draftKey(draft);
              const open = selected === key;
              return (
                <li key={key}>
                  <h3>{draft.promptTitle}</h3>
                  <p>버전 {draft.templateVersion} · <time dateTime={draft.updatedAt}>
                    {new Date(draft.updatedAt).toLocaleString("ko-KR")}
                  </time></p>
                  <div className="prompt-actions">
                    <button className="action action-secondary" type="button" aria-expanded={open}
                      aria-label={`${draft.promptTitle} 버전 ${draft.templateVersion} ${open ? "닫기" : "열람"}`}
                      onClick={() => setSelected(open ? null : key)}>{open ? "닫기" : "열람"}</button>
                    <button className="action action-secondary" type="button"
                      aria-label={`${draft.promptTitle} 버전 ${draft.templateVersion} 삭제`}
                      onClick={() => setDeletion(draft)}>삭제</button>
                  </div>
                  {open && <div className="draft-archive"><DraftArchive key={key} draft={draft} /></div>}
                </li>
              );
            })}
          </ul>
        )}
        <p role={message?.error ? "alert" : "status"} className={message?.error ? "prompt-error" : undefined}>
          {message?.text}
        </p>
      </section>
      {deletion && (
        <DecisionDialog
          title={deletion === "all" ? "저장된 작성본을 모두 삭제할까요?" : "이 작성본을 삭제할까요?"}
          description="이 브라우저의 선택한 작성본을 삭제합니다. 삭제한 작성본은 복구할 수 없습니다."
          onCancel={() => setDeletion(null)}
        >
          <button className="action action-danger" type="button" onClick={confirmDelete}>삭제 확인</button>
        </DecisionDialog>
      )}
    </>
  );
}
