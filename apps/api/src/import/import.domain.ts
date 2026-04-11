import type { OrderLineItem } from '@shou/types/contracts';
import type { OrderPayType, OrderStatus } from '@shou/types/enums';

export interface ImportTemplateMappingLike {
  sourceColumn: string;
}

function hasImportValue(value: unknown): boolean {
  return value !== null && value !== undefined && (typeof value !== 'string' || value.trim().length > 0);
}

export function normalizeImportColumnKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function readImportColumn(
  row: Record<string, unknown>,
  sourceColumn: string,
): unknown {
  const normalized = normalizeImportColumnKey(sourceColumn);
  const entry = Object.entries(row).find(([key]) => normalizeImportColumnKey(key) === normalized);
  return entry?.[1];
}

export function countMatchedImportFields(
  rows: Array<Record<string, unknown>>,
  mappings: ImportTemplateMappingLike[],
): number {
  return mappings.reduce((count, mapping) => {
    const matched = rows.some((row) => hasImportValue(readImportColumn(row, mapping.sourceColumn)));
    return matched ? count + 1 : count;
  }, 0);
}

export function resolveImportPayType(
  value: string | undefined,
  creditDays?: number,
): OrderPayType {
  if (value === 'credit') return 'credit';
  if (value === 'cash') return 'cash';
  return creditDays && creditDays > 0 ? 'credit' : 'cash';
}

export function resolveImportOrderStatus(
  value: string | OrderStatus | undefined,
  payType: OrderPayType,
  paid: number,
  amount: number,
): OrderStatus {
  if (
    value === 'pending' ||
    value === 'partial' ||
    value === 'paid' ||
    value === 'expired' ||
    value === 'credit'
  ) {
    return value;
  }
  if (paid >= amount && amount > 0) return 'paid';
  if (paid > 0) return 'partial';
  if (payType === 'credit') return 'credit';
  return 'pending';
}

export function buildImportOrderSummary(lineItems: OrderLineItem[]): string {
  const names = Array.from(new Set(lineItems.map((item) => item.skuName))).filter(Boolean);
  if (names.length === 0) return '导入订单';
  if (names.length <= 3) return names.join('、');
  return `${names.slice(0, 3).join('、')} 等 ${names.length} 项`;
}
