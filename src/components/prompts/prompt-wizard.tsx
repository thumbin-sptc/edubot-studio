"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDraftStorage } from "@/lib/browser-drafts";
import {
  currentOutput, draftKey, needsRegenerationConfirmation, restoreGeneratedOutput,
  withGeneratedOutput, type SavedDraftRecord,
} from "@/lib/prompt-drafts";
import { generatePrompt, getFieldValue, validatePromptInputs } from "@/lib/prompt-engine";
import type { PromptStep, PublishedPrompt } from "@/lib/prompt-template";
import { DraftOutput } from "./draft-output";
import { DecisionDialog, StorageToggle } from "./prompt-controls";
import { useWizardDraft } from "./use-wizard-draft";
import { AttachmentField, fieldDomId, WizardField } from "./wizard-fields";

type StorageState = ReturnType<typeof useDraftStorage>;
type OutputDecision = { type: "restore" } | { type: "regenerate"; output: string };

export function PromptWizard({ template }: { template: PublishedPrompt }) {
  const storage = useDraftStorage();
  const identity = { promptId: template.id, templateVersion: template.version };
  const key = draftKey(identity);
  const initial = storage.enabled ? storage.drafts.find(({ draft }) => draftKey(draft) === key) : undefined;
  const older = storage.drafts.filter(({ draft }) => draft.promptId === template.id && draft.templateVersion !== template.version);

  return (
    <section data-prompt-wizard className="shell subpage prompt-wizard">
      <Link className="prompt-back" href="/prompts">← 프롬프트 라이브러리</Link>
      <h1>{template.title}</h1>
      {template.summary && <p className="page-description">{template.summary}</p>}
      <p className="prompt-version">템플릿 버전 {template.version}</p>
      <section className="info-panel prompt-privacy">
        <h2>작성 전 개인정보 보호</h2>
        <p>학생 이름은 가명으로 적고, 학번이나 건강 정보 등 학생을 식별할 수 있는 정보는 입력하지 마세요. 작성 내용은 이 앱의 서버로 전송하지 않습니다.</p>
      </section>
      {storage.ready
        ? <WizardSession key={key} template={template} storage={storage} initial={initial} older={older} />
        : <p role="status">작성 화면을 준비하고 있습니다.</p>}
    </section>
  );
}

function WizardSession({ template, storage, initial, older }: {
  template: PublishedPrompt;
  storage: StorageState;
  initial?: SavedDraftRecord;
  older: SavedDraftRecord[];
}) {
  const session = useWizardDraft(template, storage, initial);
  const { draft, update } = session;
  const [started, setStarted] = useState(Boolean(initial) || older.length === 0);
  const [checkedFields, setCheckedFields] = useState<Set<string>>(() => new Set());
  const [decision, setDecision] = useState<OutputDecision | null>(null);
  const [focus, setFocus] = useState<{ id: string } | null>(null);
  const resultStep = template.steps[template.steps.length - 1];
  const stepIndex = Math.max(template.steps.findIndex(({ id }) => id === draft.currentStepId), 0);
  const step = template.steps[stepIndex];
  const nextStep = template.steps[stepIndex + 1];
  const errors = validatePromptInputs(template, draft);
  const stageId = "prompt-stage-heading";
  const output = currentOutput(draft);
  const resultsStale = output !== null && (errors.size > 0 || generatePrompt(template, draft) !== draft.generatedOutput);

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);

  function stepFields(target: PromptStep): string[] {
    if (target.kind === "input") return target.fieldIds;
    return target.kind === "references" ? template.attachments.map(({ id }) => id) : [];
  }

  function moveTo(stepId: string, fieldId?: string) {
    if (stepId !== draft.currentStepId) update({ ...draft, currentStepId: stepId });
    setFocus({ id: fieldId ? fieldDomId(fieldId) : stageId });
  }

  function showErrors(target: PromptStep, ids: string[]) {
    setCheckedFields((previous) => new Set([...previous, ...ids]));
    moveTo(target.id, ids[0]);
  }

  function complete(text: string) {
    update({
      ...withGeneratedOutput(draft, text),
      currentStepId: resultStep.id,
      completedStepIds: template.steps.map(({ id }) => id),
    });
    setFocus({ id: stageId });
  }

  function finish() {
    for (const target of template.steps) {
      const invalid = stepFields(target).filter((id) => errors.has(id));
      if (invalid.length) {
        showErrors(target, invalid);
        return;
      }
    }
    const generated = generatePrompt(template, draft);
    if (needsRegenerationConfirmation(draft, generated)) setDecision({ type: "regenerate", output: generated });
    else complete(generated);
  }

  function goNext() {
    const invalid = stepFields(step).filter((id) => errors.has(id));
    if (invalid.length && nextStep.kind !== "generated-output") showErrors(step, invalid);
    else if (nextStep.kind === "generated-output") finish();
    else {
      update({
        ...draft,
        currentStepId: nextStep.id,
        completedStepIds: [...new Set([...draft.completedStepIds, step.id])],
      });
      setFocus({ id: stageId });
    }
  }

  function isComplete(target: PromptStep) {
    if (target.kind === "generated-output") return draft.generatedOutput !== null && !resultsStale;
    return draft.completedStepIds.includes(target.id) && stepFields(target).every((id) => !errors.has(id));
  }

  if (!started && older.length > 0) {
    return (
      <section className="info-panel prompt-stage">
        <h2>이전 버전 작성본이 있습니다</h2>
        <p>저장된 버전 {older.map(({ draft: record }) => record.templateVersion).join(", ")}의 작성본과 완성본은 내 데이터 관리에서 열람하거나 복사할 수 있습니다. 현재 버전을 시작해도 이전 작성본은 보존됩니다.</p>
        <div className="prompt-actions">
          <Link href="/data" className="action action-secondary">이전 작성본 열람·복사</Link>
          <button className="action" type="button" onClick={() => {
            setStarted(true);
            setFocus({ id: stageId });
          }}>현재 버전에서 새로 시작</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="info-panel prompt-storage" aria-label="저장 설정">
        <StorageToggle enabled={storage.enabled} available={storage.available} onToggle={session.toggle} />
        <p>공용 기기에서는 자동 저장을 끄세요. <Link href="/data">저장본 열람·삭제</Link></p>
        {session.message && <p role="alert" className="prompt-error">{session.message}</p>}
        {storage.enabled && session.paused && (
          <button className="action action-secondary" type="button" onClick={session.retry}>자동 저장 다시 시도</button>
        )}
      </section>
      {template.mode === "wizard" && (
        <nav className="prompt-steps" aria-label="작성 단계">
          <div className="step-progress">
            <label htmlFor="prompt-progress">작성 진행률</label>
            <span>{stepIndex + 1} / {template.steps.length}단계</span>
          </div>
          <progress id="prompt-progress" value={stepIndex + 1} max={template.steps.length} />
          <ol>
            {template.steps.map((target, index) => (
              <li key={target.id}>
                <button type="button" aria-current={target.id === step.id ? "step" : undefined}
                  onClick={() => target.kind === "generated-output" ? finish() : moveTo(target.id)}>
                  <span>{index + 1}. {target.title}</span>
                  {isComplete(target) && <span className="step-complete">완료</span>}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <section className="info-panel prompt-stage" aria-labelledby={stageId}>
        <h2 id={stageId} tabIndex={-1}>{step.title}</h2>
        {step.description && <p>{step.description}</p>}
        {step.kind === "input" && (
          <div className="prompt-fields">
            {step.fieldIds.map((id) => {
              const field = template.fields.find((entry) => entry.id === id)!;
              return <WizardField key={id} field={field} value={getFieldValue(draft, id)}
                error={checkedFields.has(id) ? errors.get(id) : undefined}
                onChange={(value) => update({ ...draft, fieldValues: { ...draft.fieldValues, [id]: value } })} />;
            })}
          </div>
        )}
        {step.kind === "references" && (
          <div className="prompt-fields">
            {template.attachments.map((attachment) => {
              const { id } = attachment;
              return <AttachmentField key={id} attachment={attachment}
                mode={Object.hasOwn(draft.attachmentModes, id) ? draft.attachmentModes[id] : undefined}
                text={Object.hasOwn(draft.attachmentTexts, id) ? draft.attachmentTexts[id] : ""}
                error={checkedFields.has(id) ? errors.get(id) : undefined}
                onModeChange={(mode) => {
                  const attachmentModes = { ...draft.attachmentModes };
                  if (mode) attachmentModes[id] = mode;
                  else delete attachmentModes[id];
                  update({ ...draft, attachmentModes });
                }}
                onTextChange={(text) => update({ ...draft, attachmentTexts: { ...draft.attachmentTexts, [id]: text } })} />;
            })}
          </div>
        )}
        {step.kind === "generated-output" && output !== null && (
          <>
            {resultsStale && (
              <div className="result-notice">
                <p>입력 변경 사항이 아직 완성본에 반영되지 않았습니다. 아래에는 기존 완성본이 표시됩니다.</p>
                <button className="action action-secondary" type="button" onClick={finish}>입력 반영해 다시 생성</button>
              </div>
            )}
            <DraftOutput output={output} onChange={(text) => update({ ...draft, editedOutput: text })} />
            <div className="prompt-actions">
              {template.mode === "wizard" && (
                <button className="action action-secondary" type="button"
                  onClick={() => moveTo(template.steps[0].id)}>입력 내용 수정</button>
              )}
              {draft.editedOutput !== null && (
                <button className="action action-secondary" type="button"
                  onClick={() => setDecision({ type: "restore" })}>자동 생성본으로 복원</button>
              )}
            </div>
          </>
        )}
      </section>
      {step.kind !== "generated-output" && (
        <nav className="prompt-step-actions" aria-label="이전 및 다음 단계">
          {stepIndex > 0 && <button className="action action-secondary" type="button"
            onClick={() => moveTo(template.steps[stepIndex - 1].id)}>이전</button>}
          {output !== null && <button className="action action-secondary" type="button"
            onClick={() => moveTo(resultStep.id)}>기존 완성본 보기</button>}
          <button className="action" type="button" onClick={goNext}>
            {nextStep.kind === "generated-output" ? "완성본 만들기" : "다음"}
          </button>
        </nav>
      )}
      {decision && (
        <DecisionDialog
          title={decision.type === "restore" ? "자동 생성본으로 복원할까요?" : "입력을 반영해 완성본을 다시 만들까요?"}
          description="계속하면 기존 완성본에 직접 편집한 내용이 사라집니다."
          onCancel={() => setDecision(null)}
        >
          <button className="action" type="button" onClick={() => {
            setDecision(null);
            if (decision.type === "regenerate") complete(decision.output);
            else update(restoreGeneratedOutput(draft));
          }}>{decision.type === "restore" ? "복원 확인" : "다시 생성"}</button>
        </DecisionDialog>
      )}
      {session.conflict && (
        <DecisionDialog
          title="자동 저장에 사용할 작성본을 선택하세요"
          description={session.conflict.existing.draft
            ? "현재 화면과 브라우저에 저장된 작성본이 다릅니다. 저장할 작성본을 선택해 주세요."
            : "저장된 작성본이 삭제되었거나 현재 버전에서 열 수 없습니다. 현재 화면의 내용은 유지됩니다."}
          onCancel={session.cancelConflict}
        >
          {session.conflict.existing.draft && (
            <button className="action action-secondary" type="button" onClick={() => {
              if (session.resolveConflict("saved")) {
                setCheckedFields(new Set());
                setFocus({ id: stageId });
              }
            }}>저장된 작성본 불러오기</button>
          )}
          <button className="action" type="button" onClick={() => session.resolveConflict("memory")}>현재 작성 내용 저장</button>
        </DecisionDialog>
      )}
    </>
  );
}
