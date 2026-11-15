import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Solo con `--coverage` (la CI): lcov para el umbral de quality.config.json y resumen en el log.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
