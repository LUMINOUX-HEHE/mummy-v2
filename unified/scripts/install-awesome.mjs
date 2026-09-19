// Install ONE Awesome-catalog plugin into a DSH profile.
//   node ./scripts/install-awesome.mjs <plugin-key> [--profile open-design]
// Example:
//   node ./scripts/install-awesome.mjs 00080000__dsh-project-memory
//
// <plugin-key> is the yml basename without .yml, e.g. "author__plugin-name".
// Reads awesome-catalog/data/plugins/<key>.yml, takes `tarball:` (fallback `url:`),
// runs: dsh plugin --profile <profile> add <tarball|url>  with shared DSH_HOME.
// No third-party deps.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AWESOME_DATA_DIR, dshHome, dshBin, dshProfile } from './paths.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const key = args.find((a) => !a.startsWith('--'));
let profile = dshProfile();
const pi = args.indexOf('--profile');
if (pi !== -1 && args[pi + 1]) profile = args[pi + 1];

if (!key) {
  console.error('usage: node ./scripts/install-awesome.mjs <plugin-key> [--profile <name>]');
  console.error('example: node ./scripts/install-awesome.mjs 00080000__dsh-project-memory');
  process.exit(2);
}

const ymlPath = path.join(AWESOME_DATA_DIR, key.endsWith('.yml') ? key : `${key}.yml`);
if (!fs.existsSync(ymlPath)) {
  console.error(`no such descriptor: ${ymlPath}`);
  console.error('list keys with: dir "..\\awesome-dsh-plugin-main\\data\\plugins" (first 20)');
  process.exit(2);
}
const txt = fs.readFileSync(ymlPath, 'utf8');
const tarball = (txt.match(/^\s*tarball:\s*(\S+)/m) || [])[1] || '';
const url = (txt.match(/^\s*url:\s*(\S+)/m) || [])[1] || '';
const target = tarball || url;
if (!target) {
  console.error(`descriptor has neither tarball: nor url:: ${ymlPath}`);
  process.exit(2);
}

console.log(`[plugin:add] key     = ${path.basename(ymlPath, '.yml')}`);
console.log(`[plugin:add] source  = ${target}`);
console.log(`[plugin:add] profile = ${profile}`);
console.log(`[plugin:add] DSH_HOME= ${dshHome()}`);

const parts = dshBin().match(/(?:[^\s"]+|"[^"]*")+/g) ?? [dshBin()];
const exe = parts[0].replace(/^"|"$/g, '');
const baseArgs = parts.slice(1).map((s) => s.replace(/^"|"$/g, ''));
const r = spawnSync(exe, [...baseArgs, 'plugin', '--profile', profile, 'add', target], {
  stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, DSH_HOME: dshHome() },
});
process.exit(r.status ?? 1);
