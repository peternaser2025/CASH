/**
 * Financial formatting utilities for KWD (Kuwaiti Dinar)
 */

/**
 * Formats a number to KWD standard (3 decimal places)
 */
export const formatKWD = (amount: number | string): string => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0.000';
  return value.toFixed(3);
};

/**
 * Formats a number with a sign for financial statements
 */
export const formatFinancialAmount = (amount: number | string, type?: string): string => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0.000';
  
  const formatted = Math.abs(value).toFixed(3);
  
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};

/**
 * Determines if a transaction row is an income type
 */
export const isIncomeType = (type: string): boolean => {
  const t = type.toLowerCase();
  return t.includes('income') || t.includes('توريد') || t.includes('وارد') || t.includes('إيداع');
};

/**
 * Determines if a transaction row is an expense type
 */
export const isExpenseType = (type: string): boolean => {
  const t = type.toLowerCase();
  return t.includes('expense') || t.includes('صرف') || t.includes('مصروف') || t.includes('سحب') || t.includes('مشتريات');
};

/**
 * Determines if a transaction row is a transfer type
 */
export const isTransferType = (type: string): boolean => {
  const t = type.toLowerCase();
  return t.includes('transfer') || t.includes('تحويل');
};
