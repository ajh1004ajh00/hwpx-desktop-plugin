import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from './studio-build.config.mjs';

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
