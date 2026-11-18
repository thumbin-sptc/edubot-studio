"use client";

import Image from "next/image";
import { publicAssetUrl } from "@/lib/site-path";
import Link from "next/link";
import { targetSurfaces, type AudienceGuide } from "@/lib/create/audience";
import { updateCreateSession, useCreateSession } from "@/lib/create/browser-session";
import { completionLabels, getCompletionChecks } from "@/lib/create/engine";
import { createHref, devices, platforms, type ExternalAction, type PublishedGuide } from "@/lib/create/model";
import { getCreateProgress, hasPreviousProgress, updateCreateProgress, type CreateProgress } from "@/lib/create/session";
import { createKnowledgeZip } from "@/lib/create/zip-client";
import { CreateCopy, InstructionPanel, KnowledgePanel } from "./create-actions";
import { CreateStorageControls } from "./create-storage-controls";
import { CreateStepInstructions } from "./create-step-instructions";
import { CreateStepCheck, CreateWizardFlow } from "./create-wizard-flow";
import { DemoMedia } from "./demo-media";
import { ScreenExamplePanel } from "./screen-example";

function ScreenHelp({ help }: { help: ExternalAction }) {
  return (
    <details className="create-screen-help">
      <summary>화면이 조금 다르신가요?</summary>
      <p>계정이나 화면 언어에 따라 버튼 이름과 위치가 다를 수 있어요. 따라 하기 설명에서 필요한 기능을 찾고, 화면이 계속 다르면 도움말을 확인해 주세요.</p>
      <a className="create-text-link" href={help.url} target="_blank" rel="noopener noreferrer">
        {help.label} (새 탭)
      </a>
    </details>
  );
}

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
  const illustrated = guide.illustratedJourney;
  const selection = audience?.selection ?? illustrated?.audience;
  const textOnly = !illustrated && guide.steps.every((step) => step.format === "text-only" && !step.example);

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
        {selection && (
          <p>{selection.schoolLevel} · {selection.environment} · {selection.sourceFamily} 원본
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
                <section className="create-stage info-panel" aria-labelledby={headingId}>
                  <h2 id={headingId} tabIndex={-1}>{step.title}</h2>
                  {illustrated && <p className="create-step-summary">{step.description}</p>}
                  <div className={step.format === "media" || illustrated || step.example ? "create-stage-grid" : "create-stage-text"}>
                    {step.format === "media" && <DemoMedia key={step.id} media={step.media} title={step.title} />}
                    {step.format === "text-only" && (illustrated || step.example) && <ScreenExamplePanel key={step.id} example={step.example} />}
                    <div className={step.format === "text-only" && !illustrated && !step.example ? "create-text-columns" : undefined}>
                      <div className="create-step-details">
                        {!illustrated && <p>{step.description}</p>}
                        {step.format === "text-only" && <CreateStepInstructions instructions={step.instructions} />}
                        {illustrated && <ScreenHelp help={illustrated.help} />}
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
                        <CreateStepCheck label={step.checkLabel} checked={progress.checked.includes(step.id)} showCriterion={Boolean(illustrated)}
                          onChange={(checked) => updateProgress((current) => ({
                            ...current, checked: checked ? [...new Set([...current.checked, step.id])]
                              : current.checked.filter((id) => id !== step.id),
                          }))} />
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="create-stage info-panel" aria-labelledby={headingId}>
                  <h2 id={headingId} tabIndex={-1}>완료 후 점검</h2>
                  {illustrated && (
                    <div className="create-stage-grid">
                      <ScreenExamplePanel key="completion" example={illustrated.completionExample} />
                      <div className="create-step-details">
                        <p>프로젝트에서 새 대화를 열고 아래 점검 질문을 하나씩 보내 보세요.</p>
                        <ScreenHelp help={illustrated.help} />
                      </div>
                    </div>
                  )}
                  <div className="create-completion-note">
                    <p><strong>응답 점검은 직접 확인</strong></p>
                    <p>만든 에듀봇에서 새 대화를 열고 질문을 붙여넣으세요. 응답을 확인 기준과 비교하고, 자료를 사용한 답변은 파일에서 근거를 직접 찾아 확인하세요.</p>
                    <p className="muted">에듀봇 Studio에서는 외부 AI의 지침 저장, 파일 첨부, 응답 결과를 확인할 수 없습니다.</p>
                  </div>
                  <ul className="create-file-list">
                    {getCompletionChecks(guide.checks, personalization).map(({ kind, prompt, criteria, stepId }) => (
                      <li key={kind}>
                        <h3>{completionLabels[kind]}</h3>
                        <p>{illustrated && <strong>확인 기준 </strong>}{criteria}</p>
                        <CreateCopy label={`${completionLabels[kind]} 질문`} text={prompt}
                          buttonLabel={`${completionLabels[kind]} 질문 복사`} successLabel="점검 질문을 복사했습니다." />
                        <button type="button" className="action action-secondary" onClick={() => move(stepId)}>
                          {guide.steps.find(({ id }) => id === stepId)?.title} 단계로 돌아가기
                        </button>
                        {illustrated && (
                          <CreateStepCheck label={`${completionLabels[kind]}의 확인 기준을 외부 AI에서 직접 확인했어요.`}
                            showCriterion checked={progress.reviewedChecks?.includes(kind) ?? false}
                            onChange={(checked) => updateProgress((current) => ({
                              ...current,
                              reviewedChecks: checked ? [...new Set([...(current.reviewedChecks ?? []), kind])]
                                : current.reviewedChecks?.filter((entry) => entry !== kind) ?? [],
                            }))} />
                        )}
                      </li>
                    ))}
                  </ul>
                  {illustrated && (
                    <div className="create-completion-note">
                      <h3>다음 수업에서 활용해 보세요</h3>
                      <p>점검을 마치면 {platforms[guide.platform]}에서 만든 프로젝트를 다시 열어 사용하세요.</p>
                      <p className="muted">자동 저장을 켜면 이 브라우저에만 진행 기록이 남아요. 다른 기기와 동기화되지 않아요.</p>
                    </div>
                  )}
                  <div className="prompt-actions"><Link href="/prompts" className="action">프롬프트 라이브러리 이용하기</Link></div>
                </section>
            )}
          </CreateWizardFlow>
        </>
      )}
    </div>
  );
}
