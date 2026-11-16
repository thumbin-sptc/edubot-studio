"use client";

import { useId, type ReactNode } from "react";
import type { CreateProgress } from "@/lib/create/session";

type MoveToStep = (stepId: string | null) => void;
type CreateWizardFlowProps = {
  steps: ReadonlyArray<{ id: string; title: string }>;
  progress: Pick<CreateProgress, "stepId" | "checked">;
  onMove: MoveToStep;
  children: (headingId: string, move: MoveToStep) => ReactNode;
};

export function CreateWizardFlow({ steps, progress, onMove, children }: CreateWizardFlowProps) {
  const progressId = useId();
  const headingId = `${progressId}-stage-heading`;
  const stepIndex = steps.findIndex(({ id }) => id === progress.stepId);
  const step = steps[stepIndex];
  const completedCount = steps.filter(({ id }) => progress.checked.includes(id)).length;

  function move(stepId: string | null) {
    onMove(stepId);
    requestAnimationFrame(() => document.getElementById(headingId)?.focus());
  }

  return (
    <>
      <nav className="prompt-steps" aria-label="제작 단계">
        <div className="step-progress">
          <label htmlFor={progressId}>제작 진행률</label>
          <span>{step ? stepIndex + 1 : steps.length} / {steps.length}단계 · 직접 확인 {completedCount}개</span>
        </div>
        <progress id={progressId} value={step ? stepIndex + 1 : steps.length} max={steps.length} />
        <ol>
          {steps.map((target, index) => (
            <li key={target.id}>
              <button type="button" aria-current={target.id === step?.id ? "step" : undefined}
                onClick={() => move(target.id)}>
                <span>{index + 1}. {target.title}</span>
                {progress.checked.includes(target.id) && <span className="step-complete">직접 확인</span>}
              </button>
            </li>
          ))}
          <li><button type="button" aria-current={!step ? "step" : undefined} onClick={() => move(null)}>완료 후 점검</button></li>
        </ol>
      </nav>
      {children(headingId, move)}
      <nav className="prompt-step-actions" aria-label="이전 및 다음 제작 단계">
        {stepIndex !== 0 && (
          <button type="button" className="action action-secondary"
            onClick={() => move(steps[step ? stepIndex - 1 : steps.length - 1].id)}>이전</button>
        )}
        {step && (
          <button type="button" className="action" onClick={() => move(steps[stepIndex + 1]?.id ?? null)}>
            {stepIndex === steps.length - 1 ? "완료 후 점검 보기" : "다음"}
          </button>
        )}
      </nav>
    </>
  );
}

export function CreateStepCheck({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="create-self-check">
      <label className="create-checkbox">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      <p className="muted">외부 AI에서 작업을 마쳤는지 직접 확인해 주세요.</p>
    </div>
  );
}
