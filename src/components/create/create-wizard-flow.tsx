"use client";

import { useEffect, useId, type ReactNode } from "react";
import type { CreateProgress } from "@/lib/create/session";

type MoveToStep = (stepId: string | null) => void;
type CreateWizardFlowProps = {
  steps: ReadonlyArray<{ id: string; title: string }>;
  progress: Pick<CreateProgress, "stepId" | "checked">;
  onMove: MoveToStep;
  focusOnMount?: boolean;
  children: (headingId: string, move: MoveToStep) => ReactNode;
};

export function CreateWizardFlow({ steps, progress, onMove, focusOnMount = false, children }: CreateWizardFlowProps) {
  const progressId = useId();
  const headingId = `${progressId}-stage-heading`;
  const stepIndex = steps.findIndex(({ id }) => id === progress.stepId);
  const step = steps[stepIndex];
  const totalStages = steps.length + 1;
  const currentStage = step ? stepIndex + 1 : totalStages;
  const completedCount = steps.filter(({ id }) => progress.checked.includes(id)).length;

  useEffect(() => {
    if (focusOnMount) document.getElementById(headingId)?.focus();
  }, [focusOnMount, headingId]);

  function move(stepId: string | null) {
    onMove(stepId);
    requestAnimationFrame(() => document.getElementById(headingId)?.focus());
  }

  return (
    <>
      <nav className="prompt-steps" aria-label="제작 단계">
        <div className="step-progress">
          <label htmlFor={progressId}>제작 진행률</label>
          <span>단계 {currentStage} / 전체 {totalStages} · 직접 확인 {completedCount}개</span>
        </div>
        <progress id={progressId} value={currentStage} max={totalStages} />
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
          <li><button type="button" aria-current={!step ? "step" : undefined} onClick={() => move(null)}>
            {totalStages}. 완료 후 점검
          </button></li>
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

export function CreateStepCheck({ label, checked, onChange, showCriterion = false }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  showCriterion?: boolean;
}) {
  const criterionId = useId();
  return (
    <div className="create-self-check">
      {showCriterion && <p id={criterionId}><strong>직접 확인할 것</strong> {label}</p>}
      <label className="create-checkbox">
        <input type="checkbox" checked={checked} aria-describedby={showCriterion ? criterionId : undefined}
          onChange={(event) => onChange(event.target.checked)} />
        {showCriterion ? "직접 확인했어요" : label}
      </label>
      {!showCriterion && <p className="muted">외부 AI에서 작업을 마쳤는지 직접 확인해 주세요.</p>}
    </div>
  );
}
