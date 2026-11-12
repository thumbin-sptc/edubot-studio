import { ActionLink } from "@/components/action-link";
import { PageIntro } from "@/components/page-intro";

export default function NotFoundPage() {
  return (
    <PageIntro title="페이지를 찾을 수 없어요" description="주소를 확인하거나 홈에서 원하는 메뉴를 찾아보세요.">
      <div><ActionLink href="/">홈으로 돌아가기</ActionLink></div>
    </PageIntro>
  );
}
