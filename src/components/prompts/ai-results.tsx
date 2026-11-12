"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { ResultCandidate } from "@/lib/prompt-results";
import { DecisionDialog } from "./prompt-controls";

export function ExternalAnswer({ answer, saving, onChange, related }: {
  answer?: string;
  saving: boolean;
  onChange: (answer: string | undefined) => void;
  related: readonly { id: string; title: string }[];
}) {
  const id = useId();
  const [edited, setEdited] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const text = edited ?? answer ?? "";

  return (
    <>
      <section className="answer-panel" aria-labelledby={`${id}-heading`}>
        <h3 id={`${id}-heading`}>AI가 작성한 결과 보관하기 (선택)</h3>
        <p id={`${id}-help`}>외부 AI의 답변을 직접 붙여넣으세요. 학생은 가명으로 바꾸고 식별 정보나 민감정보는 지워 주세요.</p>
        <label htmlFor={id}>외부 AI 답변</label>
        <textarea className="prompt-input" id={id} aria-describedby={`${id}-help`} value={text} rows={5}
          autoComplete="off" spellCheck={false} onChange={(event) => { setEdited(event.target.value); setMessage(""); }} />
        <p className="muted">{saving
          ? "자동 저장이 켜져 있으면 이 브라우저의 작성본에 보관합니다."
          : "자동 저장이 꺼져 있으면 이 탭에서 앱을 이용하는 동안 보관합니다. 새로고침하거나 탭을 닫으면 사라집니다."}</p>
        <div className="prompt-actions">
          <button type="button" className="action action-secondary" disabled={!text.trim() || text === answer}
            onClick={() => { onChange(text); setEdited(null); setMessage("현재 작성본에 답변을 보관했습니다."); }}>
            {answer ? "답변 수정 반영" : "답변 보관"}
          </button>
          {answer && (
            <button type="button" className="action action-secondary" onClick={() => setConfirmDelete(true)}>보관한 답변 삭제</button>
          )}
        </div>
        {edited !== null && edited !== answer && <p className="muted">답변을 보관하면 후속 입력에서 선택할 수 있습니다.</p>}
        <p role="status">{message}</p>
      </section>
      {related.length > 0 && (
        <section className="answer-panel" aria-labelledby={`${id}-related`}>
          <h3 id={`${id}-related`}>관련 후속 프롬프트</h3>
          <ul>
            {related.map(({ id: targetId, title }) => (
              <li key={targetId}><Link className="answer-link" href={`/prompts/${targetId}`}>{title} 작성하기</Link></li>
            ))}
          </ul>
        </section>
      )}
      {confirmDelete && (
        <DecisionDialog title="보관한 AI 답변을 삭제할까요?"
          description={saving
            ? "현재 작성본의 답변을 삭제합니다. 저장에 반영된 삭제는 복구할 수 없습니다."
            : "현재 이용 중인 작성본에서 답변을 삭제합니다. 자동 저장을 끄기 전에 저장한 작성본은 내 데이터 관리에서 삭제할 수 있습니다."}
          onCancel={() => setConfirmDelete(false)}>
          <button type="button" className="action action-danger" onClick={() => {
            onChange(undefined);
            setEdited(null);
            setMessage("현재 작성본에서 답변을 삭제했습니다.");
            setConfirmDelete(false);
          }}>답변 삭제 확인</button>
        </DecisionDialog>
      )}
    </>
  );
}

export function PreviousAnswer({ fieldLabel, existing, candidates, onImport }: {
  fieldLabel: string;
  existing: string;
  candidates: ResultCandidate[];
  onImport: (text: string) => void;
}) {
  const id = useId();
  const [selectedKey, setSelectedKey] = useState("");
  const [pending, setPending] = useState<ResultCandidate | null>(null);
  const [message, setMessage] = useState("");
  const selected = candidates.find(({ key }) => key === selectedKey);

  function apply(candidate: ResultCandidate) {
    const current = candidates.find(({ key }) => key === candidate.key);
    if (current?.text !== candidate.text) {
      setMessage("선택한 답변이 바뀌었거나 삭제되었습니다. 답변을 다시 선택하거나 직접 붙여넣어 주세요.");
      return;
    }
    onImport(candidate.text);
    setMessage(`${fieldLabel}에 답변을 넣었습니다.`);
  }

  return (
    <section className="answer-panel" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{fieldLabel}에 이전 AI 답변 가져오기</h3>
      {candidates.length === 0 ? <p>가져올 수 있는 답변이 없습니다. 위 입력란에 직접 붙여넣을 수 있습니다.</p> : (
        <>
          <label htmlFor={id}>출처 작성본 선택</label>
          <select className="prompt-input" id={id} value={selected?.key ?? ""}
            onChange={(event) => { setSelectedKey(event.target.value); setMessage(""); }}>
            <option value="">작성본을 선택하세요</option>
            {candidates.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.title} · 버전 {entry.version} · {entry.origin === "memory" ? "현재 이용 중" : "이 브라우저에 저장"}
              </option>
            ))}
          </select>
          {selected && (
            <>
              <p><strong>답변 미리보기</strong></p>
              {selected.version !== selected.currentVersion && (
                <p className="muted">이전 버전의 보관 답변입니다. 현재 입력에 맞는지 확인해 주세요.</p>
              )}
              <pre tabIndex={0} aria-label="이전 AI 답변 미리보기">{selected.text}</pre>
              <div><button type="button" className="action action-secondary"
                onClick={() => existing.trim() && existing !== selected.text ? setPending(selected) : apply(selected)}>
                이 답변 가져오기
              </button></div>
            </>
          )}
        </>
      )}
      <p role="status">{message}</p>
      {pending && (
        <DecisionDialog title="기존 입력을 바꿀까요?"
          description={`${fieldLabel} 입력만 선택한 답변으로 바꿉니다. 기존 완성본과 편집본은 유지됩니다.`}
          onCancel={() => setPending(null)}>
          <button type="button" className="action" onClick={() => { apply(pending); setPending(null); }}>입력 교체 확인</button>
        </DecisionDialog>
      )}
    </section>
  );
}
