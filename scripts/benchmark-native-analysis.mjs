import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {initSync,HwpDocument} from '../desktop/node_modules/@rhwp/core/rhwp.js';
import {analyzeDocument,createDocumentAnalysis} from '../desktop/document-analysis.mjs';

const native=initSync({module:await readFile(new URL('../desktop/node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const doc=HwpDocument.createEmpty();doc.createBlankDocument();
try {
  for(let p=1;p<=32;p++) {doc.insertParagraph(0,p);doc.insertText(0,p,0,`합성 문단 ${p}: `+'가'.repeat(1990));}
  let layoutReads=0;
  const jsonMethods=new Set(['getPageControlLayout','getCharPropertiesAt','getParaPropertiesAt','getStyleAt','getTableDimensions','getTableCellBboxes','getCellInfo','getCellProperties','getCellCharPropertiesAt']);
  const wasm=new Proxy(doc,{get(target,key){
    if(key==='pageCount')return target.pageCount();
    if(typeof target[key]!=='function')return target[key];
    return (...args)=>{if(key==='getPageControlLayout')layoutReads++;const result=target[key](...args);return jsonMethods.has(key)?JSON.parse(result):result;};
  }});
  const state={documentEpoch:1,changeSeq:0,documentSha256:'synthetic-static-document',layoutPageCount:doc.pageCount()};
  const bridge=createDocumentAnalysis({getEnvironment:()=>({wasm,agent:{getDocumentState:()=>state}}),assertIdle(){}});
  const results=[];
  for(const cached of [false,true]) {
    layoutReads=0;let next={offset:0},responses=0,textUnits=0,maxResponseBytes=0;
    const start=performance.now(),heapBefore=process.memoryUsage().heapUsed;
    let maxSampledRss=process.memoryUsage().rss,maxSampledHeap=heapBefore;
    do {
      const args={...next,limit:50};
      const r=cached?bridge.document({...args,expectedState:state}):analyzeDocument(wasm,args);
      textUnits+=r.items.reduce((n,item)=>n+(item.text?.length??0),0);
      maxResponseBytes=Math.max(maxResponseBytes,Buffer.byteLength(JSON.stringify(r)));
      next=r.next;responses++;assert.ok(responses<1000);
      const memory=process.memoryUsage();maxSampledRss=Math.max(maxSampledRss,memory.rss);maxSampledHeap=Math.max(maxSampledHeap,memory.heapUsed);
    } while(next);
    results.push({cached,responses,textUnits,layoutReads,maxResponseBytes,elapsedMs:performance.now()-start,heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,maxSampledRss,maxSampledHeap,processLifetimeMaxRssBytes:process.resourceUsage().maxRSS*1024,wasmAllocatedBytes:native.memory.buffer.byteLength});
  }
  assert.equal(results[0].textUnits,results[1].textUnits);
  assert.equal(results[0].responses,results[1].responses);
  assert.equal(results[1].layoutReads,doc.pageCount());
  assert.ok(results[0].layoutReads>results[1].layoutReads);
  const report={date:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,core:'0.8.6',pages:doc.pageCount(),paragraphs:doc.getParagraphCount(0),scope:'native WASM full traversal, static state adapter; not host timing or peak live memory',results};
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  await writeFile(new URL('../test-results/native-analysis.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {doc.free();}
