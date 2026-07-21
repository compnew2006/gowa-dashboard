import * as fs from 'fs'
import * as path from 'path'

export async function applyRlsPolicies(pgClient: any) {
  const rlsSqlPath = path.join(process.cwd(), 'backend', 'src', 'db', 'rls.sql')
  if (fs.existsSync(rlsSqlPath)) {
    console.log('Applying PostgreSQL Row-Level Security Policies and Audit Triggers...')
    const rlsSql = fs.readFileSync(rlsSqlPath, 'utf-8')
    await pgClient.query(rlsSql)
    console.log('Successfully applied RLS Policies and Audit Triggers.')
  } else {
    console.warn(`RLS SQL script not found at ${rlsSqlPath}`)
  }
}

export async function runMigrationsAndSetup(dbClient: any, drizzleMigrateFn?: Function) {
  console.log('Starting Automated Database Migration & Policy Runner...')
  if (drizzleMigrateFn) {
    await drizzleMigrateFn()
    console.log('Drizzle migrations completed.')
  }
  await applyRlsPolicies(dbClient)
  console.log('Migration & Policy Runner Finished successfully.')
}
