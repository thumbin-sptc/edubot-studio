"use client";

import { useId, useState } from "react";
import { targetSurfaces } from "@/lib/create/audience";
import {
  environments, firstMaterialsAudience, sameMaterialsAudience, schoolLevels, sourceFamilies,
  type Combination, type GuideAudience, type MaterialsAudience, type PublishedMaterials,
} from "@/lib/create/model";
import { CreateCopy } from "./create-actions";
import { KnowledgeDownloadHelp, KnowledgeDownloadLinks } from "./knowledge-download";

const fields = {
  schoolLevel: { label: "학교급", options: schoolLevels },
  environment: { label: "교육 환경", options: environments },
  sourceFamily: { label: "원본 지침 계열", options: sourceFamilies },
};

export function CreateMaterialCards({ selection, materials }: {
  selection: MaterialsAudience;
  materials: readonly PublishedMaterials[];
}) {
  const selected = materials.find((entry) => sameMaterialsAudience(entry, selection));
  const first = sameMaterialsAudience(firstMaterialsAudience, selection);
  if (!first && !selected) {
    return <p className="create-selection" role="status">이 조합은 아직 공개 상태를 제공하지 않아요.</p>;
  }
  const instruction = selected?.instruction;
  const files = selected?.files ?? [];
  return (
    <div className="grid min-w-0 gap-3">
      <section className="create-action">
        <h3>기본 지침</h3>
        <p role="status">{instruction ? `열람·복사 가능 · 버전 ${instruction.version}`
          : "웹 재배포와 이 AI에서의 사용 권리 확인 대기"}</p>
        {instruction && (
          <>
            <p className="muted">EDU-BOT Studio 운영 · 중도중복장애교육연구회</p>
            <CreateCopy label="기본 지침 원문" text={instruction.coreInstruction}
              buttonLabel="지침 원문 복사" successLabel="기본 지침 원문을 복사했어요." />
            <p className="muted">SHA-256 <code>{instruction.sha256}</code></p>
            <a className="create-text-link" download="edubot-instruction.txt"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(instruction.coreInstruction)}`}>원문 TXT 받기</a>
          </>
        )}
      </section>
      <section className="create-action">
        <h3>지식 파일</h3>
        <p role="status">{files.length ? `다운로드 가능 ${files.length}개` : "파일별 권리 확인 대기"}</p>
        {files.length > 0 && (
          <>
            <ul className="create-file-list">
              {files.map((file) => (
                <li key={file.id}>
                  <h4>{file.title}</h4>
                  <KnowledgeDownloadLinks file={file} details={<p>{file.description}</p>} />
                </li>
              ))}
            </ul>
            <KnowledgeDownloadHelp />
          </>
        )}
      </section>
    </div>
  );
}

export function CreateMaterialsPanel({ combination, materials }: {
  combination: Combination;
  materials: readonly PublishedMaterials[];
}) {
  const fieldId = useId();
  const firstCombination = combination.platform === firstMaterialsAudience.platform && combination.device === firstMaterialsAudience.device;
  const [audience, setAudience] = useState<GuideAudience>(() => firstCombination ? firstMaterialsAudience
    : materials.find(({ platform, device }) => platform === combination.platform && device === combination.device) ?? firstMaterialsAudience);
  return (
    <section className="grid min-w-0 gap-3">
      <h2>{targetSurfaces[combination.platform]} 제작 자료</h2>
      <fieldset>
        <legend className="sr-only">제작 자료 대상</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(fields) as Array<keyof GuideAudience>).map((field) => (
            <div className="grid min-w-0 gap-1" key={field}>
              <label htmlFor={`${fieldId}-${field}`}>{fields[field].label}</label>
              <select id={`${fieldId}-${field}`} className="prompt-input w-full min-w-0" value={audience[field]}
                onChange={(event) => setAudience({ ...audience, [field]: event.target.value })}>
                {fields[field].options.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          ))}
        </div>
      </fieldset>
      <CreateMaterialCards selection={{ ...audience, ...combination }} materials={materials} />
    </section>
  );
}
