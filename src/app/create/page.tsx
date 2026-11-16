import type { Metadata } from "next";
import { PageIntro, StatusPanel } from "@/components/page-intro";
import { CreatePicker } from "@/components/create/create-picker";
import type { CreateStatus } from "@/lib/create/model";
import { getCreateEntries } from "@/lib/create/published";

const title = "나만의 에듀봇 만들기";
export const metadata: Metadata = { title };

export default function CreatePage() {
  const statuses = getCreateEntries().map(({ platform, device, ...entry }): CreateStatus => entry.support === "supported"
    ? { platform, device, status: "published" }
    : { platform, device, status: "unsupported", reason: entry.reason, verifiedAt: entry.verifiedAt });

  return (
    <PageIntro
      title={title}
      description="이용할 AI 플랫폼과 기기를 선택해 제작 안내의 공개 상태를 확인하세요."
    >
      {!statuses.some((entry) => entry.status === "published") && (
        <StatusPanel>
          연구회 기본 지침과 지식 파일, 플랫폼별 제작 단계를 검증한 뒤 안내를 공개합니다.
        </StatusPanel>
      )}
      <CreatePicker statuses={statuses} />
    </PageIntro>
  );
}
