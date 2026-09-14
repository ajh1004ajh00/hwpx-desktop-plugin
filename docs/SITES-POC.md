# #22 Sites 1단계 PoC — 2026-09-14

사용자가 이번 대화에서 Sites PoC 실행을 요청했다. 기존의 2026-09-11 '실행하지 않음'은 당시 이슈 정리 범위이며, 이번 실행은 별도 승인된 후속 작업이다.

## 범위와 환경

- 합성 숫자만 처리하는 단일 페이지. 원본 문서·rhwp·폰트·외부 API·D1·R2·영구 저장 없음.
- 개인 소유자만 접근하는 비공개 Site. 공개 권한 확대·유료 한도 변경·사용자 문서 업로드 없음.
- Sites 사용 가능 여부: list_sites 성공, 기존 Site 없음, 신규 비공개 Site 생성 성공. 정확한 계정 숫자 한도는 미확인.
- 로컬 환경: Windows x64, Node 24.19.0, 현재 Codex 내장 브라우저. 실제 ChatGPT Desktop과 동일 환경이라고 가정하지 않는다. 앱 정확한 버전·사용자 선택 모델·계정 플랜은 별도 기록 필요.
- PoC 소스: `C:\Projects\hangulmate-sites-poc`, Site 전용 독립 Git 저장소.
- 소스 커밋: `f3136c92c0a9512ce82100055a0fe2f11e1746af`. 기존 플러그인 main에는 변경하지 않았다.
- Site ID: `appgprj_6aa751f06b048191babe0e91d9f424d6`. 저장 버전 1.

## 로컬 보조 증거

- [x] 정적 파일 6개 HTTP 200 및 MIME 검사.
- [x] `.wasm`의 application/wasm 및 브라우저 instantiateStreaming 계산 2+3=5.
- [x] 최상위 페이지에서 document.modelContext에 읽기/쓰기 도구 등록.
- [x] 실제 Codex 내장 브라우저 도구 목록에 hangulmate_poc_read / hangulmate_poc_set 발견.
- [x] 도구 read → value 0/revision 0. set(7, expected_revision 0) → value 7/revision 1, 접근성 화면에 7·1·AI 반영.
- [x] expected_revision 0으로 다시 쓰면 STATE_CHANGED, read-back 7/revision 1 유지.
- [x] Node 상태 테스트 3개 통과: 직접/AI 공통 상태, stale 거부, 동일 재시도 중복 방지, 입력 검증.

이 검사는 로컬 Codex 자동 검증이다. 사람이 직접 +1을 누른 사용성 검증, ChatGPT Desktop 도구 호출, Hosted Sites의 WASM/도구 결과와 구분한다. consequentialHint는 소스에 명시했으나 현재 host의 노출 목록에는 readOnlyHint/untrustedContentHint만 보였다. 나머지 주석 지원/효과를 단정하지 않는다.

## 다음 판정

- [x] 소유자 전용 비공개 Sites 버전 1 배포 성공.
- URL: https://hangulmate-webmcp-poc.gptisgod.chatgpt.site
- [x] Hosted URL에서 ChatGPT 로그인 게이트 확인.
- [x] 사용자가 직접 로그인 후 비공개 PoC 페이지 접근 성공.
- [x] Hosted WASM application/wasm, instantiateStreaming 2+3=5 통과.
- [x] Hosted 최상위 읽기/쓰기 WebMCP 두 개 발견·실제 호출·화면 반영 확인.

Hosted 자동 검증 추가: read → value 0/revision 0, set(value 7, expected_revision 0, command_id hosted-poc-1) → value 7/revision 1/actor AI 및 접근성 화면 일치. 오래된 revision 0으로 별도 쓰기는 STATE_CHANGED. 동일 hosted-poc-1 재시도는 value 7/revision 1 유지. 화면의 쓰기 호출 횟수는 2이며 실제 변경 횟수는 revision 1이다. 이는 현재 Codex 내장 브라우저에서 수행한 Hosted Sites 증거다. 사용자가 직접 +1을 누른 뒤 접근성 화면과 hangulmate_poc_read 반환값이 모두 value 8/revision 2/actor 직접 입력으로 일치했다. 버튼 조작은 사용자가 수행했고 에이전트는 읽기와 대조만 수행했다. ChatGPT Desktop 별도 환경 시험은 아직 미검증이다.

방문자 로그인은 개발자 신원 인증과 별개다. 로그인 우회나 공개 접근 확대는 하지 않았다. Windows 포장 경로 문제는 공식 package-site.sh를 Git Bash에서 실행해 해결했다.

배포 성공과 Hosted URL의 등록·발견·호출·화면 변경을 별도 기록한다. 사람이 대상 ChatGPT Desktop에서 같은 순서로 확인하고 앱/버전/모델을 기록해야 1단계의 실제 지원 환경 판정이 가능하다. 당시에는 이 조건 전 rhwp 배포를 보류했다. 이후 사용자가 PoC 대신 실제 편집기 배포를 명시 요청해 아래처럼 범위를 변경했다. ChatGPT Desktop 지원 판정과 심사 재현 허용은 여전히 별도 미확정이다.

#26 응답 제한·이어 읽기 등 로컬 독립 작업은 이 사람 검증을 기다리지 않고 계속 진행할 수 있다. Sites를 주 배포처로 채택하거나 #12의 로컬 패키지 후보를 폐기한 것은 아니다.

## 실제 편집기 배포 — 사용자 후속 지시 반영

사용자가 “PoC를 만들지 말고 실제로 진행”하도록 명시했다. 기존 Site를 유지하고 카운터를 실제 rhwp 편집기로 교체했다. 별도 Site 생성이나 공개 권한 확대는 하지 않았다.

- 배포 버전 2 / 성공. URL: https://hangulmate-webmcp-poc.gptisgod.chatgpt.site
- Site 소스: f90f8fc840b037c49c25126b4d2edb3f3dafaa69. 67개 정적 배포 파일, 약 53.76MB tar. 실제 편집기/글꼴/WASM/브리지 포함. 문서 파일, Node 서버, 업로드 API 없음.
- 브라우저 파일 선택/새 문서/편집/내보내기는 기존 rhwp UI, WebMCP는 최상위 페이지의 기존 5개 도구. 브라우저 IndexedDB 자동복구·최근 문서·이력은 포함된다.
- 검증된 로컬 패키지에서 scripts/export-sites.mjs로 내보낸다. 메인/iframe 모두 동일 출처 CSP를 설정했다. 외부 API 키나 원격 MCP는 추가하지 않았다.
- 시작 시 zoom-fit-width 명령이 문서 초기화 잠금과 충돌해 AI 연결까지 중단되던 것을 실제 브라우저에서 재현했다. 불필요한 초기 확대 명령을 제거하고 연결 성공을 확인했다.
- 배포 전후 현재 Codex 브라우저에서 실제 편집기 표시, 도구 5개 발견, read_selection 및 analyze_document 실제 호출 성공. 빈 문서 1페이지/1문단/함초롬바탕 10pt 반환.
- 빈 문서 초기 커서는 cursor.editable=false/selection.editable=false였다. 이 위치에서 AI 쓰기를 우회하거나 쓰기 성공으로 기록하지 않았다. 실제 지원 위치의 쓰기·화면 반영 검증은 남아 있다.
- 전체 Node 테스트 34개 통과. 사람의 파일 열기·저장·재열기·IME 검증, macOS, 별도 ChatGPT Desktop 지원 검증 및 심사 승인은 미완료.

이제 이 URL은 숫자 PoC가 아니라 실제 편집기다. URL의 기존 poc 문자열은 주소 유지에 따른 것이며 별도 새 실험을 만든 것이 아니다.

## 입력 조합 상태 및 탭 복구 후속 기록

실제 신청서의 선택 텍스트를 WebMCP로 교체하고 문서 분석으로 반영을 확인했다. 작성 중 외부 composition 이벤트를 따로 추적한 desktopComposing이 true로 남아 사용자가 입력 종료를 알린 뒤에도 AI 쓰기가 차단됐다. 별도 document 이벤트 플래그를 제거하고 InputHandler의 실제 isComposing을 getter로 읽도록 overlay를 수정했다. 기존 입력 조합 쓰기 거부 보호는 유지한다. pinned overlay 회귀 검사 및 빌드는 통과했으며 수정 후 실제 IME 재현 검증은 별도 필요하다.

다음 턴에는 기존 편집 탭이 브라우저 목록에서 사라져 있었다. 종료 원인은 확정하지 않으며, 이전 턴의 탭 유지 표시 누락은 에이전트 운영상 오류로 기록한다. 동일 Site 재진입 시 자동 복구 후보가 나타났고, 이를 복구해 작성한 지원동기와 4페이지 문서를 확인했다. 문서 삭제로 단정하지 않는다. 새 탭은 markDeliverable로 유지했다. 이는 자동 복구 사례 한 건이며 저장·모든 내용·서식 보존 시험 전체 통과로 일반화하지 않는다.

복구 후 composing=false에서 남은 기획서 항목도 WebMCP로 작성했다. 사용자 문서는 Site 소스/배포/GitHub에 포함하지 않았다. 현재 편집 탭은 강제 새로고침하지 않고 사용자 저장을 우선한다.

### 사용자 저장 확인

사용자가 복구·추가 작성 후 “저장하고 확인해봤어. 잘 돼”라고 보고했다. 이번 문서의 저장 및 사용자 확인 성공으로 기록한다. 저장 형식, 재열기 방식, 전체 서식 대조 범위는 별도로 보고되지 않았으므로 추정하지 않는다. 새 IME 수정본 적용 여부와 실제 입력 조합 재검증은 이 보고만으로 완료 처리하지 않는다.

### 버전 3 자동 쓰기 재검증
사용자 저장 확인 후 수정본을 재로드했다. 새 빈 문서의 일반 문단에 날짜 문구를 WebMCP로 입력하고 다시 읽어 일치를 확인했다. 이어 찾기 입력창에 한글 문구를 입력하고 찾기/닫기를 거친 뒤 composing=false 및 정확한 선택 영역을 확인했으며, 같은 문구에 AI 수정 확인을 덧붙이는 두 번째 WebMCP 쓰기도 성공했다. 결과: 편집 기능 확인일: 2026년 9월 14일 · AI 수정 확인. 이 결과는 현재 Codex의 자동 UI/도구 검사이며 사용자 실제 IME 조합 중 차단·조합 종료 후 재개 검증 전체를 대체하지 않는다. 기존 신청서 파일은 변경하지 않았고 새 시험 문서는 저장하지 않았다.
