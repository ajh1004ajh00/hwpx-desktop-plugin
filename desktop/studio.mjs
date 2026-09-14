import { createStudio } from './node_modules/@rhwp/editor/index.js';
import { registerStudioTools } from './studio-tools.mjs';
const status = document.querySelector('#status');
const activity=document.querySelector('#activity'),list=document.querySelector('#activity-list'),activityStatus=document.querySelector('#activity-status');
const errors={DOCUMENT_CHANGED:'문서가 바뀌었습니다. 수정 대상을 다시 읽은 뒤 요청하세요.',CURSOR_CHANGED:'커서 또는 선택 영역이 바뀌었습니다. 대상을 다시 확인하세요.',
  IME_COMPOSING:'한글 입력을 마친 뒤 다시 요청하세요.',EDITOR_BUSY:'편집 작업을 처리 중입니다. 완료 후 다시 요청하세요.',
  SNAPSHOT_EXPIRED:'이전 선택 정보가 만료됐습니다. 대상을 다시 읽어주세요.',TARGET_EXPIRED:'검색 결과가 만료됐습니다. 다시 검색하세요.',
  COMMAND_REPLAY_MISMATCH:'이전 요청과 상태가 다릅니다. 같은 수정을 반복하지 말고 현재 내용을 확인하세요.'};
const showActivity=event=>{
  activityStatus.hidden=false;
  if(event.type==='error') {
    activityStatus.textContent=errors[event.code]??'요청을 완료하지 못했습니다. 현재 문서와 변경 내역을 확인한 뒤 다시 요청하세요.';return;
  }
  activity.hidden=false;activityStatus.textContent='AI 수정이 적용됐습니다. 최근 AI 변경에서 확인하고 문서를 저장하세요.';
  const item=document.createElement('li'),title=document.createElement('strong'),before=document.createElement('p'),after=document.createElement('p');
  const excerpt=text=>text.length>300?text.slice(0,300)+'… (일부 표시)':text;
  title.textContent=event.location;
  before.textContent='이전: '+(excerpt(event.before)||'(커서에 삽입)');after.textContent='변경: '+excerpt(event.after);
  item.append(title,before,after);list.prepend(item);while(list.children.length>20)list.lastElementChild.remove();
};
document.querySelector('#clear-activity').addEventListener('click',()=>{list.replaceChildren();activity.hidden=true;activityStatus.hidden=true;});
try {
  const editor = await createStudio(document.querySelector('#editor'), {
    studioUrl: new URL('/studio/', location.href).href, renderer: 'canvas2d',
    plugins: ['hwpctrl'], height: '100%', handshakeTimeoutMs: 60000, requestTimeoutMs: 60000,
  });
  status.textContent = '직접 편집 준비됨';
  let session, hidden=false, cleanup=Promise.resolve(), connection=Promise.resolve();
  const connect=()=>connection=connection.then(async()=>{
    if(hidden || session) return;
    try {
      await cleanup;
      session=await registerStudioTools(document.modelContext, editor,showActivity);
      if(hidden) { cleanup=session?.dispose()??Promise.resolve(); session=null; await cleanup; return; }
      status.textContent=session ? '직접 편집 · AI 연결됨' : '직접 편집 가능 · 이 브라우저는 WebMCP 미지원';
    } catch {
      status.textContent='직접 편집 가능 · AI 연결 실패. 문서를 저장한 뒤 다시 열어주세요.';
    }
  });
  addEventListener('pagehide',()=>{hidden=true;cleanup=session?.dispose()??Promise.resolve();session=null;cleanup.catch(()=>{});});
  addEventListener('pageshow',event=>{hidden=false;if(event.persisted) void connect();});
  await connect();
} catch { status.textContent = '편집기를 시작하지 못했습니다. 연결 상태를 확인한 뒤 다시 열어주세요.'; }
