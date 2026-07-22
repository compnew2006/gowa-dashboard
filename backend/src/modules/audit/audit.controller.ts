import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { AuditService } from './audit.service'
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator'
import { WorkspaceGuard } from '../../common/guards/workspace.guard'
import { RequirePermissions } from '../../common/decorators/roles.decorator'

@Controller('audit')
@UseGuards(WorkspaceGuard)
@RequirePermissions('audit:read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const results = await this.audit.list(user.workspaceId, {
      userId: userId || undefined,
      action: action || undefined,
      targetType: targetType || undefined,
      since: since || undefined,
      until: until || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    })
    const total = await this.audit.count(user.workspaceId)
    return { code: 'ok', message: 'audit log', results, total }
  }
}
