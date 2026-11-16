import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { CreatePicker } from "@/components/create/create-picker";
import type { CreateStatus } from "@/lib/create/model";
import { getCreateEntries } from "@/lib/create/published";

const title = "나만의 에듀봇 만들기";
export const metadata: Metadata = { title };

export default function CreatePage() {
  const statuses = getCreateEntries().map(({ platform, device, ...entry }): CreateStatus => entry.support === "supported"
    ? { platform, device, status: "published" }
    : { platform, device, status: "unsupported", reason: entry.reason, verifiedAt: entry.verifiedAt });
  const hasPublishedGuide = statuses.some(({ status }) => status === "published");

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
