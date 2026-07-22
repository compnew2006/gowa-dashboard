import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

/**
 * Thin typed wrapper around the gowa Go binary's REST API. Holds the Basic
 * Auth + upstream URL so callers don't repeat themselves.
 *
 * Used by sync pipelines (ContactsService.syncFromGowa) that need to read
 * bulk data OUT of gowa into the CRM tables. Mutating calls still go through
 * the proxy middleware in main.ts (browser-driven).
 */
@Injectable()
export class GowaClientService {
  private readonly logger = new Logger(GowaClientService.name)
  private readonly upstream: string

  constructor(config: ConfigService) {
    this.upstream = (config.get<string>('GOWA_UPSTREAM_URL') || 'http://127.0.0.1:3080').replace(/\/+$/, '')
  }

  /**
   * Fetch the full contact list for one device. gowa returns everything in
   * a single call (no pagination — verified: 3.6k contacts in one response).
   * Returns only personal JIDs (skips @g.us groups and @newsletter channels).
   */
  async listDeviceContacts(
    basicAuthUser: string,
    basicAuthPassword: string,
    deviceId: string,
  ): Promise<Array<{ jid: string; name: string }>> {
    const auth = Buffer.from(`${basicAuthUser}:${basicAuthPassword}`).toString('base64')
    const res = await axios.get(`${this.upstream}/user/my/contacts`, {
      headers: { Authorization: `Basic ${auth}`, 'X-Device-Id': deviceId },
      timeout: 60_000,
      validateStatus: () => true,
    })
    if (res.status !== 200) {
      throw new Error(`gowa /user/my/contacts for device ${deviceId} returned HTTP ${res.status}`)
    }
    const body = res.data as { results?: { data?: Array<{ jid: string; name?: string }> } }
    const data = body.results?.data ?? []
    // Keep only personal JIDs (@s.whatsapp.net). Group (@g.us) / newsletter
    // (@newsletter) contacts are surfaced via /chats, not the contact list.
    return data
      .filter((c) => c.jid && c.jid.endsWith('@s.whatsapp.net'))
      .map((c) => ({ jid: c.jid, name: (c.name || '').trim() }))
  }

  /**
   * Fetch the registered devices list from gowa (so we know which device_ids
   * to sync). Returns the raw device rows gowa emits.
   */
  async listDevices(
    basicAuthUser: string,
    basicAuthPassword: string,
  ): Promise<Array<{ id: string; jid?: string; state?: string }>> {
    const auth = Buffer.from(`${basicAuthUser}:${basicAuthPassword}`).toString('base64')
    const res = await axios.get(`${this.upstream}/devices`, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10_000,
      validateStatus: () => true,
    })
    if (res.status !== 200) {
      throw new Error(`gowa /devices returned HTTP ${res.status}`)
    }
    const body = res.data as { results?: Array<{ id: string; jid?: string; state?: string }> }
    return body.results ?? []
  }
}
