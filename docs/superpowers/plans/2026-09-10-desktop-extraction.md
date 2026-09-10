# Desktop Extraction Implementation Plan

**Goal:** rhwp live 편집만 독립 실행 가능한 비공개 GitHub 레포로 게시.
**Architecture:** 기존 Studio shell/bridge를 보존하고 웹 실험 경로 의존성 제거.
**Tech Stack:** Node 24+, @rhwp/core 및 @rhwp/editor 0.8.6, pinned Studio.
**Spec:** ../specs/2026-09-10-desktop-extraction-design.md

## Global Constraints

- 대상: ajh1004ajh00/hwpx-desktop-plugin, 비공개.
- 기존 레포와 실행 중인 문서 보존.
- 사용자 문서 및 빌드 산출물 제외.
- XML/SVG 분석 서버 및 Web ChatGPT 연결 제외.

## Task 1: 독립 실행 경로

- [x] desktop의 Studio/커서/분석 코드와 기존 관련 테스트를 복사한다.
- [x] 서버 테스트에서 /studio/rhwp_bg.wasm 접근 성공과 /experiments 경로 거부를 검사한다.
- [x] desktop/package.json에 core/editor 0.8.6과 lockfile을 둔다.
- [x] setup의 core 경로를 desktop/node_modules로 바꾸고 서버에서 옛 실험용 routes를 제거한다.
- [x] `npm run setup` 및 `npm test`를 실행한다.

## Task 2: 플러그인 및 검토 자료

- [x] .codex-plugin/plugin.json과 skills/hwpx-desktop/SKILL.md를 작성한다.
- [x] 실제 다섯 개 Studio 도구 및 파일 선택/저장 제한을 안내한다.
- [x] README.md, docs/REVIEW.md에 실행 방법, 구조, 지원 한계 및 출처를 기록한다.
- [x] plugin-creator validate_plugin.py 및 skill-creator quick_validate.py를 실행한다.
- [x] 별도 포트의 Built-in Browser에서 실제 UI 및 도구를 확인한다.

## Task 3: 게시

- [x] `git diff --check`와 staged 파일 목록으로 문서/비밀정보/생성물을 제외했는지 확인한다.
- [ ] `git commit -m "feat: rhwp Desktop 전용 플러그인 분리"`를 실행한다.
- [ ] `gh repo create ajh1004ajh00/hwpx-desktop-plugin --private --source . --remote origin --push`를 실행한다.
- [ ] `gh repo view --json url,visibility` 및 원격 HEAD와 로컬 HEAD 일치를 확인한다.
