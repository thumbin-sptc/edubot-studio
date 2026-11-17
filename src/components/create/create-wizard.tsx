"use client";

import Image from "next/image";
import { publicAssetUrl } from "@/lib/site-path";
import Link from "next/link";
import { targetSurfaces, type AudienceGuide } from "@/lib/create/audience";
import { updateCreateSession, useCreateSession } from "@/lib/create/browser-session";
import { completionLabels, getCompletionChecks } from "@/lib/create/engine";
import { createHref, devices, platforms, type PublishedGuide } from "@/lib/create/model";
import { getCreateProgress, hasPreviousProgress, updateCreateProgress, type CreateProgress } from "@/lib/create/session";
import { createKnowledgeZip } from "@/lib/create/zip-client";
import { CreateCopy, InstructionPanel, KnowledgePanel } from "./create-actions";
import { CreateStorageControls } from "./create-storage-controls";
import { CreateStepInstructions } from "./create-step-instructions";
import { CreateStepCheck, CreateWizardFlow } from "./create-wizard-flow";
import { DemoMedia } from "./demo-media";

export function CreateWizard({ guide, desktopAvailable, audience, onBack }: {
  guide: PublishedGuide;
  desktopAvailable: boolean;
  audience?: AudienceGuide;
  onBack?: () => void;
}) {
  const { ready, session } = useCreateSession();
  const scope = audience?.scope;
  const progress = getCreateProgress(session, guide, scope);
  const step = guide.steps.find(({ id }) => id === progress.stepId);
  const personalization = audience ? progress.personalization ?? {} : session.personalization;
  const textOnly = guide.steps.every(({ format }) => format === "text-only");

  function updateProgress(change: (previous: CreateProgress) => CreateProgress) {
    updateCreateSession((current) => updateCreateProgress(
      { ...current, selection: { platform: guide.platform, device: guide.device } },
      guide, change(getCreateProgress(current, guide, scope)), scope,
    ));
  }

  return (
    <div className={textOnly ? "shell create-wizard create-wizard-text" : "shell create-wizard"} data-create-wizard>
      {onBack
        ? <button type="button" className="prompt-back" onClick={onBack}>← 제작 대상 바꾸기</button>
        : <Link className="prompt-back" href="/create">← 플랫폼·기기 바꾸기</Link>}
      <header className="wizard-heading">
        <h1>나만의 에듀봇 만들기</h1>
        {audience && (
          <p>{audience.selection.schoolLevel} · {audience.selection.environment} · {audience.selection.sourceFamily} 원본
            {" → "}{targetSurfaces[guide.platform]}</p>
        )}
        <p className="prompt-version status-chip">{platforms[guide.platform]} · {devices[guide.device]} · 버전 {guide.version} · 확인일 {guide.verifiedAt}</p>
      </header>
      {!ready ? <p role="status">제작 안내를 불러오고 있습니다.</p> : (
        <>
          <CreateStorageControls />
          {hasPreviousProgress(session, guide, scope) && (
            <p className="info-panel">이전 가이드나 지침의 진행 기록은 보존됩니다. 현재 버전은 첫 단계부터 시작합니다.</p>
          )}
          <CreateWizardFlow steps={guide.steps} progress={progress} focusOnMount={Boolean(onBack)}
            onMove={(stepId) => updateProgress((current) => ({ ...current, stepId }))}>
            {(headingId, move) => step ? (
                <section className="create-stage info-panel">
                  <h2 id={headingId} tabIndex={-1}>{step.title}</h2>
                  <div className={step.format === "media" ? "create-stage-grid" : "create-stage-text"}>
                    {step.format === "media" && <DemoMedia key={step.id} media={step.media} title={step.title} />}
                    <div className={step.format === "text-only" ? "create-text-columns" : undefined}>
                      <div className="create-step-details">
                        <p>{step.description}</p>
                        {step.format === "text-only" && <CreateStepInstructions instructions={step.instructions} />}
                        {step.mascot && (
                          <aside className="create-mascot">
                            <Image src={publicAssetUrl(step.mascot.path)} alt="" width={48} height={48} />
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
                      </div>
                      <div className="create-step-details create-step-actions">
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
                              audience={audience?.selection} onChange={(field, value) => {
                                if (audience) {
                                  updateProgress((current) => ({
                                    ...current, personalization: { ...current.personalization, [field]: value },
                                  }));
                                } else {
                                  updateCreateSession((current) => ({
                                    ...current, selection: { platform: guide.platform, device: guide.device },
                                    personalization: { ...current.personalization, [field]: value },
                                  }));
                                }
                              }} />
                          );
                          return (
                            <KnowledgePanel key={key} platform={guide.platform} resources={guide.resources} audience={audience}
                              zipBuilder={createKnowledgeZip}
                              personalization={personalization} overrides={progress.selections}
                              onSelect={(id, selected) => updateProgress((current) => ({
                                ...current, selections: { ...current.selections, [id]: selected },
                              }))} />
                          );
                        })}
                        <CreateStepCheck label={step.checkLabel} checked={progress.checked.includes(step.id)}
                          onChange={(checked) => updateProgress((current) => ({
                            ...current, checked: checked ? [...new Set([...current.checked, step.id])]
                              : current.checked.filter((id) => id !== step.id),
                          }))} />
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="create-stage info-panel">
                  <h2 id={headingId} tabIndex={-1}>완료 후 점검</h2>
                  <div className="create-completion-note">
                    <p><strong>응답 점검은 직접 확인</strong></p>
                    <p>만든 에듀봇에서 새 대화를 열고 질문을 붙여넣으세요. 응답을 확인 기준과 비교하고, 자료를 사용한 답변은 파일에서 근거를 직접 찾아 확인하세요.</p>
                    <p className="muted">에듀봇 Studio에서는 외부 AI의 지침 저장, 파일 첨부, 응답 결과를 확인할 수 없습니다.</p>
                  </div>
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
                  <div className="prompt-actions">
                    <Link href="/prompts" className="action">프롬프트 라이브러리 이용하기</Link>
                  </div>
                </section>
            )}
          </CreateWizardFlow>
        </>
      )}
    </div>
  );
}
