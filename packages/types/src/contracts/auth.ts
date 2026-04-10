import type { AuthSourceTag, TenantRole } from '../enums'

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthUserProfile {
  id: string
  username: string
  realName: string
  role: TenantRole | string
  tenantId: string | null
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: AuthUserProfile
}

export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number
}

export interface AuthMeResponse extends AuthUserProfile {
  source?: AuthSourceTag
}
