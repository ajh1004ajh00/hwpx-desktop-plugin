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

## 제출 게이트

- [ ] 최종 후보의 자동 검사 및 공개 CI 통과
- [ ] Windows 남은 수동 QA와 새 설치/업데이트 통과
- [ ] macOS 수동 QA 통과 (#11)
- [ ] PR #36 병합 및 main 정책/지원 URL 공개 확인
- [ ] 동일 조직의 개발자 인증 완료와 제출 권한 확인
- [ ] Sites 운영 조건, 지원 국가 및 포털의 최종 필수 항목 확인
- [ ] 사실과 일치하는 정책 동의 후 제출 (승인 후 게시는 별도 단계)

현재 상태를 “macOS만 남음” 또는 “제출 완료”로 표시하지 않는다. 자동 검사는 수동 입출력 QA와 개발자 인증을 대체하지 않는다.
