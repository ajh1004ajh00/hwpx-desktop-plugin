import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initSync,HwpDocument} from './node_modules/@rhwp/core/rhwp.js';

test('native HWP and HWPX roundtrip preserves synthetic text and partial character formatting',async()=>{
  initSync({module:await readFile(new URL('node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
  const source=HwpDocument.createEmpty();
  const directory=new URL('../test-results/roundtrip/',import.meta.url);
  await mkdir(directory,{recursive:true});
  const text='앞부분 보존 지원동기 뒷부분 보존';
  const inspect=doc=>({pages:doc.pageCount(),text:doc.getTextRange(0,1,0,doc.getParagraphLength(0,1)),
    formats:[0,7,11].map(i=>{const p=JSON.parse(doc.getCharPropertiesAt(0,1,i));return {fontSize:p.fontSize,bold:p.bold,italic:p.italic,underline:p.underline,textColor:p.textColor};})});
  try {
    source.createBlankDocument();
    source.insertParagraph(0,1);
    source.insertText(0,1,0,text);
    source.applyCharFormat(0,1,7,11,JSON.stringify({fontSize:1600,bold:true,italic:true,underline:true}));
    const expected=inspect(source);
    assert.equal(expected.text,text);
    assert.equal(expected.formats[1].fontSize,1600);
    assert.equal(expected.formats[1].bold,true);
    assert.notEqual(expected.formats[0].fontSize,1600);
    const results=[];
    for(const format of ['hwp','hwpx']) {
      const bytes=format==='hwp'?source.exportHwp():source.exportHwpx();
      const reopened=new HwpDocument(bytes);
      try {
        assert.deepEqual(inspect(reopened),expected);
        for(const output of ['hwp','hwpx']) {
          const converted=output==='hwp'?reopened.exportHwp():reopened.exportHwpx();
          const again=new HwpDocument(converted);
          try {assert.deepEqual(inspect(again),expected);} finally {again.free();}
          await writeFile(new URL(`F1-${format}-to-${output}.${output}`,directory),converted);
          results.push({input:format,output,bytes:converted.length,sha256:createHash('sha256').update(converted).digest('hex'),passed:true});
        }
      } finally {reopened.free();}
      await writeFile(new URL('F1-partial-format.'+format,directory),bytes);
      results.push({format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),passed:true});
    }
    await writeFile(new URL('report.json',directory),JSON.stringify({scope:'native-engine-roundtrip-not-visual-or-browser-save',core:'0.8.6',expected,results},null,2));
  } finally {source.free();}
});
