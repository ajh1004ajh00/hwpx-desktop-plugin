import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';

test('reviewed build lock patch applies to pinned upstream and can be detected on repeat setup',async()=>{
  const root=resolve(import.meta.dirname,'..');
  const source=join(root,'desktop/.runtime/rhwp');
  const patch=join(root,'scripts/patches/studio-build-lock.patch');
  const temp=await mkdtemp(join(tmpdir(),'hangulmate-build-lock-'));
  try {
    const original=execFileSync('git',['show','e8800c8def63449808a4092798442652ed460552:rhwp-studio/package-lock.json'],{cwd:source,windowsHide:true});
    await mkdir(join(temp,'rhwp-studio'));
    await writeFile(join(temp,'rhwp-studio/package-lock.json'),original);
    execFileSync('git',['apply','--no-index',patch],{cwd:temp,windowsHide:true});
    execFileSync('git',['apply','--no-index','--reverse','--check',patch],{cwd:temp,windowsHide:true});
    assert.throws(()=>execFileSync('git',['apply','--no-index','--check',patch],{cwd:temp,windowsHide:true,stdio:'pipe'}));
    const before=JSON.parse(original),after=JSON.parse(await readFile(join(temp,'rhwp-studio/package-lock.json'),'utf8'));
    assert.deepEqual(after.packages[''],before.packages['']);
    for(const [name,value] of Object.entries(before.packages)) if(name && !value.dev) assert.deepEqual(after.packages[name],value,`runtime dependency changed: ${name}`);
    for(const name of ['@babel/core','baseline-browser-mapping','brace-expansion','browserslist','fast-uri']) assert.notEqual(after.packages['node_modules/'+name].version,before.packages['node_modules/'+name].version);
  } finally {
    assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep));
    await rm(temp,{recursive:true,force:true});
  }
});
