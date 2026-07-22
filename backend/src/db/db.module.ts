import { Global, Module, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * The connection token every service injects.
 *
 * - `DRIZZLE_DB` (Symbol): used by services that explicitly `@Inject(DRIZZLE_DB)`.
 * - The bare `PostgresJsDatabase` class: used by the original scaffold services
 *   that inject via the TypeScript type only (`private readonly db: PostgresJsDatabase<any>`)
 *   with no `@Inject()` decorator. Nest's reflect-metadata captures the class
 *   function as the token, so we bind it directly.
 *
 * Both tokens resolve to the same drizzle instance.
 */
export const DRIZZLE_DB = Symbol('DRIZZLE_DB')

export type DrizzleDb = PostgresJsDatabase<typeof schema>

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DrizzleDb => {
        const url = config.get<string>('DATABASE_URL')
        if (!url) {
          throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env.')
        }
        const client = postgres(url, {
          max: 10,
          prepare: false,
          onnotice: () => {},
        })
        const db = drizzle(client, { schema })
        new Logger('DrizzleModule').log(`Connected to Postgres (${new URL(url).host})`)
        return db
      },
    },
    {
      // Bind the same instance under the bare-type token so services that
      // declare `private readonly db: PostgresJsDatabase<any>` resolve.
      provide: PostgresJsDatabase,
      inject: [DRIZZLE_DB],
      useFactory: (db: DrizzleDb) => db,
    },
  ],
  exports: [DRIZZLE_DB, PostgresJsDatabase],
})
export class DrizzleModule implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleModule.name)
  constructor() {}
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Drizzle pool closing on shutdown.')
  }
}
