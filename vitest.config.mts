import { defineConfig } from 'vitest/config';

// Keep Windows test execution predictable and avoid one Node process per spec.
export default defineConfig({
  test: { pool: 'threads', hookTimeout: 60000, maxWorkers: 1, fileParallelism: false },
});
