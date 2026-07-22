import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { WsTicketService } from './ws-ticket.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { RefreshDto } from './dto/refresh.dto'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator'
import { WorkspaceGuard } from '../../common/guards/workspace.guard'
import { AuditService } from '../audit/audit.service'

const REFRESH_COOKIE = 'gowa_refresh'
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly wsTickets: WsTicketService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; code: string; message: string }> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    const pair = await this.auth.login(dto.email, dto.password, { ip, userAgent })
    this.setRefreshCookie(res, pair.refreshToken)
    // Best-effort audit log (the email here isn't a userId yet; the AuthService
    // could return it, but the trigger-based audit on subsequent mutations
    // captures the rest).
    try {
      // Decode the just-issued JWT to get sub + workspaceId.
      const decoded = JSON.parse(
        Buffer.from(pair.accessToken.split('.')[1], 'base64').toString('utf8'),
      ) as { sub: string; workspaceId: string }
      await this.audit.record({
        workspaceId: decoded.workspaceId,
        userId: decoded.sub,
        action: 'auth.login',
        targetType: 'user',
        targetId: decoded.sub,
        payload: { email: dto.email },
        ipAddress: ip,
        userAgent,
      })
    } catch {
      // never fail the login because of an audit-log error
    }
    return { accessToken: pair.accessToken, code: 'ok', message: 'Logged in.' }
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<{ id: string; code: string; message: string }> {
    const user = await this.auth.register(dto.email, dto.password, dto.fullName)
    return { ...user, code: 'ok', message: 'User registered.' }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; code: string; message: string }> {
    const token = dto.refreshToken || (req.cookies?.[REFRESH_COOKIE] as string | undefined)
    if (!token) {
      res.clearCookie(REFRESH_COOKIE)
      return { accessToken: '', code: 'no_refresh_token', message: 'No refresh token.' }
    }
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    try {
      const pair = await this.auth.rotate(token, { ip, userAgent })
      this.setRefreshCookie(res, pair.refreshToken)
      return { accessToken: pair.accessToken, code: 'ok', message: 'Refreshed.' }
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE)
      throw err
    }
  }

  @Post('logout')
  @UseGuards(WorkspaceGuard) // requires a valid JWT
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ code: string; message: string }> {
    const token = dto.refreshToken || (req.cookies?.[REFRESH_COOKIE] as string | undefined)
    if (token) await this.auth.logout(token)
    res.clearCookie(REFRESH_COOKIE)
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    try {
      await this.audit.record({
        workspaceId: user.workspaceId,
        userId: user.sub,
        action: 'auth.logout',
        targetType: 'user',
        targetId: user.sub,
        ipAddress: ip,
        userAgent,
      })
    } catch {
      // best-effort
    }
    return { code: 'ok', message: 'Logged out.' }
  }

  /**
   * Issue a single-use ticket the browser can use to open the WebSocket
   * without putting credentials in the URL.
   */
  @Post('ws-ticket')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.OK)
  async wsTicket(
    @CurrentUser() user: JwtPayload,
    @Body('deviceId') deviceId: string,
  ): Promise<{ ticket: string; code: string; message: string }> {
    if (!deviceId) {
      return { ticket: '', code: 'bad_request', message: 'deviceId is required.' }
    }
    const ticket = await this.wsTickets.issue({
      userId: user.sub,
      workspaceId: user.workspaceId,
      deviceId,
    })
    return { ticket, code: 'ok', message: 'Ticket issued (30s TTL).' }
  }

  /** Health probe for the auth surface. */
  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(): { code: string; message: string } {
    return { code: 'ok', message: 'auth service alive' }
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_MAX_AGE_MS,
      path: '/api/v1/auth',
    })
  }
}
