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
    ? { platform, device, status: "published", hasExampleVideo: entry.steps.some(({ format }) => format === "media") }
    : { platform, device, status: "unsupported", reason: entry.reason, verifiedAt: entry.verifiedAt });
  const hasPublishedGuide = statuses.some(({ status }) => status === "published");

  if (first) {
    return (
      <>
        <AudienceGuideJourney candidates={illustrated.map(({ candidate }) => candidate)}
          approvedGuides={illustrated.map(({ guide }) => guide)} initialSelection={first.selection} materials={materials} />
        {statuses.length > 0 && <div className="shell pb-8"><CreatePicker statuses={statuses} materials={materials} /></div>}
      </>
    );
  }
  return (
    <PageIntro
      title={title}
      description={hasPublishedGuide
        ? "이용할 AI 플랫폼과 기기를 선택해 제작 안내를 확인하세요."
        : "플랫폼과 기기를 선택하면 제작 가이드 상태와 공개된 자료를 확인할 수 있어요."}
    >
      <CreatePicker statuses={statuses} materials={materials} />
    </PageIntro>
  );
}
