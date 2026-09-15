# 한글메이트 · HangulMate

**GPT와 함께 쓰고 고치는 한글 문서.**

한글 파일을 열고, 문장과 표를 함께 수정하고, 결과물을 저장하는 Desktop 공동 편집 플러그인입니다.
사용자의 직접 편집과 AI 편집은 같은 문서와 실행 취소 기록을 사용합니다.

> 개발 중 · 임시 제품명
> v1.0.0은 Windows/macOS 공동 편집과 OpenAI 플러그인 심사 통과·출시를 목표로 합니다.
> 공개 Sites 시험 배포 및 플러그인 검증 단계이며 전체 형식 호환성이나 심사 승인을 의미하지 않습니다.

[Project](https://github.com/users/ajh1004ajh00/projects/2) · [마일스톤](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/milestones) · [이슈](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/issues) · [기여 안내](CONTRIBUTING.md)

## 함께 작업하는 방법

기본 이용 경로는 [공개 Sites 편집기](https://hangulmate-webmcp-poc.gptisgod.chatgpt.site/)와 최신 플러그인입니다. Node.js/Git/로컬 서버 설치 없이 시작합니다. [새 사용자 안내](docs/SITES-QUICKSTART.md)를 참고하세요. 아래 개발용 설치는 로컬 개발을 선택한 경우에만 해당합니다.

목표 경험은 **파일 열기 → 위치 확인 → GPT와 수정 → 직접 보완 → 저장·재열기**입니다.

| 하고 싶은 일 | 요청 예시 | 현재 범위 |
| --- | --- | --- |
| 문장 다듬기 | “선택한 문장을 간결하게 바꿔줘” | 지원되는 같은 문단의 선택 텍스트 수정 |
| 표 내용 작성 | “현재 셀에 이 내용을 넣어줘” | 일반 표 셀의 현재 커서에 한 줄 입력 |
| 문서 검토 | “문서 내용과 글자 서식을 분석해줘” | 본문·최상위 표의 페이징 분석 |
| 신청서 공동 작성 | “팀명과 참가 목적을 해당 칸에 채워줘” | 요청한 문자열의 일치 후보 검색·선택 후 항목별 수정. 중복 후보는 확인 필요 |

커서를 놓거나 텍스트를 선택한 뒤 요청하거나, 찾을 구절을 지정할 수 있습니다. 의미 검색은 제공하지 않습니다.

AI 쓰기 후 **최근 AI 변경**에서 위치와 이전·변경 내용을 확인하세요. 현재 탭의 최근 20건을 각각 300자까지 표시하며, 실행 취소나 직접 수정 후의 현재 상태와 다를 수 있습니다. 되돌리기는 문서의 실행 취소를 사용하고, 결과 확인 후 저장하세요. **표시 기록 지우기**는 표시 내역만 지웁니다.

문서나 커서가 바뀌었다는 오류가 나오면 대상을 다시 읽고 확인합니다. 여러 항목 중 일부가 실패하면 성공한 항목까지 일괄 재실행하지 않습니다. 실제 한글 입력·PDF·독립 뷰어의 배치 검증은 아직 남아 있습니다.

## 지원 형식과 환경

목표는 **HWP/HWPX 입력 → HWP/HWPX/PDF 출력**입니다.
메뉴 제공과 실제 결과물 품질 검증을 구분합니다.

| 형식 | 현재 경로 | 검증 상태 |
| --- | --- | --- |
| HWP/HWPX 입력 | Studio 파일 열기 | 엔진 읽기 지원, 문서별 호환성 검증 필요 |
| HWP 출력 | HWP 형식으로 저장 | 메뉴 제공, 실제 저장·재열기 검증 필요 |
| HWPX 출력 | HWPX 형식으로 저장 | 메뉴 제공, 실제 저장·재열기 검증 필요 |
| PDF 출력 | 브라우저 인쇄의 PDF로 저장 | 메뉴 제공, 글꼴·페이지 배치 검증 필요 |

| 환경 | 현재 상태 | v1.0.0 검증 목표 |
| --- | --- | --- |
| Windows | Studio·WebMCP 연결과 일부 편집 검증 | 설치부터 세 형식 저장·재열기 및 복구까지 |
| macOS | 실제 환경 시험 예정 | 같은 시험 문서와 판정 기준으로 전체 흐름 확인 |

OS·CPU·Desktop·Node·뷰어 버전과 시험 날짜를 기록합니다.
일반 브라우저 실행이나 자동 테스트 성공으로 실제 Desktop 검증을 대신하지 않습니다.

## 개발용 설치와 첫 작업

Node.js **24 이상**, Git, 최초 설치 시 인터넷 연결이 필요합니다.
현재 저장소 접근 권한이 필요하며, 아래는 개발용 경로입니다. 공개 디렉터리 배포는 준비 중입니다.

```sh
git clone https://github.com/ajh1004ajh00/hwpx-desktop-plugin.git
cd hwpx-desktop-plugin
npm run setup
npm start
```

Desktop의 내장 브라우저에서 `http://127.0.0.1:4175/desktop/`를 엽니다.
Studio의 `파일 > 열기`에서 `.hwp`/`.hwpx`를 선택하거나 빈 문서에 직접 입력합니다.
첨부 파일 자동 열기는 작업 지침을 마련했지만 실제 host 연결 검증이 남아 있습니다.
파일이 열린 뒤 읽기·분석·지원되는 입력은 WebMCP 도구를 우선 사용합니다.
외부 브라우저에서도 수동 UI는 열리지만 AI 도구 연결은 **WebMCP를 지원하는 host**가 필요합니다.
Desktop 제품명만으로 지원을 가정하지 않습니다.

이미 다른 서버가 4175를 쓰고 있다면 PowerShell에서:

```powershell
$env:HWPX_DESKTOP_PORT = '4176'
npm start
```

macOS에서는:

```sh
HWPX_DESKTOP_PORT=4176 npm start
```

이때 내장 브라우저에서 `http://127.0.0.1:4176/desktop/`를 엽니다.
컴퓨터 재시작 후에는 다시 `npm start`하면 됩니다. 의존성이 준비되어 있으면 setup 재실행은 필요 없습니다.

## v1.0.0 로드맵

| 마일스톤 | 달성할 결과 |
| --- | --- |
| [v0.2.0 공동 편집 기본 흐름 완성](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/milestone/1) | 첨부 파일 연결, 대상 탐색, WebMCP 우선 작업, 형식별 저장 검증 |
| [v0.3.0 Windows·macOS 실사용 안정성 확보](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/milestone/2) | 여러 항목 작성, 변경 확인·undo, 복구, 공통 문서 및 두 OS 검증 |
| [v0.9.0 플러그인 심사 제출 준비 완료](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/milestone/3) | 제출 경로, 설치·배포·CI, 정책·사용 문서, 심사 시나리오 |
| [v1.0.0 플러그인 심사 통과·출시](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/milestone/4) | 제출·보완 대응, 승인 확인, 승인된 버전 게시 |

심사 경로 조사는 초기부터 진행합니다. 개발 완료·제출·승인·게시를 구분하며,
기한은 확정 전 지정하지 않습니다. 세부 완료 조건과 의존성은 Project의 이슈에서 관리합니다.

## AI 도구

| 도구 | 기능 |
| --- | --- |
| `hwpx_studio_read_selection` | 현재 커서·선택·문서 버전 읽기 |
| `hwpx_studio_insert_at_cursor` | 읽은 커서에 입력하거나 같은 문단의 선택 텍스트 교체 |
| `hwpx_studio_apply_char_format` | 선택한 글자의 글꼴·크기·굵게·기울임·밑줄·취소선·색상 변경 |
| `hwpx_studio_analyze_current_table` | 현재 표의 셀·내용·글꼴·크기 등 분석 |
| `hwpx_studio_analyze_document` | 본문·표·셀·서식 구간을 페이징해서 분석 |
| `hwpx_studio_replace_paragraph` | 지원되는 일반 본문 문단 전체 교체 |
| `hwpx_studio_find_targets` | 요청한 구절의 일치 후보만 검색 |
| `hwpx_studio_focus_target` | 확인한 검색 후보를 선택; 쓰기 전 다시 읽기 필요 |

AI는 화면 픽셀 대신 Studio의 실제 문서 위치와 스냅샷을 사용합니다.
사용자가 커서를 옮기거나 문서를 수정하면 오래된 입력 명령을 거부합니다.
AI 입력·글자 서식과 직접 편집은 같은 문서와 실행 취소 기록을 공유합니다.

## 플러그인 구성

`.codex-plugin/plugin.json`과 `skills/hwpx-desktop/SKILL.md`가 포함된 skill 기반 플러그인입니다.
스킬은 서버 실행과 내장 브라우저에서 실제 도구를 사용하는 방법을 안내합니다.
문서 도구는 페이지의 `document.modelContext`에 등록되며 별도 `.mcp.json` 서버는 없습니다.

표시 이름은 **한글메이트**입니다. 설치 호환성을 위해 저장소·플러그인 식별자
`hwpx-desktop-plugin`을 유지합니다. 기존 HWPX Document에서 분리한 독립 프로젝트입니다.
현재 원격 MCP와 Apps SDK UI는 포함하지 않습니다.
GPT 코드 검토용 진입점은 [docs/REVIEW.md](docs/REVIEW.md)입니다.

## 데이터 처리·저장과 현재 한계

문서 파싱·렌더링은 로컬 브라우저의 rhwp 엔진에서 수행합니다.
읽기·분석 도구가 반환하는 문서 텍스트와 서식 정보는 GPT의 작업 문맥에 전달됩니다.
로컬 엔진 사용이 문서 내용의 외부 전달이 전혀 없다는 뜻은 아닙니다.

- Studio 파일 메뉴에서 HWP/HWPX 저장 또는 PDF 인쇄를 선택합니다. 실제 생성 파일을 다시 열어 확인하세요.
- 로컬 파일 선택과 저장처럼 WebMCP가 제공하지 않는 작업에만 브라우저 자동화를 사용합니다.
- AI 입력과 글자 서식은 일반 본문/깊이 1 표 셀의 같은 문단 안에서 지원합니다. 입력 텍스트는 한 줄 BMP 1–4,000자이고, 글자 서식은 비어 있지 않은 선택 영역에만 적용됩니다.
- 중첩 표, 보호 셀, 여러 문단/셀 선택, 필드, 머리말·꼬리말·각주·객체 모드,
  줄바꿈/탭·보충 유니코드 입력은 AI 커서 도구에서 거부합니다.
- 분석은 본문과 최상위 표 중심입니다. 미지원 구조와 개수는 결과에 명시합니다.
- 자동 저장·복구가 없습니다. 새로고침 전에 저장하세요.
- 형식별 읽기·내보내기는 rhwp와 브라우저의 호환 범위에 따릅니다. 중요한 문서는 원본 사본을 보관하세요.
- 개인정보처리방침·약관·공개 지원 안내 및 심사용 데이터 경계 검증은 출시 준비 작업에 포함됩니다.

## 개발 및 검증

```sh
npm run setup
npm test
npm run build
```

`setup`은 잠긴 npm 의존성과 고정 upstream Studio를 내려받아 빌드합니다.
이미 설치한 의존성으로 다시 빌드할 때는 `npm run build`를 사용합니다.
테스트에는 커서/선택 변경 거부, 입력 조합·중복 명령 처리, 표/문서 분석,
중복 파일 UI 방지, 서버 파일 접근 경계와 upstream 빌드 패치 검사가 포함됩니다.

직접 npm 의존성은 `@rhwp/core`와 `@rhwp/editor` **0.8.6** 두 개입니다.
Studio는 커밋 `e8800c8def63449808a4092798442652ed460552`에서 빌드하며 자체 lockfile을 사용합니다.
빌드 시 upstream의 개발 의존성도 설치됩니다. Node만으로 실행하며 Python/Rust toolchain은 필요 없습니다.
생성된 Studio/WASM/폰트와 node_modules는 Git에서 제외되므로 첫 setup에는 다운로드 시간과 공간이 필요합니다.

## 기여·지원·출처

[이슈](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/issues)에 환경 버전, 재현 절차,
기대 결과와 실제 결과를 기록해 주세요. 개인정보가 담긴 원본 대신 합성 시험 문서를 사용해 주세요.

- 원본 프로젝트: [taejung3852/hwpx-document-plugin](https://github.com/taejung3852/hwpx-document-plugin)
- 문서 엔진 및 Studio: [edwardkim/rhwp](https://github.com/edwardkim/rhwp)
- [MIT License](LICENSE), [의존성·폰트 고지](THIRD_PARTY_NOTICES.md)
- [OpenAI 플러그인 제출 안내](https://developers.openai.com/plugins/deploy/submission)

한글메이트는 임시 제품명이며 OpenAI 또는 한글 제품 공급자의 공식 제품·승인을 의미하지 않습니다.
# 심사 준비 작업 자료

2026-09-14 변경본의 [데이터 처리 기준](docs/DATA-POLICY.md)과
[사람 검증·macOS 팀원 인계 절차](docs/REVIEW-HANDOFF.md)를 참고하세요.
원본은 로컬 편집기에 두지만, 요청한 선택 텍스트·표/문서 분석 결과는 ChatGPT에 제공됩니다.
브라우저에 복구·최근 문서·비교 이력이 남을 수 있습니다. 최종 패키지와 실제 Desktop 검증은 별도입니다.

### Sites에서 실제 편집기 열기

공개 [한글메이트 편집기](https://hangulmate-webmcp-poc.gptisgod.chatgpt.site/)에 실제 rhwp 편집기와 WebMCP 8개 도구를 배포합니다. 이 경로는 방문자 Node/localhost 설치가 필요하지 않습니다. 문서는 브라우저에서 처리하며 자동 복구본이 브라우저 저장소에 남을 수 있습니다. 현재 배포/미검증 범위는 docs/SITES-POC.md에 기록합니다.
