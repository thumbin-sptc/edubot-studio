# EDU-BOT Studio — Codex 지침

## 목적과 문서 읽기 순서
이 저장소는 중도중복장애교육연구회 EDU-BOT Studio 무료 웹앱용 개발 소스다.
**시작하기 전에** `README.md` → `docs/DECISIONS.md` → `docs/PRD.md` → `docs/UX-SPEC.md` → `docs/PROMPT-SCHEMA.md` → `docs/CONTENT-POLICY.md` → `docs/ACCEPTANCE.md` → `tasks/CODEX-01.md` 순으로 읽는다.

## 절대 원칙
1. 홈에서 **나만의 에듀봇 만들기**와 **프롬프트 라이브러리**는 동등한 비중이다.
2. 특정 원고 버전의 `sourceOriginalText`는 사용자의 요청 없이 재작성하지 않는다. 입력 치환은 명시된 `templateText` placeholder만 사용하고 결과 편집은 파생본에 적용한다.
3. 교재 원고는 수정될 수 있다. 템플릿 ID는 유지하고 버전을 증가시킨다. `publicationStatus: published`만 공개한다. **현재의 공식 프롬프트 34개와 추가 활용 후보 9개는 최종 원문 확정본이 아니다.**
4. 공통 Wizard UI/렌더러와 프롬프트별 데이터는 분리한다. IEP 신규 카테고리도 컴포넌트 코드를 대량 수정하지 않고 추가할 수 있어야 한다.
5. 프롬프트 입력·학생 관련 정보·AI 결과를 서버, 로그, 분석서비스 또는 외부 AI API에 전송하지 않는다. 로그인, DB, 서버 사용자 데이터 저장 없음.
6. 브라우저 영속 저장은 기본 OFF; 사용자가 명시적으로 켰을 때만 localStorage 이용. OFF 상태에서는 메모리에만 유지한다. OFF와 이전 저장 데이터 삭제는 별도 동작이다.
7. 사용자 파일은 이 앱에 업로드하지 않는다. 외부 AI에 사용자가 직접 첨부하도록 안내한다.
8. 3개 AI 플랫폼 × PC·모바일웹 제작 안내는 검증된 단계만 공개한다. 검증 전 UI 경로나 GIF, 기본 지침 및 지식 파일을 지어내지 않는다.
9. 프롬프트 작성에서는 가명 사용 안내, 개인정보 주의, 복사 전 외부 AI 이용 경고를 제공한다.
10. Copied/Downloaded는 External uploaded/Configured와 다르다. 외부 완료는 자가 체크만 지원한다.
11. Toss 스타일 방향성(화이트, 네이비/스카이블루, 절제된 연두), 접근성, 반응형, reduce-motion을 준수한다. 공식 캐릭터/로고 미제공 시 가짜 최종 캐릭터를 만들지 않는다.
12. 노션은 사용하지 않는다. GitHub가 명세와 콘텐츠의 단일 원본이다. `main`이 Vercel 프로덕션 배포 대상으로 예정되므로 스키마·빌드 테스트를 우선한다.
13. 사용자 피드백으로 결정된 29개 UX/운영 기준을 무단으로 변경하지 않는다. 새 판단이 필요하면 문서에 '미확정'으로 표시한다.

## 개발 순서
- 1차 작업: `tasks/CODEX-01.md`에 따라 Next.js 기본 구조와 홈/준비 중 화면 구현. 실험용 템플릿이나 비검수 지식 파일의 공개 금지.
- 이후: 프롬프트 라이브러리 → 데이터 구동 Wizard → 편집/복사 → opt-in 저장/삭제 → 에듀봇 제작 마법사 → 실제 검수된 콘텐츠 추가.

## 검사
최소 `npm run validate:content` 및 `npm test` 를 통과시킨다. Next.js 설정 이후 `npm run typecheck`, `npm run lint`, `npm run build`도 구현·실행한다.
