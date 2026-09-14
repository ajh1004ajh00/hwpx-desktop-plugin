import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {verifyPackage} from './verify-package.mjs';

// Export only the verified browser runtime; no documents or local server code.
const root=resolve(import.meta.dirname,'..');
const destination=resolve(process.argv[2]??'');
if(!process.argv[2] || destination===root) throw new Error('Supply a separate Sites checkout');
const hosting=JSON.parse(await readFile(resolve(destination,'.openai/hosting.json'),'utf8'));
if(!hosting.project_id || hosting.static?.directory!=='dist') throw new Error('Expected registered static Site');
await verifyPackage(root);
const dist=resolve(destination,'dist');
await mkdir(dist,{recursive:true});
await cp(resolve(root,'desktop/.runtime/studio'),resolve(dist,'studio'),{recursive:true});
await mkdir(resolve(dist,'vendor/editor'),{recursive:true});
for(const name of ['index.js','transport.js','document-agent-contract.js']) {
  await cp(resolve(root,'desktop/node_modules/@rhwp/editor',name),resolve(dist,'vendor/editor',name));
}
for(const name of ['studio.mjs','studio-tools.mjs','studio.css']) {
  const source=await readFile(resolve(root,'desktop',name),'utf8');
  await writeFile(resolve(dist,name),source.replaceAll('./node_modules/@rhwp/editor/','./vendor/editor/'));
}
const policy="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const security=`<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`;
const html=await readFile(resolve(root,'desktop/studio.html'),'utf8');
await writeFile(resolve(dist,'index.html'),html.replace('<meta charset="utf-8">',`<meta charset="utf-8">${security}`).replace('문서를 클릭해 직접 입력하세요. 원본은 덮어쓰지 않습니다. 편집·저장 호환성은 시험 중입니다.',
  '파일 메뉴에서 한글 문서를 열거나 새 문서를 작성하세요. 문서는 이 브라우저에서 처리되며 자동 복구본이 저장될 수 있습니다. AI에는 요청에 필요한 내용만 전달합니다. 편집·저장 호환성은 검증 중입니다.'));
const studioHtml=await readFile(resolve(dist,'studio/index.html'),'utf8');
await writeFile(resolve(dist,'studio/index.html'),studioHtml.replace('<head>',`<head>${security}`));
await cp(resolve(root,'LICENSE'),resolve(dist,'LICENSE.txt'));
console.log('Exported verified browser editor to registered Site');
