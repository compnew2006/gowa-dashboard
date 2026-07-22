import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsUUID,
} from 'class-validator'

export class CreateContactDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  jid!: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @IsString()
  @MaxLength(30)
  phoneNumber!: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsUUID()
  assignedUserId?: string
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null
}

export class BulkSyncDto {
  contacts!: Array<{ jid: string; name?: string; phoneNumber: string }>
}
