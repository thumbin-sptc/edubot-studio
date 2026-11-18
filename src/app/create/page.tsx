import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { CreatePicker } from "@/components/create/create-picker";
import { AudienceGuideJourney } from "@/components/create/audience-guide-journey";
import { illustratedAudienceOption } from "@/lib/create/audience";
import type { CreateStatus } from "@/lib/create/model";
import { getCreateContent } from "@/lib/create/published";

const title = "나만의 에듀봇 만들기";
export const metadata: Metadata = { title };

export default function CreatePage() {
  const { entries, materials } = getCreateContent();
  const illustrated = entries.flatMap((entry) => {
    const option = entry.support === "supported" && illustratedAudienceOption(entry);
    return option ? [option] : [];
  });
  const first = illustrated[0];
  const statuses = entries.filter((entry) => entry.support !== "supported" || !entry.illustratedJourney)
    .map(({ platform, device, ...entry }): CreateStatus => entry.support === "supported"
    ? { platform, device, status: "published",
      hasExampleVideo: entry.steps.some((step) => step.format === "media" && step.media.kind === "video") }
    : { platform, device, status: "unsupported", reason: entry.reason, verifiedAt: entry.verifiedAt });
  if (first) {
    return (
      <>
        <AudienceGuideJourney candidates={illustrated.map(({ candidate }) => candidate)}
          approvedGuides={illustrated.map(({ guide }) => guide)} initialSelection={first.selection} materials={materials} />
        {(statuses.length > 0 || materials.length > 0) && (
          <div className="shell pb-8"><CreatePicker statuses={statuses} materials={materials} /></div>
        )}
      </>
    );
  }
  return (
    <PageIntro
      title={title}
      description="AI 플랫폼과 기기를 선택해 기본 지침, 지식 파일, 제작 가이드의 공개 상태를 확인하세요."
    >
      <CreatePicker statuses={statuses} materials={materials} />
    </PageIntro>
  );
}
