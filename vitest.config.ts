import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'electron/db/queries/**/*.ts',
        'electron/services/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: ['electron/ipc/**', 'electron/main.ts', '**/*.d.ts'],
    },
  },
});
