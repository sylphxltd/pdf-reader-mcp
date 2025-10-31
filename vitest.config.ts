import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest configuration options go here
    globals: true, // Optional: Use Vitest globals like describe, it, expect
    environment: 'node', // Specify the test environment
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html', 'lcov'], // Add lcov for badges/external tools
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'], // Only include files in src
      exclude: [
        // Exclude index/types or other non-testable files if needed
        'src/index.ts',
        'src/handlers/index.ts', // Usually just exports
        'src/types/**/*.ts', // Type-only files have no executable code
        '**/*.d.ts',
      ],
      thresholds: {
        // High coverage thresholds after refactoring and image extraction
        lines: 98,
        functions: 100,
        branches: 92,
        statements: 98,
      },
    },
  },
});
