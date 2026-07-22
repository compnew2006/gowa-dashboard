import { IsOptional, IsString, IsBoolean, MaxLength, IsEmail } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class AssignRoleDto {
  @IsString()
  roleId!: string
}

export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsString()
  @MaxLength(128)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string

  @IsOptional()
  @IsString()
  roleId?: string // defaults to Agent
}
