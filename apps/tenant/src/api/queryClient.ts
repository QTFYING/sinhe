import { QueryClient } from '@tanstack/react-query';

// TanStack Query 全局配置：严格区分服务端状态管理
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // B端系统默认不频繁获焦重现发请求干扰视角
      retry: 1,                    // 接口失败仅重试 1 次
      staleTime: 5 * 60 * 1000,    // 5分钟数据新鲜度，避免频繁 Loading
    },
  },
});
