"use client";

import type { ReactNode } from "react";
import { emptyChoice, isChoiceValue, type ChoiceValue, type FieldValue } from "@/lib/prompt-engine";
import type { AttachmentMode, PromptAttachment, PromptField } from "@/lib/prompt-template";

export function fieldDomId(id: string): string {
  return `prompt-field-${id}`;
}

function FieldNotes({ id, helpText, privacySensitive, error, children }: {
  id: string;
  helpText?: string;
  privacySensitive?: boolean;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <div id={`${id}-notes`} className="field-notes">
      {helpText && <p>{helpText}</p>}
      {privacySensitive && <p>학생은 ‘학생 A’처럼 가명으로 적고, 식별할 수 있는 정보는 빼 주세요.</p>}
      {children}
      {error && <p className="prompt-error">{error}</p>}
    </div>
  );
}

function TextControl({ id, kind, value, required, error, notes, onChange }: {
  id: string;
  kind: "short-text" | "long-text" | "number";
  value: string;
  required: boolean;
  error?: string;
  notes: string;
  onChange: (text: string) => void;
}) {
  const props = {
    id,
    className: "prompt-input",
    value,
    required,
    autoComplete: "off",
    spellCheck: false,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": notes,
  };
  return kind === "long-text"
    ? <textarea {...props} rows={4} onChange={(event) => onChange(event.target.value)} />
    : <input {...props} type="text" inputMode={kind === "number" ? "decimal" : undefined}
        onChange={(event) => onChange(event.target.value)} />;
}

function ChoiceControls({ id, field, value, onChange }: {
  id: string;
  field: Extract<PromptField, { options: unknown }>;
  value: ChoiceValue;
  onChange: (value: ChoiceValue) => void;
}) {
  const single = field.kind === "single-select";
  const type = single ? "radio" : "checkbox";
  const selected = value.selected.filter((item) => field.options.some((option) => option.value === item));
  return (
    <div className="field-options">
      {field.options.map((option) => (
        <label key={option.value}>
          <input type={type} name={id} checked={selected.includes(option.value)}
            aria-describedby={`${id}-notes`} onChange={(event) => onChange({
              ...value,
              selected: single ? [option.value] : event.target.checked
                ? [...selected, option.value] : selected.filter((item) => item !== option.value),
              useOther: !single && field.allowOther && value.useOther,
            })} />
          {option.label}
        </label>
      ))}
      {field.allowOther && (
        <label>
          <input type={type} name={id} checked={value.useOther} aria-describedby={`${id}-notes`}
            onChange={(event) => onChange({ ...value, selected: single ? [] : selected, useOther: event.target.checked })} />
          기타
        </label>
      )}
      {field.allowOther && value.useOther && (
        <div className="grid gap-1">
          <label htmlFor={`${id}-other`}>기타 내용</label>
          <TextControl id={`${id}-other`} kind="short-text" value={value.other} required notes={`${id}-notes`}
            onChange={(other) => onChange({ ...value, other })} />
        </div>
      )}
    </div>
  );
}

function RepeatableControls({ id, field, value, error, onChange }: {
  id: string;
  field: Extract<PromptField, { kind: "repeatable" }>;
  value: string[];
  error?: string;
  onChange: (value: string[]) => void;
}) {
  function focusItem(itemId: string) {
    requestAnimationFrame(() => document.getElementById(itemId)?.focus());
  }

  return (
    <div className="field-options">
      {value.map((text, index) => {
        const itemId = `${id}-item-${index}`;
        return (
          <div key={itemId} className="repeat-item">
            <label htmlFor={itemId}>{field.label} {index + 1}</label>
            <TextControl id={itemId} kind={field.itemType} value={text} required error={error}
              notes={`${id}-notes`} onChange={(next) => onChange(value.map((item, i) => i === index ? next : item))} />
            <button className="action action-secondary" type="button" aria-label={`${field.label} ${index + 1} 삭제`}
              onClick={() => {
                onChange(value.filter((_, i) => i !== index));
                focusItem(value.length > 1 ? `${id}-item-${Math.min(index, value.length - 2)}` : `${id}-add`);
              }}>항목 삭제</button>
          </div>
        );
      })}
      <button className="action action-secondary" id={`${id}-add`} type="button"
        disabled={field.maxItems !== null && value.length >= field.maxItems}
        onClick={() => { onChange([...value, ""]); focusItem(`${id}-item-${value.length}`); }}>항목 추가</button>
    </div>
  );
}

export function WizardField({ field, value, error, onChange }: {
  field: PromptField;
  value?: FieldValue;
  error?: string;
  onChange: (value: FieldValue) => void;
}) {
  const id = fieldDomId(field.id);
  const label = <>{field.label}{field.required && <span className="field-required">필수</span>}</>;
  const notes = (
    <FieldNotes id={id} helpText={field.helpText} privacySensitive={field.privacySensitive} error={error}>
      {field.kind === "repeatable" && (
        <p>
          {field.required ? "" : "입력 시 "}최소 {Math.max(field.minItems, Number(field.required))}개
          {field.maxItems !== null && ` · 최대 ${field.maxItems}개`}
        </p>
      )}
      {(field.example || (field.kind === "repeatable" && field.exampleItems.length > 0)) && (
        <details>
          <summary>작성 예시</summary>
          {field.example && <p>{field.example}</p>}
          {field.kind === "repeatable" && (
            <ul>{field.exampleItems.map((example, index) => <li key={index}>{example}</li>)}</ul>
          )}
        </details>
      )}
    </FieldNotes>
  );

  if (field.kind === "short-text" || field.kind === "long-text" || field.kind === "number") {
    return (
      <div className="prompt-field">
        <label htmlFor={id}>{label}</label>
        {notes}
        <TextControl id={id} kind={field.kind} value={typeof value === "string" ? value : ""}
          required={field.required} error={error} notes={`${id}-notes`} onChange={onChange} />
      </div>
    );
  }
  return (
    <fieldset id={id} className="prompt-field" tabIndex={-1}
      aria-invalid={error ? true : undefined} aria-describedby={`${id}-notes`}>
      <legend>{label}</legend>
      {notes}
      {field.kind === "repeatable"
        ? <RepeatableControls id={id} field={field} value={Array.isArray(value) ? value : []} error={error} onChange={onChange} />
        : "options" in field && <ChoiceControls id={id} field={field} value={isChoiceValue(value) ? value : emptyChoice}
            onChange={onChange} />}
    </fieldset>
  );
}

export function AttachmentField({ attachment, mode, text, error, onModeChange, onTextChange }: {
  attachment: PromptAttachment;
  mode?: AttachmentMode;
  text: string;
  error?: string;
  onModeChange: (mode: AttachmentMode | "") => void;
  onTextChange: (text: string) => void;
}) {
  const id = fieldDomId(attachment.id);
  return (
    <div className="prompt-field">
      <label htmlFor={id}>{attachment.label}{attachment.required && <span className="field-required">필수</span>}</label>
      <FieldNotes id={id} helpText={attachment.helpText} privacySensitive={attachment.privacySensitive} error={error} />
      <select id={id} className="prompt-input" value={mode ?? ""} required={attachment.required}
        aria-describedby={`${id}-notes`} aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "" || value === "external-file" || value === "text-input") onModeChange(value);
        }}>
        <option value="">제공 방법 선택</option>
        {attachment.allowedModes.map((option) => (
          <option key={option} value={option}>{option === "external-file" ? "외부 AI에 파일로 첨부" : "내용 직접 입력"}</option>
        ))}
      </select>
      {mode === "external-file" && <p className="muted">프롬프트를 붙여넣은 뒤 이용 중인 외부 AI에서 파일을 직접 첨부해 주세요.</p>}
      {mode === "text-input" && (
        <>
          <label htmlFor={`${id}-text`}>{attachment.label} 내용</label>
          <TextControl id={`${id}-text`} kind="long-text" value={text} required error={error}
            notes={`${id}-notes`} onChange={onTextChange} />
        </>
      )}
    </div>
  );
}
