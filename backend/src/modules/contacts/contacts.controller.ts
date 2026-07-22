import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ContactsService } from './contacts.service'
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto'
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator'
import { WorkspaceGuard } from '../../common/guards/workspace.guard'
import { RequirePermissions } from '../../common/decorators/roles.decorator'
import { DevicesService } from '../devices/devices.service'
import { GowaClientService } from '../devices/gowa-client.service'
import { ConfigService } from '@nestjs/config'

@Controller('contacts')
@UseGuards(WorkspaceGuard)
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name)
  private readonly defaultGowaUser: string
  private readonly defaultGowaPass: string

  constructor(
    private readonly contacts: ContactsService,
    private readonly devices: DevicesService,
    private readonly gowa: GowaClientService,
    config: ConfigService,
  ) {
    // The gowa upstream uses a single shared Basic Auth (admin:admin123) for
    // ALL devices. Per-device credentials live in the vault, but for the bulk
    // sync we use the env-configured default (matches APP_BASIC_AUTH).
    this.defaultGowaUser = config.get<string>('GOWA_BASIC_AUTH_USER') || 'admin'
    this.defaultGowaPass = config.get<string>('GOWA_BASIC_AUTH_PASS') || 'admin123'
  }

  @Get()
  @RequirePermissions('contacts:read', 'contacts:manage')
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const results = await this.contacts.list(user.workspaceId, {
      search: search || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    })
    const total = await this.contacts.count(user.workspaceId)
    return { code: 'ok', message: 'contacts', results, total }
  }

  @Get(':id')
  @RequirePermissions('contacts:read', 'contacts:manage')
  @HttpCode(HttpStatus.OK)
  async get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const contact = await this.contacts.get(user.workspaceId, id)
    return { code: 'ok', message: 'contact', results: contact }
  }

  @Post()
  @RequirePermissions('contacts:write', 'contacts:manage')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateContactDto) {
    const contact = await this.contacts.create(user.workspaceId, dto)
    return { code: 'ok', message: 'contact created', results: contact }
  }

  @Patch(':id')
  @RequirePermissions('contacts:write', 'contacts:manage')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    const contact = await this.contacts.update(user.workspaceId, id, dto)
    return { code: 'ok', message: 'contact updated', results: contact }
  }

  @Delete(':id')
  @RequirePermissions('contacts:manage')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.contacts.remove(user.workspaceId, id)
    return { code: 'ok', message: 'contact removed', results: null }
  }

  /**
   * Sync contacts from a SINGLE registered device into the CRM table.
   * Body: `{ deviceId: string }` (the gowa device_id, e.g. "egypt").
   * Uses the device's vault credentials to authenticate against gowa.
   */
  @Post('sync-from-gowa')
  @RequirePermissions('contacts:write', 'contacts:manage')
  @HttpCode(HttpStatus.OK)
  async syncFromGowa(
    @CurrentUser() user: JwtPayload,
    @Body() body: { deviceId?: string },
  ) {
    if (!body?.deviceId) {
      return { code: 'bad_request', message: 'deviceId is required', results: null }
    }
    // Resolve device credentials from the encrypted vault.
    const creds = await this.devices.resolveCredentials(user.workspaceId, body.deviceId)
    const deviceContacts = await this.gowa.listDeviceContacts(
      creds.basicAuthUser,
      creds.basicAuthPassword,
      body.deviceId,
    )
    const stats = await this.contacts.syncFromDevice(
      user.workspaceId,
      body.deviceId,
      deviceContacts,
    )
    this.logger.log(
      `Synced device "${body.deviceId}": fetched=${stats.fetched} upserted=${stats.upserted} skipped=${stats.skipped}`,
    )
    return { code: 'ok', message: 'sync complete', results: stats }
  }

  /**
   * Sync contacts from ALL registered devices in the workspace. Loops the
   * vault, fetches each device's address book, and upserts. Returns per-device
   * stats. Long-running for big address books (3k+ contacts/device) — the
   * client should show a spinner.
   */
  @Post('sync-all-devices')
  @RequirePermissions('contacts:manage')
  @HttpCode(HttpStatus.OK)
  async syncAllDevices(@CurrentUser() user: JwtPayload) {
    const vaultDevices = await this.devices.list(user.workspaceId)
    if (vaultDevices.length === 0) {
      return {
        code: 'ok',
        message: 'no devices registered in vault',
        results: { devices: [], totalFetched: 0, totalUpserted: 0 },
      }
    }
    const perDevice: Array<{ deviceId: string; status: string; stats?: unknown; error?: string }> = []
    let totalFetched = 0
    let totalUpserted = 0

    for (const vd of vaultDevices) {
      try {
        const creds = await this.devices.resolveCredentials(user.workspaceId, vd.deviceId)
        const deviceContacts = await this.gowa.listDeviceContacts(
          creds.basicAuthUser,
          creds.basicAuthPassword,
          vd.deviceId,
        )
        const stats = await this.contacts.syncFromDevice(
          user.workspaceId,
          vd.deviceId,
          deviceContacts,
        )
        totalFetched += stats.fetched
        totalUpserted += stats.upserted
        perDevice.push({ deviceId: vd.deviceId, status: 'ok', stats })
      } catch (err) {
        perDevice.push({
          deviceId: vd.deviceId,
          status: 'error',
          error: (err as Error).message,
        })
        this.logger.warn(`Sync failed for device "${vd.deviceId}": ${(err as Error).message}`)
      }
    }

    this.logger.log(
      `Sync all devices: ${perDevice.length} devices, fetched=${totalFetched} upserted=${totalUpserted}`,
    )
    return {
      code: 'ok',
      message: 'sync complete',
      results: { devices: perDevice, totalFetched, totalUpserted },
    }
  }
}
