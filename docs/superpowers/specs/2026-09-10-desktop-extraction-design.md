# Desktop 전용 레포 분리

사용자 승인 범위: 현재 잘 동작하는 rhwp Desktop 기능만 분리해
`ajh1004ajh00/hwpx-desktop-plugin` 비공개 GitHub 레포에 게시한다.
원본 레포나 설치된 플러그인, 열린 문서는 변경하지 않는다.

## 구조

최상위 페이지의 WebMCP 도구 → @rhwp/editor → 로컬 Studio iframe → rhwp WASM.
iframe 안의 문서가 유일한 편집 상태이며 사용자의 직접 입력과 AI 입력이
같은 실행 취소 기록을 사용한다. 기존 커서 및 분석 구현과 테스트를 옮긴다.

가져올 기능: 파일 선택, 직접 편집, 커서/선택 읽기 및 입력, 현재 표/전체 문서 분석,
제한된 본문 문단 교체, 작업본 다운로드, 로컬 정적 서버, 플러그인 스킬.

제외: Python/Rust 서버, 원격 MCP, Apps SDK UI, XML 패치 및 SVG 위치 분석,
실험용 필드 등록 UI, 터널, 서버 승인/최종화. rhwp 자체의 파일 파싱과 렌더링은 유지한다.

## 의존성과 배포

Node.js 24 이상과 Git. 직접 npm 의존성은 @rhwp/core 및 @rhwp/editor 0.8.6.
Studio는 기존 고정 커밋 e8800c8def63449808a4092798442652ed460552에서 빌드한다.
upstream 소스와 빌드 의존성은 ignored .runtime에 준비하고 원본 lockfile을 사용한다.
레포에는 사용자 문서, 인증정보, node_modules, 생성된 WASM/폰트를 올리지 않는다.
MIT 및 폰트 고지는 빌드 산출물에 유지한다.

## 검증

새 경로에서 의존성 설치와 Studio 빌드를 수행한다. 커서·분석·내보내기 테스트와
정적 서버 경계 테스트를 실행한다. 별도 포트에서 Built-in Browser 화면과 도구를 확인한다.
GitHub 게시 후 원격 URL, 비공개 상태, 커밋을 직접 확인한다.
