"use client";

import { useId, useRef, useState } from "react";
import { CopyPrompt } from "@/components/prompts/prompt-controls";
import { buildSelectedBundle, composeInstruction, isRecommended, isSelected, type ZipBuilder } from "@/lib/create/engine";
import { fetchKnowledgeBlob, requestZipDownload } from "@/lib/create/zip-client";
import { zipLimits } from "@/lib/create/zip-policy";
import {
  environments, personalizationFields, schoolLevels, type Instruction, type Knowledge, type Personalization, type Platform,
} from "@/lib/create/model";

export function CreateCopy({ label, text, buttonLabel, successLabel }: {
  label: string;
  text: string;
  buttonLabel: string;
  successLabel: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  return (
    <div className="prompt-output create-copy">
      <label htmlFor={id}>{label}</label>
      <textarea ref={input} id={id} className="prompt-input" value={text} readOnly autoComplete="off" spellCheck={false} rows={5} />
      <CopyPrompt text={text} target={input} buttonLabel={buttonLabel} successLabel={successLabel} />
    </div>
  );
}

export function InstructionPanel({ instruction, personalization, onChange }: {
  instruction: Instruction;
  personalization: Personalization;
  onChange: (field: keyof Personalization, value: string) => void;
}) {
  const fields = Object.entries(personalizationFields) as Array<[keyof Personalization, string]>;
  return (
    <section className="create-action">
      <h3>연구회 기본 지침</h3>
      <p className="muted">지침 버전 {instruction.version} · 선택한 개인화 항목은 기본 지침 뒤에 추가됩니다.</p>
      <details className="create-personalization">
        <summary>개인화 설정 (선택)</summary>
        <p>학생 실명, 생년월일, 학교명, 의료정보는 입력하지 마세요. 학급 구성은 학생을 식별할 수 없게 적어 주세요.</p>
        {fields.map(([field, label]) => {
          const choices = field === "schoolLevel" ? schoolLevels : field === "environment" ? environments : undefined;
          return (
            <label key={field}>
              {label}
              {choices ? (
                <select className="prompt-input" value={personalization[field] ?? ""}
                  onChange={(event) => onChange(field, event.target.value)}>
                  <option value="">선택 안 함</option>
                  {choices.map((choice) => <option key={choice}>{choice}</option>)}
                </select>
              ) : (
                <textarea className="prompt-input" rows={2} value={personalization[field] ?? ""}
                  autoComplete="off" spellCheck={false} onChange={(event) => onChange(field, event.target.value)} />
              )}
            </label>
          );
        })}
      </details>
      <CreateCopy label="복사할 지침" text={composeInstruction(instruction.coreInstruction, personalization)}
        buttonLabel="지침 복사" successLabel="지침을 복사했습니다." />
    </section>
  );
}

function DownloadLink({ file, onStart }: { file: Knowledge; onStart: (file: Knowledge) => void }) {
  return <a className="action action-secondary" href={file.path} download
    onClick={() => onStart(file)}>{file.title} 다운로드</a>;
}

export function KnowledgePanel({ platform, resources, personalization, overrides, onSelect, zipBuilder }: {
  platform: Platform;
  resources: Knowledge[];
  personalization: Personalization;
  overrides: Record<string, boolean>;
  onSelect: (id: string, selected: boolean) => void;
  zipBuilder?: ZipBuilder;
}) {
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [alternatives, setAlternatives] = useState<Knowledge[]>([]);
  const downloading = useRef(false);
  const hasSelection = resources.some((file) => isSelected(file, personalization, overrides));
  if (!resources.length) return null;

  function reportStart(file: Knowledge) {
    setMessage(`${file.title} 파일 다운로드를 시작했습니다.`);
  }

  async function downloadBundle() {
    if (!zipBuilder || downloading.current || !hasSelection) return;
    downloading.current = true;
    setWorking(true);
    setAlternatives([]);
    setMessage("선택한 파일의 ZIP을 만들고 있습니다.");
    try {
      const result = await buildSelectedBundle(resources, personalization, overrides,
        (_, file) => fetchKnowledgeBlob(file, window.location.origin), zipBuilder);
      if (result.kind === "ready") {
        requestZipDownload(result.zip);
        setMessage("ZIP 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.");
      } else if (result.kind === "empty") {
        setMessage("ZIP에 넣을 파일을 선택해 주세요.");
      } else {
        setAlternatives(result.alternatives);
        setMessage(result.kind === "limit"
          ? `ZIP은 최대 ${zipLimits.files}개, 합계 ${zipLimits.bytes / 1024 / 1024} MiB까지 만들 수 있습니다. 선택을 줄이거나 개별 다운로드를 이용해 주세요.`
          : "ZIP을 만들지 못했습니다. 아래에서 파일을 개별 다운로드해 주세요.");
      }
    } catch {
      setAlternatives(resources.filter((file) => isSelected(file, personalization, overrides)));
      setMessage("브라우저에서 ZIP 다운로드를 시작하지 못했습니다. 아래에서 파일을 개별 다운로드해 주세요.");
    } finally {
      downloading.current = false;
      setWorking(false);
    }
  }

  return (
    <section className="create-action">
      <h3>지식 자료</h3>
      <p>필요한 자료를 내려받은 뒤 이용 중인 외부 AI에서 직접 첨부해 주세요.</p>
      <ul className="create-file-list">
        {resources.map((file) => {
          const note = file.platformNotes?.[platform];
          return (
            <li key={file.id}>
              <label className="create-checkbox">
                <input type="checkbox" checked={isSelected(file, personalization, overrides)}
                  onChange={(event) => onSelect(file.id, event.target.checked)} />
                {file.title}
              </label>
              <p className="muted">
                {file.category === "common" ? "공통" : isRecommended(file, personalization) ? "추천" : "선택"}
                {" · "}{file.fileSize.toLocaleString("ko-KR")}바이트 · 버전 {file.fileVersion} · 확인일 {file.verifiedAt}
              </p>
              <p>{file.description}</p>
              {note && <p>{note.text} (확인일 {note.verifiedAt})</p>}
              <DownloadLink file={file} onStart={reportStart} />
            </li>
          );
        })}
      </ul>
      {zipBuilder && (
        <button type="button" className="action" disabled={!hasSelection || working}
          onClick={downloadBundle}>{working ? "ZIP 만드는 중" : "선택한 파일 ZIP 다운로드"}</button>
      )}
      <p role="status">{message}</p>
      {alternatives.length > 0 && (
        <ul aria-label="개별 다운로드 대안" className="create-file-list">
          {alternatives.map((file) => <li key={file.id}><DownloadLink file={file} onStart={reportStart} /></li>)}
        </ul>
      )}
    </section>
  );
}
