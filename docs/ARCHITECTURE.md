# 기술 구조 / 순서별 개발 설계

## 선택한 기반
- 앱: Next.js App Router + React + TypeScript + Tailwind (최종 설치 버전은 개발 환경에서 확인)
- 아이콘: Lucide 등 가벼운 구성 가능; 접근성 기본 컴포넌트 선호
- 콘텐츠: GitHub 커밋에 포함된 JSON/TypeScript. CMS/Notion/DB 불필요
- 배포: GitHub `main` → Vercel, 배포 전 CI 검사 권장

## 권장 페이지
```
/                   동등한 두 기능 CTA
/create             AI 플랫폼·기기 선택 (검증 전 준비 중)
/create/[platform]  플랫폼별 안내
/prompts            목적/목차 탐색
/prompts/[id]       맞춤형 질문/편집/복사
/data               저장·삭제 관리
/help               연구회 소개·개인정보·이용 안내
```

## 콘텐츠 처리 경계
1. `content/prompt-inventory.json`: 34개 공식 프롬프트 및 9개 활용 후보의 제목·분류·출처 목록. 배포/활성 여부와 다름.
2. `content/prompts/*.json`: 실제 질문과 치환 템플릿. `publicationStatus=published`만 공용 프롬프트 탐색·라우트에서 이용.
3. `sourceOriginalText`는 변환·서버 입력 대상이 아니다. `templateText`의 선언된 `{{token}}`만 브라우저에서 치환.
4. 나중에 원고를 수정하면 JSON 데이터와 버전만 갱신. UI 엔진은 콘텐츠 독립적으로 동작.
5. 참고 자료 파일은 브라우저에서 웹앱으로 업로드받지 않는다. 외부 AI에 직접 첨부하도록 안내.

## 프런트엔드 상태
- 저장 OFF: React 상태(메모리). 다음 단계 이동해도 유지, 새로고침 복원 보장 없음.
- 저장 ON: 사용자 명시적 동의 후 로컬 저장. `promptId + version` 등 복원 검증 메타정보 저장.
- 개별 삭제/전체 삭제는 이전 결과·링크 참조까지 정확히 처리하고 확인 창 제공.
- 특정 작성본 버전이 현재 템플릿과 다르면 사용자 선택 없이 덮어쓰지 않는다.
- `localStorage`는 암호화 저장소가 아니므로 공용 기기에 저장 비권장.

## 안전한 단계적 배포
- CODEX-01에서는 빈 프롬프트·제작 기능을 동작하는 것처럼 광고하지 않는다.
- CODEX-02에서 엔진 테스트 후 draft 템플릿으로 개발 로컬 검수.
- 콘텐츠 확정 후에만 `published` 설정하고 공개.
