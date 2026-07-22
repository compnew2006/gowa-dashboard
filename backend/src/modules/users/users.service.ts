import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as bcrypt from 'bcryptjs'
import { users, roles, workspaceMembers, workspaces } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'
import type { CreateUserDto, UpdateUserDto } from './dto/update-user.dto'

export interface UserPublic {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  role?: { id: string; name: string } | null
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {}

  /** List all users in a workspace, with their role in that workspace. */
  async list(workspaceId: string): Promise<UserPublic[]> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleId: workspaceMembers.roleId,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .leftJoin(roles, eq(roles.id, workspaceMembers.roleId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      avatarUrl: r.avatarUrl,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      role: r.roleId ? { id: r.roleId, name: r.roleName ?? '' } : null,
    }))
  }

  async get(workspaceId: string, userId: string): Promise<UserPublic> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleId: workspaceMembers.roleId,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .leftJoin(roles, eq(roles.id, workspaceMembers.roleId))
      .where(and(eq(users.id, userId), eq(workspaceMembers.workspaceId, workspaceId)))
      .limit(1)
    if (!row) throw new NotFoundException(`User ${userId} not found in this workspace.`)
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      avatarUrl: row.avatarUrl,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      role: row.roleId ? { id: row.roleId, name: row.roleName ?? '' } : null,
    }
  }

  async create(workspaceId: string, dto: CreateUserDto): Promise<UserPublic> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, dto.email))
    if (existing) throw new ConflictException('A user with that email already exists.')

    let roleId = dto.roleId
    if (!roleId) {
      const [agentRole] = await this.db.select().from(roles).where(eq(roles.name, 'Agent'))
      if (!agentRole) throw new NotFoundException('Agent role not seeded.')
      roleId = agentRole.id
    } else {
      // Validate the role exists
      const [role] = await this.db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId))
      if (!role) throw new NotFoundException(`Role ${roleId} does not exist.`)
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const [user] = await this.db
      .insert(users)
      .values({ email: dto.email, passwordHash, fullName: dto.fullName ?? null, isActive: true })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })

    await this.db
      .insert(workspaceMembers)
      .values({ workspaceId, userId: user!.id, roleId })
      .onConflictDoNothing()

    const [roleRow] = await this.db.select({ name: roles.name }).from(roles).where(eq(roles.id, roleId))
    return { ...user!, role: { id: roleId, name: roleRow?.name ?? '' } }
  }

  async update(workspaceId: string, userId: string, dto: UpdateUserDto): Promise<UserPublic> {
    // Verify membership so we can't mutate users outside our workspace.
    await this.get(workspaceId, userId)

    const [updated] = await this.db
      .update(users)
      .set({ ...(dto.fullName !== undefined && { fullName: dto.fullName }), ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }), ...(dto.isActive !== undefined && { isActive: dto.isActive }), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
    if (!updated) throw new NotFoundException(`User ${userId} not found.`)
    // re-fetch role
    const current = await this.get(workspaceId, userId)
    return { ...updated, role: current.role }
  }

  /** Change the user's role within a workspace. */
  async assignRole(
    workspaceId: string,
    userId: string,
    roleId: string,
    callerIsSuperAdmin: boolean,
  ): Promise<void> {
    await this.get(workspaceId, userId)
    const [role] = await this.db.select({ name: roles.name }).from(roles).where(eq(roles.id, roleId))
    if (!role) throw new NotFoundException(`Role ${roleId} does not exist.`)
    // Only SuperAdmins can grant SuperAdmin.
    if (role.name === 'SuperAdmin' && !callerIsSuperAdmin) {
      throw new ForbiddenException('Only a SuperAdmin can grant the SuperAdmin role.')
    }
    await this.db
      .update(workspaceMembers)
      .set({ roleId })
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
  }

  async remove(workspaceId: string, userId: string, callerUserId: string): Promise<void> {
    if (userId === callerUserId) {
      throw new ForbiddenException('You cannot delete your own account. Ask another admin.')
    }
    await this.get(workspaceId, userId)
    // Remove the membership first (FK-cascades if user has only this workspace),
    // then hard-delete the user.
    await this.db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    await this.db.delete(users).where(eq(users.id, userId))
  }

  /** Resolve the default workspace id (used by AuthController.register fallback). */
  async getDefaultWorkspaceId(): Promise<string> {
    const [ws] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, 'default-workspace'))
      .limit(1)
    if (!ws) throw new NotFoundException('Default workspace not seeded.')
    return ws.id
  }
}
