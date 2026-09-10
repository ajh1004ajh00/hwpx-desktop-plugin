# 기여 안내

## 언어

설명은 한국어로 작성하고 코드 식별자, 명령어, 경로, 오류 메시지, 제품 이름은 원문을 유지합니다.

## 커밋과 브랜치

- 커밋: `<type>(<optional-scope>): <한국어 요약>`
- 타입: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `chore`, `revert`
- 브랜치: `<type>/<issue-number>-<short-kebab>`; Issue가 없으면 번호를 생략할 수 있습니다.
- 커밋 하나에는 하나의 되돌릴 수 있는 논리적 변경을 담습니다.

## Issue와 Pull Request

- Issue: 배경, 목표, 완료 조건, 작업 목록, 참고사항
- Pull Request: 변경 이유, 주요 변경, 검증 결과, 영향과 위험, 연결 Issue
- 실행하지 않은 테스트를 성공으로 기록하지 않습니다.

## 제품 로드맵

- 임시 제품명: 한글메이트(HangulMate). 저장소·플러그인 식별자는 `hwpx-desktop-plugin`을 유지합니다.
- 기본 Project: [한글메이트 — 공동 편집과 v1.0.0 출시](https://github.com/users/ajh1004ajh00/projects/2), 소유자 `ajh1004ajh00`, 번호 2.
- 각 구현·검증 이슈를 Project와 적합한 저장소 마일스톤에 직접 연결합니다.
- 마일스톤: v0.2.0 기본 흐름, v0.3.0 Windows/macOS 안정성, v0.9.0 심사 준비, v1.0.0 승인·출시.
- 상태는 `Status` 하나로 `할 일 / 진행 중 / 검토 / 완료`를 사용합니다.
- 우선순위는 `P0 긴급 / P1 높음 / P2 보통 / P3 낮음`, 유형은 `버그 / 기능 / 작업 / 문서`입니다.
- 기본값은 할 일·P2 보통이며, 출시를 막는 필수 검증·기능은 P1 높음으로 분류합니다.
- 유형 라벨은 bug, enhancement, documentation, testing, research, chore 중 목적에 맞게 하나 지정합니다.
- 영역은 area:workflow, area:editing, area:export, area:release를 사용하고, 환경별 시험은 platform:windows 또는 platform:macos로 구분합니다.
- Dependencies에는 필요한 선행 결과와 실제 이슈 링크를 기록합니다. 참고 관계는 Related로 구분합니다.
- Windows/macOS는 동일한 시험 문서와 기대 결과를 사용하며, 각 환경의 버전과 관찰 결과를 남깁니다.
- 담당자와 기한은 실제 참여자·일정이 확정된 경우 지정합니다.

## 보안

토큰, 비밀번호, 쿠키, `.env` 값, 개인키, 고객 데이터를 커밋, Issue, Pull Request에 포함하지 않습니다.
