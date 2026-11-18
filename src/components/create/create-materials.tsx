"use client";

import { useState } from "react";
import {
  environments, firstMaterialsAudience, sameMaterialsAudience, schoolLevels, sourceFamilies,
  type Combination, type GuideAudience, type MaterialsAudience, type PublishedMaterials,
} from "@/lib/create/model";
import { CreateCopy } from "./create-actions";
import { KnowledgeDownloadHelp, KnowledgeDownloadLinks } from "./knowledge-download";

const fields = {
  schoolLevel: { label: "학교급", options: schoolLevels },
  environment: { label: "교육 환경", options: environments },
  sourceFamily: { label: "지침 원본 계열", options: sourceFamilies },
};

export function CreateMaterialCards({ selection, materials }: {
  selection: MaterialsAudience;
  materials: readonly PublishedMaterials[];
}) {
  const selected = materials.find((entry) => sameMaterialsAudience(entry, selection));
  const first = sameMaterialsAudience(firstMaterialsAudience, selection);
  if (!first && !selected) {
    return <p className="create-selection" role="status">선택한 조합에 등록된 기본 지침과 지식파일이 없어요.</p>;
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
            <CreateCopy label="기본 지침 원문" text={instruction.coreInstruction}
              buttonLabel="기본 지침 복사" successLabel="기본 지침 원문을 복사했어요." />
            <a className="create-text-link" download="edubot-instruction.txt"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(instruction.coreInstruction)}`}>원문 TXT 받기</a>
          </>
        )}
      </section>
      <section className="create-action">
        <h3>지식파일</h3>
        <p role="status">{files.length ? `다운로드 가능 ${files.length}개` : "공개할 수 있는 지식파일이 아직 없어요."}</p>
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
  const firstCombination = combination.platform === firstMaterialsAudience.platform && combination.device === firstMaterialsAudience.device;
  const [audience, setAudience] = useState<GuideAudience>(() => firstCombination ? firstMaterialsAudience
    : materials.find(({ platform, device }) => platform === combination.platform && device === combination.device) ?? firstMaterialsAudience);
  return (
    <section className="grid min-w-0 gap-3">
      <h2>기본 지침과 지식파일</h2>
      <p>학교급, 교육 환경, 지침 원본 계열을 골라 공개된 자료를 확인하세요.</p>
      <fieldset>
        <legend className="sr-only">제작 자료 대상</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(fields) as Array<keyof GuideAudience>).map((field) => (
            <label className="grid min-w-0 gap-1" key={field}>
              {fields[field].label}
              <select className="prompt-input w-full min-w-0" value={audience[field]}
                onChange={(event) => setAudience({ ...audience, [field]: event.target.value })}>
                {fields[field].options.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <CreateMaterialCards selection={{ ...audience, ...combination }} materials={materials} />
    </section>
  );
}
