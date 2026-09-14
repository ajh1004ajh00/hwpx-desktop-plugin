import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPackage } from '../scripts/verify-package.mjs';

test('package inspection rejects missing assets, mixed versions, unexpected documents and changed bytes',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const baseline=await verifyPackage(root);
  assert.ok(baseline.files.some(item=>item.path==='desktop/node_modules/@rhwp/core/package.json'));
  const temp=await mkdtemp(join(tmpdir(),'hangulmate-package-'));
  try {
    // A small fixture tree retains real metadata; large assets need no engine execution here.
    for(const item of baseline.files) {
      await mkdir(dirname(join(temp,item.path)),{recursive:true});
      await writeFile(join(temp,item.path),item.path.endsWith('.json') ? await readFile(join(root,item.path)) : 'fixture');
    }
    const expected=await verifyPackage(temp);
    const asset=join(temp,'desktop/studio.mjs');
    await rm(asset);
    await assert.rejects(verifyPackage(temp),{code:'ENOENT'});
    await writeFile(asset,'changed fixture');
    await assert.rejects(verifyPackage(temp,{expected}),/PACKAGE_INTEGRITY_MISMATCH/);
    await writeFile(asset,'fixture');
    const pkg=join(temp,'package.json'),original=await readFile(pkg,'utf8');
    await writeFile(pkg,JSON.stringify({...JSON.parse(original),version:'99.0.0'}));
    await assert.rejects(verifyPackage(temp),/PACKAGE_METADATA_MISMATCH/);
    await writeFile(pkg,original);
    await writeFile(join(temp,'desktop/.runtime/studio/private.hwpx'),'synthetic');
    await assert.rejects(verifyPackage(temp),/PACKAGE_PRIVATE_FILE/);
  } finally {
    assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep));
    await rm(temp,{recursive:true,force:true});
  }
});
