import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Load .env before tests boot NestJS.
    setupFiles: ['./test/setup.ts'],
    // Integration tests boot the real NestJS app against a real Postgres + Redis.
    // Long timeouts because the first test pays the bootstrap cost.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Sequential — the suite shares the DB; parallel runs would race on JWTs.
    fileParallelism: false,
    pool: 'forks',
    globals: false,
    include: ['test/**/*.e2e.ts'],
  },
})
