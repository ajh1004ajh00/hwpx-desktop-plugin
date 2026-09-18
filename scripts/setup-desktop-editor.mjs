import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 이상이 필요합니다.');
const source = resolve(root, 'desktop/.runtime/rhwp');
const revision = 'e8800c8def63449808a4092798442652ed460552';
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm', windowsHide: true });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed: ${result.status}`);
}
try { await access(resolve(source, '.git')); } catch {
  run('git', ['clone', '--filter=blob:none', '--no-checkout', 'https://github.com/edwardkim/rhwp.git', source]);
  run('git', ['sparse-checkout', 'set', 'rhwp-studio', 'rhwp-shared', 'typescript', 'npm', 'assets/fonts'], source);
  run('git', ['checkout', revision], source);
}
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8', windowsHide: true });
if (head.stdout.trim() !== revision) throw new Error('Unexpected Studio revision; refusing to overwrite this checkout.');
// Pin the reviewed build-tool security updates without moving the document engine revision.
const lockPatch=resolve(root,'scripts/patches/studio-build-lock.patch');
const patchCheck=spawnSync('git',['apply','--check',lockPatch],{cwd:source,windowsHide:true});
if(patchCheck.status===0) run('git',['apply',lockPatch],source);
else {
  const applied=spawnSync('git',['apply','--reverse','--check',lockPatch],{cwd:source,windowsHide:true});
  if(applied.status!==0) throw new Error('Unexpected upstream build lock; refusing to replace local changes.');
}
if (!process.argv.includes('--build-only')) {
  run('npm', ['ci', '--ignore-scripts', '--prefix', 'desktop']);
  run('npm', ['ci', '--ignore-scripts'], resolve(source, 'rhwp-studio'));
}
const core = resolve(root, 'desktop/node_modules/@rhwp/core');
if (JSON.parse(await readFile(resolve(core, 'package.json'))).version !== '0.8.6') throw new Error('Studio requires @rhwp/core 0.8.6');
await mkdir(resolve(source, 'pkg'), { recursive: true });
for (const file of ['rhwp.js', 'rhwp_bg.wasm']) {
  await cp(resolve(core, file), resolve(source, 'pkg', file));
  await cp(resolve(core, file), resolve(source, 'rhwp-studio/public', file));
}
// Copy only runtime assets; upstream public/samples contains documents unrelated to this package.
for (const name of ['icons','images','favicon.ico','print.html','theme-init.js','rhwp.js','rhwp_bg.wasm']) {
  await cp(resolve(source,'rhwp-studio/public',name),resolve(root,'desktop/.runtime/public',name),{recursive:true});
}
run(process.execPath, [resolve(source, 'rhwp-studio/node_modules/vite/bin/vite.js'), 'build', '--config', resolve(root, 'desktop/studio-build.config.mjs')]);
const fonts = resolve(root, 'desktop/.runtime/studio/fonts');
try { if ((await stat(fonts)).isFile()) await rm(fonts); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await cp(resolve(source, 'assets/fonts'), fonts, { recursive: true });
await cp(resolve(source, 'LICENSE'), resolve(root, 'desktop/.runtime/studio/LICENSE.txt'));
console.log('Local Studio ready. Run node scripts/start-desktop.mjs');
