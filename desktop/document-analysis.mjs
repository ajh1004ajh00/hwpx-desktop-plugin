const fail=code=>{throw new Error(code);};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const color=value=>typeof value==='string'?value.toUpperCase():null;

function format(properties={}) {
  return {
    fontFamily:properties.fontFamily??null,
    fontSizePt:Number.isFinite(properties.fontSize)?properties.fontSize/100:null,
    bold:properties.bold===true,
    italic:properties.italic===true,
    underline:properties.underline===true,
    strikethrough:properties.strikethrough===true,
    textColor:color(properties.textColor),
    charShapeId:integer(properties.charShapeId)?properties.charShapeId:null,
  };
}

export function formatRuns(length,read) {
  if(!integer(length)||typeof read!=='function') fail('INVALID_FORMAT_RANGE');
  const count=Math.max(length,1),runs=[];
  for(let offset=0;offset<count;offset++) {
    const current=format(read(offset)),last=runs.at(-1);
    if(last && Object.keys(current).every(key=>last[key]===current[key])) last.end=length?offset+1:0;
    else runs.push({start:offset,end:length?offset+1:0,...current});
  }
  return runs;
}

const page=(offset,limit,total)=>{
  if(!integer(offset)||!integer(limit)||limit<1||limit>50||offset>total) fail('INVALID_PAGE');
  return {start:offset,end:Math.min(total,offset+limit)};
};
const padding=properties=>({
  left:Number.isFinite(properties.paddingLeft)?properties.paddingLeft:null,
  right:Number.isFinite(properties.paddingRight)?properties.paddingRight:null,
  top:Number.isFinite(properties.paddingTop)?properties.paddingTop:null,
  bottom:Number.isFinite(properties.paddingBottom)?properties.paddingBottom:null,
});
const MAX_BYTES=256*1024;
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const budget=()=>({remaining:512,paragraphs:50});
function fragment(length,textOffset,readText,readFormat,allowance) {
  if(!integer(length)||!integer(textOffset)||textOffset>length) fail('INVALID_PAGE');
  const count=Math.min(length-textOffset,allowance.remaining);
  allowance.remaining-=Math.max(count,1); allowance.paragraphs--;
  return {length,textOffset,truncated:textOffset+count<length,
    text:readText(textOffset,count),
    formatRuns:formatRuns(count,i=>readFormat(textOffset+i)).map(run=>({...run,start:run.start+textOffset,end:run.end+textOffset}))};
}
function cellParagraphs(wasm,target,cell,paragraphOffset,textOffset,allowance) {
  const args=[target.section,target.paragraph,target.control,cell];
  const count=wasm.getCellParagraphCount(...args),paragraphs=[];
  if(!integer(paragraphOffset)||paragraphOffset>count||(paragraphOffset===count&&textOffset)) fail('INVALID_PAGE');
  let index=paragraphOffset;
  for(;index<count&&allowance.remaining>0&&allowance.paragraphs>0;index++) {
    const part=fragment(wasm.getCellParagraphLength(...args,index),textOffset,
      (start,length)=>wasm.getTextInCell(...args,index,start,length),
      offset=>wasm.getCellCharPropertiesAt(...args,index,offset),allowance);
    paragraphs.push({index,...part});
    if(part.truncated) return {paragraphs,continuation:{paragraphOffset:index,textOffset:part.formatRuns.at(-1).end}};
    textOffset=0;
  }
  return {paragraphs,continuation:index<count?{paragraphOffset:index,textOffset:0}:null};
}
function validateOffsets(paragraphOffset,textOffset) {
  if(!integer(paragraphOffset)||!integer(textOffset)) fail('INVALID_PAGE');
}
function finish(result,next) {
  const response={...result,nextOffset:next?.offset??null,next,truncated:next!==null};
  if(bytes(response)>MAX_BYTES) fail('ANALYSIS_ITEM_TOO_LARGE');
  return response;
}
function tableTarget(position) {
  if(!integer(position?.sectionIndex)||!integer(position?.parentParaIndex)||!integer(position?.controlIndex)
    ||position.cellPath?.length!==1) fail('CURRENT_CURSOR_NOT_IN_ROOT_TABLE');
  return {section:position.sectionIndex,paragraph:position.parentParaIndex,control:position.controlIndex};
}

export function analyzeCurrentTable(wasm,position,{offset=0,limit=20,paragraphOffset=0,textOffset=0}={}) {
  validateOffsets(paragraphOffset,textOffset);
  const target=tableTarget(position),dimensions=wasm.getTableDimensions(target.section,target.paragraph,target.control);
  const range=page(offset,limit,dimensions.cellCount),allowance=budget();
  if(offset===dimensions.cellCount&&(paragraphOffset||textOffset)) fail('INVALID_PAGE');
  const bboxes=wasm.getTableCellBboxes(target.section,target.paragraph,target.control),cells=[];
  let next=null,index=range.start;
  for(;index<range.end&&allowance.remaining>0&&allowance.paragraphs>0;index++) {
    const info=wasm.getCellInfo(target.section,target.paragraph,target.control,index);
    const properties=wasm.getCellProperties(target.section,target.paragraph,target.control,index);
    const part=cellParagraphs(wasm,target,index,paragraphOffset,textOffset,allowance);
    const cell={
      index,row:info.row+1,column:info.col+1,rowSpan:info.rowSpan,columnSpan:info.colSpan,
      pages:[...new Set(bboxes.filter(box=>box.cellIdx===index).map(box=>box.pageIndex+1))],
      protected:properties.cellProtect===true,verticalAlign:properties.verticalAlign??null,
      textDirection:wasm.getCellTextDirection(target.section,target.paragraph,target.control,index),
      padding:padding(properties),paragraphs:part.paragraphs,
    };
    if(bytes([...cells,cell])>MAX_BYTES-4096) {
      if(!cells.length) fail('ANALYSIS_ITEM_TOO_LARGE');
      next={offset:index,paragraphOffset,textOffset}; break;
    }
    cells.push(cell);
    if(part.continuation) {next={offset:index,...part.continuation};break;}
    paragraphOffset=0;textOffset=0;
  }
  next??=index<dimensions.cellCount?{offset:index,paragraphOffset:0,textOffset:0}:null;
  return finish({table:{...target,rows:dimensions.rowCount,columns:dimensions.colCount,totalCells:dimensions.cellCount},
    offset,limit,cells},next);
}

function controls(wasm) {
  const unique=new Map();
  for(let pageIndex=0;pageIndex<wasm.pageCount;pageIndex++) {
    for(const control of wasm.getPageControlLayout(pageIndex).controls??[]) {
      const identity=control.stableIndex?.length
        ? `${control.type}:${JSON.stringify(control.stableIndex)}`
        : `${control.type}:${control.secIdx}:${control.paraIdx}:${control.controlIdx}:${control.outerTableControlIdx??''}`;
      if(!unique.has(identity)) unique.set(identity,{...control,pages:[pageIndex+1]});
      else unique.get(identity).pages.push(pageIndex+1);
    }
  }
  return [...unique.values()];
}
function rootTableTarget(control) {
  if(control.type!=='table'||control.outerTableControlIdx!==undefined||control.headerFooter||control.noteRef
    ||![control.secIdx,control.paraIdx,control.controlIdx].every(integer)) return null;
  return {section:control.secIdx,paragraph:control.paraIdx,control:control.controlIdx};
}
function tableInfo(wasm,target) {
  const value=wasm.getTableDimensions(target.section,target.paragraph,target.control);
  return {...target,rows:value.rowCount,columns:value.colCount,totalCells:value.cellCount};
}
function readCell(wasm,target,index,bboxes,paragraphOffset,textOffset,allowance) {
  const info=wasm.getCellInfo(target.section,target.paragraph,target.control,index);
  return {
    cell:{index,row:info.row+1,column:info.col+1,rowSpan:info.rowSpan,columnSpan:info.colSpan,
      pages:[...new Set(bboxes.filter(box=>box.cellIdx===index).map(box=>box.pageIndex+1))]},
    ...cellParagraphs(wasm,target,index,paragraphOffset,textOffset,allowance),
  };
}
function bodyParagraph(wasm,section,paragraph,textOffset,allowance) {
  return {
    kind:'body_paragraph',section,paragraph,
    ...fragment(wasm.getParagraphLength(section,paragraph),textOffset,
      (start,length)=>wasm.getTextRange(section,paragraph,start,length),
      offset=>wasm.getCharPropertiesAt(section,paragraph,offset),allowance),
    paraShapeId:wasm.getParaPropertiesAt(section,paragraph).paraShapeId??null,
    style:wasm.getStyleAt(section,paragraph),
  };
}

function documentCatalog(wasm) {
  const catalog=controls(wasm),tables=catalog.map(rootTableTarget).filter(Boolean);
  const byParagraph=new Map();
  for(const target of tables) {
    const key=`${target.section}:${target.paragraph}`;
    if(!byParagraph.has(key)) byParagraph.set(key,[]);
    byParagraph.get(key).push(target);
  }
  const descriptors=[],tableCache=new Map();
  const sections=wasm.getSectionCount();
  let bodyParagraphs=0;
  for(let section=0;section<sections;section++) {
    const count=wasm.getParagraphCount(section); bodyParagraphs+=count;
    for(let paragraph=0;paragraph<count;paragraph++) {
      descriptors.push({kind:'body_paragraph',section,paragraph});
      for(const target of (byParagraph.get(`${section}:${paragraph}`)??[]).sort((a,b)=>a.control-b.control)) {
        const table=tableInfo(wasm,target);
        const key=`${target.section}:${target.paragraph}:${target.control}`;
        tableCache.set(key,{table,bboxes:null});
        descriptors.push({kind:'table',key});
        for(let index=0;index<table.totalCells;index++) descriptors.push({kind:'table_cell',key,index});
      }
    }
  }
  const objectCounts={};
  for(const control of catalog) objectCounts[control.type]=(objectCounts[control.type]??0)+1;
  const unsupported={
    nestedTables:catalog.filter(control=>control.type==='table'&&control.outerTableControlIdx!==undefined).length,
    headerFooterControls:catalog.filter(control=>control.headerFooter).length,
    noteControls:catalog.filter(control=>control.noteRef).length,
    unaddressableControls:catalog.filter(control=>![control.secIdx,control.paraIdx,control.controlIdx].every(integer)).length,
  };
  return {descriptors,tableCache,summary:{pages:wasm.pageCount,sections,bodyParagraphs,tables:tables.length,objects:objectCounts,unsupported}};
}

export function analyzeDocument(wasm,{offset=0,limit=20,paragraphOffset=0,textOffset=0}={},catalog=documentCatalog(wasm)) {
  validateOffsets(paragraphOffset,textOffset);
  const {descriptors,tableCache,summary}=catalog;
  const range=page(offset,limit,descriptors.length);
  if(offset===descriptors.length&&(paragraphOffset||textOffset)) fail('INVALID_PAGE');
  const items=[],allowance=budget();let next=null,index=range.start;
  for(;index<range.end&&allowance.remaining>0&&allowance.paragraphs>0;index++) {
    const descriptor=descriptors[index];let item,continuation=null;
    if(descriptor.kind==='body_paragraph') {
      if(paragraphOffset) fail('INVALID_PAGE');
      item=bodyParagraph(wasm,descriptor.section,descriptor.paragraph,textOffset,allowance);
      if(item.truncated) continuation={paragraphOffset:0,textOffset:item.formatRuns.at(-1).end};
    } else {
      const cached=tableCache.get(descriptor.key);
      if(descriptor.kind==='table') {
        if(paragraphOffset||textOffset) fail('INVALID_PAGE');
        item={kind:'table',table:cached.table};
      } else {
        cached.bboxes??=wasm.getTableCellBboxes(cached.table.section,cached.table.paragraph,cached.table.control);
        const part=readCell(wasm,cached.table,descriptor.index,cached.bboxes,paragraphOffset,textOffset,allowance);
        continuation=part.continuation;
        item={kind:'table_cell',table:{section:cached.table.section,paragraph:cached.table.paragraph,control:cached.table.control},
          cell:part.cell,paragraphs:part.paragraphs};
      }
    }
    if(bytes([...items,item])>MAX_BYTES-4096) {
      if(!items.length) fail('ANALYSIS_ITEM_TOO_LARGE');
      next={offset:index,paragraphOffset,textOffset};break;
    }
    items.push(item);
    if(continuation) {next={offset:index,...continuation};break;}
    paragraphOffset=0;textOffset=0;
  }
  next??=index<descriptors.length?{offset:index,paragraphOffset:0,textOffset:0}:null;
  return finish({summary,
    offset,limit,totalItems:descriptors.length,items},next);
}

const stateKeys=['documentEpoch','changeSeq','documentSha256','layoutPageCount'];
function assertState(expected,current) {
  if(!expected||stateKeys.some(key=>expected[key]!==current?.[key])) fail('DOCUMENT_CHANGED: 문서가 변경됐습니다. 다시 읽어주세요.');
}

export function createDocumentAnalysis({getEnvironment,assertIdle,focus}) {
  const targets=new Map();
  let cachedState,cachedWasm,cachedCatalog;
  const readDocument=(wasm,command)=>analyzeDocument(wasm,command,cachedCatalog??=documentCatalog(wasm));
  const run=(expected,read)=>{
    assertIdle();
    const {wasm,agent}=getEnvironment();
    if(!wasm||!agent) fail('NO_DOCUMENT');
    const current=()=>({...agent.getDocumentState(),layoutPageCount:wasm.pageCount});
    const before=current();
    if(cachedWasm!==wasm||stateKeys.some(key=>cachedState?.[key]!==before[key])) {
      cachedCatalog=undefined;cachedWasm=wasm;cachedState=before;
    }
    try {
      assertState(expected,before);
      const result=read(wasm);
      const after=current(); assertState(expected,after);
      return {state:after,...result};
    } catch(error) {cachedCatalog=undefined;throw error;}
  };
  return {
    search:command=>run(command?.expectedState,wasm=>{
      const query=command.query;
      if(typeof query!=='string'||!query.trim()||query.length>128||/[\u0000-\u001f\u007f\uD800-\uDFFF]/.test(query)) fail('INVALID_QUERY');
      targets.clear();
      const candidates=[];let next={offset:0},tail='',lastKey='',truncated=false;
      // Reuse bounded native reads; no document text is returned beyond exact matches.
      // Ceiling: 128 analysis pages and 20 candidates. Refine a truncated search.
      for(let pages=0;next&&pages<128;pages++) {
        const result=readDocument(wasm,{...next,limit:50});
        for(const item of result.items) {
          const fragments=item.kind==='body_paragraph'?[item]:item.kind==='table_cell'?item.paragraphs:[];
          for(const part of fragments) {
            const location=item.kind==='body_paragraph'
              ?{kind:item.kind,section:item.section,paragraph:item.paragraph}
              :{kind:item.kind,...item.table,cell:item.cell.index,cellParagraph:part.index,row:item.cell.row,column:item.cell.column};
            const key=JSON.stringify(location);
            if(key!==lastKey||part.textOffset===0) tail='';
            const text=tail+part.text,base=part.textOffset-tail.length;
            if(/[\uD800-\uDFFF]/.test(text)) fail('UNSUPPORTED_SEARCH_OFFSETS');
            for(let at=text.indexOf(query);at!==-1;at=text.indexOf(query,at+1)) {
              if(at+query.length<=tail.length) continue;
              if(candidates.length===20) {truncated=true;break;}
              const target_id=crypto.randomUUID(),charOffset=base+at;
              const hit={found:true,sec:location.section,para:location.paragraph,charOffset,length:query.length,
                ...(location.kind==='table_cell'?{cellContext:{parentPara:location.paragraph,ctrlIdx:location.control,cellIdx:location.cell,cellPara:location.cellParagraph}}:{})};
              targets.set(target_id,{state:command.expectedState,hit});
              candidates.push({target_id,location,charOffset,length:query.length,matchedText:query});
            }
            tail=query.length>1?text.slice(-(query.length-1)):'';lastKey=key;
            if(truncated) break;
          }
          if(truncated) break;
        }
        next=result.next;
        if(truncated) break;
      }
      return {candidates,truncated:truncated||next!==null,scope:'body_and_root_cells'};
    }),
    focus:command=>run(command?.expectedState,()=>{
      const target=targets.get(command.targetId);
      if(!target) fail('TARGET_EXPIRED');
      assertState(target.state,command.expectedState);
      if(getEnvironment().composing) fail('IME_COMPOSING');
      if(typeof focus!=='function') fail('FOCUS_UNAVAILABLE');
      focus(target.hit);
      return {focused:true};
    }),
    currentTable:command=>run(command?.expectedState,wasm=>analyzeCurrentTable(wasm,command.position,command)),
    document:command=>run(command?.expectedState,wasm=>readDocument(wasm,command)),
  };
}
