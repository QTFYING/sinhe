// Role Enum as defined in CLAUDE.md
export enum UserRoleEnum {
  TENANT_OWNER = 'TENANT_OWNER',
  TENANT_OPERATOR = 'TENANT_OPERATOR',
  TENANT_FINANCE = 'TENANT_FINANCE',
  TENANT_VIEWER = 'TENANT_VIEWER',
}

// Payment Status
export enum PayStatusEnum {
  UNPAID = 'UNPAID',
  PAYING = 'PAYING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
}

// Generic API Response
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}
