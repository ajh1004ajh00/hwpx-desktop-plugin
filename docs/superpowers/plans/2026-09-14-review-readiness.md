# 한글메이트 심사 준비 구현 계획

**Goal:** 이슈 #19의 사용자 승인 정책에 따라 #20 응답 최소화, #25 등록 생명주기를 구현하고 #13 자동 검사와 #1·#16 사람 검증 자료를 준비한다.

**Architecture:** 기존 로컬 Studio와 내부 문서 상태/Undo를 유지한다. WebMCP 경계에서만 응답을 허용 목록으로 투영하며, 등록 실패/종료 시 콜백을 비활성화한다. 새 원격 서비스는 만들지 않는다.

**Tech Stack:** Node.js 24, node:test, 기존 rhwp 0.8.6.

**Spec:** GitHub #19, #20, #25, #13, #16 및 2026-09-14 사용자 지시. 필요한 문서 내용의 ChatGPT 제공은 사용자가 승인했다.

## 제약

- 사람의 신원·권한·정책 공개·실사용 검증은 대행하지 않는다. macOS 실행은 팀원에게 인계한다.
- main은 유지하고 격리 worktree에서 구현한다. 배포/제출/커밋/PR은 수행하지 않는다.
- 전체 로드맵 완료와 이번 자동 검증 결과를 구분한다. #4·#6은 최종 구현 시 #19·#20·#7 기준을 적용한다.

## 실행 순서

- [x] `desktop/studio-tools.test.mjs`: 선택 밖 합성 표식, 쓰기 응답/오류, 등록 1/3/5번째 실패, 해제 API 부재/실패, 종료·재등록 테스트를 추가하고 실패를 확인한다.
- [x] `desktop/studio-tools.mjs`: 내부 snapshots를 유지하고 선택 텍스트와 기능 여부만 반환한다. 쓰기 결과는 명령 ID/성공 여부만 반환하고 예상 오류 코드를 허용 목록으로 제한한다. 등록 전체 완료 전과 dispose 후 실행을 거부한다. AbortSignal을 제공하고 기존 unregisterTool도 지원한다. 정리 오류는 원인을 덮지 않는다.
- [x] `desktop/studio.mjs`: pagehide 정리와 BFCache pageshow 복원을 연결한다. 정리 기능을 무시하는 host의 콜백도 비활성화한다.
- [x] `scripts/verify-package.mjs` 및 `.github/workflows/verify.yml`: 참조 자산 누락과 루트 manifest 경로를 실제 파일로 확인하고 Windows 자동 테스트/빌드를 구성한다. macOS는 실행하지 않는다.
- [x] `docs/REVIEW-HANDOFF.md`, `docs/DATA-POLICY.md`: 사용자 승인 정책, 수신자/보관 범위, 정상 5개·부정 3개 이상 재현 절차, 사람이 기록할 환경·증거·제출 항목을 작성한다.
- [x] `npm test`, `npm run build`, 패키지 검사, `git diff --check`를 실행하고 정확한 결과 및 남은 선행 조건을 기록한다.

후속 #2·#3·#4·#6·#7·#8·#9·#12·#21·#24·#26 작업은 미완료 여부를 명시하고, 사람 확인 없이 지원 환경/저장 품질/심사 준비 완료를 선언하지 않는다.
