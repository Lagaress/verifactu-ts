import { defineConfig } from 'vitest/config';

// Tests contra el entorno de pruebas de la AEAT. Requieren certificado:
//   VERIFACTU_IT_PFX=/ruta/cert.p12 VERIFACTU_IT_PASS=... npm run test:integration
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 60_000,
    passWithNoTests: true,
  },
});
