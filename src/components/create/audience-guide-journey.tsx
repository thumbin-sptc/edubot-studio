"use client";

import { useRef, useState } from "react";
import { buildAudienceBundle, resolveAudience, type AudienceCandidate, type AudienceSelection } from "@/lib/create/audience";
import type { PublishedGuide, PublishedMaterials } from "@/lib/create/model";
import { createKnowledgeZip, fetchKnowledgeBlob, requestZipDownload } from "@/lib/create/zip-client";
import { AudienceGuidePicker } from "./audience-guide-picker";
import { CreateWizard } from "./create-wizard";

export function AudienceGuideJourney({ candidates, approvedGuides, initialSelection, materials = [] }: {
  candidates: readonly AudienceCandidate[];
  approvedGuides: readonly PublishedGuide[];
  initialSelection: AudienceSelection;
  materials?: readonly PublishedMaterials[];
}) {
  const [selection, setSelection] = useState(initialSelection);
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const guideFor = ({ platform, device }: AudienceSelection) =>
    approvedGuides.find((guide) => guide.platform === platform && guide.device === device);
  const result = open ? resolveAudience(candidates, selection, guideFor(selection)) : undefined;

  if (result?.kind === "ready") {
    return <CreateWizard guide={result.journey.guide} desktopAvailable={false} audience={result.journey}
      onBack={() => {
        setOpen(false);
        requestAnimationFrame(() => heading.current?.focus());
      }} />;
  }
  return (
    <div className="shell create-wizard">
      <header className="wizard-heading">
        <h1 ref={heading} tabIndex={-1}>나만의 에듀봇을 만들어 볼까요?</h1>
        <p className="page-description">학교급과 사용할 AI를 고르면 제작 안내를 확인할 수 있어요.</p>
      </header>
      <AudienceGuidePicker candidates={candidates} approvedGuides={approvedGuides} initialSelection={selection} materials={materials}
        onStart={(target) => {
          setSelection(target);
          setOpen(true);
        }}
        onBundle={async (target, ids) => {
          const bundle = await buildAudienceBundle(candidates, target, guideFor(target), ids,
            (_, file) => fetchKnowledgeBlob(file, location.origin), createKnowledgeZip);
          if (bundle.kind === "ready") requestZipDownload(bundle.zip);
          return bundle.kind;
        }} />
    </div>
  );
}
