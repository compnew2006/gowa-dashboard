import { roles, workspaces, users, workspaceMembers } from './schema'
import * as crypto from 'crypto'

export interface SeedOptions {
  db: any // Drizzle database instance
}

export const CORE_ROLES = [
  {
    name: 'SuperAdmin',
    permissions: ['*'],
  },
  {
    name: 'Admin',
    permissions: [
      'workspace:manage',
      'users:manage',
      'devices:admin',
      'chats:read',
      'chats:write',
      'contacts:manage',
      'campaigns:manage',
      'audit:read',
    ],
  },
  {
    name: 'Manager',
    permissions: [
      'devices:read',
      'chats:read',
      'chats:write',
      'contacts:manage',
      'campaigns:read',
      'campaigns:write',
    ],
  },
  {
    name: 'Agent',
    permissions: ['chats:read', 'chats:write', 'contacts:read', 'contacts:write'],
  },
]

export async function seedDatabase(db: any) {
  console.log('Starting Database Seeding Process...')

  // 1. Seed Core RBAC Roles
  const seededRoles: Record<string, string> = {}
  for (const roleDef of CORE_ROLES) {
    const [inserted] = await db
      .insert(roles)
      .values({
        name: roleDef.name,
        permissions: roleDef.permissions,
      })
      .onConflictDoUpdate({
        target: roles.name,
        set: { permissions: roleDef.permissions, updatedAt: new Date() },
      })
      .returning({ id: roles.id, name: roles.name })

    if (inserted) {
      seededRoles[inserted.name] = inserted.id
    }
  }
  console.log(`Successfully seeded ${Object.keys(seededRoles).length} RBAC roles.`)

  // 2. Create Initial System Tenant Workspace
  const [defaultWorkspace] = await db
    .insert(workspaces)
    .values({
      name: 'Default Workspace',
      slug: 'default-workspace',
    })
    .onConflictDoUpdate({
      target: workspaces.slug,
      set: { updatedAt: new Date() },
    })
    .returning({ id: workspaces.id })

  console.log(`Created System Workspace ID: ${defaultWorkspace.id}`)

  // 3. Create Default Administrator Account
  const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@enterprise-crm.internal'
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin#123456!'
  const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex')

  const [defaultAdmin] = await db
    .insert(users)
    .values({
      email: defaultAdminEmail,
      passwordHash: passwordHash,
      fullName: 'System Administrator',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { updatedAt: new Date() },
    })
    .returning({ id: users.id })

  console.log(`Created Default Administrator ID: ${defaultAdmin.id} (${defaultAdminEmail})`)

  // 4. Assign Admin to Workspace with SuperAdmin Role
  const superAdminRoleId = seededRoles['SuperAdmin'] || seededRoles['Admin']
  if (superAdminRoleId && defaultWorkspace && defaultAdmin) {
    await db
      .insert(workspaceMembers)
      .values({
        workspaceId: defaultWorkspace.id,
        userId: defaultAdmin.id,
        roleId: superAdminRoleId,
      })
      .onConflictDoNothing()

    console.log('Bound Administrator to Default Workspace with SuperAdmin role.')
  }

  console.log('Database Seeding Complete!')
}
