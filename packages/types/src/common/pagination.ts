/** 通用列表查询参数。 */
export interface ListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

/** 通用分页响应。 */
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
