[CODEX-01.md](https://github.com/user-attachments/files/34766978/CODEX-01.md)
# CODEX-01 — Next.js 기본 구조 및 실제 접근 가능한 첫 화면

## 이 작업의 목적
현재 저장소에 있는 개발 명세/콘텐츠 분석 파일을 보존하면서 **Next.js + TypeScript + Tailwind 기반 웹앱 실행 구조와 기본 화면만** 구현한다. 디자인은 토스형의 미니멀한 방향이며, 미확정 콘텐츠를 노출하거나 정상 제작 과정이 있는 것처럼 가장하지 않는다.

## 먼저 읽을 파일
`AGENTS.md`, `docs/DECISIONS.md`, `docs/PRD.md`, `docs/UX-SPEC.md`, `docs/ARCHITECTURE.md`, `docs/CONTENT-POLICY.md`, `docs/DESIGN-SYSTEM.md`, `docs/ACCEPTANCE.md`, `docs/PROMPT-SCHEMA.md`.

## 할 일
1. 현재 저장소에서 `npm run validate:content`와 `npm test`를 먼저 실행하여 기존 JSON 샘플 무결성을 확인한다.
2. 저장소를 덮어쓰지 않고 Next.js App Router 프로젝트 파일을 생성한다. 현행 안정 버전 호환성을 확인하고 TypeScript, Tailwind, ESLint, Node.js LTS 환경을 사용한다. `package.json`의 기존 `validate:content`와 `test` 스크립트를 유지한다.
3. **홈 `/`**: 연구회/서비스 개요, 서로 동등한 크기의 두 카드 `나만의 에듀봇 만들기`와 `프롬프트 라이브러리` 제작. 모바일 1열, PC 2열. CTA 클릭 가능.
4. **기본 네비게이션**: 데스크톱 상단, 모바일 하단(홈/에듀봇/프롬프트), 키보드 조작 및 상태 표현, `prefers-reduced-motion` 존중.
5. `/create`, `/prompts`, `/data`, `/help` 라우트 생성. **미완성 기능은 명시적으로 '준비 중'** 표시. `/prompts`에서는 승인되지 않은 템플릿을 목록에 노출하지 말 것. 43개 inventory(공식 34개+후보 9개)는 참고용일 뿐 공개 항목이 아니다.
6. 다음 단계의 개발을 위해 콘텐츠 로더의 입구를 마련하되 `publicationStatus === 'published'`만 공개 데이터로 필터링한다. 사용자가 직접 내용을 입력하는 UI는 아직 만들지 않는다.
7. 공용 UI 최소 컴포넌트(버튼/카드/레이아웃 등)와 오류/404 페이지 기본값 구현. 가상의 로고·캐릭터/영상/파일을 넣지 않는다.
8. `npm run validate:content`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`를 실행하고 결과와 남은 TODO를 보고한다. 문서와 다르게 구현해야 할 경우 임의로 결정하지 않고 변경 사유를 적는다.

## 하지 말 일
- 교재 프롬프트 34개를 임의로 전사/생성하지 말 것.
- IEP 작성 프롬프트 본문을 임의로 만들지 말 것.
- 실제 기본 GPT 지침·지식 파일·공식 에듀봇 마스코트가 제공되었다고 가정하지 말 것.
- 로그인·DB·서버 API·AI API·Notion 연동·Analytics를 추가하지 말 것.
- 일반 웹 방문자 입력을 서버로 로깅하지 말 것.
- 디자인과 카피가 확정 사실처럼 '이미 에듀봇을 만든다'고 오인시키지 말 것.

## 완료 기준
- 개발 서버에서 5개 핵심 라우트 로드/반응형 정상.
- 주 메뉴와 CTA 클릭 정상, 모바일에서 탐색 UI 가림 없음.
- `draft` 템플릿 2개가 라이브 홈페이지·라이브러리에서 보이지 않음.
- 기존 공식 34개+추가 후보 9개 메타데이터 JSON, 두 draft 템플릿, 문서, 테스트 파일 훼손 없음.
- 각 검사 스크립트 실행 결과 확인 가능.

## 이어지는 작업
CODEX-02에서 스키마-구동 프롬프트 Wizard·최종 편집본 복사·버전 충돌/저장 정책을 개발한다. 현재 미완성 영역을 기능으로 속여서는 안 된다.
