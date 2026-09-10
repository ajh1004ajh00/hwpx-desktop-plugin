import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '.runtime/rhwp');
function replaceOnce(code, marker, replacement) {
  if (code.split(marker).length !== 2) throw new Error(`Pinned Studio marker changed: ${marker}`);
  return code.replace(marker,replacement);
}
// Build the pinned upstream editor without its dev-server file reader or PWA cache.
export default {
  root: resolve(root, 'rhwp-studio'), base: '/studio/',
  define: { __APP_VERSION__: JSON.stringify('0.8.6-local'), __RHWP_DISABLE_EXTERNAL_WEBFONTS__: 'true', __RHWP_HWPCTRL__: 'true' },
  resolve: { alias: {
    '@': resolve(root, 'rhwp-studio/src'), '@wasm/rhwp.js': resolve(root, 'pkg/rhwp.js'), '@wasm': resolve(root, 'pkg'),
    '@desktop-cursor': resolve(import.meta.dirname,'cursor-bridge.mjs'),
    '@desktop-analysis': resolve(import.meta.dirname,'document-analysis.mjs'),
    '@rhwp/hwpctrl/studio-plugin': resolve(root, 'npm/hwpctrl-ocx/src/studio-plugin.mjs'),
  } },
  build: { outDir: resolve(import.meta.dirname, '.runtime/studio'), emptyOutDir: true },
  plugins: [{
    name:'desktop-selection-evidence',
    enforce:'pre',
    // Pinned, fail-closed build overlay. No vendor source files are rewritten.
    // Exact cursor evidence + fenced native snapshot commands; no separate document model.
    transform(code, id) {
      code=code.replaceAll('\r\n','\n');
      if (id.replaceAll('\\','/').endsWith('/rhwp-studio/src/engine/input-handler.ts')) {
        for (const entry of ['executeOperation(desc: OperationDescriptor): void {','private handleUndo(): void {','private handleRedo(): void {']) {
          code=replaceOnce(code,entry,`${entry}\n    if (this.desktopMutationLocked) throw new Error('EDITOR_BUSY');`);
        }
        const marker='getCursorPosition(): DocumentPosition { return this.cursor.getPosition(); }';
        const move='this.cursor.moveTo(newPos);\n    this.cursor.resetPreferredX();\n    this.pendingFocusedPagePatch = null;';
        if (!code.includes(marker) || !code.includes(move)) throw new Error('Pinned input-handler cursor API changed');
        return {code:replaceOnce(code,move, `if (desc.operationType === 'desktop-cursor-insert') this.cursor.clearSelection();\n    ${move}`).replace(marker, `${marker}
  desktopMutationLocked = false;
  getDesktopCursorContext() {
    return {
      position:this.cursor.getPosition(), selection:this.cursor.getSelectionOrdered(), rect:this.cursor.getRect(),
      unsupportedMode:this.isFormMode() || this.cursor.isInHeaderFooter() || this.cursor.isInFootnote()
        || this.cursor.isInPictureObjectSelection() || this.cursor.isInTableObjectSelection() || this.cursor.isInCellSelectionMode(),
    };
  }`),map:null};
      }
      if (!id.replaceAll('\\','/').endsWith('/rhwp-studio/src/main.ts')) return;
      code=replaceOnce(code,'async function loadBytes(',`async function loadBytes(...args: Parameters<typeof desktopLoadBytes>): Promise<void> {
  return desktopCursor.exclusive(()=>desktopLoadBytes(...args),false);
}
async function desktopLoadBytes(`);
      code=replaceOnce(code,'async function createNewDocument(): Promise<void> {',`async function createNewDocument(): Promise<void> {
  return desktopCursor.exclusive(()=>desktopCreateNewDocument(),false);
}
async function desktopCreateNewDocument(): Promise<void> {`);
      code=replaceOnce(code,'return documentAgent.focusTarget(target);', 'desktopCursor.assertIdle();\n      return documentAgent.focusTarget(target);');
      const context = 'async automationContext() { await initPromise; return automation.getContext(); }';
      const apply = 'return documentAgent.applyTextCommand(command);';
      const execute = 'return automation.execute(id, params, options);';
      const initialized = 'const initPromise = initialize();';
      if (![context,apply,execute,initialized].every(marker=>code.includes(marker))) throw new Error('Pinned Studio bridge changed; review overlay before building.');
      let transformed=code.replace(initialized, `${initialized}
const desktopCursor = createCursorBridge({
  getEnvironment: () => ({wasm,input:inputHandler,agent:documentAgent,composing:desktopComposing,render:()=>canvasView!.refreshDocumentAgentMutation()}),
  mutate:(bridge,start,end,text) => {
    if (end.charOffset>start.charOffset) new DeleteTextCommand(start,end.charOffset-start.charOffset,'forward').execute(bridge);
    return new InsertTextCommand(start,text).execute(bridge);
  },
  lock:()=>{
    const root=document.getElementById('studio-root')!;
    const input=inputHandler;
    const inputLocked=input?.desktopMutationLocked;
    if (input) input.desktopMutationLocked=true;
    const previous=root.inert; root.inert=true;
    return ()=>{root.inert=previous; if(input) input.desktopMutationLocked=inputLocked!;};
  },
});
const desktopAnalysis=createDocumentAnalysis({
  getEnvironment:()=>({wasm,agent:documentAgent}),
  assertIdle:()=>desktopCursor.assertIdle(),
});
`).replace(context, `async automationContext() {
  await initPromise;
  if (!documentAgent) throw new Error('No document');
  const snapshot=desktopCursor.read();
  let selection={editable:false,target:null,page:snapshot.cursor.page}, evidence=null;
  try {
    selection=documentAgent.getSelectionContext();
    evidence=selection.editable && selection.target ? desktopEvidence(wasm,selection.target) : null;
  } catch { /* A cell-local paragraph is not a body paragraph; cursor path remains authoritative. */ }
  return {...automation.getContext(), desktopSnapshot:{...snapshot,selection,evidence}};
}`).replace(apply, `if (desktopComposing) throw new Error('IME_COMPOSING: finish text composition first');
      return desktopCursor.exclusive(()=>documentAgent!.applyTextCommand(command));`)
        .replace(execute, `if (id==='desktop:analyze-current-table') return desktopAnalysis.currentTable(params);
      if (id==='desktop:analyze-document') return desktopAnalysis.document(params);
      if (id==='desktop:insert-text') return desktopCursor.apply(params);
      desktopCursor.assertIdle();
      ${execute}`);
      transformed=replaceOnce(transformed,'return documentAgent.revertTextCommand(command);','return desktopCursor.exclusive(()=>documentAgent!.revertTextCommand(command));');
      transformed=replaceOnce(transformed,'if (!await canReplaceCurrentDocument(skipUnsavedGuard)) {','desktopCursor.assertIdle();\n      if (!await canReplaceCurrentDocument(skipUnsavedGuard)) {');
      return {
        code: `import { collectTargetEvidence as desktopEvidence } from '@/document-agent/controller';
import { createCursorBridge } from '@desktop-cursor';
import { createDocumentAnalysis } from '@desktop-analysis';
import { InsertTextCommand, DeleteTextCommand } from '@/engine/command';
let desktopComposing = false;
document.addEventListener('compositionstart', () => { desktopComposing = true; }, true);
document.addEventListener('compositionend', () => { desktopComposing = false; }, true);
` + transformed, map:null,
      };
    },
  }],
};
