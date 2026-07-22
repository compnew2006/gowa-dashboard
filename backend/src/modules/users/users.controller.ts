import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './dto/update-user.dto'
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator'
import { WorkspaceGuard } from '../../common/guards/workspace.guard'
import { Roles, RequirePermissions } from '../../common/decorators/roles.decorator'

@Controller('users')
@UseGuards(WorkspaceGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users:manage')
  @HttpCode(HttpStatus.OK)
  async list(@CurrentUser() user: JwtPayload) {
    const list = await this.users.list(user.workspaceId)
    return { code: 'ok', message: 'users', results: list }
  }

  @Get(':id')
  @RequirePermissions('users:manage')
  @HttpCode(HttpStatus.OK)
  async get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const u = await this.users.get(user.workspaceId, id)
    return { code: 'ok', message: 'user', results: u }
  }

  @Post()
  @RequirePermissions('users:manage')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    const u = await this.users.create(user.workspaceId, dto)
    return { code: 'ok', message: 'user created', results: u }
  }

  @Patch(':id')
  @RequirePermissions('users:manage')
  @HttpCode(HttpStatus.OK)
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const u = await this.users.update(user.workspaceId, id, dto)
    return { code: 'ok', message: 'user updated', results: u }
  }

  @Post(':id/role')
  @RequirePermissions('users:manage')
  @HttpCode(HttpStatus.OK)
  async assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    const callerIsSuperAdmin = user.roleName === 'SuperAdmin'
    await this.users.assignRole(user.workspaceId, id, dto.roleId, callerIsSuperAdmin)
    return { code: 'ok', message: 'role assigned', results: null }
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.users.remove(user.workspaceId, id, user.sub)
    return { code: 'ok', message: 'user removed', results: null }
  }
}
