import { access } from 'node:fs/promises';
import { startDesktopServer } from '../desktop/server.mjs';

if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Node.js 24 이상이 필요합니다.'); process.exit(1);
}
const port = Number(process.env.HWPX_DESKTOP_PORT ?? 4175);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('HWPX_DESKTOP_PORT는 1024–65535여야 합니다.'); process.exit(1);
}
try {
  await access(new URL('../desktop/.runtime/studio/index.html', import.meta.url));
  await access(new URL('../desktop/node_modules/@rhwp/editor/index.js', import.meta.url));
  await access(new URL('../desktop/.runtime/studio/rhwp_bg.wasm', import.meta.url));
} catch {
  console.error('플러그인 루트에서 npm run setup을 먼저 실행하세요.');
  process.exit(1);
}
const server = startDesktopServer(port);
server.on('listening', () => {
  console.log(`HWPX Desktop: http://127.0.0.1:${port}/desktop/`);
  console.log('Desktop 내장 브라우저에서 위 주소를 열고 HWPX 파일을 선택하세요. 원격 MCP 연결은 필요하지 않습니다.');
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2000) });
      const status = await response.json();
      if (status.app === 'hwpx-desktop-plugin' && status.protocol === 1) {
        console.log(`HWPX Desktop이 이미 실행 중입니다: http://127.0.0.1:${port}/desktop/`); return;
      }
    } catch { /* A different listener is not a Desktop server. */ }
  }
  console.error(`Desktop 서버 시작 실패: ${error.code ?? error.message}. HWPX_DESKTOP_PORT로 다른 포트를 지정할 수 있습니다.`);
  process.exitCode = 1;
});
