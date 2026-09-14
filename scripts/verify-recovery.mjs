import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cwd=resolve(import.meta.dirname,'../desktop/.runtime/rhwp/rhwp-studio');
const result=spawnSync(process.execPath,['--test',...['autosave-store','autosave-manager','recovery-ui','save-target','save-document-format'].map(name=>`tests/${name}.test.ts`)],{cwd,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
