import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
// This validates the local build tree, not acceptance of a submission archive.
export async function verifyPackage(directory=root,{expected}={}) {
  const base=await realpath(directory);
  const files=new Set([
    '.codex-plugin/plugin.json','package.json','README.md','LICENSE','THIRD_PARTY_NOTICES.md',
    'docs/DATA-POLICY.md','docs/REVIEW-HANDOFF.md','docs/MILESTONE-STATUS.md',
    'skills/hwpx-desktop/SKILL.md','scripts/start-desktop.mjs','scripts/setup-desktop-editor.mjs','scripts/verify-package.mjs','scripts/benchmark-analysis.mjs',
    'desktop/package.json','desktop/package-lock.json','desktop/server.mjs','desktop/studio.html',
    'desktop/studio.mjs','desktop/studio-tools.mjs','desktop/studio.css','desktop/cursor-bridge.mjs',
    'desktop/document-analysis.mjs','desktop/studio-build.config.mjs',
    'desktop/.runtime/studio/index.html','desktop/.runtime/studio/rhwp.js','desktop/.runtime/studio/rhwp_bg.wasm',
    'desktop/.runtime/studio/LICENSE.txt','desktop/.runtime/studio/fonts/D2Coding-Regular.woff2',
    'desktop/.runtime/studio/fonts/FONTS.md','desktop/.runtime/studio/fonts/SourceHanSerifK-OFL.txt',
    ...['index.js','transport.js','document-agent-contract.js','package.json'].map(name=>'desktop/node_modules/@rhwp/editor/'+name),
    ...['package.json','rhwp.js','rhwp_bg.wasm','LICENSE'].map(name=>'desktop/node_modules/@rhwp/core/'+name),
  ]);
  const json=async name=>JSON.parse(await readFile(resolve(base,name),'utf8'));
  const manifest=await json('.codex-plugin/plugin.json'),pkg=await json('package.json');
  if(manifest.name!==pkg.name || manifest.version.split('+')[0]!==pkg.version || manifest.skills!=='./skills/') {
    throw new Error('PACKAGE_METADATA_MISMATCH');
  }
  const dependencies=(await json('desktop/package.json')).dependencies;
  const lock=await json('desktop/package-lock.json');
  for(const name of ['@rhwp/core','@rhwp/editor']) {
    if(dependencies[name]!=='0.8.6' || lock.packages['node_modules/'+name]?.version!==dependencies[name]
      || (await json('desktop/node_modules/'+name+'/package.json')).version!==dependencies[name]) {
      throw new Error('DEPENDENCY_VERSION_MISMATCH');
    }
  }
  const walk=async name=>{
    const actual=await realpath(resolve(base,name));
    if(!actual.startsWith(base+sep)) throw new Error('PACKAGE_PATH_ESCAPE');
    for(const entry of await readdir(actual,{withFileTypes:true})) {
      const child=name+'/'+entry.name;
      if(entry.isSymbolicLink()) throw new Error('PACKAGE_LINK_UNSUPPORTED');
      if(entry.isDirectory()) await walk(child);
      else files.add(child);
    }
  };
  await walk('desktop/.runtime/studio');
  const inventory=[];
  for(const name of [...files].sort()) {
    if(/(?:^|\/)\.env(?:\.|$)|\.(?:hwp|hwpx|pem|key|log)$/i.test(name)) throw new Error('PACKAGE_PRIVATE_FILE');
    const actual=await realpath(resolve(base,name));
    if(!actual.startsWith(base+sep) || !(await stat(actual)).isFile()) throw new Error('PACKAGE_PATH_INVALID');
    const bytes=await readFile(actual);
    if(!bytes.length) throw new Error('PACKAGE_EMPTY_FILE: '+name);
    inventory.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  const report={scope:'local-build-tree',version:manifest.version,files:inventory};
  if(expected && JSON.stringify(expected)!==JSON.stringify(report)) throw new Error('PACKAGE_INTEGRITY_MISMATCH');
  return report;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const reference=process.argv.indexOf('--against');
  const expected=reference===-1 ? undefined : JSON.parse(await readFile(process.argv[reference+1],'utf8'));
  const report=await verifyPackage(root,{expected});
  console.log(JSON.stringify(report,null,2));
}
