import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: [
                                'better-sqlite3',
                                'puppeteer-core',
                                'bufferutil',
                                'utf-8-validate',
                                'sharp',
                                'node-cron',
                                'electron-updater'
                            ]
                        }
                    }
                }
            },
            preload: {
                input: 'electron/preload.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            output: {
                                format: 'cjs',
                                entryFileNames: 'preload.cjs'
                            }
                        }
                    }
                }
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@electron': path.resolve(__dirname, './electron')
        }
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            }
        }
    },
    publicDir: 'public'
});
