import { createStudio } from './node_modules/@rhwp/editor/index.js';
import { registerStudioTools } from './studio-tools.mjs';
const status = document.querySelector('#status');
try {
  const editor = await createStudio(document.querySelector('#editor'), {
    studioUrl: new URL('/studio/', location.href).href, renderer: 'canvas2d',
    plugins: ['hwpctrl'], height: '100%', handshakeTimeoutMs: 60000, requestTimeoutMs: 60000,
  });
  status.textContent = '직접 편집 준비됨';
  await editor.commands.execute('view:zoom-fit-width');
  try {
    const connected = await registerStudioTools(document.modelContext, editor);
    status.textContent = connected ? '직접 편집 · AI 연결됨' : '직접 편집 가능 · 이 브라우저는 WebMCP 미지원';
  } catch (error) { status.textContent = '직접 편집 가능 · AI 연결 실패: ' + error.message; }
} catch (error) { status.textContent = '편집기 시작 실패: ' + error.message; }
