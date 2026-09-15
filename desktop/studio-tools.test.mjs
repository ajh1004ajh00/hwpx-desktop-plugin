import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTextCommand, registerStudioTools } from './studio-tools.mjs';
test('local activity shows successful writes once and sanitized failures without affecting commands',async()=>{
  const tools=new Map(),events=[];
  const editor={commands:{context:async()=>({desktopSnapshot:{...snapshot,cursor:{token:'secret',selectedText:'전',position:{sectionIndex:0,paragraphIndex:1}}}}),execute:async()=>({})}};
  await registerStudioTools({registerTool:t=>tools.set(t.name,t)},editor,event=>{events.push(event);throw Error('UI failure');});
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  const args={snapshot_id:read.snapshot_id,command_id:'a1',text:'후'};
  for(let i=0;i<2;i++)assert.equal((await tools.get('hwpx_studio_insert_at_cursor').execute(args)).status,'applied');
  assert.equal(events.length,1);assert.equal(events[0].before,'전');assert.equal(events[0].after,'후');
  assert.doesNotMatch(JSON.stringify(events),/secret|documentSha256/);
  editor.commands.execute=async()=>{throw Object.assign(new Error('DOCUMENT_CHANGED: PRIVATE_DETAIL'),{code:'RPC_ERROR'});};
  await assert.rejects(tools.get('hwpx_studio_insert_at_cursor').execute({...args,command_id:'a2'}),/DOCUMENT_CHANGED/);
  assert.deepEqual(events.at(-1),{type:'error',code:'DOCUMENT_CHANGED'});
});
const snapshot = { state: { documentEpoch: 3, changeSeq: 5, documentSha256: 'a'.repeat(64), layoutPageCount:2 }, selection: { editable: true, target: { kind:'body_paragraph',section:0,paragraph:1,charOffset:0,length:2 } }, evidence: { text:'원문', textSha256:'b'.repeat(64), formatSha256:'c'.repeat(64), adjacentContextSha256:'d'.repeat(64) }, composing:false };
test('search and focus bind private document state and exclude internal results',async()=>{
  const tools=new Map(),calls=[];
  await registerStudioTools({registerTool:t=>tools.set(t.name,t)},{commands:{context:async()=>({desktopSnapshot:snapshot}),execute:async(id,args)=>{
    calls.push({id,args});return {candidates:[],truncated:false,scope:'body_and_root_cells',focused:true,state:'PRIVATE',debug:'PRIVATE'};
  }}});
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  const search=tools.get('hwpx_studio_find_targets');
  assert.equal(search.annotations.readOnlyHint,true);
  assert.deepEqual(await search.execute({snapshot_id:read.snapshot_id,query:'동기'}),{candidates:[],truncated:false,scope:'body_and_root_cells'});
  assert.deepEqual(await tools.get('hwpx_studio_focus_target').execute({snapshot_id:read.snapshot_id,target_id:'t1'}),{focused:true});
  assert.deepEqual(calls.map(c=>c.args.expectedState),[snapshot.state,snapshot.state]);
});
test('AI command binds the read snapshot rather than latest state', () => {
  const command = makeTextCommand(snapshot, '수정', 'c1');
  assert.equal(command.expectedChangeSeq, 5);
  assert.equal(command.expectedBeforeSha256, 'b'.repeat(64));
  assert.equal(command.expectedFormatSha256, 'c'.repeat(64));
  assert.deepEqual(command.target, {kind:'body_paragraph',section:0,paragraph:1,charOffset:0,length:2});
  assert.equal(command.replacement, '수정');
});
test('AI rejects composing, unsupported selection and multi-paragraph replacement', () => {
  assert.throws(() => makeTextCommand({...snapshot, composing:true}, '수정', 'c2'), /입력/);
  assert.throws(() => makeTextCommand({...snapshot, selection:{editable:false,target:null}}, '수정', 'c3'), /본문/);
  assert.throws(() => makeTextCommand(snapshot, '두\n문단', 'c4'));
});
test('Studio registers paged read-only table and document analysis bound to a snapshot',async()=>{
  const tools=new Map(),calls=[];
  const position={sectionIndex:0,paragraphIndex:0,charOffset:0,parentParaIndex:4,controlIndex:2,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:2,cellIndex:0,cellParaIndex:0}]};
  const desktopSnapshot={state:snapshot.state,cursor:{position,token:'iframe-token'}};
  const editor={commands:{
    context:async()=>({desktopSnapshot}),
    execute:async(id,params)=>{calls.push({id,params});return {ok:true};},
  }};
  await registerStudioTools({registerTool:tool=>tools.set(tool.name,tool)},editor);
  assert.equal(tools.size,8);
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  const tableTool=tools.get('hwpx_studio_analyze_current_table');
  const documentTool=tools.get('hwpx_studio_analyze_document');
  assert.equal(tableTool.annotations.readOnlyHint,true);
  assert.equal(documentTool.annotations.readOnlyHint,true);
  await tableTool.execute({snapshot_id:read.snapshot_id,offset:0,limit:20});
  await documentTool.execute({snapshot_id:read.snapshot_id,offset:20,limit:20});
  assert.deepEqual(calls,[
    {id:'desktop:analyze-current-table',params:{expectedState:snapshot.state,position,offset:0,limit:20}},
    {id:'desktop:analyze-document',params:{expectedState:snapshot.state,offset:20,limit:20}},
  ]);
});

test('selection response excludes filename, surrounding text and internal evidence; writes keep the private fence', async () => {
  const tools=new Map();
  const privateSnapshot={...snapshot,fileName:'PRIVATE_FILE',cursor:{token:'PRIVATE_TOKEN',editable:true,collapsed:false,
    selectedText:'선택 내용',paragraphText:'PRIVATE_BEFORE 선택 내용 PRIVATE_AFTER',beforeText:'PRIVATE_BEFORE',afterText:'PRIVATE_AFTER'}};
  const calls=[];
  const editor={commands:{context:async()=>({desktopSnapshot:privateSnapshot}),execute:async(name,args)=>{
    calls.push(args);return {command_id:args.commandId,inserted_text:'PRIVATE_RECEIPT',cursor:privateSnapshot.cursor};
  }},applyTextCommand:async command=>{calls.push(command);return {commandId:command.commandId,private:'PRIVATE_RECEIPT'};}};
  await registerStudioTools({registerTool:tool=>tools.set(tool.name,tool)},editor);
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  assert.equal(read.cursor.selectedText,'선택 내용');
  assert.doesNotMatch(JSON.stringify(read),/PRIVATE_|textSha256|documentSha256|evidence/);
  for(const [name,args] of [['insert_at_cursor',{text:'수정'}],['replace_paragraph',{replacement:'수정'}]]) {
    const params={snapshot_id:read.snapshot_id,command_id:'c1',...args};
    const first=await tools.get(`hwpx_studio_${name}`).execute(params);
    assert.deepEqual(first,{command_id:'c1',status:'applied',saved:false});
    assert.deepEqual(await tools.get(`hwpx_studio_${name}`).execute(params),first);
  }
  assert.equal(calls[0].token,'PRIVATE_TOKEN');
  assert.equal(calls[2].expectedDocumentSha256,'a'.repeat(64));
});

test('character formatting uses the selected snapshot and returns a minimal receipt', async () => {
  const tools=new Map(),calls=[],events=[];
  const privateSnapshot={...snapshot,cursor:{token:'PRIVATE_TOKEN',editable:true,collapsed:false,
    selectedText:'선택 내용',position:{sectionIndex:0,paragraphIndex:1,charOffset:0}}};
  const editor={commands:{context:async()=>({desktopSnapshot:privateSnapshot}),execute:async(name,args)=>{
    calls.push({name,args});return {command_id:args.commandId,status:'applied'};
  }}};
  await registerStudioTools({registerTool:tool=>tools.set(tool.name,tool)},editor,event=>events.push(event));
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  const format=tools.get('hwpx_studio_apply_char_format');
  assert.ok(format,'the native character-format tool must be registered');
  const result=await format.execute({snapshot_id:read.snapshot_id,command_id:'fmt-1',
    font_family:'맑은 고딕',font_size_pt:16,bold:true,italic:false,underline:true,strikethrough:false,text_color:'#1a2b3c'});
  assert.deepEqual(result,{command_id:'fmt-1',status:'applied',saved:false});
  assert.deepEqual(calls,[{name:'desktop:apply-char-format',args:{token:'PRIVATE_TOKEN',commandId:'fmt-1',props:{
    fontFamily:'맑은 고딕',fontSize:1600,bold:true,italic:false,underline:true,strikethrough:false,textColor:'#1A2B3C',
  }}}]);
  assert.doesNotMatch(JSON.stringify(result),/선택 내용|PRIVATE/);
  assert.deepEqual(events,[{type:'applied',location:'구역 1 · 문단 2',before:'선택 내용',after:'선택 내용',
    formatSummary:'글꼴 맑은 고딕 · 16pt · 굵게 · 기울임 해제 · 밑줄 · 취소선 해제 · 글자색 #1A2B3C'}]);
});

test('tool errors preserve known recovery codes without echoing document text', async () => {
  const tools=new Map();
  const editor={commands:{context:async()=>{throw new Error('DOCUMENT_CHANGED: PRIVATE_ERROR');}}};
  await registerStudioTools({registerTool:tool=>tools.set(tool.name,tool)},editor);
  await assert.rejects(tools.get('hwpx_studio_read_selection').execute({}),error=>
    error.message==='DOCUMENT_CHANGED' && !error.cause);
  editor.commands.context=async()=>{throw new Error('PRIVATE_UNKNOWN');};
  await assert.rejects(tools.get('hwpx_studio_read_selection').execute({}),/^Error: TOOL_FAILED$/);
});

test('selection read exposes only a safe cursor recovery reason',async()=>{
  const tools=new Map();
  const privateSnapshot={...snapshot,cursor:{editable:false,collapsed:false,selectedText:'',reason:'OFFSET_OUT_OF_RANGE: PRIVATE_DETAIL'}};
  await registerStudioTools({registerTool:tool=>tools.set(tool.name,tool)},{commands:{context:async()=>({desktopSnapshot:privateSnapshot})}});
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  assert.deepEqual(read.cursor,{editable:false,collapsed:false,selectedText:'',reason:'OFFSET_OUT_OF_RANGE'});
  assert.doesNotMatch(JSON.stringify(read),/PRIVATE_DETAIL/);
});

for (const failAt of [1,4,8]) test(`registration failure ${failAt} aborts tools and allows a clean retry`, async () => {
  const tools=new Map();let count=0;
  const host={registerTool(tool,{signal}={}) {
    if(++count===failAt) throw new Error('registration failed');
    if(tools.has(tool.name)) throw new Error('duplicate');
    tools.set(tool.name,tool);signal?.addEventListener('abort',()=>tools.delete(tool.name),{once:true});
  }};
  await assert.rejects(registerStudioTools(host,{}),/registration failed/);
  assert.equal(tools.size,0);
  const session=await registerStudioTools(host,{});
  assert.equal(tools.size,8);
  await session.dispose();assert.equal(tools.size,0);
});

test('failed cleanup preserves registration cause, attempts every removal and disables retained callbacks', async () => {
  const tools=new Map(),removed=[];let count=0,reads=0;
  const host={registerTool(tool){if(++count===4)throw new Error('original failure');tools.set(tool.name,tool);},
    unregisterTool(name){removed.push(name);throw new Error('cleanup failure');}};
  await assert.rejects(registerStudioTools(host,{commands:{context:async()=>{reads++;}}}),error=>
    error.cause?.message==='original failure');
  assert.equal(removed.length,3);
  await assert.rejects(tools.get('hwpx_studio_read_selection').execute({}),/TOOLS_INACTIVE/);
  assert.equal(reads,0);
});

test('host ignoring cleanup cannot run disposed callbacks and duplicate registration cannot replace a live session', async () => {
  const tools=new Map();let reads=0;
  const host={registerTool(tool){if(tools.has(tool.name))throw new Error('duplicate');tools.set(tool.name,tool);}};
  const session=await registerStudioTools(host,{commands:{context:async()=>{reads++;return {desktopSnapshot:snapshot};}}});
  await assert.rejects(registerStudioTools(host,{}),/TOOLS_ALREADY_REGISTERED/);
  await tools.get('hwpx_studio_read_selection').execute({});assert.equal(reads,1);
  await session.dispose();await session.dispose();
  await assert.rejects(tools.get('hwpx_studio_read_selection').execute({}),/TOOLS_INACTIVE/);
  assert.equal(reads,1);
});

test('legacy unregister removes all tools and a pending registration cannot execute a partial tool set',async()=>{
  const tools=new Map();let resume;
  const gate=new Promise(resolve=>{resume=resolve;});
  const host={async registerTool(tool){tools.set(tool.name,tool);if(tools.size===1)await gate;},
    unregisterTool(name){tools.delete(name);}};
  const pending=registerStudioTools(host,{});
  await assert.rejects(tools.get('hwpx_studio_read_selection').execute({}),/TOOLS_INACTIVE/);
  resume();const session=await pending;
  await session.dispose();assert.equal(tools.size,0);
  const next=await registerStudioTools(host,{});await next.dispose();assert.equal(tools.size,0);
});

test('both write failures and expired snapshots return no raw error payload, analysis omits private state',async()=>{
  const tools=new Map();
  const editor={commands:{context:async()=>({desktopSnapshot:{...snapshot,cursor:{token:'private'}}}),
    execute:async name=>{
      if(name==='desktop:analyze-document')return {state:{secret:'PRIVATE_STATE'},items:[{text:'requested'}],nextOffset:null,debug:'PRIVATE_DEBUG'};
      throw new Error('CURSOR_CHANGED: PRIVATE_ERROR');
    }},applyTextCommand:async()=>{throw Object.assign(new Error('PRIVATE_ERROR'),{code:'DOCUMENT_CHANGED'});}};
  await registerStudioTools({registerTool:tool=>tools.set(tool.name,tool)},editor);
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  const args={snapshot_id:read.snapshot_id,command_id:'c1',text:'수정',replacement:'수정'};
  await assert.rejects(tools.get('hwpx_studio_insert_at_cursor').execute(args),/^Error: CURSOR_CHANGED$/);
  await assert.rejects(tools.get('hwpx_studio_replace_paragraph').execute(args),/^Error: DOCUMENT_CHANGED$/);
  assert.deepEqual(await tools.get('hwpx_studio_analyze_document').execute({snapshot_id:read.snapshot_id,offset:0,limit:1}),
    {items:[{text:'requested'}],nextOffset:null});
  for(let i=0;i<8;i++)await tools.get('hwpx_studio_read_selection').execute({});
  await assert.rejects(tools.get('hwpx_studio_insert_at_cursor').execute(args),/^Error: SNAPSHOT_EXPIRED$/);
});

test('analysis continuation stays bound to the private snapshot and exposes only page positions',async()=>{
  const tools=new Map(),calls=[];
  const desktopSnapshot={...snapshot,cursor:{position:{sectionIndex:0,parentParaIndex:0,controlIndex:0,cellPath:[{}]}}};
  await registerStudioTools({registerTool:t=>tools.set(t.name,t)}, {commands:{
    context:async()=>({desktopSnapshot}),execute:async(name,args)=>{calls.push(args);return {
      state:{secret:'PRIVATE_STATE'},items:[],next:{offset:0,paragraphOffset:0,textOffset:512},truncated:true,
    };},
  }});
  const read=await tools.get('hwpx_studio_read_selection').execute({});
  for(const name of ['hwpx_studio_analyze_document','hwpx_studio_analyze_current_table']) {
    const tool=tools.get(name);
    const response=await tool.execute({snapshot_id:read.snapshot_id,offset:0,limit:1,paragraphOffset:2,textOffset:512});
    assert.deepEqual(response.next,{offset:0,paragraphOffset:0,textOffset:512});
    assert.equal(response.truncated,true);
    assert.doesNotMatch(JSON.stringify(response),/PRIVATE_STATE/);
    assert.equal(calls.at(-1).textOffset,512);
    assert.equal(calls.at(-1).paragraphOffset,2);
    assert.deepEqual(calls.at(-1).expectedState,snapshot.state);
    assert.ok(!tool.inputSchema.required.includes('textOffset'));
  }
});
