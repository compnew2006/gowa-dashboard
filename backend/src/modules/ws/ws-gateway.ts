import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Server, Socket } from 'socket.io'
import WebSocket from 'ws'
import { WsTicketService } from '../auth/ws-ticket.service'
import { DevicesService } from '../devices/devices.service'

/**
 * Secure WebSocket relay: the browser opens a Socket.IO connection with a
 * single-use `ticket` query param. We validate the ticket, look up the
 * device's gowa credentials server-side, and open an upstream `ws` to gowa
 * with the Basic-Auth header (NOT in the URL). We then relay both directions.
 *
 * This removes the browser's need to put `?authorization=<base64(creds)>` in
 * the WebSocket URL — the credential never leaves the server.
 */
@WebSocketGateway({
  namespace: '/',
  cors: { origin: true, credentials: true },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WsGateway.name)
  private readonly upstreamBase: string

  @WebSocketServer()
  server!: Server

  /** Map client socket.id -> upstream ws handle, for clean teardown. */
  private upstreamByClient = new Map<string, WebSocket>()

  constructor(
    private readonly tickets: WsTicketService,
    private readonly devices: DevicesService,
    config: ConfigService,
  ) {
    this.upstreamBase = (config.get<string>('GOWA_UPSTREAM_URL') || 'http://127.0.0.1:3080')
      .replace(/^http/, 'ws')
      .replace(/\/+$/, '')
  }

  async handleConnection(client: Socket): Promise<void> {
    const ticket = client.handshake.query['ticket'] as string | undefined
    const payload = await this.tickets.consume(ticket || '')
    if (!payload) {
      this.logger.warn(`Client ${client.id} rejected: invalid/expired ticket.`)
      client.emit('error', { code: 'invalid_ticket', message: 'Ticket invalid or expired.' })
      client.disconnect(true)
      return
    }

    try {
      const creds = await this.devices.resolveCredentials(payload.workspaceId, payload.deviceId)
      const auth = Buffer.from(`${creds.basicAuthUser}:${creds.basicAuthPassword}`).toString('base64')
      const upstreamUrl = `${this.upstreamBase}/ws?device_id=${encodeURIComponent(payload.deviceId)}`
      this.logger.log(`Client ${client.id} -> upstream ${upstreamUrl}`)

      const upstream = new WebSocket(upstreamUrl, {
        headers: { Authorization: `Basic ${auth}` },
      })
      this.upstreamByClient.set(client.id, upstream)

      upstream.on('open', () => {
        client.emit('open', { deviceId: payload.deviceId })
      })
      upstream.on('message', (data: WebSocket.RawData) => {
        client.emit('message', data.toString())
      })
      upstream.on('close', (code, reason) => {
        client.emit('close', { code, reason: reason?.toString() })
        client.disconnect(true)
      })
      upstream.on('error', (err) => {
        this.logger.error(`Upstream error for ${client.id}: ${err.message}`)
        client.emit('error', { code: 'upstream_error', message: err.message })
        client.disconnect(true)
      })

      client.on('message', (msg: unknown) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
        }
      })
    } catch (err) {
      this.logger.error(`Connection setup failed for ${client.id}: ${(err as Error).message}`)
      client.emit('error', { code: 'setup_failed', message: (err as Error).message })
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket): void {
    const upstream = this.upstreamByClient.get(client.id)
    if (upstream) {
      try {
        upstream.removeAllListeners()
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
          upstream.close()
        }
      } catch {
        // ignore
      }
      this.upstreamByClient.delete(client.id)
    }
  }
}
