import { IsOptional, IsString, MinLength } from 'class-validator'

/**
 * Body is OPTIONAL — the refresh token normally lives in an httpOnly cookie.
 * The body form is supported for non-browser clients.
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string
}
