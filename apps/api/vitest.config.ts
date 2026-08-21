import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'mysql://root:proofdesk@localhost:3306/proof_desk_test',
      SESSION_SECRET: 'test-secret',
      RATE_LIMIT_MAX: '10000',
      LOG_LEVEL: 'silent',
    },
    globalSetup: ['./test/globalSetup.ts'],
    // Tests share one MySQL database and truncate tables — never run files in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
