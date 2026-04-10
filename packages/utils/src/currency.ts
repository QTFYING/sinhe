import BigNumber from 'bignumber.js';

/**
 * Validates if the string is a valid amount format
 */
export const isValidAmount = (val: string): boolean => {
  const bn = new BigNumber(val);
  return !bn.isNaN() && bn.isFinite() && bn.isPositive();
};

/**
 * Validate identity: totalAmount = paidAmount + discountAmount
 */
export const validateOrderEquation = (totalAmount: string, paidAmount: string, discountAmount: string): boolean => {
  const total = new BigNumber(totalAmount || '0');
  const paid = new BigNumber(paidAmount || '0');
  const discount = new BigNumber(discountAmount || '0');
  return total.isEqualTo(paid.plus(discount));
};

/**
 * Format string amount for UI display
 */
export const formatAmount = (val: string | null | undefined): string => {
  if (!val) return '0.00';
  const bn = new BigNumber(val);
  if (bn.isNaN()) return '0.00';
  return bn.toFormat(2);
};
