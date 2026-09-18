import {mkdir,readFile,writeFile,copyFile,mkdtemp} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const destination=resolve(process.argv[2]??'');
if(!process.argv[2]||basename(destination)!=='hwpx-desktop-plugin'||destination===root)throw Error('Supply a separate hwpx-desktop-plugin output directory');
const files={'.codex-plugin/plugin.json':'.codex-plugin/plugin.json','skills/hwpx-desktop/SKILL.md':'skills/hwpx-desktop/SKILL.md','README.md':'docs/SITES-QUICKSTART.md','LICENSE':'LICENSE','THIRD_PARTY_NOTICES.md':'THIRD_PARTY_NOTICES.md','docs/DATA-POLICY.md':'docs/DATA-POLICY.md'};
const inventory=[];
for(const [name,source] of Object.entries(files)){
  const bytes=await readFile(resolve(root,source));await mkdir(dirname(resolve(destination,name)),{recursive:true});await copyFile(resolve(root,source),resolve(destination,name));
  inventory.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const output=resolve(root,'test-results');await mkdir(output,{recursive:true});
const archive=resolve(output,'hangulmate-sites-plugin.zip');
execFileSync('tar',['-a','-cf',archive,'-C',destination,...Object.keys(files)]);
const extracted=await mkdtemp(resolve(output,'sites-fresh-'));
execFileSync('tar',['-xf',archive,'-C',extracted]);
for(const f of inventory){const bytes=await readFile(resolve(extracted,f.path));if(createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Hash mismatch '+f.path);}
const version=JSON.parse(await readFile(resolve(destination,'.codex-plugin/plugin.json'),'utf8')).version;
const report={version,destination,archive,extracted,files:inventory,archiveSha256:createHash('sha256').update(await readFile(archive)).digest('hex')};
await writeFile(resolve(output,'sites-plugin.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
