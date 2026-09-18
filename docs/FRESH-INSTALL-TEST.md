# Sites 플러그인 새 설치 검증 — 2026-09-14

> 아래는 9월 14일 설치 기록이다. 9월 18일 방문자 ZIP에 THIRD_PARTY_NOTICES를 추가해 6개 파일이 되었으며, 실제 Sites 도구는 8개를 확인했다. 새 ZIP의 추출 검증과 새 PC 설치 시험은 구별한다. [최신 검증 결과와 미완료 항목](RELEASE-READINESS-2026-09-18.md)을 우선 참고한다.

버전: 0.1.0+codex.20260914055531. Sites 공개 버전 7.

- Sites URL을 기본 실행 경로로 변경했다. 사용자 설치에는 Node/Git/npm setup/localhost 서버가 필요 없다. 로컬 개발 저장소와 사용자 플러그인 묶음을 분리했다.
- 배포 묶음은 manifest, skill, README, LICENSE, 데이터 정책 5개 파일이다. scripts/package-sites-plugin.mjs로 ZIP을 생성하고 새로운 임시 폴더에 추출해 5개 SHA256을 비교했다.
- 공식 plugin validator와 UTF-8 모드 skill validator 통과. 기본 Windows 인코딩으로 skill validator가 실패한 것은 cp949 읽기 오류였고, UTF-8 재실행으로 해결했다.
- 기존 개인 마켓플레이스의 소스 junction은 이전 링크를 보관한 뒤 C:/Projects/hangulmate-release/hwpx-desktop-plugin으로 변경했다. 원래 개발 저장소는 수정/이동하지 않았다. codex plugin add hwpx-desktop-plugin@personal로 설치하고 설치 캐시 5개 파일의 SHA256 일치를 확인했다.
- 인증 헤더·쿠키 없는 HTTP GET으로 /, /studio/, /studio-tools.mjs, /studio/rhwp_bg.wasm 모두 200 확인. HTML/JS/WASM MIME이 맞고 로그인 페이지로 이동하지 않았다. 응답 Cache-Control은 public, max-age=0, must-revalidate였다. 이 값은 실제 브라우저 cold/warm 캐시 전송량 측정이 아니다.
- 공개 URL의 새 내장 브라우저 탭에서 WebMCP 7개 발견, 빈 문서에 합성 문구 입력 성공, 일치 검색 결과 확인, Undo 실행. 로컬 서버를 실행하지 않았다. 기존 사용자 탭과 복구 후보를 수정/삭제하지 않았다.

## 검증 범위와 남은 항목

별도 추출 폴더·실제 재설치·인증 없는 HTTP 접근·새 브라우저 탭 검증이다. 다른 PC, 다른 계정, 새 OS/브라우저 프로필에서 검증했다는 뜻은 아니다. 새 탭은 같은 브라우저 프로필의 복구 후보를 표시했으며 '나중에'로 건너뛰었다.

현재 대화에 이미 로드된 스킬은 재설치로 교체되지 않을 수 있다. 새 대화에서 한글메이트를 선택해 URL을 여는 경로를 확인해야 한다. 다른 계정/Windows, macOS, 실제 파일 선택·저장·재열기, IME와 독립 뷰어/PDF 시각 검증은 남겨둔다. 심사 승인본이라고 표시하지 않는다.

산출물 식별은 test-results/sites-plugin.json을 기준으로 한다. 동료는 최신 플러그인을 전달받아 설치하고 새 대화에서 사용한다. 이 로컬 업데이트가 원격 GitHub main이나 공개 디렉터리에 자동 게시된 것은 아니다.
