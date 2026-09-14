# 한글메이트 시작하기

1. 전달받은 최신 한글메이트 플러그인을 설치하거나 업데이트한다.
2. 새 대화에서 한글메이트를 선택하고 “한글메이트 편집기를 열어줘”라고 요청한다.
3. 앱 내장 브라우저에서 https://hangulmate-webmcp-poc.gptisgod.chatgpt.site/ 를 연다.
4. 파일 > 열기로 HWP/HWPX를 선택하거나 새 문서를 작성한다.
5. 수정할 텍스트를 선택하고 AI에 요청한다. 최근 AI 변경에서 결과를 확인한다.
6. 파일 메뉴에서 저장한 뒤 다시 열어 확인한다.

Node.js·Git·npm setup·localhost 서버는 필요 없다. 일반 브라우저에서도 직접 편집할 수 있지만 AI 편집은 WebMCP를 지원하는 앱/내장 브라우저가 필요하다. “직접 편집 · AI 연결됨”과 실제 선택 읽기 성공을 확인한다.

공개 URL은 편집기를 공유한다. 서로 다른 방문자가 같은 문서를 실시간 공유하는 기능은 없다. 파일은 각자의 브라우저에서 처리하고 자동 복구본이 남을 수 있다. AI 요청에 필요한 내용은 ChatGPT에 제공된다.

파일 선택 자동화가 안 되면 파일 > 열기에서 직접 선택한다. 사이트 접근 오류는 새로고침해 확인하되, 이미 문서 작업 중이면 먼저 저장한다. 새 플러그인 안내는 새 대화에서 확인한다. 과거 대화의 로컬 서버 실행 안내를 그대로 따르지 않는다.

현재는 시험 배포이며 심사 승인본이 아니다. 실제 IME·PDF/독립 뷰어 배치·macOS는 사람이 검증한다.

## GitHub에서 업데이트하는 동료

이미 이 저장소 checkout을 소스로 등록해 설치한 경우, 그 폴더에서 다음 순서로 갱신한다.

```sh
git switch main
git pull --ff-only
codex plugin list --json
```

목록에서 `hwpx-desktop-plugin`의 `source.path`가 방금 pull한 폴더인지, `marketplaceName`이 무엇인지 확인한다. 그 이름으로 `codex plugin add hwpx-desktop-plugin@마켓플레이스이름`을 실행하고 새 대화를 시작한다. 예를 들어 기존 `personal` 마켓플레이스가 해당 checkout을 가리키면 `codex plugin add hwpx-desktop-plugin@personal`이다. pull만으로 설치 캐시는 바뀌지 않는다.

소스가 별도 Sites 배포 폴더라면 pull 후 해당 폴더를 먼저 갱신한다.

```sh
node scripts/package-sites-plugin.mjs "설치 소스로 등록된 별도 폴더/hwpx-desktop-plugin"
```

이 명령의 Node.js는 Git 저장소에서 묶음을 갱신하는 개발자용이다. 완성된 Sites 플러그인과 URL을 이용하는 방문자는 Node.js나 로컬 서버가 필요 없다. 폴더를 모르면 임의 경로를 덮어쓰지 말고 위 목록의 `source.path`를 먼저 확인한다.

처음 설치하는 동료는 기존 사용자의 `personal` 등록이 자기 PC에도 있다고 가정하지 않는다. 전달받은 플러그인을 자기 앱에서 설치한 뒤 위 경로와 이름을 확인한다. GitHub clone 자체는 플러그인 설치가 아니다.
