import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

const buildRoot = process.env.L2D_DESKTOP_BUILD_ROOT;

export default defineConfig({
  ...(buildRoot ? { build: { outDir: path.resolve(buildRoot, 'dist') } } : {}),
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            ...(buildRoot ? { outDir: path.resolve(buildRoot, 'dist-electron') } : {}),
            rollupOptions: {
              external: ['@napi-rs/canvas', '@l2d/mcp-server/websocket'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            ...(buildRoot ? { outDir: path.resolve(buildRoot, 'dist-electron') } : {}),
            rollupOptions: {
              output: { format: 'cjs', entryFileNames: 'preload.cjs' },
            },
          },
        },
      },
    }),
  ],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
