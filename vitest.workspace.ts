import { defineWorkspace } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': path.resolve(__dirname, './src'),
  '@electron': path.resolve(__dirname, './electron'),
};

export default defineWorkspace([
  {
    resolve: { alias },
    test: {
      name: 'node',
      include: [
        'tests/unit/electron/**/*.test.ts',
        'tests/integration/**/*.test.ts',
      ],
      environment: 'node',
      setupFiles: ['tests/setup/node-setup.ts'],
      globals: true,
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'browser',
      include: ['tests/unit/src/**/*.test.ts'],
      environment: 'happy-dom',
      setupFiles: ['tests/setup/browser-setup.ts'],
      globals: true,
    },
  },
]);
