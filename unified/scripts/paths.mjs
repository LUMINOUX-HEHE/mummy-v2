// Single source of truth for unified/ locations.
// No third-party deps. ESM only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const UNIFIED_DIR = path.resolve(here, '..');
// Outer folder is the download root that also contains the three projects.
export const OUTER_ROOT = path.resolve(UNIFIED_DIR, '..');

export const DSH_DIR = path.join(OUTER_ROOT, 'deepseek-harness-master');
export const OD_DIR = path.join(OUTER_ROOT, 'open-design-main');
export const AWESOME_DIR = path.join(OUTER_ROOT, 'awesome-dsh-plugin-main');
export const AWESOME_DATA_DIR = path.join(AWESOME_DIR, 'data', 'plugins');

export const BRIDGE_PKG_DIR = path.join(OD_DIR, 'packages', 'dsh-runtime');
export const BRIDGE_PATCH = path.join(BRIDGE_PKG_DIR, 'cordis.patch.yml');
export const OD_DSH_DEF = path.join(
  OD_DIR, 'apps', 'daemon', 'src', 'runtimes', 'defs', 'deepseek-harness.ts'
);

// Shared isolated Harness home. Both DSH CLI and OD daemon must see the same value.
// OD resolves <DSH_HOME>/profiles/open-design (see resolveOpenDesignProfileDir).
export const DEFAULT_DSH_HOME = path.join(UNIFIED_DIR, '.dsh-home');

export function env(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function dshHome() {
  return path.resolve(env('DSH_HOME', DEFAULT_DSH_HOME));
}

export function dshBin() {
  return env('DSH_BIN', 'dsh');
}

export function dshProfile() {
  return env('DSH_PROFILE', 'open-design');
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}
