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
    const current=format(read(offset)),signature=JSON.stringify(current),last=runs.at(-1);
    if(last?.signature===signature) last.end=length?offset+1:0;
    else runs.push({start:offset,end:length?offset+1:0,...current,signature});
  }
  return runs.map(({signature,...run})=>run);
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
function cellParagraph(wasm,target,cell,index) {
  const args=[target.section,target.paragraph,target.control,cell,index];
  const length=wasm.getCellParagraphLength(...args);
  const result={
    index,text:wasm.getTextInCell(...args,0,length),length,
    formatRuns:formatRuns(length,offset=>wasm.getCellCharPropertiesAt(...args,offset)),
  };
  return result;
}
function tableTarget(position) {
  if(!integer(position?.sectionIndex)||!integer(position?.parentParaIndex)||!integer(position?.controlIndex)
    ||position.cellPath?.length!==1) fail('CURRENT_CURSOR_NOT_IN_ROOT_TABLE');
  return {section:position.sectionIndex,paragraph:position.parentParaIndex,control:position.controlIndex};
}

export function analyzeCurrentTable(wasm,position,{offset=0,limit=20}={}) {
  const target=tableTarget(position),dimensions=wasm.getTableDimensions(target.section,target.paragraph,target.control);
  const range=page(offset,limit,dimensions.cellCount);
  const bboxes=wasm.getTableCellBboxes(target.section,target.paragraph,target.control);
  const cells=[];
  for(let index=range.start;index<range.end;index++) {
    const info=wasm.getCellInfo(target.section,target.paragraph,target.control,index);
    const properties=wasm.getCellProperties(target.section,target.paragraph,target.control,index);
    const paragraphs=[];
    const count=wasm.getCellParagraphCount(target.section,target.paragraph,target.control,index);
    for(let paragraph=0;paragraph<count;paragraph++) paragraphs.push(cellParagraph(wasm,target,index,paragraph));
    cells.push({
      index,row:info.row+1,column:info.col+1,rowSpan:info.rowSpan,columnSpan:info.colSpan,
      pages:[...new Set(bboxes.filter(box=>box.cellIdx===index).map(box=>box.pageIndex+1))],
      protected:properties.cellProtect===true,verticalAlign:properties.verticalAlign??null,
      textDirection:wasm.getCellTextDirection(target.section,target.paragraph,target.control,index),
      padding:padding(properties),paragraphs,
    });
  }
  return {
    table:{...target,rows:dimensions.rowCount,columns:dimensions.colCount,totalCells:dimensions.cellCount},
    offset,limit,cells,nextOffset:range.end<dimensions.cellCount?range.end:null,
  };
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
function readCell(wasm,target,index,bboxes=wasm.getTableCellBboxes(target.section,target.paragraph,target.control)) {
  const info=wasm.getCellInfo(target.section,target.paragraph,target.control,index);
  const paragraphs=[];
  const count=wasm.getCellParagraphCount(target.section,target.paragraph,target.control,index);
  for(let paragraph=0;paragraph<count;paragraph++) paragraphs.push(cellParagraph(wasm,target,index,paragraph));
  return {
    cell:{index,row:info.row+1,column:info.col+1,rowSpan:info.rowSpan,columnSpan:info.colSpan,
      pages:[...new Set(bboxes.filter(box=>box.cellIdx===index).map(box=>box.pageIndex+1))]},
    paragraphs,
  };
}
function bodyParagraph(wasm,section,paragraph) {
  const length=wasm.getParagraphLength(section,paragraph);
  const result={
    kind:'body_paragraph',section,paragraph,length,
    text:wasm.getTextRange(section,paragraph,0,length),
    paraShapeId:wasm.getParaPropertiesAt(section,paragraph).paraShapeId??null,
    style:wasm.getStyleAt(section,paragraph),
    formatRuns:formatRuns(length,offset=>wasm.getCharPropertiesAt(section,paragraph,offset)),
  };
  return result;
}

export function analyzeDocument(wasm,{offset=0,limit=20}={}) {
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
  const range=page(offset,limit,descriptors.length),objectCounts={};
  for(const control of catalog) objectCounts[control.type]=(objectCounts[control.type]??0)+1;
  const unsupported={
    nestedTables:catalog.filter(control=>control.type==='table'&&control.outerTableControlIdx!==undefined).length,
    headerFooterControls:catalog.filter(control=>control.headerFooter).length,
    noteControls:catalog.filter(control=>control.noteRef).length,
    unaddressableControls:catalog.filter(control=>![control.secIdx,control.paraIdx,control.controlIdx].every(integer)).length,
  };
  const items=descriptors.slice(range.start,range.end).map(descriptor=>{
    if(descriptor.kind==='body_paragraph') return bodyParagraph(wasm,descriptor.section,descriptor.paragraph);
    const cached=tableCache.get(descriptor.key);
    if(descriptor.kind==='table') return {kind:'table',table:cached.table};
    cached.bboxes??=wasm.getTableCellBboxes(cached.table.section,cached.table.paragraph,cached.table.control);
    return {kind:'table_cell',table:{section:cached.table.section,paragraph:cached.table.paragraph,control:cached.table.control},
      ...readCell(wasm,cached.table,descriptor.index,cached.bboxes)};
  });
  return {
    summary:{pages:wasm.pageCount,sections,bodyParagraphs,tables:tables.length,objects:objectCounts,unsupported},
    offset,limit,totalItems:descriptors.length,items,nextOffset:range.end<descriptors.length?range.end:null,
  };
}

const stateKeys=['documentEpoch','changeSeq','documentSha256','layoutPageCount'];
function assertState(expected,current) {
  if(!expected||stateKeys.some(key=>expected[key]!==current?.[key])) fail('DOCUMENT_CHANGED: 문서가 변경됐습니다. 다시 읽어주세요.');
}

export function createDocumentAnalysis({getEnvironment,assertIdle}) {
  const run=(expected,read)=>{
    assertIdle();
    const {wasm,agent}=getEnvironment();
    if(!wasm||!agent) fail('NO_DOCUMENT');
    const current=()=>({...agent.getDocumentState(),layoutPageCount:wasm.pageCount});
    const before=current(); assertState(expected,before);
    const result=read(wasm);
    const after=current(); assertState(expected,after);
    return {state:after,...result};
  };
  return {
    currentTable:command=>run(command?.expectedState,wasm=>analyzeCurrentTable(wasm,command.position,command)),
    document:command=>run(command?.expectedState,wasm=>analyzeDocument(wasm,command)),
  };
}
