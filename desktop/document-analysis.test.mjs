import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRuns, analyzeCurrentTable, analyzeDocument, createDocumentAnalysis } from './document-analysis.mjs';

test('document catalog is reused only for the same native model and all state fields',()=>{
  let layouts=0,state={documentEpoch:1,changeSeq:0,documentSha256:'a'};
  const wasm={pageCount:1,getPageControlLayout:()=>{layouts++;return {controls:[]};},getSectionCount:()=>1,getParagraphCount:()=>2,
    getParagraphLength:()=>1,getTextRange:()=>'가',getCharPropertiesAt:()=>({}),getParaPropertiesAt:()=>({}),getStyleAt:()=>({})};
  let current=wasm;
  const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm:current,agent:{getDocumentState:()=>state}}),assertIdle(){}});
  const read=offset=>bridge.document({expectedState:{...state,layoutPageCount:current.pageCount},offset,limit:1});
  read(0);read(1);assert.equal(layouts,1);
  for(const key of ['documentEpoch','changeSeq','documentSha256']) {state={...state,[key]:key==='documentSha256'?'b':state[key]+1};read(0);read(1);}
  assert.equal(layouts,4);
  current={...wasm};read(0);assert.equal(layouts,5);
  current.pageCount=2;read(0);read(1);assert.equal(layouts,7);
});

test('target search returns only bounded matches, spans fragments and fences focus',()=>{
  let state={documentEpoch:1,changeSeq:1,documentSha256:'one',layoutPageCount:0},focused;
  const texts=['PRIVATE_PREFIX '+'가'.repeat(495)+'지원동기 PRIVATE_SUFFIX','지원동기'];
  const wasm={pageCount:0,getPageControlLayout:()=>({controls:[]}),getSectionCount:()=>1,getParagraphCount:()=>texts.length,
    getParagraphLength:(_s,p)=>texts[p].length,getTextRange:(_s,p,o,n)=>texts[p].slice(o,o+n),
    getCharPropertiesAt:()=>({}),getParaPropertiesAt:()=>({}),getStyleAt:()=>({})};
  const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>state}}),assertIdle(){},focus:hit=>{focused=hit;}});
  const result=bridge.search({expectedState:state,query:'지원동기'});
  assert.equal(result.candidates.length,2);
  assert.equal(result.truncated,false);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_PREFIX|PRIVATE_SUFFIX/);
  assert.equal(focused,undefined);
  bridge.focus({expectedState:state,targetId:result.candidates[0].target_id});
  assert.equal(focused.charOffset,510);
  state={...state,changeSeq:2};focused=undefined;
  assert.throws(()=>bridge.focus({expectedState:result.state,targetId:result.candidates[1].target_id}),/DOCUMENT_CHANGED/);
  assert.equal(focused,undefined);
  assert.throws(()=>bridge.search({expectedState:state,query:''}),/INVALID_QUERY/);
  texts[0]='지원동기 '.repeat(25);
  const many=bridge.search({expectedState:state,query:'지원동기'});
  assert.equal(many.candidates.length,20);assert.equal(many.truncated,true);
  assert.throws(()=>bridge.focus({expectedState:state,targetId:result.candidates[0].target_id}),/TARGET_EXPIRED/);
});

test('format runs group adjacent character properties and convert HWPUNIT to points',()=>{
  const props=[
    {fontFamily:'맑은 고딕',fontSize:1000,bold:true,textColor:'#000000',charShapeId:3},
    {fontFamily:'맑은 고딕',fontSize:1000,bold:true,textColor:'#000000',charShapeId:3},
    {fontFamily:'함초롬바탕',fontSize:900,bold:false,textColor:'#ff0000',charShapeId:4},
  ];
  assert.deepEqual(formatRuns(3,index=>props[index]),[
    {start:0,end:2,fontFamily:'맑은 고딕',fontSizePt:10,bold:true,italic:false,underline:false,strikethrough:false,textColor:'#000000',charShapeId:3},
    {start:2,end:3,fontFamily:'함초롬바탕',fontSizePt:9,bold:false,italic:false,underline:false,strikethrough:false,textColor:'#FF0000',charShapeId:4},
  ]);
});

function tableWasm() {
  const texts=[['제목'],['값'],['병합','둘째 문단']];
  return {
    getTableDimensions:()=>({rowCount:2,colCount:2,cellCount:3}),
    getTableCellBboxes:()=>[
      {cellIdx:0,row:0,col:0,rowSpan:1,colSpan:1,pageIndex:0},
      {cellIdx:1,row:0,col:1,rowSpan:1,colSpan:1,pageIndex:0},
      {cellIdx:2,row:1,col:0,rowSpan:1,colSpan:2,pageIndex:1},
    ],
    getCellInfo:(_s,_p,_c,cell)=>cell===2?{row:1,col:0,rowSpan:1,colSpan:2}:{row:0,col:cell,rowSpan:1,colSpan:1},
    getCellProperties:()=>({cellProtect:false,verticalAlign:'Center',paddingLeft:100}),
    getCellTextDirection:()=>0,
    getCellParagraphCount:(_s,_p,_c,cell)=>cell===2?2:1,
    getCellParagraphLength:(_s,_p,_c,cell,para)=>texts[cell][para].length,
    getTextInCell:(_s,_p,_c,cell,para)=>texts[cell][para],
    getCellCharPropertiesAt:(_s,_p,_c,cell)=>({fontFamily:cell?'함초롬바탕':'맑은 고딕',fontSize:cell?900:1000,charShapeId:cell?2:1}),
  };
}

test('target search locates root cell paragraphs without leaking adjacent cells and blocks composing focus',()=>{
  let composing=false,hit;
  const state={documentEpoch:1,changeSeq:0,documentSha256:'a',layoutPageCount:1};
  const wasm=Object.assign(tableWasm(),{pageCount:1,getSectionCount:()=>1,getParagraphCount:()=>1,
    getParagraphLength:()=>0,getTextRange:()=>'',getCharPropertiesAt:()=>({}),getParaPropertiesAt:()=>({}),getStyleAt:()=>({}),
    getPageControlLayout:()=>({controls:[{type:'table',secIdx:0,paraIdx:0,controlIdx:2}]})});
  const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>state},composing}),assertIdle(){},focus:value=>{hit=value;}});
  const result=bridge.search({expectedState:state,query:'둘째'});
  assert.equal(result.candidates.length,1);
  assert.deepEqual(result.candidates[0].location,{kind:'table_cell',section:0,paragraph:0,control:2,cell:2,cellParagraph:1,row:2,column:1});
  assert.doesNotMatch(JSON.stringify(result),/제목|병합|문단/);
  composing=true;
  assert.throws(()=>bridge.focus({expectedState:state,targetId:result.candidates[0].target_id}),/IME_COMPOSING/);
  assert.equal(hit,undefined);composing=false;
  bridge.focus({expectedState:state,targetId:result.candidates[0].target_id});
  assert.deepEqual(hit.cellContext,{parentPara:0,ctrlIdx:2,cellIdx:2,cellPara:1});
});

test('current table analysis returns paged cells with text, format and merge coordinates',()=>{
  const result=analyzeCurrentTable(tableWasm(),{
    sectionIndex:0,paragraphIndex:0,charOffset:0,parentParaIndex:4,controlIndex:2,
    cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:2,cellIndex:0,cellParaIndex:0}],
  },{offset:0,limit:2});
  assert.deepEqual(result.table,{section:0,paragraph:4,control:2,rows:2,columns:2,totalCells:3});
  assert.equal(result.cells.length,2);
  assert.deepEqual(result.cells[0],{
    index:0,row:1,column:1,rowSpan:1,columnSpan:1,pages:[1],protected:false,
    verticalAlign:'Center',textDirection:0,padding:{left:100,right:null,top:null,bottom:null},
    paragraphs:[{index:0,text:'제목',length:2,textOffset:0,truncated:false,formatRuns:[{start:0,end:2,fontFamily:'맑은 고딕',fontSizePt:10,bold:false,italic:false,underline:false,strikethrough:false,textColor:null,charShapeId:1}]}],
  });
  assert.equal(result.cells[1].paragraphs[0].formatRuns[0].fontSizePt,9);
  assert.equal(result.nextOffset,2);
});

test('document analysis pages body paragraphs and root table cells and summarizes objects',()=>{
  const wasm=Object.assign(tableWasm(),{
    pageCount:2,
    getSectionCount:()=>1,
    getParagraphCount:()=>2,
    getParagraphLength:(_s,p)=>p?2:4,
    getTextRange:(_s,p)=>p?'끝문':'본문￼',
    getCharPropertiesAt:()=>({fontFamily:'바탕',fontSize:1100,charShapeId:7}),
    getParaPropertiesAt:()=>({paraShapeId:8}),
    getStyleAt:()=>({id:9,name:'바탕글'}),
    getPageControlLayout:page=>({controls:page===0?[
      {type:'table',secIdx:0,paraIdx:0,controlIdx:2,stableIndex:[0,0,2]},
      {type:'image',secIdx:0,paraIdx:0,controlIdx:3,stableIndex:[0,0,3]},
      {type:'table',secIdx:0,paraIdx:0,controlIdx:4,outerTableControlIdx:2,stableIndex:[0,0,2,1,0,4]},
      {type:'shape',secIdx:0,paraIdx:0,controlIdx:5,headerFooter:{kind:'header'},stableIndex:[0,0,5]},
      {type:'equation',secIdx:0,paraIdx:0,controlIdx:6,noteRef:{kind:'footnote'},stableIndex:[0,0,6]},
    ]:[{type:'table',secIdx:0,paraIdx:0,controlIdx:2,stableIndex:[0,0,2]}]}),
  });
  const first=analyzeDocument(wasm,{offset:0,limit:4});
  assert.deepEqual(first.summary,{
    pages:2,sections:1,bodyParagraphs:2,tables:1,
    objects:{table:2,image:1,shape:1,equation:1},
    unsupported:{nestedTables:1,headerFooterControls:1,noteControls:1,unaddressableControls:0},
  });
  assert.deepEqual(first.items.map(item=>item.kind),['body_paragraph','table','table_cell','table_cell']);
  assert.equal(first.items[0].text,'본문￼');
  assert.equal(first.items[0].formatRuns[0].fontSizePt,11);
  assert.deepEqual(first.items[1].table,{section:0,paragraph:0,control:2,rows:2,columns:2,totalCells:3});
  assert.deepEqual(first.items[2].cell,{index:0,row:1,column:1,rowSpan:1,columnSpan:1,pages:[1]});
  assert.equal(first.nextOffset,4);
  const second=analyzeDocument(wasm,{offset:first.nextOffset,limit:4});
  assert.deepEqual(second.items.map(item=>item.kind),['table_cell','body_paragraph']);
  assert.equal(second.items[0].paragraphs[1].text,'둘째 문단');
  assert.equal(second.nextOffset,null);
});

test('document pagination reads text and format only for returned items',()=>{
  let textReads=0,formatReads=0;
  const wasm={
    pageCount:0,getPageControlLayout:()=>({controls:[]}),getSectionCount:()=>1,getParagraphCount:()=>100,
    getParagraphLength:()=>1,getTextRange:()=>{textReads++;return '가';},
    getCharPropertiesAt:()=>{formatReads++;return {fontSize:1000};},
    getParaPropertiesAt:()=>({}),getStyleAt:()=>({id:0,name:'바탕글'}),
  };
  const result=analyzeDocument(wasm,{offset:50,limit:2});
  assert.equal(result.items.length,2);
  assert.equal(textReads,2);
  assert.equal(formatReads,2);
});

test('analysis returns long paragraph text and formatting without an unreachable truncated tail',()=>{
  const text='가'.repeat(5001);
  const wasm={
    pageCount:0,getPageControlLayout:()=>({controls:[]}),getSectionCount:()=>1,getParagraphCount:()=>1,
    getParagraphLength:()=>text.length,getTextRange:(_s,_p,start,length)=>text.slice(start,start+length),
    getCharPropertiesAt:()=>({fontFamily:'바탕',fontSize:1000,charShapeId:1}),
    getParaPropertiesAt:()=>({}),getStyleAt:()=>({id:0,name:'바탕글'}),
  };
  let next={offset:0},joined='',last;
  do {
    const result=analyzeDocument(wasm,{...next,limit:1});
    assert.ok(result.items[0].text.length<=512);
    joined+=result.items[0].text; last=result.items[0]; next=result.next;
  } while(next);
  assert.equal(joined,text);
  assert.equal(last.formatRuns.at(-1).end,5001);

  const table=Object.assign(tableWasm(),{
    getTableDimensions:()=>({rowCount:1,colCount:1,cellCount:1}),
    getTableCellBboxes:()=>[{cellIdx:0,pageIndex:0}],
    getCellInfo:()=>({row:0,col:0,rowSpan:1,colSpan:1}),
    getCellParagraphCount:()=>1,getCellParagraphLength:()=>text.length,
    getTextInCell:(_s,_p,_c,_cell,_para,start,length)=>text.slice(start,start+length),
    getCellCharPropertiesAt:()=>({fontFamily:'바탕',fontSize:1000,charShapeId:1}),
  });
  next={offset:0}; joined='';
  do {
    const current=analyzeCurrentTable(table,{
      sectionIndex:0,parentParaIndex:0,controlIndex:0,cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0}],
    },{...next,limit:1});
    assert.ok(current.cells[0].paragraphs[0].text.length<=512);
    joined+=current.cells[0].paragraphs[0].text; next=current.next;
  } while(next);
  assert.equal(joined,text);
});

test('analysis bridge binds every page to document content and pagination state',()=>{
  const state={documentEpoch:3,changeSeq:4,documentSha256:'abc',layoutPageCount:1};
  const wasm={
    pageCount:1,getPageControlLayout:()=>({controls:[]}),getSectionCount:()=>1,getParagraphCount:()=>1,
    getParagraphLength:()=>1,getTextRange:()=>'가',getCharPropertiesAt:()=>({fontSize:1000}),
    getParaPropertiesAt:()=>({paraShapeId:1}),getStyleAt:()=>({id:2,name:'바탕글'}),
  };
  let idleChecks=0;
  const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>({...state})}}),assertIdle:()=>idleChecks++});
  const result=bridge.document({expectedState:{...state},offset:0,limit:1});
  assert.deepEqual(result.state,state);
  assert.equal(result.items[0].text,'가');
  assert.equal(idleChecks,1);
  state.changeSeq++;
  assert.throws(()=>bridge.document({expectedState:{...result.state},offset:0,limit:1}),/DOCUMENT_CHANGED/);
  state.changeSeq--;
  wasm.pageCount=2;
  assert.throws(()=>bridge.document({expectedState:{...result.state},offset:0,limit:1}),/DOCUMENT_CHANGED/);
});

function boundedWasm(texts) {
  let reads=0;
  return {
    get reads(){return reads;}, reset(){reads=0;},
    pageCount:0,getPageControlLayout:()=>({controls:[]}),getSectionCount:()=>1,getParagraphCount:()=>texts.length,
    getParagraphLength:(_s,p)=>texts[p].length,getTextRange:(_s,p,start,length)=>texts[p].slice(start,start+length),
    getCharPropertiesAt:(_s,_p,i)=>{reads++;return {fontFamily:'가상',bold:!!(i%2)};},
    getParaPropertiesAt:()=>({}),getStyleAt:()=>({id:0,name:'기본'}),
  };
}
test('search retains overlapping matches within paragraphs and across fragment boundaries',()=>{
  for(const [text,offsets] of [['aaa',[0,1]],['x'.repeat(511)+'aaa',[511,512]]]) {
    const wasm=boundedWasm([text]);
    const state={documentEpoch:1,changeSeq:1,documentSha256:'original',layoutPageCount:0};
    const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>({...state})}}),assertIdle:()=>{}});
    const result=bridge.search({expectedState:state,query:'aa'});
    assert.deepEqual(result.candidates.map(candidate=>candidate.charOffset),offsets);
    assert.equal(result.truncated,false);
  }
});
test('analysis bounds total reads and bytes across items and reaches empty paragraphs and final formats',()=>{
  const texts=['가'.repeat(513),'',...Array(60).fill('나'.repeat(20))],wasm=boundedWasm(texts);
  let next={offset:0},joined=Array(texts.length).fill(''),count=0;
  do {
    wasm.reset();
    const result=analyzeDocument(wasm,{...next,limit:50});
    assert.ok(wasm.reads<=512);
    assert.ok(Buffer.byteLength(JSON.stringify(result))<=256*1024);
    for(const item of result.items) joined[item.paragraph]+=item.text;
    next=result.next; assert.ok(++count<100);
  } while(next);
  assert.deepEqual(joined,texts);
  assert.throws(()=>analyzeDocument(wasm,{offset:0,textOffset:-1}),/INVALID_PAGE/);
  assert.throws(()=>analyzeDocument(wasm,{offset:0,paragraphOffset:1}),/INVALID_PAGE/);
  assert.throws(()=>analyzeDocument(wasm,{offset:0,textOffset:9999}),/INVALID_PAGE/);
});
test('oversized metadata fails explicitly rather than returning an unbounded response',()=>{
  const wasm=boundedWasm(['가']);
  wasm.getStyleAt=()=>({name:'가'.repeat(100000)});
  assert.throws(()=>analyzeDocument(wasm),/ANALYSIS_ITEM_TOO_LARGE/);
});

test('large multi-paragraph cells resume in both table and document analysis within a shared budget',()=>{
  const texts=['', '가'.repeat(1100), ...Array(60).fill(''), '끝'];let reads=0;
  const wasm=Object.assign(tableWasm(),boundedWasm(['본문']),{
    pageCount:1,getPageControlLayout:()=>({controls:[{type:'table',secIdx:0,paraIdx:0,controlIdx:0}]}),
    getTableDimensions:()=>({rowCount:1,colCount:1,cellCount:1}),
    getCellParagraphCount:()=>texts.length,getCellParagraphLength:(_s,_p,_c,_i,p)=>texts[p].length,
    getTextInCell:(_s,_p,_c,_i,p,start,length)=>texts[p].slice(start,start+length),
    getCellCharPropertiesAt:()=>{reads++;return {bold:true};},
  });
  for(const kind of ['table','document']) {
    let next={offset:kind==='table'?0:2},joined=Array(texts.length).fill(''),visited=new Set(),count=0;
    do {
      reads=0;
      const result=kind==='table'?analyzeCurrentTable(wasm,{sectionIndex:0,parentParaIndex:0,controlIndex:0,cellPath:[{}]},{...next,limit:1})
        :analyzeDocument(wasm,{...next,limit:1});
      assert.ok(reads<=512);
      const item=kind==='table'?result.cells[0]:result.items[0];
      assert.ok(item.paragraphs.length<=50);
      for(const p of item.paragraphs) {joined[p.index]+=p.text;visited.add(p.index);}
      next=result.next;assert.ok(++count<100);
    }while(next);
    assert.deepEqual(joined,texts);assert.equal(visited.size,texts.length);
  }
});
test('every private state component rejects stale continuation before reading content',()=>{
  for(const key of ['documentEpoch','changeSeq','documentSha256','layoutPageCount']) {
    const state={documentEpoch:1,changeSeq:1,documentSha256:'original',layoutPageCount:0};
    const wasm=boundedWasm(['가'.repeat(1000)]);
    const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>({...state})}}),assertIdle:()=>{}});
    const first=bridge.document({expectedState:{...state},limit:1});
    const expectedState={...state};
    if(key==='layoutPageCount') wasm.pageCount++; else state[key]=key==='documentSha256'?'changed':2;
    wasm.reset();
    assert.throws(()=>bridge.document({expectedState,...first.next,limit:1}),/DOCUMENT_CHANGED/);
    assert.equal(wasm.reads,0);
  }
});

test('byte budget resumes before an excluded item and document changes during reading discard results',()=>{
  const wasm=boundedWasm(['첫','끝']);
  wasm.getStyleAt=()=>({name:'가'.repeat(50000)});
  const first=analyzeDocument(wasm,{limit:2});
  assert.equal(first.items.length,1);
  assert.deepEqual(first.next,{offset:1,paragraphOffset:0,textOffset:0});
  assert.ok(Buffer.byteLength(JSON.stringify(first))<=256*1024);
  const second=analyzeDocument(wasm,{...first.next,limit:2});
  assert.equal(second.items[0].text,'끝');assert.equal(second.next,null);
  const state={documentEpoch:1,changeSeq:1,documentSha256:'original',layoutPageCount:0};
  const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>({...state})}}),assertIdle:()=>{}});
  wasm.getTextRange=()=>{state.changeSeq++;return '첫';};
  assert.throws(()=>bridge.document({expectedState:{...state},limit:1}),/DOCUMENT_CHANGED/);
});
