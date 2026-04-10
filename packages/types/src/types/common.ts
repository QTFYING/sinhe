/** 统一 API 响应结构 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 列表查询参数 */
export interface ListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface BatchOperationResult {
  successCount: number
  failedIds: string[]
}
