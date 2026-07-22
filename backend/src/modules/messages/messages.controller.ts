import { Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common'
import { MessagesService } from './messages.service'
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator'
import { WorkspaceGuard } from '../../common/guards/workspace.guard'
import { RequirePermissions } from '../../common/decorators/roles.decorator'

@Controller('messages')
@UseGuards(WorkspaceGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** Aggregate stats for the workspace message ledger. */
  @Get('stats')
  @RequirePermissions('chats:read', 'audit:read')
  @HttpCode(HttpStatus.OK)
  async stats(@CurrentUser() user: JwtPayload) {
    const stats = await this.messages.stats(user.workspaceId)
    return { code: 'ok', message: 'message stats', results: stats }
  }

  /**
   * GET /messages/:jidUri?limit=50&before=ISO&after=ISO
   * jidUri is the URL-encoded chat JID (e.g. `966561853319@s.whatsapp.net`).
   */
  @Get(':jidUri')
  @RequirePermissions('chats:read')
  @HttpCode(HttpStatus.OK)
  async listByChat(
    @CurrentUser() user: JwtPayload,
    @Param('jidUri') jidUri: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
  ) {
    const jid = decodeURIComponent(jidUri)
    const results = await this.messages.listByChat(user.workspaceId, jid, {
      limit: limit ? Number(limit) : undefined,
      before: before || undefined,
      after: after || undefined,
    })
    return { code: 'ok', message: 'messages', results }
  }

  @Get('by-id/:messageId')
  @RequirePermissions('chats:read')
  @HttpCode(HttpStatus.OK)
  async getById(@CurrentUser() user: JwtPayload, @Param('messageId') messageId: string) {
    const row = await this.messages.getById(user.workspaceId, messageId)
    if (!row) throw new NotFoundException(`Message ${messageId} not in ledger.`)
    return { code: 'ok', message: 'message', results: row }
  }
}
