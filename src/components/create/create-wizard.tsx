"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef } from "react";
import { updateCreateSession, useCreateSession } from "@/lib/create/browser-session";
import { completionLabels, getCompletionChecks } from "@/lib/create/engine";
import { createHref, devices, platforms, type PublishedGuide } from "@/lib/create/model";
import { getCreateProgress, hasPreviousProgress, updateCreateProgress, type CreateProgress } from "@/lib/create/session";
import { createKnowledgeZip } from "@/lib/create/zip-client";
import { CreateCopy, InstructionPanel, KnowledgePanel } from "./create-actions";
import { CreateStorageControls } from "./create-storage-controls";
import { DemoMedia } from "./demo-media";

export function CreateWizard({ guide, desktopAvailable }: { guide: PublishedGuide; desktopAvailable: boolean }) {
  const { ready, session } = useCreateSession();
  const heading = useRef<HTMLHeadingElement>(null);
  const progressId = useId();
  const progress = getCreateProgress(session, guide);
  const stepIndex = guide.steps.findIndex(({ id }) => id === progress.stepId);
  const step = guide.steps[stepIndex];
  const personalization = session.personalization;
  const completedCount = guide.steps.filter(({ id }) => progress.checked.includes(id)).length;

  function updateProgress(change: (previous: CreateProgress) => CreateProgress) {
    updateCreateSession((current) => updateCreateProgress(
      { ...current, selection: { platform: guide.platform, device: guide.device } },
      guide, change(getCreateProgress(current, guide)),
    ));
  }

  function move(stepId: string | null) {
    updateProgress((current) => ({ ...current, stepId }));
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <div className="shell create-wizard" data-create-wizard>
      <Link className="prompt-back" href="/create">← 플랫폼·기기 바꾸기</Link>
      <h1>나만의 에듀봇 만들기</h1>
      <p className="muted">{platforms[guide.platform]} · {devices[guide.device]} · 버전 {guide.version} · 확인일 {guide.verifiedAt}</p>
      {!ready ? <p role="status">제작 안내를 불러오고 있습니다.</p> : (
        <>
          <CreateStorageControls />
          {hasPreviousProgress(session, guide) && (
            <p className="info-panel">이전 가이드나 지침의 진행 기록은 보존됩니다. 현재 버전은 첫 단계부터 시작합니다.</p>
          )}
          <nav className="prompt-steps" aria-label="제작 단계">
            <div className="step-progress">
              <label htmlFor={progressId}>제작 진행률</label>
              <span>{step ? stepIndex + 1 : guide.steps.length} / {guide.steps.length}단계 · 직접 확인 {completedCount}개</span>
            </div>
            <progress id={progressId} value={step ? stepIndex + 1 : guide.steps.length} max={guide.steps.length} />
            <ol>
              {guide.steps.map((target, index) => (
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
          {step ? (
            <section className="create-stage info-panel">
              <h2 ref={heading} tabIndex={-1}>{step.title}</h2>
              <div className="create-stage-grid">
                <DemoMedia key={step.id} media={step.media} title={step.title} />
                <div className="create-step-details">
                  <p>{step.description}</p>
                  {step.mascot && (
                    <aside className="create-mascot">
                      <Image src={step.mascot.path} alt="" width={48} height={48} unoptimized />
                      <p>{step.mascot.text}</p>
                    </aside>
                  )}
                  {step.desktopAlternative && (
                    <aside className="info-panel">
                      <p>{step.desktopAlternative}</p>
                      {desktopAvailable
                        ? <Link className="create-text-link" href={createHref({ platform: guide.platform, device: "desktop-web" })}>PC 웹 제작 안내 보기</Link>
                        : <p>PC 웹 제작 안내는 준비 중입니다.</p>}
                    </aside>
                  )}
                  {step.actions.map((action, index) => {
                    const key = `${step.id}-${index}`;
                    if (action.kind === "external-link") return (
                      <div key={key}>
                        <a href={action.url} target="_blank" rel="noopener noreferrer" className="create-text-link">{action.label} (새 탭)</a>
                        <p className="muted">확인일 {action.verifiedAt}</p>
                      </div>
                    );
                    if (action.kind === "instruction") return (
                      <InstructionPanel key={key} instruction={guide.instruction} personalization={personalization}
                        onChange={(field, value) => updateCreateSession((current) => ({
                          ...current, selection: { platform: guide.platform, device: guide.device },
                          personalization: { ...current.personalization, [field]: value },
                        }))} />
                    );
                    return (
                      <KnowledgePanel key={key} platform={guide.platform} resources={guide.resources}
                        zipBuilder={createKnowledgeZip}
                        personalization={personalization} overrides={progress.selections}
                        onSelect={(id, selected) => updateProgress((current) => ({
                          ...current, selections: { ...current.selections, [id]: selected },
                        }))} />
                    );
                  })}
                  <div className="create-self-check">
                    <label className="create-checkbox">
                      <input type="checkbox" checked={progress.checked.includes(step.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          updateProgress((current) => ({
                            ...current, checked: checked ? [...new Set([...current.checked, step.id])]
                              : current.checked.filter((id) => id !== step.id),
                          }));
                        }} />
                      {step.checkLabel}
                    </label>
                    <p className="muted">외부 AI에서 작업을 마쳤는지 직접 확인해 주세요.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="create-stage info-panel">
              <h2 ref={heading} tabIndex={-1}>완료 후 점검</h2>
              <p>아래 질문을 외부 AI에 붙여넣고, 응답을 확인 기준과 비교해 보세요.</p>
              <ul className="create-file-list">
                {getCompletionChecks(guide.checks, personalization).map(({ kind, prompt, criteria, stepId }) => (
                  <li key={kind}>
                    <h3>{completionLabels[kind]}</h3>
                    <p>{criteria}</p>
                    <CreateCopy label={`${completionLabels[kind]} 질문`} text={prompt}
                      buttonLabel={`${completionLabels[kind]} 질문 복사`} successLabel="점검 질문을 복사했습니다." />
                    <button type="button" className="action action-secondary" onClick={() => move(stepId)}>
                      {guide.steps.find(({ id }) => id === stepId)?.title} 단계로 돌아가기
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <nav className="prompt-step-actions" aria-label="이전 및 다음 제작 단계">
            {stepIndex !== 0 && (
              <button type="button" className="action action-secondary"
                onClick={() => move(guide.steps[step ? stepIndex - 1 : guide.steps.length - 1].id)}>이전</button>
            )}
            {step && (
              <button type="button" className="action" onClick={() => move(guide.steps[stepIndex + 1]?.id ?? null)}>
                {stepIndex === guide.steps.length - 1 ? "완료 후 점검 보기" : "다음"}
              </button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
