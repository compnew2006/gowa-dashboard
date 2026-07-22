import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator'

/**
 * Registers a gowa device in the encrypted vault.
 * `basicAuthUser` + `basicAuthPassword` are the APP_BASIC_AUTH credentials the
 * gowa binary is configured with (stored AES-256-GCM encrypted at rest).
 */
export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deviceId!: string // the gowa device JID, e.g. "966561853319:28@s.whatsapp.net"

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  basicAuthUser!: string

  @IsString()
  @MinLength(1)
  basicAuthPassword!: string

  @IsOptional()
  @IsString()
  status?: string
}
