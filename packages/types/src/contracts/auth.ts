import type { AuthSourceTag, UserRole } from '../enums'

export interface LoginRequest {
  account: string
  password: string
}

export interface AuthUserProfile {
  id: string
  account: string
  realName: string
  role: UserRole
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
