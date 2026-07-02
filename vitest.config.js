import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'extension/tests/**/*.test.js',
      'api/tests/**/*.test.js'
    ],
    coverage: {
      reporter: ['text', 'html'],
      include: ['extension/src/**', 'api/lib/**', 'api/api/**']
    }
  }
});
