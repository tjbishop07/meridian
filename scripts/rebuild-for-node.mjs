/**
 * Rebuilds better-sqlite3 for the system Node.js ABI so Vitest tests can run.
 * After tests, fix-pnpm-sqlite.mjs restores the Electron-ABI binary.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Find the pnpm store path for better-sqlite3
const pnpmDir = join(root, 'node_modules', '.pnpm');
let sqliteDir = null;

for (const entry of readdirSync(pnpmDir)) {
  if (entry.startsWith('better-sqlite3@')) {
    sqliteDir = join(pnpmDir, entry, 'node_modules', 'better-sqlite3');
    break;
  }
}

if (!sqliteDir || !existsSync(sqliteDir)) {
  console.error('[rebuild-for-node] Could not locate better-sqlite3 in pnpm store.');
  process.exit(1);
}

console.log('[rebuild-for-node] Rebuilding better-sqlite3 for system Node.js...');
execSync('npx node-gyp rebuild', { cwd: sqliteDir, stdio: 'inherit' });
console.log('[rebuild-for-node] Done.');
