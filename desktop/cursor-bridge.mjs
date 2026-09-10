const fail = code => { throw new Error(code); };
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const integer = n => Number.isSafeInteger(n) && n >= 0;
export function normalizePosition(value) {
  const result = {};
  for (const key of ['sectionIndex','paragraphIndex','charOffset']) {
    if (!integer(value?.[key])) fail('INVALID_CURSOR');
    result[key]=value[key];
  }
  if (value.parentParaIndex !== undefined) {
    for (const key of ['parentParaIndex','controlIndex','cellIndex','cellParaIndex']) {
      if (!integer(value[key])) fail('INVALID_CELL_CURSOR');
      result[key]=value[key];
    }
    result.cellPath=(value.cellPath?.length ? value.cellPath : [{controlIndex:value.controlIndex,cellIndex:value.cellIndex,cellParaIndex:value.cellParaIndex}]).map(entry => {
      const item={};
      for (const key of ['controlIndex','cellIndex','cellParaIndex']) {
        if (!integer(entry[key])) fail('INVALID_CELL_PATH'); item[key]=entry[key];
      }
      return item;
    });
  } else if (value.cellPath?.length) fail('INVALID_CELL_PATH');
  if (value.isTextBox) result.isTextBox=true;
  return result;
}
const container = position => ({...position,charOffset:0});
export function validateCursorText(text) {
  // ponytail: upstream offsets mix UTF-16 and scalar counts. Reject supplementary
  // characters until that contract has dedicated end-to-end coverage.
  if (typeof text !== 'string' || !text.length || text.length > 4000 || /[\u0000-\u001f\u007f\uD800-\uDFFF]/.test(text)) fail('UNSUPPORTED_TEXT: use one line, 1–4000 BMP characters');
  return text;
}
export function assertCursorFence(expected,current) {
  if (expected.composing || current.composing) fail('IME_COMPOSING: 한글 입력 조합을 마친 뒤 다시 읽어주세요.');
  if (!expected.cursor.editable || !current.cursor.editable) fail('UNSUPPORTED_CURSOR');
  for (const key of ['documentEpoch','changeSeq','documentSha256']) {
    if (expected.state[key] !== current.state[key]) fail('DOCUMENT_CHANGED: 문서가 변경됐습니다.');
  }
  for (const key of ['position','start','end','paragraphText']) {
    if (!equal(expected.cursor[key],current.cursor[key])) fail('CURSOR_CHANGED: 커서 또는 선택 범위가 변경됐습니다.');
  }
}

export function paragraphText(wasm,position) {
  const cell=position.parentParaIndex !== undefined;
  const args=cell ? [position.sectionIndex,position.parentParaIndex,JSON.stringify(position.cellPath)] : [position.sectionIndex,position.paragraphIndex];
  const length=cell ? wasm.getCellParagraphLengthByPath(...args) : wasm.getParagraphLength(...args);
  if (!integer(length) || length > 4000) fail('PARAGRAPH_TOO_LARGE');
  const text=cell ? wasm.getTextInCellByPath(...args,0,length) : wasm.getTextRange(...args,0,length);
  if (text.length !== length || /[\uD800-\uDFFF\uFFFC]/.test(text)) fail('UNSUPPORTED_PARAGRAPH_OFFSETS');
  return text;
}

export function describeCursor(wasm,raw) {
  const position=normalizePosition(raw.position);
  const start=normalizePosition(raw.selection?.start ?? position);
  const end=normalizePosition(raw.selection?.end ?? position);
  const result={position,start,end,collapsed:equal(start,end),page:raw.rect ? raw.rect.pageIndex+1 : null,editable:false,reason:null};
  try {
    if (raw.unsupportedMode || position.isTextBox) fail('UNSUPPORTED_EDIT_MODE');
    if (!equal(container(start),container(end)) || !equal(container(position),container(start))) fail('CROSS_PARAGRAPH_OR_CELL_SELECTION');
    if (start.charOffset > end.charOffset) fail('INVALID_SELECTION_ORDER');
    if (position.parentParaIndex !== undefined) {
      if (position.cellPath.length !== 1) fail('NESTED_TABLE_READ_ONLY');
      const [path]=position.cellPath;
      if (path.controlIndex!==position.controlIndex || path.cellIndex!==position.cellIndex || path.cellParaIndex!==position.cellParaIndex) fail('CELL_PATH_MISMATCH');
      if (wasm.getCellProperties(position.sectionIndex,position.parentParaIndex,position.controlIndex,position.cellIndex).cellProtect) fail('PROTECTED_CELL');
      const info=wasm.getCellInfo(position.sectionIndex,position.parentParaIndex,position.controlIndex,position.cellIndex);
      result.cell={row:info.row+1,column:info.col+1,rowSpan:info.rowSpan,columnSpan:info.colSpan};
    } else if (wasm.getControlTextPositions(position.sectionIndex,position.paragraphIndex).length) fail('BODY_CONTROLS_UNSUPPORTED');
    const text=paragraphText(wasm,start);
    if (end.charOffset > text.length || position.charOffset > text.length) fail('OFFSET_OUT_OF_RANGE');
    for (let offset=start.charOffset; offset<=end.charOffset;offset++) {
      if (wasm.getFieldInfoAt({...start,charOffset:offset}).inField) fail('FIELD_RANGE_UNSUPPORTED');
    }
    result.paragraphText=text;
    result.selectedText=text.slice(start.charOffset,end.charOffset);
    result.beforeText=text.slice(0,start.charOffset);
    result.afterText=text.slice(end.charOffset);
    result.editable=true;
  } catch(error) { result.reason=error.message; }
  return result;
}

export function createCursorBridge({getEnvironment,mutate,lock}) {
  const snapshots=new Map(),journal=new Map();
  let busy=false;
  const assertIdle=() => { if (busy) fail('EDITOR_BUSY'); };
  const rawRead=() => {
    const env=getEnvironment();
    if (!env.input || !env.agent) fail('NO_DOCUMENT');
    return {state:{...env.agent.getDocumentState(),layoutPageCount:env.wasm.pageCount},cursor:describeCursor(env.wasm,env.input.getDesktopCursorContext()),composing:env.composing,fileName:env.wasm.fileName};
  };
  const exclusive=async (action,lockInput=true) => {
    assertIdle(); busy=true;
    let release;
    try { release=lockInput ? lock() : null; return await action(); }
    finally { try { release?.(); } finally { busy=false; } }
  };
  return {
    assertIdle,exclusive,
    read() {
      assertIdle(); const snapshot=rawRead(), token=crypto.randomUUID();
      snapshots.set(token,snapshot);
      if (snapshots.size>16) snapshots.delete(snapshots.keys().next().value);
      return {...snapshot,cursor:{...snapshot.cursor,token}};
    },
    apply(command) {
      return exclusive(async () => {
        if (!command || Object.keys(command).sort().join(',') !== 'commandId,text,token') fail('INVALID_CURSOR_COMMAND');
        for (const key of ['commandId','token']) if (typeof command[key]!=='string' || !command[key].length || command[key].length>128) fail('INVALID_CURSOR_COMMAND');
        validateCursorText(command.text);
        const binding=JSON.stringify(command), replay=journal.get(command.commandId);
        if (replay) {
          const now=rawRead();
          if (replay.binding!==binding || !equal(now.state,replay.after.state)) fail('COMMAND_REPLAY_MISMATCH');
          return replay.receipt;
        }
        const expected=snapshots.get(command.token);
        if (!expected) fail('CURSOR_SNAPSHOT_EXPIRED');
        assertCursorFence(expected,rawRead());
        const {start,end,beforeText,afterText,selectedText}=expected.cursor;
        const env=getEnvironment();
        await env.input.executeDocumentAgentOperation({
          kind:'snapshot',operationType:'desktop-cursor-insert',
          operation: wasm => {
            assertCursorFence(expected,rawRead());
            const next=mutate(wasm,start,end,command.text);
            wasm.flushDeferredPagination?.();
            if (paragraphText(wasm,start) !== beforeText+command.text+afterText) fail('CURSOR_POSTIMAGE_MISMATCH');
            return next;
          },
        },env.render);
        const after=rawRead();
        const receipt={command_id:command.commandId,operation:expected.cursor.collapsed?'insert_at_cursor':'replace_selection',inserted_text:command.text,replaced_text:selectedText,before:expected.state,after:after.state,cursor:after.cursor};
        journal.set(command.commandId,{binding,receipt,after});
        if (journal.size>32) journal.delete(journal.keys().next().value);
        return receipt;
      });
    },
  };
}
