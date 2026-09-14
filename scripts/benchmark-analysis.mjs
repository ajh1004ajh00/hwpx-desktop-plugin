import { performance } from 'node:perf_hooks';
import { strict as assert } from 'node:assert';
import { analyzeDocument, analyzeCurrentTable } from '../desktop/document-analysis.mjs';

// Measures our JavaScript analysis code through a synthetic WASM-shaped adapter.
// Does not measure WASM crossing costs, file parsing, rendering or Desktop responsiveness.
const position={sectionIndex:0,parentParaIndex:0,controlIndex:0,cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0}]};
const scenarios=[
  {name:'body-5001',length:5001},
  {name:'body-50000',length:50000},
  {name:'body-50000-alternating',length:50000,alternating:true},
  {name:'cell-50000-alternating',length:50000,alternating:true,table:true},
  {name:'cell-100-paragraphs',length:1000,paragraphs:100,table:true},
  {name:'document-10000-paragraphs-1000-pages',length:100,paragraphs:10000,pages:1000},
];

function runCase(spec) {
  let formatReads=0,textReads=0,layoutReads=0;
  const text='가'.repeat(spec.length-1)+'끝';
  const properties=offset=>{
    formatReads++;
    return {fontFamily:'합성글꼴',fontSize:1000,bold:!!(spec.alternating && offset%2),charShapeId:1};
  };
  const read=(_s,_p,start,length)=>{textReads++;return text.slice(start,start+length);};
  const wasm={
    pageCount:spec.pages??1,getSectionCount:()=>1,getParagraphCount:()=>spec.paragraphs??1,
    getPageControlLayout:()=>{layoutReads++;return {controls:[]};},
    getParagraphLength:()=>text.length,getTextRange:read,getCharPropertiesAt:(_s,_p,offset)=>properties(offset),
    getParaPropertiesAt:()=>({}),getStyleAt:()=>({id:0,name:'합성'}),
    getTableDimensions:()=>({rowCount:1,colCount:1,cellCount:1}),
    getTableCellBboxes:()=>[{cellIdx:0,pageIndex:0}],
    getCellInfo:()=>({row:0,col:0,rowSpan:1,colSpan:1}),getCellProperties:()=>({}),getCellTextDirection:()=>0,
    getCellParagraphCount:()=>spec.paragraphs??1,getCellParagraphLength:()=>text.length,
    getTextInCell:(_s,_p,_c,_cell,_para,start,length)=>read(0,0,start,length),
    getCellCharPropertiesAt:(_s,_p,_c,_cell,_para,offset)=>properties(offset),
  };
  global.gc?.();
  const before=process.memoryUsage().heapUsed,start=performance.now();
  const result=spec.table ? analyzeCurrentTable(wasm,position,{offset:0,limit:1}) : analyzeDocument(wasm,{offset:0,limit:1});
  const analysisMs=performance.now()-start;
  const json=JSON.stringify(result);
  const totalMs=performance.now()-start;
  const heapUsedDeltaBytes=process.memoryUsage().heapUsed-before;
  const paragraphs=spec.table?result.cells[0].paragraphs:result.items;
  assert.equal(paragraphs.length,1);
  assert.equal(formatReads,Math.min(spec.length,512));
  assert.ok(paragraphs.every(p=>p.text===text.slice(0,512)));
  assert.ok(Buffer.byteLength(json)<=256*1024);
  return {next:result.next,truncated:result.truncated,analysisMs,totalMs,heapUsedDeltaBytes,jsonBytes:Buffer.byteLength(json),formatReads,textReads,layoutReads,
    formatRuns:paragraphs.reduce((n,p)=>n+p.formatRuns.length,0)};
}

const results=scenarios.map(spec=>({scenario:spec.name,samples:Array.from({length:3},()=>runCase(spec))}));
console.log(JSON.stringify({date:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,
  scope:'synthetic-adapter: FIRST bounded response only; JavaScript analysis and JSON serialization, not full traversal',
  memory:'heapUsed after serialization minus before analysis; not peak memory',results},null,2));
