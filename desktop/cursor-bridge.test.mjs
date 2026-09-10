import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePosition, assertCursorFence, validateCursorText, createCursorBridge, describeCursor } from './cursor-bridge.mjs';
const position = {sectionIndex:0,paragraphIndex:2,charOffset:3};
const state = {documentEpoch:2,changeSeq:7,documentSha256:'a'.repeat(64)};
const expected = {state,cursor:{position,start:position,end:position,editable:true,paragraphText:'가나다라마'},composing:false};
test('exact positions retain cell ancestry but ignore display-only caret geometry', () => {
  assert.deepEqual(normalizePosition({...position,cursorRect:{x:100,y:200}}),position);
  const cell = {...position,parentParaIndex:8,controlIndex:1,cellIndex:4,cellParaIndex:2};
  assert.deepEqual(normalizePosition(cell).cellPath,[{controlIndex:1,cellIndex:4,cellParaIndex:2}]);
  assert.throws(() => normalizePosition({...position,charOffset:-1}));
});
test('cursor fence rejects moved caret, changed selection, changed text/document and composition', () => {
  assert.doesNotThrow(() => assertCursorFence(expected,structuredClone(expected)));
  const changes = [
    x => x.cursor.position.charOffset++, x => x.cursor.start.charOffset++,
    x => x.cursor.end.charOffset++, x => x.cursor.paragraphText+='바',
    x => x.state.changeSeq++, x => x.state.documentEpoch++,
    x => x.state.documentSha256='b'.repeat(64), x => x.composing=true,
    x => x.cursor.editable=false,
  ];
  for (const change of changes) {
    const current=structuredClone(expected); change(current);
    assert.throws(() => assertCursorFence(expected,current));
  }
});
test('one-line cursor text validates bounds and rejects unsupported scalar offsets', () => {
  assert.equal(validateCursorText('한글 입력'),'한글 입력');
  for (const text of ['', '여러\n문단', '\t', 'x'.repeat(4001), '😀', 3]) assert.throws(() => validateCursorText(text));
});
test('exclusive lock failures do not permanently busy the editor', async () => {
  let broken=true;
  const bridge=createCursorBridge({lock:()=>{if(broken) throw Error('lock failed');return ()=>{throw Error('release failed');};}});
  await assert.rejects(bridge.exclusive(()=>{}), /lock failed/);
  assert.doesNotThrow(bridge.assertIdle);
  broken=false;
  await assert.rejects(bridge.exclusive(()=>{}), /release failed/);
  assert.doesNotThrow(bridge.assertIdle);
});

function harness() {
  const model={text:'가나다라',offset:2,seq:0,locked:false,render:async()=>{}};
  const wasm={pageCount:1,getParagraphLength:()=>model.text.length,getTextRange:()=>model.text,
    getControlTextPositions:()=>[],getFieldInfoAt:()=>({inField:false}),fileName:'trial.hwpx'};
  const raw=()=>({position:{sectionIndex:0,paragraphIndex:1,charOffset:model.offset}});
  const input={getDesktopCursorContext:raw,executeDocumentAgentOperation:async(desc,render)=>{
    // Contract adapter only; actual native edit/undo is exercised in the browser.
    const saved={text:model.text,offset:model.offset};
    try { const next=desc.operation(wasm); await render(); model.offset=next.charOffset; model.seq++; }
    catch(e){Object.assign(model,saved);throw e;}
  }};
  const bridge=createCursorBridge({
    getEnvironment:()=>({wasm,input,agent:{getDocumentState:()=>({documentEpoch:1,changeSeq:model.seq,documentSha256:model.text})},render:()=>model.render(),composing:false}),
    mutate:(_wasm,start,end,text)=>{model.text=model.text.slice(0,start.charOffset)+text+model.text.slice(end.charOffset);return {...start,charOffset:start.charOffset+text.length};},
    lock:()=>{model.locked=true;return ()=>{model.locked=false;};},
  });
  return {model,wasm,raw,bridge};
}
test('native bridge contract inserts once, rejects replay changes and stale cursor', async()=>{
  const {bridge,model}=harness();
  const snapshot=bridge.read();
  assert.equal(snapshot.state.layoutPageCount,1);
  const command={token:snapshot.cursor.token,commandId:'one',text:'AI'};
  const receipt=await bridge.apply(command);
  assert.equal(model.text,'가나AI다라'); assert.equal(model.seq,1); assert.equal(model.locked,false);
  assert.deepEqual(await bridge.apply(command),receipt); assert.equal(model.seq,1);
  await assert.rejects(bridge.apply({...command,text:'다른'}),/REPLAY/);
  const next=bridge.read(); model.offset--;
  await assert.rejects(bridge.apply({...command,token:next.cursor.token,commandId:'two'}),/CURSOR_CHANGED/);
  assert.equal(model.text,'가나AI다라');
});
test('render wait excludes concurrent commands and failure releases lock without receipt', async()=>{
  const {bridge,model}=harness();
  let rejectRender;
  model.render=()=>new Promise((_,reject)=>{rejectRender=reject;});
  const command={token:bridge.read().cursor.token,commandId:'render',text:'AI'};
  const pending=bridge.apply(command);
  assert.equal(model.locked,true);
  assert.throws(()=>bridge.read(),/EDITOR_BUSY/);
  await assert.rejects(bridge.apply(command),/EDITOR_BUSY/);
  rejectRender(Error('render failed')); await assert.rejects(pending,/render failed/);
  assert.equal(model.text,'가나다라'); assert.equal(model.locked,false);
  model.render=async()=>{};
  await bridge.apply(command); assert.equal(model.text,'가나AI다라');
});
test('capabilities reject fields, special modes and cross-paragraph ranges',()=>{
  const {wasm,raw}=harness();
  assert.equal(describeCursor(wasm,raw()).editable,true);
  assert.equal(describeCursor(wasm,{...raw(),unsupportedMode:true}).editable,false);
  const start=raw().position,end={...start,paragraphIndex:2};
  assert.equal(describeCursor(wasm,{...raw(),selection:{start,end}}).reason,'CROSS_PARAGRAPH_OR_CELL_SELECTION');
  wasm.getFieldInfoAt=()=>({inField:true});
  assert.equal(describeCursor(wasm,raw()).reason,'FIELD_RANGE_UNSUPPORTED');
});
