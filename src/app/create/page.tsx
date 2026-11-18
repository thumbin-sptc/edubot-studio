import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { CreatePicker } from "@/components/create/create-picker";
import { AudienceGuideJourney } from "@/components/create/audience-guide-journey";
import { illustratedAudienceOption } from "@/lib/create/audience";
import type { CreateStatus } from "@/lib/create/model";
import { getCreateEntries } from "@/lib/create/published";

const title = "나만의 에듀봇 만들기";
export const metadata: Metadata = { title };

export default function CreatePage() {
  const entries = getCreateEntries();
  const illustrated = entries.flatMap((entry) => {
    const option = entry.support === "supported" && illustratedAudienceOption(entry);
    return option ? [option] : [];
  });
  const first = illustrated[0];
  const statuses = entries.filter((entry) => entry.support !== "supported" || !entry.illustratedJourney)
    .map(({ platform, device, ...entry }): CreateStatus => entry.support === "supported"
    ? { platform, device, status: "published" }
    : { platform, device, status: "unsupported", reason: entry.reason, verifiedAt: entry.verifiedAt });
  const hasPublishedGuide = statuses.some(({ status }) => status === "published");

  if (first) {
    return (
      <>
        <AudienceGuideJourney candidates={illustrated.map(({ candidate }) => candidate)}
          approvedGuides={illustrated.map(({ guide }) => guide)} initialSelection={first.selection} />
        {statuses.length > 0 && <div className="shell pb-8"><CreatePicker statuses={statuses} /></div>}
      </>
    );
  }
  return (
    <PageIntro
      title={title}
      description={hasPublishedGuide
        ? "이용할 AI 플랫폼과 기기를 선택해 제작 안내를 확인하세요."
        : "공개된 제작 안내는 아직 없습니다. 플랫폼과 기기를 선택해 조합별 상태를 확인하세요."}
    >
      <CreatePicker statuses={statuses} />
    </PageIntro>
  );
}
