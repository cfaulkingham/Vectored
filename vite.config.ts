import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    clearScreen: false,
    server: {
        port: 3000,
        strictPort: true,
        host: host || '127.0.0.1',
        hmr: host ? { protocol: 'ws', host, port: 3001 } : undefined,
        watch: { ignored: ['**/src-tauri/**'] },
    },
    plugins: [react()],
    build: {
        target: ['es2021', 'safari14'],
    },
    resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // The editor uses geometry only. PaperScript's compiler requires eval,
          // which is intentionally unavailable under the desktop CSP.
          'paper': path.resolve(__dirname, 'node_modules/paper/dist/paper-core.js'),
        }
    }
});
