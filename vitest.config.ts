import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Los ejemplos importan el paquete por su nombre, como lo haría un integrador.
    alias: [
      { find: /^verifactu-ts$/, replacement: src('index.ts') },
      { find: /^verifactu-ts\/client$/, replacement: src('client/index.ts') },
      { find: /^verifactu-ts\/transport\/node$/, replacement: src('client/transports/node.ts') },
      { find: /^verifactu-ts\/qr\/render$/, replacement: src('qr/render/index.ts') },
      { find: /^verifactu-ts\/testing$/, replacement: src('testing/index.ts') },
      { find: /^verifactu-ts\/errors$/, replacement: src('errors.ts') },
      { find: /^verifactu-ts\/no-verifactu$/, replacement: src('no-verifactu.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/generated/**'],
    },
  },
});
