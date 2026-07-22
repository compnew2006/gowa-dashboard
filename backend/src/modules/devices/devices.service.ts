import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { devices } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'
import { CryptoService } from '../auth/crypto.service'
import type { RegisterDeviceDto } from './dto/register-device.dto'

export interface DevicePublic {
  id: string
  deviceId: string
  name: string
  status: string
  basicAuthUser: string
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class DevicesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
    private readonly crypto: CryptoService,
  ) {}

  async list(workspaceId: string): Promise<DevicePublic[]> {
    const rows = await this.db
      .select()
      .from(devices)
      .where(eq(devices.workspaceId, workspaceId))
    return rows.map(this.toPublic)
  }

  async register(workspaceId: string, dto: RegisterDeviceDto): Promise<DevicePublic> {
    const existing = await this.db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.deviceId, dto.deviceId), eq(devices.workspaceId, workspaceId)))
      .limit(1)
    if (existing.length > 0) {
      throw new ConflictException(`Device "${dto.deviceId}" already registered in this workspace.`)
    }

    const enc = this.crypto.encrypt(dto.basicAuthPassword)
    const [row] = await this.db
      .insert(devices)
      .values({
        workspaceId,
        deviceId: dto.deviceId,
        name: dto.name,
        status: dto.status ?? 'CONNECTED',
        basicAuthUser: dto.basicAuthUser,
        encCiphertext: enc.ciphertext,
        encIv: enc.iv,
        encTag: enc.tag,
        encKeyId: enc.keyId,
      })
      .returning()
    if (!row) throw new Error('Device insert returned no row.')
    return this.toPublic(row)
  }

  async remove(workspaceId: string, deviceId: string): Promise<void> {
    const result = await this.db
      .delete(devices)
      .where(and(eq(devices.deviceId, deviceId), eq(devices.workspaceId, workspaceId)))
      .returning({ id: devices.id })
    if (result.length === 0) {
      throw new NotFoundException(`Device "${deviceId}" not found in this workspace.`)
    }
  }

  /**
   * Resolve + decrypt the gowa Basic Auth credentials for the device the
   * caller selected (via X-Device-Id). Used by the proxy controller.
   */
  async resolveCredentials(
    workspaceId: string,
    deviceId: string,
  ): Promise<{ basicAuthUser: string; basicAuthPassword: string; deviceRecordId: string }> {
    const [row] = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.deviceId, deviceId), eq(devices.workspaceId, workspaceId)))
      .limit(1)
    if (!row) {
      throw new NotFoundException(
        `Device "${deviceId}" not registered in this workspace. Register it via POST /devices.`,
      )
    }
    const password = this.crypto.decrypt(row.encCiphertext, row.encIv, row.encTag)
    return { basicAuthUser: row.basicAuthUser, basicAuthPassword: password, deviceRecordId: row.id }
  }

  private toPublic(row: typeof devices.$inferSelect): DevicePublic {
    return {
      id: row.id,
      deviceId: row.deviceId,
      name: row.name,
      status: row.status,
      basicAuthUser: row.basicAuthUser,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
