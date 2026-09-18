import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, rm, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep, dirname} from 'node:path';
import {execFileSync} from 'node:child_process';

test('Sites archive includes license notices and only the visitor bundle, with matching extracted bytes', async () => {
  const root=resolve(import.meta.dirname,'..');
  const temp=await mkdtemp(join(tmpdir(),'hangulmate-sites-package-'));
  try {
    // Run the real CLI in an isolated source tree so npm test cannot overwrite a release archive.
    const source=join(temp,'source');
    for(const name of ['scripts/package-sites-plugin.mjs','.codex-plugin/plugin.json','skills/hwpx-desktop/SKILL.md','docs/SITES-QUICKSTART.md','LICENSE','THIRD_PARTY_NOTICES.md','docs/DATA-POLICY.md','docs/PRIVACY.md','docs/TERMS.md','docs/SUPPORT.md','assets/logo.png']) {
      await mkdir(dirname(join(source,name)),{recursive:true});
      await copyFile(join(root,name),join(source,name));
    }
    const destination=join(temp,'hwpx-desktop-plugin');
    execFileSync(process.execPath,[join(source,'scripts/package-sites-plugin.mjs'),destination],{cwd:source,windowsHide:true});
    const report=JSON.parse(await readFile(join(source,'test-results/sites-plugin.json'),'utf8'));
    const extracted=join(temp,'extracted'); await mkdir(extracted);
    execFileSync('tar',['-xf',report.archive,'-C',extracted],{windowsHide:true});
    const files=[];
    async function walk(dir,prefix='') {
      for(const entry of await readdir(dir,{withFileTypes:true})) {
        const name=prefix+entry.name;
        if(entry.isDirectory()) await walk(join(dir,entry.name),name+'/');
        else files.push(name);
      }
    }
    await walk(extracted);
    assert.deepEqual(files.sort(),['.codex-plugin/plugin.json','LICENSE','README.md','THIRD_PARTY_NOTICES.md','docs/DATA-POLICY.md','docs/PRIVACY.md','docs/TERMS.md','docs/SUPPORT.md','docs/SITES-QUICKSTART.md','assets/logo.png','skills/hwpx-desktop/SKILL.md'].sort());
    for(const name of files) assert.deepEqual(await readFile(join(extracted,name)),await readFile(join(destination,name)));
  } finally {
    assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep));
    await rm(temp,{recursive:true,force:true});
  }
});
