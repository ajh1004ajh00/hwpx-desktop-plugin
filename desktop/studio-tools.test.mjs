import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTextCommand, exportWorkingCopy, registerStudioTools } from './studio-tools.mjs';
const snapshot = { state: { documentEpoch: 3, changeSeq: 5, documentSha256: 'a'.repeat(64), layoutPageCount:2 }, selection: { editable: true, target: { kind:'body_paragraph',section:0,paragraph:1,charOffset:0,length:2 } }, evidence: { text:'원문', textSha256:'b'.repeat(64), formatSha256:'c'.repeat(64), adjacentContextSha256:'d'.repeat(64) }, composing:false };
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
test('download uses live iframe filename and rejects changed document during export RPC', async () => {
  const state = { documentEpoch:4,changeSeq:2,documentSha256:'a'.repeat(64) };
  let current = state;
  const editor = {
    commands:{context:async () => ({desktopSnapshot:{state,fileName:'내부에서 연 파일.hwpx'}})},
    exportHwpx:async () => new Uint8Array([1,2,3]),
    getDocumentState:async () => current,
  };
  const saved = await exportWorkingCopy(editor);
  assert.equal(saved.fileName,'내부에서 연 파일_작업본.hwpx');
  assert.deepEqual(saved.bytes,new Uint8Array([1,2,3]));
  for (const change of [{documentEpoch:5},{changeSeq:3},{documentSha256:'b'.repeat(64)}]) {
    current = {...state,...change};
    await assert.rejects(exportWorkingCopy(editor), /변경/);
  }
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
  assert.equal(tools.size,5);
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
