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

## 보안

토큰, 비밀번호, 쿠키, `.env` 값, 개인키, 고객 데이터를 커밋, Issue, Pull Request에 포함하지 않습니다.
