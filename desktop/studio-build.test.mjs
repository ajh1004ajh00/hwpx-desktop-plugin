import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from './studio-build.config.mjs';
import {stripTypeScriptTypes} from 'node:module';

test('search-selected cell carries the path required by native formatting commands',async()=>{
  const path=new URL('.runtime/rhwp/rhwp-studio/src/ui/find-dialog.ts',import.meta.url);
  const source=await readFile(path,'utf8');
  const output=config.plugins[0].transform(source,path.pathname)?.code??source;
  const {navigateToSearchHit}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(output)).toString('base64'));
  let position,anchor;
  const ih={cursor:{clearSelection(){anchor=null;},moveTo(p){position=p;},setAnchor(){anchor=position;}},updateCaret(){},moveCursorTo(p){position=p;}};
  navigateToSearchHit(ih,{found:true,sec:0,para:2,charOffset:1,length:3,cellContext:{parentPara:2,ctrlIdx:0,cellIdx:3,cellPara:0}});
  for(const p of [anchor,position])assert.deepEqual(p.cellPath,[{controlIndex:0,cellIndex:3,cellParaIndex:0}]);
  assert.equal(anchor.charOffset,1);assert.equal(position.charOffset,4);
  navigateToSearchHit(ih,{found:true,sec:0,para:1,charOffset:0,length:2});
  assert.equal(position.cellPath,undefined);assert.equal(position.paragraphIndex,1);
});

test('pinned overlay guards native mutation/history and serializes all document ingress', async()=>{
  const transform=config.plugins[0].transform;
  for (const file of ['main.ts','engine/input-handler.ts']) {
    const path=new URL(`.runtime/rhwp/rhwp-studio/src/${file}`,import.meta.url);
    const source=await readFile(path,'utf8');
    const output=transform(source,path.pathname).code;
    assert.equal(transform(source.replaceAll('\r\n','\n'),path.pathname).code,output);
    if(file==='main.ts') {
      assert.match(output,/const desktopAnalysis=createDocumentAnalysis/);
      assert.match(output,/id==='desktop:analyze-current-table'.*desktopAnalysis\.currentTable/s);
      assert.match(output,/id==='desktop:analyze-document'.*desktopAnalysis\.document/s);
      assert.match(output,/return desktopCursor.exclusive\(\(\)=>desktopLoadBytes\(\.\.\.args\),false\)/);
      assert.match(output,/return desktopCursor.exclusive\(\(\)=>desktopCreateNewDocument\(\),false\)/);
      assert.match(output,/desktopCursor.assertIdle\(\);\s+return documentAgent.focusTarget/);
      assert.throws(()=>transform(source.replace('async function loadBytes(','async function renamed('),path.pathname),/marker changed/);
      assert.throws(()=>transform(source.replace('return documentAgent.revertTextCommand(command);','return changed(command);'),path.pathname),/marker changed/);
      assert.throws(()=>transform(source.replace('if (!await canReplaceCurrentDocument(skipUnsavedGuard)) {','if (changed) {'),path.pathname),/marker changed/);
    } else {
      for(const method of ['executeOperation(desc: OperationDescriptor): void {','private handleUndo(): void {','private handleRedo(): void {']) {
        assert.ok(output.includes(`${method}\n    if (this.desktopMutationLocked) throw new Error('EDITOR_BUSY');`));
      }
      assert.match(output,/if \(desc.operationType === 'desktop-cursor-insert'\) this.cursor.clearSelection\(\)/);
      assert.throws(()=>transform(source.replace('private handleUndo(): void {','private changed(): void {'),path.pathname),/marker changed/);
    }
  }
});

test('composition fence uses the editor IME state instead of a second document-wide flag',async()=>{
  const transform=config.plugins[0].transform;
  const mainPath=new URL('.runtime/rhwp/rhwp-studio/src/main.ts',import.meta.url);
  const inputPath=new URL('.runtime/rhwp/rhwp-studio/src/engine/input-handler.ts',import.meta.url);
  const main=transform(await readFile(mainPath,'utf8'),mainPath.pathname).code;
  const input=transform(await readFile(inputPath,'utf8'),inputPath.pathname).code;
  assert.match(input,/getDesktopComposing\(\) \{ return this\.isComposing; \}/);
  assert.match(main,/composing:inputHandler\?\.getDesktopComposing\(\)\?\?false/);
  assert.match(main,/if \(inputHandler\?\.getDesktopComposing\(\)\)/);
  assert.doesNotMatch(main,/let desktopComposing|document\.addEventListener\('composition/);
});
