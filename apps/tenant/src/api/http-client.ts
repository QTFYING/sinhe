import axios from 'axios';
import { useAuthStore } from '../store/use-auth-store';
import { message } from 'antd';

// 单例模式生成强隔离的 Client
export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截器：动态将 Token 塞入 Header
httpClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：全域监控 401 和业务异常
httpClient.interceptors.response.use(
  (response) => {
    // 根据在 shared-types 定义过的响应规范，此处统一拆解并抛出业务错
    if (response.data?.code !== 200 && response.data?.code !== undefined) {
      message.error(response.data.message || '业务逻辑校验拦截');
      return Promise.reject(new Error(response.data.message));
    }
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      message.error('登录会话已过期失效，请重新登录！');
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      message.error('越权访问！您所在的租户或角色无此项权限处理。');
    } else {
      message.error(error.response?.data?.message || '网络或服务端底座熔断');
    }
    return Promise.reject(error);
  }
);
