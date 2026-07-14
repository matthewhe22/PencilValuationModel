import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@pencil/engine': fileURLToPath(
        new URL('../../packages/engine/src/index.ts', import.meta.url),
      ),
    },
  },
});
