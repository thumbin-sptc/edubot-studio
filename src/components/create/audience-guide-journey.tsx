"use client";

import { useRef, useState } from "react";
import { buildAudienceBundle, resolveAudience, type AudienceCandidate, type AudienceSelection } from "@/lib/create/audience";
import type { PublishedGuide } from "@/lib/create/model";
import { createKnowledgeZip, fetchKnowledgeBlob, requestZipDownload } from "@/lib/create/zip-client";
import { AudienceGuidePicker } from "./audience-guide-picker";
import { CreateWizard } from "./create-wizard";

export function AudienceGuideJourney({ candidates, approvedGuides, initialSelection }: {
  candidates: readonly AudienceCandidate[];
  approvedGuides: readonly PublishedGuide[];
  initialSelection: AudienceSelection;
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
        <h1 ref={heading} tabIndex={-1}>학교급별 제작 자료 선택</h1>
      </header>
      <AudienceGuidePicker candidates={candidates} approvedGuides={approvedGuides} initialSelection={selection}
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
