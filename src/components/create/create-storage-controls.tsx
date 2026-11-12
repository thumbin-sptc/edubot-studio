"use client";

import Link from "next/link";
import { useState } from "react";
import { changeBrowserPreference } from "@/lib/browser-storage";
import {
  cancelCreateConflict, resolveCreateConflict, retryCreateSave, useCreateSession,
} from "@/lib/create/browser-session";
import { DecisionDialog, StorageToggle } from "@/components/prompts/prompt-controls";

export function CreateStorageControls({ showPreference = true }: { showPreference?: boolean }) {
  const storage = useCreateSession();
  const [toggleError, setToggleError] = useState(false);
  if (!storage.ready || (!showPreference && !storage.message && !storage.conflict)) return null;

  return (
    <section className="info-panel create-storage" aria-label="제작 설정 자동 저장">
      {showPreference && (
        <>
          <StorageToggle enabled={storage.enabled} available={storage.available}
            onToggle={() => setToggleError(!changeBrowserPreference(!storage.enabled))} />
          <p>저장 데이터는 이 브라우저에 평문으로 보관됩니다. 공용 기기에서는 자동 저장을 끄세요.{" "}
            <Link className="create-text-link" href="/data">내 데이터 관리</Link>
          </p>
        </>
      )}
      {(toggleError || storage.message) && (
        <p className="prompt-error" role="alert">
          {toggleError ? "저장 설정을 변경하지 못했습니다. 브라우저 설정을 확인해 주세요." : storage.message}
        </p>
      )}
      {storage.enabled && storage.paused && (
        <div className="prompt-actions">
          <button type="button" className="action action-secondary" onClick={retryCreateSave}>자동 저장 다시 시도</button>
        </div>
      )}
      {storage.conflict && (
        <DecisionDialog title="자동 저장에 사용할 제작 설정을 선택하세요"
          description={storage.conflict.session
            ? "현재 화면과 브라우저에 저장된 제작 설정이 다릅니다. 선택한 설정의 개인화와 진행 기록을 사용합니다."
            : "저장된 제작 설정이 삭제되었거나 현재 버전에서 열 수 없습니다. 현재 화면의 내용은 유지됩니다."}
          onCancel={cancelCreateConflict}>
          {storage.conflict.session && (
            <button type="button" className="action action-secondary"
              onClick={() => resolveCreateConflict("saved")}>저장된 제작 설정 불러오기</button>
          )}
          <button type="button" className="action" onClick={() => resolveCreateConflict("memory")}>현재 제작 설정 저장</button>
        </DecisionDialog>
      )}
    </section>
  );
}
