// Build OD's dsh-runtime bridge and install it into the LOCAL DSH's
// `open-design` profile. Local equivalent of `od agent setup deepseek-harness`
// but pinned to your sibling checkout instead of npm latest.
//
//   node ./scripts/setup-bridge.mjs [--skip-build] [--skip-pack]
//
// Env: DSH_HOME (default unified/.dsh-home), DSH_BIN (default "dsh"), DSH_PROFILE.
// No third-party deps.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  OD_DIR, DSH_DIR, BRIDGE_PKG_DIR,
  dshHome, dshBin, dshProfile, exists,
} from './paths.mjs';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) {
    const pretty = `${cmd} ${args.join(' ')}`;
    throw new Error(`command failed (${r.status}): ${pretty}`);
  }
  return r;
}

function runCapture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });
  return r;
}

const skipBuild = process.argv.includes('--skip-build');
const skipPack = process.argv.includes('--skip-pack');
const HOME = dshHome();
const BIN = dshBin();
const PROFILE = dshProfile();

if (!exists(DSH_DIR)) throw new Error(`missing DSH dir: ${DSH_DIR}`);
if (!exists(OD_DIR)) throw new Error(`missing OD dir: ${OD_DIR}`);
if (!exists(BRIDGE_PKG_DIR)) throw new Error(`missing bridge pkg: ${BRIDGE_PKG_DIR}`);
fs.mkdirSync(HOME, { recursive: true });

console.log(`[setup-bridge] DSH_DIR   = ${DSH_DIR}`);
console.log(`[setup-bridge] OD_DIR    = ${OD_DIR}`);
console.log(`[setup-bridge] DSH_HOME  = ${HOME}`);
console.log(`[setup-bridge] DSH_BIN   = ${BIN}`);
console.log(`[setup-bridge] PROFILE   = ${PROFILE}`);

if (!skipBuild) {
  console.log('[setup-bridge] 1/4 building @open-design/dsh-runtime …');
  run('pnpm', ['--dir', OD_DIR, '--filter', '@open-design/dsh-runtime', 'run', 'build']);
} else {
  console.log('[setup-bridge] 1/4 build skipped');
}

console.log('[setup-bridge] 2/4 packing bridge …');
let tgz = '';
if (!skipPack) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'od-bridge-'));
  run('pnpm', ['-C', BRIDGE_PKG_DIR, 'pack', '--pack-destination', tmp]);
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.tgz'));
  if (files.length === 0) throw new Error(`pack produced no tgz in ${tmp}`);
  tgz = path.join(tmp, files[0]);
  console.log(`[setup-bridge] packed: ${tgz}`);
} else {
  console.log('[setup-bridge] 2/4 pack skipped (set tgz manually if needed)');
}

if (tgz) {
  console.log(`[setup-bridge] 3/4 installing into DSH profile "${PROFILE}" …`);
  // BIN may itself be a compound command ("pnpm --dir ... exec dsh"); split naively on spaces
  // unless user gave a direct executable path.
  const parts = BIN.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [BIN];
  const exe = parts[0].replace(/^"|"$/g, '');
  const baseArgs = parts.slice(1).map((s) => s.replace(/^"|"$/g, ''));
  run(exe, [...baseArgs, 'plugin', '--profile', PROFILE, 'add', tgz], {
    env: { ...process.env, DSH_HOME: HOME },
  });
} else {
  console.log('[setup-bridge] 3/4 install skipped');
}

console.log('[setup-bridge] 4/4 verifying --probe …');
{
  const parts = BIN.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [BIN];
  const exe = parts[0].replace(/^"|"$/g, '');
  const baseArgs = parts.slice(1).map((s) => s.replace(/^"|"$/g, ''));
  const r = runCapture(exe, [...baseArgs, '--profile', PROFILE, '--probe'], {
    env: { ...process.env, DSH_HOME: HOME },
  });
  const out = ((r.stdout ?? '') + (r.stderr ?? '')).trim();
  console.log(out.split('\n').slice(0, 20).join('\n'));
  if (r.status !== 0) {
    throw new Error(
      `--probe failed (status ${r.status}). If the profile is missing, run without --skip-build/--skip-pack once.`
    );
  }
  try {
    JSON.parse(r.stdout.trim().split('\n').pop());
    console.log('[setup-bridge] probe JSON OK');
  } catch {
    console.log('[setup-bridge] WARNING: probe output did not end with a JSON object — see above.');
  }
}

console.log('[setup-bridge] done. Next: node ./scripts/verify.mjs');
