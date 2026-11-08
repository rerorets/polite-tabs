import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, 'src');
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
  description: string;
};

// Emits manifest.json with the version and description taken from package.json,
// so the two never drift apart.
const manifest = (): Plugin => ({
  name: 'polite-tabs-manifest',
  generateBundle() {
    const source = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as object;
    this.emitFile({
      type: 'asset',
      fileName: 'manifest.json',
      source: JSON.stringify({ ...source, version: pkg.version, description: pkg.description }, null, 2),
    });
  },
});

export default defineConfig({
  root,
  publicDir: resolve(root, 'public'),
  plugins: [react(), manifest()],
  build: {
    outDir: resolve(import.meta.dirname, 'build'),
    emptyOutDir: true,
    target: 'chrome120',
    rolldownOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        options: resolve(root, 'options.html'),
        background: resolve(root, 'background/index.ts'),
      },
      output: {
        // The service worker path is fixed in manifest.json, so it must not be hashed.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.test.ts'],
  },
});
