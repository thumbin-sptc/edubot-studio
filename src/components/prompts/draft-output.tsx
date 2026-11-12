"use client";

import { useRef } from "react";
import { currentOutput, type Draft } from "@/lib/prompt-drafts";
import { isChoiceValue } from "@/lib/prompt-engine";
import { CopyPrompt } from "./prompt-controls";

export function DraftOutput({ output, onChange }: { output: string; onChange?: (text: string) => void }) {
  const target = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="prompt-output">
      <label htmlFor="prompt-output">완성 프롬프트</label>
      <textarea ref={target} id="prompt-output" className="prompt-input" rows={9} value={output}
        autoComplete="off" spellCheck={false}
        readOnly={!onChange} onChange={(event) => onChange?.(event.target.value)} />
      <CopyPrompt text={output} target={target} />
    </div>
  );
}

export function DraftArchive({ draft }: { draft: Draft }) {
  const fieldEntries = Object.entries(draft.fieldValues).map(([id, value]) => {
    const text = isChoiceValue(value)
      ? [...value.selected, ...(value.useOther ? [value.other] : [])].join(", ")
      : Array.isArray(value) ? value.join("\n") : value;
    return [id, text];
  });
  const attachments = Object.entries(draft.attachmentModes).map(([id, mode]) => [
    id, mode === "external-file" ? "외부 AI에 파일로 첨부" : draft.attachmentTexts[id] ?? "",
  ]);
  const entries = [...fieldEntries, ...attachments].filter(([, text]) => text.trim());
  const output = currentOutput(draft);

  return (
    <div className="grid gap-4">
      {entries.length > 0 && (
        <dl className="draft-inputs">
          {entries.map(([id, text]) => (
            <div key={id}>
              <dt>{Object.hasOwn(draft.labels, id) ? draft.labels[id] : id}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      )}
      {output !== null ? <DraftOutput output={output} /> : <p>저장된 완성 프롬프트가 없습니다.</p>}
      {draft.externalAiResult && (
        <div className="draft-inputs">
          <strong>이전에 보관한 AI 답변</strong>
          <p>{draft.externalAiResult}</p>
        </div>
      )}
    </div>
  );
}
