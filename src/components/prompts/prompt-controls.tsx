"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { copyPromptText } from "@/lib/prompt-engine";

export function DecisionDialog({ title, description, onCancel, children }: {
  title: string;
  description: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
    return () => dialog?.close();
  }, []);

  function cancel() {
    ref.current?.close();
    onCancel();
  }

  return (
    <dialog
      ref={ref}
      className="prompt-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); cancel(); }}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-description`} className="muted">{description}</p>
      <div className="prompt-actions">
        <button className="action action-secondary" type="button" data-cancel onClick={cancel}>취소</button>
        {children}
      </div>
    </dialog>
  );
}

export function StorageToggle({ enabled, available, onToggle }: {
  enabled: boolean;
  available: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <div className="storage-toggle">
      <label>
        <input type="checkbox" role="switch" checked={enabled} disabled={!available}
          aria-describedby={id} onChange={onToggle} />
        이 브라우저에 자동 저장
      </label>
      <p className="muted" id={id} aria-live="polite">
        {!available ? "이 브라우저에서는 저장소를 사용할 수 없습니다." : enabled
          ? "저장 켜짐 · 작성본을 이 브라우저에 저장합니다."
          : "저장 꺼짐 · 새 입력은 메모리에만 보관하며 기존 저장본은 유지합니다."}
      </p>
    </div>
  );
}

export function CopyPrompt({ text, target }: { text: string; target: RefObject<HTMLTextAreaElement | null> }) {
  const [status, setStatus] = useState<{ text: string; result: "copied" | "manual" } | null>(null);
  const [copying, setCopying] = useState(false);
  const current = status?.text === text ? status.result : null;

  async function copy() {
    setStatus(null);
    setCopying(true);
    const clipboard = navigator.clipboard;
    const result = await copyPromptText(text, clipboard?.writeText?.bind(clipboard));
    setCopying(false);
    if (target.current?.value !== text) return;
    setStatus({ text, result });
    if (result === "manual") {
      target.current.focus();
      target.current.select();
    }
  }

  return (
    <div className="prompt-copy">
      <p className="muted">외부 AI에 붙여넣으면 해당 서비스의 데이터 처리 정책이 적용됩니다. 학생을 식별할 수 있는 정보는 지워 주세요.</p>
      <button className="action" type="button" onClick={copy} disabled={copying || !text.trim()}>프롬프트 복사</button>
      <p className="prompt-copy-status" role="status">
        {current === "copied" && "프롬프트를 복사했습니다."}
        {current === "manual" && "자동 복사를 사용할 수 없습니다. 본문을 선택한 뒤 기기의 복사 메뉴 또는 Ctrl+C / ⌘C를 사용해 주세요."}
      </p>
    </div>
  );
}
