
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      '.replit.dev',
      '.repl.co'
    ]
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'client/index': resolve(__dirname, 'src/client/index.tsx'),
        'server/index': resolve(__dirname, 'src/server/index.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'sharp', 'fs', 'crypto', 'server-only'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js'
      }
    }
  }
});
