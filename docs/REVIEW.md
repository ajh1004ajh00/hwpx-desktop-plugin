# GPT 코드 검토 안내

## 목적

Desktop 내장 브라우저에서 rhwp 기반 직접 편집과 AI 편집을 같은 문서에 적용하는 MVP다.
검토 범위는 이 레포와 setup이 고정한 rhwp 커밋이다. 웹 ChatGPT용 Apps SDK,
원격 MCP, XML 패치 엔진은 이 프로젝트의 요구사항이 아니다.

## 읽는 순서

1. README.md: 실행·지원 범위.
2. desktop/studio.mjs: editor 생성, 파일 선택과 다운로드 UI.
3. desktop/studio-tools.mjs: 다섯 개 WebMCP 도구, 스냅샷 보관, 작업본 내보내기.
4. desktop/cursor-bridge.mjs: 실제 커서·선택 증거, 상태 재확인, 입력·실행 취소 연결.
5. desktop/document-analysis.mjs: rhwp 모델의 표·문서·서식 페이징.
6. desktop/studio-build.config.mjs: 고정 upstream API에 적용하는 빌드 변환.
7. desktop/server.mjs 및 scripts/: 로컬 자산 제공, 설치와 실행.
8. skills/hwpx-desktop/SKILL.md: 에이전트의 실제 기능 선택과 한계 안내.

## 검토할 위험

- 커서 이동/직접 입력/IME 조합/문서 교체 중 AI 명령이 잘못 적용될 수 있는가?
- 같은 command_id 재시도로 중복 입력이 발생하는가? 실행 취소가 사용자 입력과 일관되는가?
- 스타일 분석이 rhwp의 지원 범위를 넘어 정확성을 주장하는가?
- 저장 중 변경을 제대로 거부하는가? 반환 bytes와 실제 디스크 저장을 구분하는가?
- 서버가 허용한 UI/런타임 외의 로컬 파일에 접근할 수 있는가?
- upstream 변경 시 빌드 변환이 명확히 실패하는가?

## 재현

Node 24+와 Git으로 `npm run setup`, `npm test`, `npm start`를 실행한다.
실제 WebMCP 연결은 이를 지원하는 Desktop 내장 브라우저에서 확인해야 한다.
외부 브라우저/테스트 더블의 성공을 실제 host 연결 성공으로 간주하지 않는다.

수동 검증: 새 빈 문서 입력 → 현재 커서 읽기 → AI 삽입 → 선택 교체 → 실행 취소 →
표 안에서 읽기 및 분석 → 문서 분석 페이징 → 작업본 다운로드 → 다시 열기.
미지원 셀/문단 구조와 오래된 스냅샷이 거부되는지도 확인한다.

## 분리 출처

2026-09-10 원본 레포 로컬 작업 트리에서 Studio 관련 파일만 추출했다.
원본 HEAD는 2f6d8d4e37fb577f3afc79071701e51c1d135e0c이나 Desktop 파일은 당시
미커밋 상태였으므로 그 커밋만으로 이번 Desktop 구현을 복원할 수 없다.
현재 레포가 추출된 코드의 독립 스냅샷이다. 원본 파일이나 설치된 플러그인을 삭제하지 않았다.

## 이번 분리 검증 결과 (2026-09-10, Windows)

- 새 디렉터리에서 `npm run setup`: 의존성 설치 및 production build 성공.
- `npm test`: 19 passed, 0 failed. 이전 필드 등록 방식 테스트는 포함하지 않는다.
- 플러그인 manifest validator 및 skill validator 통과.
- 실제 Desktop Built-in Browser, 별도 4176 포트에서 Studio 화면과 다섯 WebMCP 도구 확인.
- 빈 테스트 문서의 일반 본문에 직접 입력 후 AI 커서 삽입과 선택 영역 교체 확인.
- AI 입력 실행 취소 시 이전 문서 SHA와 정확히 일치하고 다시 실행 시 문구 복원.
- 커서 이동 후 오래된 스냅샷 입력은 CURSOR_CHANGED로 거부.
- UI에서 2×2 표 생성, 첫 셀 AI 입력, 현재 표 분석으로 4개 셀 확인.
- 전체 문서 분석으로 본문과 함초롬바탕 10pt 서식 확인.
- 작업본 bytes 준비와 다운로드 링크 표시는 성공. 링크 클릭 후 Windows Downloads에
  새 파일이 생성된 것은 확인되지 않았다. 실제 디스크 저장 및 저장본 재열기는 이번 검증에서 미확인이다.
- macOS의 실제 UI 실행과 일반 문서 전체의 무손실 보존은 이번 검증 범위 밖이다.

upstream Studio lockfile의 `npm audit`에는 5개 경고(low 1, moderate 1, high 3)가 있다.
대상 패키지는 @babel/core, baseline-browser-mapping, brace-expansion, browserslist, fast-uri다.
`npm audit --omit=dev --prefix desktop/.runtime/rhwp/rhwp-studio`는 0건이며
직접 core/editor 의존성 설치 검사도 0건이다. 이는 알려진 advisory 검사 결과이고 보안 보장은 아니다.
이번 추출에서는 작동 중인 upstream 버전/lockfile을 유지했다. 출시 전 빌드 의존성 갱신을 검토한다.
