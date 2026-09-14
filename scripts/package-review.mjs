import {mkdtemp,mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyPackage} from './verify-package.mjs';

const root=resolve(import.meta.dirname,'..'),output=resolve(root,'test-results');
await mkdir(output,{recursive:true});
const stage=await mkdtemp(resolve(output,'review-package-'));
const baseline=await verifyPackage(root);
for(const file of baseline.files) {
  const destination=resolve(stage,file.path);await mkdir(dirname(destination),{recursive:true});
  await copyFile(resolve(root,file.path),destination);
}
await verifyPackage(stage,{expected:baseline});
const archive=stage+'.zip';
execFileSync('tar',['-a','-cf',archive,'-C',stage,'.']);
const check=await mkdtemp(resolve(output,'review-extracted-'));
execFileSync('tar',['-xf',archive,'-C',check]);
await verifyPackage(check,{expected:baseline});
const bytes=await readFile(archive);
const report={status:'review-candidate-not-submitted',archive,extracted:check,version:baseline.version,files:baseline.files.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),inventory:baseline};
await writeFile(resolve(output,'review-package.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({archive,extracted:check,files:report.files,bytes:report.bytes,sha256:report.sha256},null,2));
