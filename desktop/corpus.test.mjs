import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initSync,HwpDocument} from './node_modules/@rhwp/core/rhwp.js';

const initialized=readFile(new URL('node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url)).then(module=>initSync({module}));
test('native parser rejects empty, unsupported and truncated files',async()=>{
  await initialized;
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();
  try {
    const bytes=doc.exportHwp();
    for(const invalid of [new Uint8Array(),new TextEncoder().encode('not a document'),bytes.slice(0,64)]) {
      assert.throws(()=>new HwpDocument(invalid));
    }
  } finally {doc.free();}
});
const json=value=>JSON.parse(value);
function structure(doc) {
  const controls=new Map();
  for(let page=0;page<doc.pageCount();page++) for(const c of json(doc.getPageControlLayout(page)).controls??[]) {
    const key=JSON.stringify([c.type,c.secIdx,c.paraIdx,c.controlIdx,c.stableIndex]);
    controls.set(key,c.type);
  }
  return {pages:doc.pageCount(),paragraphs:Array.from({length:doc.getParagraphCount(0)},(_,p)=>doc.getTextRange(0,p,0,doc.getParagraphLength(0,p))),controls:[...controls.values()].sort()};
}
const scenarios=[
  {name:'F2-table',prepare(doc){
    const table=json(doc.createTable(0,1,0,2,2));assert.equal(table.ok,true);
    for(let cell=0;cell<4;cell++) assert.equal(json(doc.insertTextInCell(0,table.paraIdx,table.controlIdx,cell,0,0,`합성 셀 ${cell+1}`)).ok,true);
    assert.equal(json(doc.applyCharFormatInCell(0,table.paraIdx,table.controlIdx,2,0,0,6,JSON.stringify({bold:true,fontSize:1400}))).ok,true);
    return table;
  },inspect(doc,t){return {...structure(doc),dimensions:json(doc.getTableDimensions(0,t.paraIdx,t.controlIdx)),cells:Array.from({length:4},(_,cell)=>({
    text:doc.getTextInCell(0,t.paraIdx,t.controlIdx,cell,0,0,doc.getCellParagraphLength(0,t.paraIdx,t.controlIdx,cell,0)),
    bold:json(doc.getCellCharPropertiesAt(0,t.paraIdx,t.controlIdx,cell,0,0)).bold,
    size:json(doc.getCellCharPropertiesAt(0,t.paraIdx,t.controlIdx,cell,0,0)).fontSize,
  }))};}},
  {name:'F3-picture',prepare(doc){
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
    const result=json(doc.insertPicture(0,1,0,'[]',png,2000,2000,1,1,'png','합성 이미지'));assert.equal(result.ok,true);
  },inspect:structure},
  {name:'F4-pages',prepare(doc){
    assert.equal(json(doc.insertText(0,1,0,'첫 페이지 합성 내용')).ok,true);
    assert.equal(json(doc.insertPageBreak(0,1,12)).ok,true);
    const last=doc.getParagraphCount(0)-1;
    assert.equal(json(doc.insertText(0,last,0,'둘째 페이지 합성 내용')).ok,true);
    assert.ok(doc.pageCount()>=2);
  },inspect:structure},
];
for(const scenario of scenarios) test(`native corpus roundtrip: ${scenario.name}`,async()=>{
  await initialized;
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertParagraph(0,1);
  const directory=new URL('../test-results/corpus/',import.meta.url);await mkdir(directory,{recursive:true});
  try {
    const target=scenario.prepare(doc),expected=scenario.inspect(doc,target),results=[];
    for(const format of ['hwp','hwpx']) {
      const bytes=format==='hwp'?doc.exportHwp():doc.exportHwpx(),reopened=new HwpDocument(bytes);
      try {assert.deepEqual(scenario.inspect(reopened,target),expected);} finally {reopened.free();}
      await writeFile(new URL(`${scenario.name}.${format}`,directory),bytes);
      results.push({format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),passed:true});
    }
    await writeFile(new URL(`${scenario.name}.json`,directory),JSON.stringify({scope:'engine-structure-not-visual',expected,results},null,2));
  } finally {doc.free();}
});
