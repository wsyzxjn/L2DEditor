import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

const buildRoot = process.env.L2D_DESKTOP_BUILD_ROOT;

// Split large UI libraries out of the renderer entry chunk. PixiJS is left to
// Rollup so its renderer backends stay lazily loaded chunks.
const vendorChunk = (id: string) => {
  const match = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(dockview[^/]*|react-dom|react|scheduler|cmdk|lucide-react)\//.exec(id);
  if (!match) return undefined;
  const name = match[1];
  if (name.startsWith('dockview')) return 'dockview';
  if (name === 'react' || name === 'react-dom' || name === 'scheduler') return 'react';
  return 'ui-vendor';
};

export default defineConfig({
  build: {
    ...(buildRoot ? { outDir: path.resolve(buildRoot, 'dist') } : {}),
    rollupOptions: { output: { manualChunks: vendorChunk } },
  },
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
