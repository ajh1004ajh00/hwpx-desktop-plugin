# HWPX Desktop

Desktop 내장 브라우저에서 **한글 문서를 직접 입력하고 AI와 함께 편집**하는 플러그인입니다.
현재 커서·선택 영역 입력, 표/문서 분석, 작업본 다운로드에 집중합니다.

`hwpx-document-plugin`의 로컬 Desktop 구현에서 분리했습니다.
웹 ChatGPT Apps SDK, 원격 MCP, XML 직접 편집 및 SVG 위치 분석 파이프라인은 포함하지 않습니다.
rhwp 내부의 파일 파싱과 렌더링은 그대로 사용합니다.

## 실행

Node.js **24 이상**, Git, 최초 설치 시 인터넷 연결이 필요합니다.

```sh
git clone https://github.com/ajh1004ajh00/hwpx-desktop-plugin.git
cd hwpx-desktop-plugin
npm run setup
npm start
```

Desktop의 내장 브라우저에서 `http://127.0.0.1:4175/desktop/`를 엽니다.
파일 열기에서 `.hwp`/`.hwpx`를 선택하거나 빈 문서에 직접 입력합니다.
외부 브라우저에서도 수동 UI는 열리지만 AI 도구 연결은 **WebMCP를 지원하는 host**가 필요합니다.
Desktop 제품명만으로 지원을 가정하지 않습니다.

이미 다른 서버가 4175를 쓰고 있다면 PowerShell에서:

```powershell
$env:HWPX_DESKTOP_PORT = '4176'
npm start
```

이때 내장 브라우저에서 `http://127.0.0.1:4176/desktop/`를 엽니다.
컴퓨터 재시작 후에는 다시 `npm start`하면 됩니다. 의존성이 준비되어 있으면 setup 재실행은 필요 없습니다.

## AI 도구

| 도구 | 기능 |
| --- | --- |
| `hwpx_studio_read_selection` | 현재 커서·선택·문서 버전 읽기 |
| `hwpx_studio_insert_at_cursor` | 읽은 커서에 입력하거나 같은 문단의 선택 텍스트 교체 |
| `hwpx_studio_analyze_current_table` | 현재 표의 셀·내용·글꼴·크기 등 분석 |
| `hwpx_studio_analyze_document` | 본문·표·셀·서식 구간을 페이징해서 분석 |
| `hwpx_studio_replace_paragraph` | 지원되는 일반 본문 문단 전체 교체 |

AI는 화면 픽셀 대신 Studio의 실제 문서 위치와 스냅샷을 사용합니다.
사용자가 커서를 옮기거나 문서를 수정하면 오래된 입력 명령을 거부합니다.
AI 입력과 직접 입력은 같은 문서와 실행 취소 기록을 공유합니다.

## 플러그인 구성

`.codex-plugin/plugin.json`과 `skills/hwpx-desktop/SKILL.md`가 포함된 skill 기반 플러그인입니다.
스킬은 서버 실행과 내장 브라우저에서 실제 도구를 사용하는 방법을 안내합니다.
문서 도구는 페이지의 `document.modelContext`에 등록되며 별도 `.mcp.json` 서버는 없습니다.

이 레포를 복제하거나 게시하는 것만으로 기존에 설치된 **HWPX Document**가 바뀌지는 않습니다.
새 패키지의 표시 이름은 **HWPX Desktop**입니다. 현재 설치 목록이나 원격 연결은 수정하지 않습니다.
GPT 코드 검토용 진입점은 [docs/REVIEW.md](docs/REVIEW.md)입니다.

## 저장과 현재 한계

- `저장 준비` → `준비된 작업본 내려받기`로 HWPX 파일을 저장합니다. 원본을 덮어쓰지 않습니다.
- 파일 선택기는 최대 32 MiB를 허용합니다. 내장 Studio 기능 전체의 호환성을 보장하는 수치는 아닙니다.
- AI 입력은 일반 본문/깊이 1 표 셀의 같은 문단, 한 줄 BMP 텍스트 1–4,000자를 지원합니다.
- 중첩 표, 보호 셀, 여러 문단/셀 선택, 필드, 머리말·꼬리말·각주·객체 모드,
  줄바꿈/탭·보충 유니코드 입력은 AI 커서 도구에서 거부합니다.
- 분석은 본문과 최상위 표 중심입니다. 미지원 구조와 개수는 결과에 명시합니다.
- 자동 저장·복구가 없습니다. 새로고침 전에 저장하세요. 저장 링크는 준비 시점의 작업본입니다.
- HWP/HWPX 읽기와 HWPX 내보내기는 rhwp 호환 범위에 따릅니다. 중요한 문서는 다시 열어 검토하세요.

## 개발 및 검증

```sh
npm run setup
npm test
npm run build
```

`setup`은 잠긴 npm 의존성과 고정 upstream Studio를 내려받아 빌드합니다.
이미 설치한 의존성으로 다시 빌드할 때는 `npm run build`를 사용합니다.
테스트에는 커서/선택 변경 거부, 입력 조합·중복 명령 처리, 표/문서 분석,
내보내기 중 변경 거부, 서버 파일 접근 경계와 upstream 빌드 패치 검사가 포함됩니다.

직접 npm 의존성은 `@rhwp/core`와 `@rhwp/editor` **0.8.6** 두 개입니다.
Studio는 커밋 `e8800c8def63449808a4092798442652ed460552`에서 빌드하며 자체 lockfile을 사용합니다.
빌드 시 upstream의 개발 의존성도 설치됩니다. Node만으로 실행하며 Python/Rust toolchain은 필요 없습니다.
생성된 Studio/WASM/폰트와 node_modules는 Git에서 제외되므로 첫 setup에는 다운로드 시간과 공간이 필요합니다.

## 출처

- 원본 프로젝트: [taejung3852/hwpx-document-plugin](https://github.com/taejung3852/hwpx-document-plugin)
- 문서 엔진 및 Studio: [edwardkim/rhwp](https://github.com/edwardkim/rhwp)
- [MIT License](LICENSE), [의존성·폰트 고지](THIRD_PARTY_NOTICES.md)
