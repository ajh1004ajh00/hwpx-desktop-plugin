# Windows 및 제출 준비 검증 — 2026-09-18

기준 소스: main `4f595c3`, 별도 작업 브랜치 `chore/16-windows-release-readiness`. macOS는 요청에 따라 제외했다. 사용자 문서 대신 합성 문장과 기존 자동 fixture를 사용했다. 이 기록은 전체 출시 승인이 아니다.

## 패키지 수정

방문자용 Sites ZIP에 `THIRD_PARTY_NOTICES.md`가 빠져 있었다. 실제 패키지 CLI → ZIP 추출 → 파일 집합·바이트 비교 회귀 테스트에서 실패를 확인한 뒤 allowlist에 고지를 추가했다. 이제 6개 파일만 포함한다. rhwp/WASM/폰트는 사이트 자산이므로 ZIP에 추가하지 않았다.

데이터 안내에서 사용자 Sites 경로와 개발자 npm/GitHub 경로를 구분했다. 동일 사이트·브라우저 프로필의 탭은 IndexedDB 등을 공유할 수 있으므로 탭마다 완전히 독립된 저장소라는 설명을 사용하지 않는다. 캐시·복구본은 디스크에 남을 수 있고 PC 종료가 삭제를 보장하지 않는다. 호스팅 로그의 보관 기간·지역은 미확인이다.

## 로컬 자동 검증

Windows x64, Node.js 24.19.0, rhwp core/editor 0.8.6, upstream 고정 revision `e8800c8def63449808a4092798442652ed460552`.

- 새 작업 폴더에서 `npm run setup`: 의존성 설치와 Vite 빌드 성공.
- 변경 전 `npm test`: 52개 통과. 새 패키지 회귀 테스트: 수정 전 실패, 수정 후 통과.
- 변경 후 `npm test`: 53개 통과, 실패·건너뜀 0. `npm run verify:package` 및 `git diff --check` 통과. 로컬 결과이며 원격 CI와는 별개다.
- `node scripts/verify-recovery.mjs`: 복구 관련 33개 검사 통과.
- `npm audit --omit=dev --prefix desktop`: 0건. upstream Studio 전체 audit 결과를 대신하지 않는다.

upstream Studio의 전체 audit에는 5개 항목(low 1, moderate 1, high 3)이 남아 있다. `npm explain`에서 @babel/core, baseline-browser-mapping, brace-expansion, browserslist, fast-uri는 dev 의존성으로 표시되며 vite-plugin-pwa/workbox-build 도구 체인에 연결된다. 개발 의존성이므로 무조건 안전하다고 판정하지 않는다. 고정 upstream을 임의로 갱신하지 않았으며, 해당 체인의 버전 갱신과 빌드 재검증은 #21의 후속 작업이다.

Vite는 큰 chunk 및 CanvasKit의 fs/path externalization 경고를 냈다. 설치 스크립트의 Windows npm shell 호출에는 Node DEP0190 경고가 있다. 성공 exit code와 이 경고들을 구분한다.

## 공개 Sites의 실제 도구 검증

Windows Desktop 내장 브라우저의 별도 탭에서 8개 도구를 확인했다. 로컬 소스 빌드와 공개 배포의 바이너리 동일성은 이 시험으로 증명하지 않는다. 앱 정확한 버전·전체 계정 지원 조건과 새 사용자 설치는 미확인이다.

[제출 사례](SUBMISSION.md)의 P1–P6 및 N1–N4를 직접 실행했다. 주요 관찰:

- 합성 문장 삽입과 동일 요청 재전송 후 내용이 한 번만 나타났다.
- 검색한 `선택내용-B`만 교체하여 `앞문맥-A 검토완료 뒷문맥-C`를 확인했다.
- 18자 문장에서 run 0–6/12–18은 원래 10pt·검정 서식, run 6–12만 16pt·굵게·취소선·파랑으로 변경됐다. UI Undo 후 전체가 원래 단일 서식으로 돌아왔다.
- 오래된 문서/커서 snapshot 및 command_id의 다른 인자를 각각 DOCUMENT_CHANGED/CURSOR_CHANGED/COMMAND_REPLAY_MISMATCH로 거부했다.
- 줄바꿈 포함 입력은 TOOL_FAILED로 거부됐고 마지막 문장 `한글메이트 최종 합성 문장`이 유지됐다.
- 일반 Chrome 별도 탭에서는 직접 편집 가능·WebMCP 미지원 안내를 확인했다. 프로그램으로 입력한 한글 문자열은 물리적 IME 조합 시험이 아니다.

Undo 이후 선택이 해제된 상태에서 한 번 삽입된 중간 시도는 선택 치환 성공으로 계산하지 않았다. 이를 Undo한 뒤 다시 검색/선택/읽기를 거쳐 P2를 수행했다. 최신 선택 재확인이 필요한 실제 사례다.

## 저장·PDF: 미완료

내장 브라우저에서 HWPX/HWP 저장 이름 대화상자를 완료했지만 출력 파일을 확보하지 못했다. HWP의 브라우저 다운로드 이벤트는 3초 내 관찰되지 않았다. 일반 Chrome에서도 HWPX 저장 UI 완료 후 파일 확보를 확인하지 못했다. 확인한 Downloads 폴더에서 합성 파일이 발견되지 않았다는 사실만으로 저장 실패의 원인을 확정하지 않는다.

PDF 인쇄 안내에서 인쇄 창 열기까지 진행했으나 실제 시스템 인쇄 창·PDF 파일을 확인하지 못했다. 따라서 #3/#10/#27의 저장 보존·독립 뷰어 재열기·PDF 시각 비교는 **통과하지 않았다**. 다음 시험에서는 실제 저장 위치와 파일 존재·열림·문서 내용을 함께 기록해야 한다.

시험용 새 문서의 복구 기록이 브라우저에 남을 수 있다. 기존 사용자 기록을 지우는 일괄 사이트 데이터 삭제는 수행하지 않았다.

## 문서 분석 성능 참고 (#26)

`node scripts/benchmark-native-analysis.mjs`의 합성 문서: 37페이지, 33문단, 63,991 text units, 125회 응답. 정적 상태 어댑터에서 실행한 Node native WASM 측정이며 실제 호스트 왕복 시간이나 브라우저 peak memory가 아니다.

| 값 | 캐시 없음 | 캐시 있음 |
| --- | ---: | ---: |
| layout 읽기 | 4,625 | 37 |
| 경과 시간 | 2,375.62ms | 1,737.19ms |
| 최대 응답 크기 | 2,556B | 2,664B |
| 표본 중 최대 RSS | 159,473,664B | 89,473,024B |

단일 실행 수치로 대규모 문서 지연이나 동시 사용자 수를 보장하지 않는다. 실행 원본은 로컬 `test-results/native-analysis.json`이다.

## 이슈별 다음 판정

| 관련 이슈 | 이번 진전 | 남은 조건 |
| --- | --- | --- |
| #1, #17, #18 | Sites skills-only 제출 경로 정리. 인증은 직접 확인 당시 Identity in review | 동일 조직 인증·권한·제품 심사·게시 |
| #4, #5, #7, #16, #27 | 실제 검색·선택·수정·서식·Undo·거부 사례 | 실제 IME와 출력 보존, 표/복잡 문서 회귀 |
| #12, #13, #28 | 방문자 ZIP 고지 누락 수정, 추출 비교 회귀 검사 | 새 PC 최종 버전 설치·업데이트 |
| #14, #15, #19, #20 | 소개/시나리오 초안과 데이터 경계 갱신. 공개명 AnJuHyun·지원 이메일·GitHub 계정 확정 | 정책·약관 URL 확정 및 제출 신원 대조 |
| #21 | 로컬 런타임 audit와 upstream dev 경고 구분 | upstream 갱신, 네트워크·저장 경계 추가 증거 |
| #23, #24 | 현재 Sites와 브라우저 캐시 경로 명시 | 실제 cold/warm 전송량·호스팅 한도 측정 |
| #26 | Windows native WASM 성능 재측정 | 실제 호스트·대표 복잡 문서 측정 |
| #2, #3, #8, #9, #10 | Windows UI 및 복구 자동 검사 일부 | 실제 파일 열기/취소, 복구 UI, 출력 파일·독립 뷰어, corpus |

이슈 전체의 완료 조건이 충족되지 않은 항목은 닫지 않는다. #11 macOS는 변경하지 않는다.
