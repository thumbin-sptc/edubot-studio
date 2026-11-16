# GitHub Pages 배포

운영 주소는 [EDU-BOT Studio](https://thumbin-sptc.github.io/edubot-studio/)입니다. Next.js는 Node.js 24 빌드에서 HTML, 라우팅 데이터와 브라우저 자산을 `out/`에 생성합니다. Pages는 검증된 `out/`만 게시합니다.

## 설정과 배포 확인

1. GitHub 저장소 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다. `github-pages` 환경의 배포 브랜치는 `main`입니다. [GitHub Pages 게시 소스](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
2. `main`에 푸시하면 **CI**의 `validate` 작업이 설치, 콘텐츠 검사, 테스트, 린트, 타입 검사, 빌드와 정적 공개 경계를 검사합니다. 통과한 `out/`을 업로드한 후 `deploy`가 게시합니다. PR은 검증만 실행합니다. 운영 빌드에 필요한 환경변수는 없습니다.
3. **Actions → CI**에서 두 작업의 성공, 커밋 SHA, `github-pages`의 배포 URL을 확인합니다. `main`이 더 최신이면 이전 실행은 게시를 건너뜁니다. 필요한 경우 **Run workflow**에서 현재 `main`을 다시 실행할 수 있습니다.

## 운영 확인

| 운영 주소 뒤에 붙일 경로 | 현재 기대 결과 |
| --- | --- |
| 루트 | 홈에서 두 기능 시작 화면으로 이동 |
| `create/` | 플랫폼 3종 × PC·모바일 웹 조합 모두 준비 중 |
| `prompts/` | 공개 프롬프트 29건(특수학급 15건, 특수학교 14건) |
| `data/` | 새 브라우저 프로필에서 자동 저장 OFF, 저장본 없음 |
| `help/` | 이용 안내와 개인정보 보호 안내 |
| `prompts/SC-001/`, `prompts/SS-001/` | HTTP 200, 승인된 판본의 작성 마법사 |
| `prompts/DD-001/`, `create/chatgpt/desktop-web/` | HTTP 404 |
| `content/prompts/SC-001.json`, `content/prompt-inventory.json`, `tests/fixtures/synthetic-create.mjs` | HTTP 404 |

PC와 모바일에서 메뉴 이동, 직접 접속, 새로고침, 뒤로 가기, 스타일·폰트 로딩과 저장 기본값을 확인합니다. 공개 프롬프트 작성 마법사는 합성 입력으로 운영 주소에서 확인합니다. 공개 제작 가이드는 0건이며, 이미지·영상·자막, 개별 다운로드·ZIP은 격리된 합성 빌드에서 확인합니다. 공개 자료 등록은 [콘텐츠 공개 체크리스트](CONTENT-RELEASE.md)를 따릅니다.

## 정적 호스팅에서 처리하는 항목

- `basePath: "/edubot-studio"`는 Next.js 링크와 빌드 자산에 적용됩니다. 콘텐츠 경로는 기존 `/tutorials/…`, `/downloads/…` 형식으로 관리하고 브라우저에서 열 때만 배포 경로를 붙입니다. 이미지는 원본 정적 파일을 쓰며, ZIP은 브라우저에서 같은 출처의 파일을 받아 크기와 SHA-256을 확인한 뒤 생성합니다. [Next.js basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)
- `trailingSlash: true`로 각 주소에 `index.html`을 만들어 직접 접근과 새로고침을 지원합니다. Pages의 정적 `404.html`이 미생성 주소를 처리합니다. 런타임 Node.js와 이미지 최적화 서버는 필요하지 않습니다. [Next.js 정적 내보내기](https://nextjs.org/docs/app/guides/static-exports)
- 현재 Next.js 버전은 공개 상세 목록이 비어 있어도 동적 라우트마다 빌드용 매개변수를 요구합니다. `npm run build`의 후속 단계가 임시 상세 경로를 `out/`에서 제거합니다. Windows에서는 Next.js가 하위 폴더에 생성한 프리페치 파일명도 브라우저가 요청하는 점 구분 형식으로 맞춥니다. 공개 경계 검사는 실제 산출물의 파일 목록, HTML, 라우팅 데이터, 번들과 승인 파일을 확인합니다.
- 브라우저 저장은 출처 단위입니다. 다른 도메인의 저장본은 GitHub Pages로 자동 이동하지 않습니다. 자동 저장은 이 주소에서도 기본 OFF입니다.

## 복구

Actions에서 문제가 발생한 SHA와 작업을 확인합니다. 검증이 실패하면 이전 게시본이 유지됩니다. 게시 후 문제가 발견되면 정상 동작한 SHA와 콘텐츠 승인 상태를 확인하고, 문제 변경을 되돌리는 커밋을 `main`에 반영해 같은 CI와 배포를 거칩니다. 회수된 자료의 재게시 여부도 확인합니다. 복구 배포의 SHA와 운영 주소에서 화면·404를 다시 확인합니다.
