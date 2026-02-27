/**
 * pnpm v10 places electron-rebuild output in node_modules/.ignored/ instead
 * of the real pnpm store path. This script copies the Electron-ABI binary
 * back to where Electron actually loads it from.
 *
 * Runs as part of postinstall: electron-rebuild && node scripts/fix-pnpm-sqlite.mjs
 */

import { existsSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ignoredDir = join(root, 'node_modules', '.ignored', 'better-sqlite3', 'build', 'Release');
const src = join(ignoredDir, 'better_sqlite3.node');

if (!existsSync(src)) {
  console.log('[fix-pnpm-sqlite] No ignored binary found — nothing to fix.');
  process.exit(0);
}

// Find the pnpm store path for better-sqlite3
const pnpmDir = join(root, 'node_modules', '.pnpm');
let dest = null;

for (const entry of readdirSync(pnpmDir)) {
  if (entry.startsWith('better-sqlite3@')) {
    const candidate = join(pnpmDir, entry, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    dest = candidate;
    break;
  }
}

if (!dest) {
  console.warn('[fix-pnpm-sqlite] Could not locate pnpm store path for better-sqlite3.');
  process.exit(0);
}

copyFileSync(src, dest);
console.log(`[fix-pnpm-sqlite] Copied Electron-ABI binary:\n  ${src}\n→ ${dest}`);
