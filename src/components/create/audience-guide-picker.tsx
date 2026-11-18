"use client";

import { useId, useState } from "react";
import {
  resolveAudience, sourceFamilies, targetSurfaces,
  type AudienceCandidate, type AudienceReleaseCheck, type AudienceSelection, type buildAudienceBundle,
} from "@/lib/create/audience";
import { devices, environments, firstMaterialsAudience, sameMaterialsAudience, schoolLevels,
  type PublishedGuide, type PublishedMaterials } from "@/lib/create/model";
import { CreateMaterialCards } from "./create-materials";
import { KnowledgeDownloadHelp, KnowledgeDownloadLinks } from "./knowledge-download";

const fields = {
  schoolLevel: { label: "학교급", options: schoolLevels.map((value) => [value, value]) },
  environment: { label: "교육 환경", options: environments.map((value) => [value, value]) },
  sourceFamily: { label: "지침 원본 계열", options: sourceFamilies.map((value) => [value, value]) },
  platform: { label: "사용할 AI", options: Object.entries(targetSurfaces) },
  device: { label: "이용 기기", options: Object.entries(devices) },
};
const fieldHints: Partial<Record<keyof AudienceSelection, string>> = {
  sourceFamily: "기본 지침이 처음 만들어진 형식을 고릅니다.",
  platform: "에듀봇을 실제로 만들 AI를 고릅니다.",
  device: "제작할 때 사용할 브라우저 환경을 고릅니다.",
};
const referenceLabels = {
  available: "실물 연결 확인 · 승인 자료 확인",
  missing: "미확보",
  ambiguous: "연결 근거 확인 필요",
  "scope-pending": "적용 범위 확인 필요",
  unapproved: "실물 연결 확인 · 배포 승인 자료 대기",
  "out-of-scope": "이 조합에서 제외",
};
const useLabels = {
  required: "필수",
  recommended: "권장",
  optional: "선택",
  "out-of-scope": "선택 대상 제외",
  "scope-pending": "조건 검토 중",
};
const checkLabels = {
  scope: "학교급·교육 환경의 적용 범위 확인 필요",
  compatibility: "이 AI의 호환성 미검증",
  "hands-on": "이 기기에서 실제 조작 미검증",
  rights: "지침·자료의 재배포 권한 미확인",
  release: "게시 승인 대기",
  guide: "승인된 가이드 버전 확인 필요",
} satisfies Record<AudienceReleaseCheck, string>;
type BundleOutcome = Awaited<ReturnType<typeof buildAudienceBundle>>["kind"];
const bundleMessages = {
  ready: "ZIP 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.",
  blocked: "현재 선택한 자료의 다운로드 승인을 확인할 수 없습니다.",
  empty: "ZIP에 넣을 자료가 없습니다.",
  limit: "선택한 자료가 ZIP 한도를 넘었습니다. 선택을 줄이거나 개별로 내려받으세요.",
  failed: "ZIP을 만들거나 내려받기를 시작하지 못했습니다. 자료를 개별로 내려받으세요.",
} satisfies Record<BundleOutcome, string>;

export function AudienceGuidePicker({
  candidates, approvedGuides, initialSelection, materials = [], onBundle, onStart,
}: {
  candidates: readonly AudienceCandidate[];
  approvedGuides: readonly PublishedGuide[];
  initialSelection: AudienceSelection;
  materials?: readonly PublishedMaterials[];
  onBundle: (selection: AudienceSelection, selectedResourceIds: string[]) => Promise<BundleOutcome>;
  onStart?: (selection: AudienceSelection) => void;
}) {
  const hintId = useId();
  const [selection, setSelection] = useState(initialSelection);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<BundleOutcome>();
  const [busy, setBusy] = useState(false);
  const guide = approvedGuides.find(({ platform, device }) => platform === selection.platform && device === selection.device);
  const result = resolveAudience(candidates, selection, guide);
  const choices = result.kind === "ready" ? [...result.recommended, ...result.optional] : [];
  const recommended = new Set(result.kind === "ready" ? result.journey.recommendedIds : []);
  const isPicked = (id: string) => Object.hasOwn(overrides, id) ? overrides[id] : recommended.has(id);
  const selected = choices.filter(({ id }) => isPicked(id));
  const alternatives = result.kind === "ready" && (outcome === "failed" || outcome === "limit")
    ? [...result.required, ...selected] : [];
  const summary = [selection.schoolLevel, selection.environment, `${selection.sourceFamily} 원본`,
    targetSurfaces[selection.platform], devices[selection.device]].join(" · ");
  const ready = result.kind === "ready" ? result : undefined;
  const illustrated = ready?.journey.guide.illustratedJourney;
  const showMaterials = sameMaterialsAudience(firstMaterialsAudience, selection) ||
    materials.some((entry) => sameMaterialsAudience(entry, selection));

  async function download() {
    if (busy || result.kind !== "ready") return;
    setBusy(true);
    setOutcome(undefined);
    try {
      setOutcome(await onBundle(selection, selected.map(({ id }) => id)));
    } catch {
      setOutcome("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="info-panel create-picker" aria-label="학교급별 제작 자료">
      <div className="create-selection" role="status">
        <strong>{summary}</strong>
        <p>
          {ready && "제작 안내를 시작할 수 있어요."}
          {result.kind === "blocked" && "준비 중 · 지침과 자료를 확인하고 있어요."}
          {result.kind === "unavailable" && "준비 중 · 이 조합에 연결된 지침이 없어요."}
          {result.kind === "unsupported" && "미지원 · 이 AI와 기기 조합에서는 사용할 수 없어요."}
          {result.kind === "conflict" && "준비 중 · 지침을 사용할 수 있는 범위를 확인하고 있어요."}
        </p>
      </div>
      {ready && illustrated && (
        <p>단계마다 예시 화면을 보며 따라 할 수 있어요. PC 브라우저에서 {targetSurfaces[selection.platform]}를 열고
          {ready.required.length ? ` 안내에 나오는 필수 파일 ${ready.required.length}개를 준비해 주세요.` : " 안내를 시작해 보세요."}</p>
      )}
      {ready && onStart && (
        <div>
          <button className="action" type="button" disabled={busy} onClick={() => onStart(selection)}>제작 안내 시작</button>
        </div>
      )}
      {showMaterials && !ready?.journey.guide.steps.some((step) => step.format === "media" && step.media.kind === "video") && (
        <p>예시 영상 준비 중</p>
      )}
      <fieldset disabled={busy}>
        <legend>제작 대상과 사용 환경</legend>
        <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(fields) as Array<keyof AudienceSelection>).map((field) => {
            const fieldId = `${hintId}-${field}`;
            const descriptionId = fieldHints[field] ? `${fieldId}-hint` : undefined;
            return (
              <div key={field} className="grid min-w-0 content-start gap-1">
                <label htmlFor={fieldId}>{fields[field].label}</label>
                <select id={fieldId} aria-describedby={descriptionId}
                  className="min-h-11 w-full min-w-0 rounded-md border px-3 py-2" value={selection[field]}
                  onChange={(event) => {
                    setSelection({ ...selection, [field]: event.target.value });
                    setOverrides({});
                    setOutcome(undefined);
                  }}>
                  {fields[field].options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {descriptionId && <p id={descriptionId} className="muted">{fieldHints[field]}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>
      {showMaterials && (
        <section className="grid min-w-0 gap-3">
          <h2>기본 지침과 지식파일</h2>
          <CreateMaterialCards selection={selection} materials={materials} />
        </section>
      )}
      {result.kind === "blocked" && result.pendingChecks.length > 0 && (
        <ul aria-label="공개 검수 대기 항목" className="space-y-2">
          {result.pendingChecks.map((check) => <li key={check}>{checkLabels[check]}</li>)}
        </ul>
      )}
      {result.kind === "blocked" && result.references.length > 0 && (
        <ul aria-label="지식 자료 상태" className="space-y-2">
          {result.references.map(({ id, label, status, applicability }) => (
            <li key={id}>{label} · {useLabels[applicability]} · {referenceLabels[status]}</li>
          ))}
        </ul>
      )}
      {result.kind === "ready" && (
        <div className="space-y-3">
          <details className="create-picker-download" open={onStart ? undefined : true}>
            <summary>지금 자료만 받기 (선택)</summary>
            <div className="space-y-3">
              {onStart && <p>제작을 시작하면 지식 파일 추가 단계에서도 자료를 선택하고 받을 수 있습니다.</p>}
              <fieldset disabled={busy}>
                <legend>ZIP으로 받을 지식 자료</legend>
                <div className="create-options">
                  {result.required.map(({ id, title }) => (
                    <p key={id} className="col-span-full min-w-0 self-center break-words sm:col-span-1">{title} · 필수 포함</p>
                  ))}
                  {choices.map(({ id, title }) => (
                    <label key={id} className="col-span-full min-w-0 break-words sm:col-span-1">
                      <input type="checkbox" checked={isPicked(id)}
                        onChange={(event) => {
                          setOverrides((current) => ({ ...current, [id]: event.target.checked }));
                          setOutcome(undefined);
                        }} />
                      <span>{title} · {recommended.has(id) ? "권장" : "선택"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="action action-secondary" type="button" disabled={!result.required.length && !selected.length}
                aria-disabled={busy} onClick={download}>
                {busy ? "ZIP 만드는 중" : "선택 자료 ZIP 다운로드"}
              </button>
              <p className="create-selection" aria-live="polite">{outcome ? bundleMessages[outcome] : ""}</p>
              {alternatives.length > 0 && (
                <div className="space-y-3">
                  <KnowledgeDownloadHelp />
                  <ul aria-label="개별 다운로드 대안" className="create-file-list">
                    {alternatives.map((file) => <li key={file.id}><KnowledgeDownloadLinks file={file} /></li>)}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
