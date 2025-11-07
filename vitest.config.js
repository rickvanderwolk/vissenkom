import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.js', 'server.js'],
      exclude: [
        'node_modules/',
        'tests/',
        'js/vissenkom.js',  // Client-side code - would need browser testing
        'js/controller.js'  // Client-side code - would need browser testing
      ],
      // Coverage thresholds - enforce quality standards
      thresholds: {
        lines: 50,      // At least 50% of lines covered
        functions: 50,  // At least 50% of functions covered
        branches: 40,   // At least 40% of branches covered
        statements: 50  // At least 50% of statements covered
      }
    }
  }
});
