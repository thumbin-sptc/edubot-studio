# EDU-BOT Studio — Codex 착수용 저장소 (v0.3)

특수교육 교사가 ChatGPT·Claude·Gemini에서 나만의 에듀봇을 구성하는 법을 배우고, 교재 프롬프트를 단계별 입력으로 완성하는 무료 웹앱을 만들기 위한 **개발 시작 패키지**다.

## 지금 준비된 것
- 확정된 29개 기획 결정 및 화면·기능·검수 명세: `docs/`
- 교재 3종에서 발견한 공식 프롬프트 **34개 + 추가 후보 9개(총 43건)** 목록: `content/prompt-inventory.json`
- 검토 중인 **시범 데이터 2개**(특수학급/특수학교 교사철학): `content/prompts/SC-001.json`, `SS-001.json`
- 데이터 기본 무결성 검사기 및 테스트: `scripts/`, `tests/`
- Codex **첫 구현 지시서**: `tasks/CODEX-01.md`

**주의: 현재 다운로드 패키지는 Next.js 웹앱이 완성된 상태가 아니다.** `src/app/`은 시작 위치를 표시하는 빈 폴더이며, 첫 구현은 Codex에게 `tasks/CODEX-01.md`를 읽혀 시작한다.

## 먼저 데이터 검사하기 (Node.js 20.9 이상 권장)
```bash
npm run validate:content
npm test
```
위 검사기는 외부 npm 패키지가 필요 없다. Next.js 스캐폴딩을 추가한 뒤에도 유지한다.

## 개발 착수
1. GitHub에 새 저장소를 만들고 이 압축파일 **안의 내용**을 저장소 루트에 넣는다. 미확정 교재 문구와 원본 자료를 다루므로 **처음에는 Private 저장소 권장**.
2. 저장소를 Codex에서 열고 `tasks/CODEX-01.md`의 작업을 실행한다.
3. npm 스크립트 검증/타입/빌드가 통과한 뒤 GitHub `main`에 반영한다.
4. 준비된 프로젝트를 Vercel에 연결하면 `main`에 변경 사항이 반영될 때 배포하도록 설정할 수 있다. 실제 연결·배포는 사용자가 진행한다.

## 원고가 수정되면
- 프롬프트 `id`는 그대로 두고 `version`만 증가시킨다.
- 승인된 문구만 새 `sourceOriginalText`/`templateText`에 반영한다.
- `publicationStatus`가 `published`인 템플릿만 서비스에 노출한다.
- 저장된 기존 작성본은 버전 불일치 시 무통보 초기화하지 않는다.
- IEP 프롬프트는 나중에 같은 데이터 구조로 추가한다.

## 넣지 않은 자료
- PDF 교재 원본, GPTs 지침·지식 파일, 에듀봇 공식 로고·마스코트, 튜토리얼 GIF/영상은 포함하지 않았다.
- 이 패키지에 사용자 또는 학생의 실제 개인정보는 넣지 않는다.
- Notion 관련 파일·연동은 없음.
