import axios from 'axios';
import { useAuthStore } from '../store/use-auth-store';
import { message } from 'antd';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach((cb) => cb(newToken));
  pendingRequests = [];
}

// 请求拦截器：注入 Token
httpClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：业务错误码 + 自动刷新 Token
httpClient.interceptors.response.use(
  (response) => {
    const { code, message: msg } = response.data ?? {};
    // API.md §1.4: code === 0 表示成功
    if (code !== 0 && code !== undefined) {
      message.error(msg || '业务请求失败');
      return Promise.reject(new Error(msg));
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // 尝试用 Refresh Token 续期
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(httpClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('/api/auth/refresh', null, { withCredentials: true });
        const newToken = res.data?.data?.accessToken;
        if (newToken) {
          useAuthStore.getState().login(newToken, useAuthStore.getState().userInfo!);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          onTokenRefreshed(newToken);
          return httpClient(originalRequest);
        }
        throw new Error('refresh failed');
      } catch {
        useAuthStore.getState().logout();
        message.error('登录已过期，请重新登录');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 403) {
      message.error('无权限访问该资源');
    } else if (error.response?.status !== 401) {
      message.error(error.response?.data?.message || '网络请求失败');
    }
    return Promise.reject(error);
  }
);
