export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: UserProfile
}

export interface RefreshResponse {
  accessToken: string
  expiresIn: number
}

export interface UserProfile {
  id: string
  username: string
  realName: string
  role: string
  tenantId: string | null
}
