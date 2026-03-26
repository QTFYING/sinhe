import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfo {
  userId: string;
  username: string;
  role: string;
  tenantId: string | null;
}

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  login: (token: string, userInfo: UserInfo) => void;
  logout: () => void;
}

// 遵循红线：状态管理只保存轻量状态如个人信息、Token 及偏好设置
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userInfo: null,
      login: (token, userInfo) => set({ token, userInfo }),
      logout: () => set({ token: null, userInfo: null }),
    }),
    { name: 'b2b-auth-storage' }
  )
);
