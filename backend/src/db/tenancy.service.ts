import { Injectable, Scope } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

@Injectable({ scope: Scope.REQUEST })
export class TenancyService {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  /**
   * Executes a database query inside a transaction with set local variables for RLS context.
   * This guarantees absolute multi-tenant boundary compliance at the database engine level.
   */
  async runWithTenantContext<T>(
    workspaceId: string,
    userId: string | null,
    ipAddress: string = '0.0.0.0',
    userAgent: string = 'system',
    work: (tx: PostgresJsDatabase<any>) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      // Bind tenant workspace scope to PostgreSQL transaction session
      await tx.execute(sql`SET LOCAL app.current_workspace_id = ${workspaceId}`);
      
      // Bind audit log identity attributes if user context is available
      if (userId) {
        await tx.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
      }
      
      await tx.execute(sql`SET LOCAL app.current_ip_address = ${ipAddress}`);
      await tx.execute(sql`SET LOCAL app.current_user_agent = ${userAgent}`);

      // Perform transaction actions
      return await work(tx);
    });
  }
}
