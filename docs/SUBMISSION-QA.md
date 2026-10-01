# 제출 전 QA 인수인계

후보: `0.1.0+codex.20260918031814`. 공개 개발자 AnJuHyun, 지원 ajhajh503@gmail.com.
제출 입력은 [SUBMISSION.md](SUBMISSION.md), 정책은 [PRIVACY.md](PRIVACY.md)와 [TERMS.md](TERMS.md)를 사용한다.

## 실행과 증거

1. `npm run setup`, `npm test`, `node scripts/verify-recovery.mjs`, `npm run verify:package`를 실행한다.
2. `npm audit --omit=dev --prefix desktop`와 `npm audit --prefix desktop/.runtime/rhwp/rhwp-studio`가 0건인지 확인한다.
3. `node scripts/package-sites-plugin.mjs <별도 경로>/hwpx-desktop-plugin`으로 ZIP을 생성한다. `test-results/sites-plugin.json`의 버전·SHA-256과 ZIP을 함께 보관한다.
4. 최종 ZIP을 설치한 새 대화에서 공개 Sites를 연다. OS, 앱 이름/버전, 설치 버전, Sites URL/배포 버전, 실행 날짜를 기록한다. 기존 설치에서 업데이트하는 경우도 확인한다.
5. [제출 자료](SUBMISSION.md)의 P1–P6/N1–N4를 실행하고 예상 결과와 실제 결과를 기록한다.
6. 실제 한국어 키보드로 조합 중 입력·커서 이동·삭제·확정·Undo를 시험한다. 자동 문자열 주입을 IME 통과로 기록하지 않는다.
7. 합성 HWP/HWPX를 열고 일부 본문과 표 셀을 수정한다. 파일 열기/저장 취소 후 원문이 유지되는지 확인한다.
8. 브라우저에서 HWP와 HWPX를 각각 저장하고 실제 파일 경로·해시를 기록한다. 독립 뷰어로 본문, 선택 부분 서식, 표, 그림, 페이지 구성을 비교한다. PDF도 실제 파일을 확보해 같은 항목을 비교한다. 메뉴 클릭만으로 통과 처리하지 않는다.
9. macOS에서도 4–8을 반복한다. WebMCP 미지원 환경은 편집 기능의 제한 안내가 정확한지 별도로 기록한다.

시험 중 개인 문서를 쓰지 않는다. 결과 행에는 `환경 | 사례 | 기대 결과 | 실제 결과 | 통과/실패 | 파일/스크린샷`을 남긴다. 미실행은 미실행으로 기록한다.

## 2026-09-18 현재 판정

- Windows 11 Pro 10.0.26200 / Codex 26.911.7940.0에서 기존 공개 Sites의 P1–P6/N1–N4를 관찰했다. 최종 후보 새 설치 결과는 별도다.
- 한글 2024 13.0.0.564에서 엔진이 생성한 F1 HWP/HWPX를 열어 `앞부분 보존 지원동기 뒷부분 보존`과 가운데 구절의 부분 서식을 확인했다. 브라우저 저장 결과를 확인한 시험은 아니다.
- Windows 브라우저 저장 파일 확보, PDF 비교, 실제 IME와 macOS QA는 미완료다. Windows UI 도구는 현재 URL을 판별하지 못해 안전 검사로 중단됐다.
- 로컬 전체 테스트는 한글에서 열어 둔 F1 HWPX 파일 잠금으로 1건 EBUSY가 발생했다. 깨끗한 CI의 전체 결과를 별도로 확인한다.

## 2026-10-01 재검증 (로컬 검토용, 미게시)

- 후보 `0.1.0+codex.20260918031814`, 릴리스 checkout `6a6680fd060736f44b373a7c0c6a2f0fec29a9b8`. 현재 원격 main `0d9c20ea75f34b3329816a0798a09397292e1262`와 Git tree `30240dfc311b6e9377e9259e2a7ae037a311e3c7`가 같다. 원본 checkout과 upstream 변경은 보존하고 별도 복사본에서 시험했다.
- 원본 후보: 전체 테스트 54/54, 복구 33/33, 빌드, 패키지 검사, 방문자 ZIP 11개 파일의 생성·추출·해시 비교 통과. desktop production 및 upstream 전체 audit 각각 0건. Node 24.21.0 / npm 11.19.0 / rhwp 0.8.6.
- 추가 upstream `tsc --noEmit` 검사에서 WASM 선언 파일 누락으로 TS7016 5건이 발생했다. 검토용 수정은 setup에서 고정 core 패키지의 `rhwp.d.ts`를 upstream `pkg`에 복사하는 한 줄이다. 선언 파일을 제거한 뒤 수정된 setup을 다시 실행하여 생성·타입 검사·전체 테스트 통과를 확인했다. 기존 CI에는 별도 타입 검사 단계가 없다.
- 한글 문단, 부분 서식, 2×2 표와 PNG 그림을 포함한 새 합성 문서에서 본문·셀을 수정하고 HWP→HWP, HWP→HWPX, HWPX→HWP, HWPX→HWPX 저장 후 파일을 다시 읽었다. 네 조합에서 엔진 기준 본문·표 내용·제목 서식·그림 속성·페이지 수가 유지됐다. 실제 브라우저 다운로드나 독립 뷰어의 시각 비교 결과가 아니다.
- PR #36은 병합됐고 [후보 Windows CI](https://github.com/ajh1004ajh00/hwpx-desktop-plugin/actions/runs/35303448592)는 success다. 공개 저장소 main의 PRIVACY/TERMS/SUPPORT 문서 존재를 재확인했다.
- 한글 2024 `13.0.0.564`는 설치돼 있다. 하지만 이 세션에는 지원되는 화면·마우스 실행기가 없고 Remote Desktop Commander도 오프라인이다. 브라우저 저장·PDF·실제 IME·독립 뷰어 재열기·최종 새 설치/업데이트는 미실행이다. 로컬 플러그인 캐시에서 확인한 버전은 이전 `0.1.0+codex.20260915023843`이며, 캐시 존재만으로 활성 설치 버전을 단정하지 않는다.
- 이 기록과 setup 수정은 main 기반 별도 로컬 브랜치 `fix/setup-wasm-declarations`에 보존했다. 기존 checkout·공개 main·배포·설치 상태는 변경하지 않았다. 자동 검사 원본 로그와 합성 파일은 검증 작업 폴더에 보관하며, 타입 검사 재실행 명령은 `node desktop/.runtime/rhwp/rhwp-studio/node_modules/typescript/bin/tsc -p desktop/.runtime/rhwp/rhwp-studio/tsconfig.json --noEmit`이다. 새 로컬 수정 커밋의 원격 CI는 실행하지 않았다.

## 제출 게이트

- [x] 최종 후보의 기존 자동 검사 및 공개 CI 통과 (추가 타입 검사 보완은 위 재검증 기록 참조)
- [ ] Windows 남은 수동 QA와 새 설치/업데이트 통과
- [ ] macOS 수동 QA 통과 (#11)
- [x] PR #36 병합 및 공개 main 정책/지원 문서 확인
- [ ] 동일 조직의 개발자 인증 완료와 제출 권한 확인
- [ ] Sites 운영 조건, 지원 국가 및 포털의 최종 필수 항목 확인
- [ ] 사실과 일치하는 정책 동의 후 제출 (승인 후 게시는 별도 단계)

현재 상태를 “macOS만 남음” 또는 “제출 완료”로 표시하지 않는다. 자동 검사는 수동 입출력 QA와 개발자 인증을 대체하지 않는다.
