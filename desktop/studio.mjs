import { createStudio } from './node_modules/@rhwp/editor/index.js';
import { registerStudioTools, exportWorkingCopy } from './studio-tools.mjs';
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const open = document.querySelector('#open');
const saveLink = document.querySelector('#save-link');
let downloadUrl;
function clearDownload() {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined; saveLink.hidden = true; saveLink.removeAttribute('href');
}
let busy = false;
function setBusy(value) { busy = value; open.disabled = value; download.disabled = value; }
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
  download.disabled = false;
  open.addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (busy) return;
    setBusy(true);
    clearDownload();
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error('최대 32 MiB 파일을 열 수 있습니다.');
      await editor.loadFile(new Uint8Array(await file.arrayBuffer()), file.name);
      await editor.commands.execute('view:zoom-fit-width');
      status.textContent = file.name;
    } catch (error) { status.textContent = error.message; }
    finally { event.target.value = ''; setBusy(false); }
  });
  download.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    clearDownload();
    try {
      const { bytes, fileName } = await exportWorkingCopy(editor);
      downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/hwp+zip' }));
      saveLink.href = downloadUrl; saveLink.download = fileName; saveLink.hidden = false;
      status.textContent = '저장 준비됨 · 링크는 준비 시점의 작업본입니다';
    } catch (error) { status.textContent = error.message; }
    finally { setBusy(false); }
  });
} catch (error) { status.textContent = '편집기 시작 실패: ' + error.message; }
