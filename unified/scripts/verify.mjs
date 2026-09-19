// Read-only connection check. Mutates nothing, installs nothing.
//   node ./scripts/verify.mjs
// Exit 0 = wired (or wiring possible); exit 2 = missing local checkouts.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  UNIFIED_DIR, DSH_DIR, OD_DIR, AWESOME_DIR, AWESOME_DATA_DIR,
  BRIDGE_PKG_DIR, BRIDGE_PATCH, OD_DSH_DEF,
  dshHome, dshBin, dshProfile, exists,
} from './paths.mjs';

let failures = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const bad = (msg) => { failures++; console.log(`  FAIL ${msg}`); };

console.log('unified/verify');
console.log(`  node     ${process.version} (need >=24)`);
if (Number(process.version.slice(1).split('.')[0]) < 24) bad('node < 24');
else ok('node version');

for (const [label, p] of [
  ['unified/', UNIFIED_DIR],
  ['dsh/', DSH_DIR],
  ['open-design/', OD_DIR],
  ['awesome-catalog/', AWESOME_DIR],
  ['awesome data/plugins/', AWESOME_DATA_DIR],
  ['bridge pkg/', BRIDGE_PKG_DIR],
  ['bridge cordis.patch.yml', BRIDGE_PATCH],
  ['OD deepseek-harness def', OD_DSH_DEF],
]) {
  if (exists(p)) ok(`${label} -> ${p}`);
  else bad(`missing ${label} (expected ${p})`);
}

if (exists(AWESOME_DATA_DIR)) {
  const n = fs.readdirSync(AWESOME_DATA_DIR).filter((f) => f.endsWith('.yml')).length;
  ok(`awesome descriptors: ${n} *.yml`);
  const sample = path.join(AWESOME_DATA_DIR, '00080000__dsh-project-memory.yml');
  if (exists(sample)) {
    const txt = fs.readFileSync(sample, 'utf8');
    const m = txt.match(/tarball:\s*(\S+)/);
    ok(`sample plugin tarball: ${m ? m[1].slice(0, 80) + '…' : '(no tarball line)'}`);
  }
}

const HOME = dshHome();
console.log(`  DSH_HOME=${HOME}`);
console.log(`  DSH_BIN=${dshBin()}  PROFILE=${dshProfile()}`);
if (!exists(HOME)) console.log('  note   DSH_HOME does not exist yet — setup-bridge will create it');

const parts = dshBin().match(/(?:[^\s"]+|"[^"]*")+/g) ?? [dshBin()];
const exe = parts[0].replace(/^"|"$/g, '');
const baseArgs = parts.slice(1).map((s) => s.replace(/^"|"$/g, ''));
const probe = spawnSync(exe, [...baseArgs, '--profile', dshProfile(), '--probe'], {
  encoding: 'utf8', shell: process.platform === 'win32',
  env: { ...process.env, DSH_HOME: HOME },
});
if (probe.error) {
  console.log(`  note   dsh not runnable yet (${probe.error.message}) — install/build first`);
} else if (probe.status === 0) {
  try {
    const last = (probe.stdout.trim().split('\n').pop() ?? '');
    const j = JSON.parse(last);
    ok(`dsh --probe OK (keys: ${Object.keys(j).slice(0, 6).join(',')})`);
  } catch {
    bad('dsh --probe ran but output was not JSON — bridge may be uninstalled');
  }
} else {
  console.log(`  note   dsh --probe not green yet (status ${probe.status}). Run setup:bridge after install/build.`);
  console.log('  ' + ((probe.stdout ?? '') + (probe.stderr ?? '')).trim().split('\n').slice(0, 8).join('\n  '));
}

if (failures > 0) {
  console.log(`\nverify: ${failures} hard failure(s) — fix paths above.`);
  process.exit(2);
}
console.log('\nverify: local wiring possible. Next: npm run setup:bridge');
