import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Used by `npx drizzle-kit generate` / `push`. The runtime app uses
// `src/db/db.module.ts` to create the drizzle instance directly.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
