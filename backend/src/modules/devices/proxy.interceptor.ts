import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler, 
  UnauthorizedException, 
  BadRequestException 
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { devices } from '../../db/schema';
import { CryptoService } from '../auth/crypto.service';

@Injectable()
export class ProxyInterceptor implements NestInterceptor {
  constructor(
    private readonly db: PostgresJsDatabase<any>,
    private readonly cryptoService: CryptoService
  ) {}

  /**
   * Intercepts standard outgoing requests aimed at the gowa backend.
   * Dynamically appends decapped Basic Auth credentials and verifies device ownership.
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Extract workspace reference bound by WorkspaceGuard
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException('Request must be scoped within a valid workspace context.');
    }

    // Extract targeting device ID
    const deviceId = request.headers['x-device-id'] || request.query['device_id'];
    if (!deviceId) {
      throw new BadRequestException('Targeting device header (X-Device-Id) is required.');
    }

    // Lookup device config
    const [deviceRecord] = await this.db
      .select()
      .from(devices)
      .where(and(
        eq(devices.deviceId, deviceId),
        eq(devices.workspaceId, workspaceId)
      ));

    if (!deviceRecord) {
      throw new UnauthorizedException('Device access unauthorized or does not exist inside workspace context.');
    }

    // Decrypt credentials
    const decryptedPassword = this.cryptoService.decrypt(
      deviceRecord.encCiphertext,
      deviceRecord.encIv,
      deviceRecord.encTag
    );

    // Build authorization credentials
    const authString = `${deviceRecord.basicAuthUser}:${decryptedPassword}`;
    const encodedCredentials = Buffer.from(authString).toString('base64');

    // Attach credentials dynamically to outgoing proxy context
    request.proxyHeaders = {
      ...request.headers,
      'Authorization': `Basic ${encodedCredentials}`,
      'X-Device-Id': deviceRecord.deviceId
    };

    return next.handle();
  }
}
