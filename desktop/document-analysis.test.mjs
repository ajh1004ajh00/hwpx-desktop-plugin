import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRuns, analyzeCurrentTable, analyzeDocument, createDocumentAnalysis } from './document-analysis.mjs';

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
    paragraphs:[{index:0,text:'제목',length:2,formatRuns:[{start:0,end:2,fontFamily:'맑은 고딕',fontSizePt:10,bold:false,italic:false,underline:false,strikethrough:false,textColor:null,charShapeId:1}]}],
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
  const result=analyzeDocument(wasm,{offset:0,limit:1});
  assert.equal(result.items[0].text.length,5001);
  assert.equal(result.items[0].text,text);
  assert.equal(result.items[0].truncated,undefined);
  assert.deepEqual(result.items[0].formatRuns.map(({start,end})=>({start,end})),[{start:0,end:5001}]);

  const table=Object.assign(tableWasm(),{
    getTableDimensions:()=>({rowCount:1,colCount:1,cellCount:1}),
    getTableCellBboxes:()=>[{cellIdx:0,pageIndex:0}],
    getCellInfo:()=>({row:0,col:0,rowSpan:1,colSpan:1}),
    getCellParagraphCount:()=>1,getCellParagraphLength:()=>text.length,
    getTextInCell:(_s,_p,_c,_cell,_para,start,length)=>text.slice(start,start+length),
    getCellCharPropertiesAt:()=>({fontFamily:'바탕',fontSize:1000,charShapeId:1}),
  });
  const current=analyzeCurrentTable(table,{
    sectionIndex:0,paragraphIndex:0,charOffset:0,parentParaIndex:0,controlIndex:0,
    cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0}],
  },{offset:0,limit:1});
  assert.equal(current.cells[0].paragraphs[0].text,text);
  assert.equal(current.cells[0].paragraphs[0].truncated,undefined);
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
