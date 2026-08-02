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
 * Determines if a transaction row is a transfer type or custody movement
 */
export const isTransferType = (type: string, category?: string): boolean => {
  const t = (type || '').toLowerCase();
  const c = (category || '').toLowerCase();
  return (
    t.includes('transfer') || 
    t.includes('تحويل') || 
    c.includes('transfer') || 
    c.includes('تحويل') || 
    c.includes('تغذية عهدة')
  );
};

/**
 * Determines if a transaction row is an income type
 */
export const isIncomeType = (type: string, category?: string): boolean => {
  if (isTransferType(type, category)) return false;
  const t = (type || '').toLowerCase();
  const c = (category || '').toLowerCase();
  return (
    t.includes('income') || 
    t.includes('إيراد') || 
    t.includes('مبيعات') || 
    t.includes('توريد') || 
    t.includes('وارد') || 
    t.includes('إيداع') ||
    c.includes('إيراد') ||
    c.includes('مبيعات')
  );
};

/**
 * Determines if a transaction row is an expense type
 */
export const isExpenseType = (type: string, category?: string): boolean => {
  if (isTransferType(type, category)) return false;
  const t = (type || '').toLowerCase();
  const c = (category || '').toLowerCase();
  return (
    t.includes('expense') || 
    t.includes('صرف') || 
    t.includes('مصروف') || 
    t.includes('سحب') || 
    t.includes('مشتريات') ||
    c.includes('مصروف') ||
    c.includes('مشتريات')
  );
};

/**
 * Determines if a transaction row is an unpaid accrual or credit purchase (does NOT deduct from cash box)
 */
export const isAccrualType = (type?: string, category?: string, description?: string): boolean => {
  const text = `${type || ''} ${category || ''} ${description || ''}`;
  // Skip settlements (سداد / تسوية ديون) - settlement DOES involve cash!
  if (/سداد|تسوية/i.test(text)) return false;

  return /آجل|اجل|مستحق|مستحقة|مستحقه|رواتب مستحقة|دين|دائن|مورد|مؤجل|غير مسدد|لم يسدد|deferred|accrual|credit|due/i.test(text);
};

/**
 * Classifies a transaction into standard accounting operation types:
 * - مبيعات
 * - مشتريات
 * - مصاريف
 * - مشتريات آجلة
 * - مصاريف مستحقة
 * - سداد مستحقات
 * - تحويل مالي
 * - إغلاق وتصفية صندوق
 */
export const getAccountingOperationType = (
  type: string, 
  category: string = '', 
  description: string = '', 
  income: number = 0, 
  expense: number = 0
): string => {
  const combined = `${type} ${category} ${description}`;
  
  if (isTransferType(type, category)) {
    return 'تحويل مالي';
  }

  if (combined.includes('إغلاق صندوق') || combined.includes('تصفية صندوق') || combined.includes('تسوية رصيد') || combined.includes('إغلاق عهدة')) {
    return 'إغلاق وتصفية صندوق';
  }

  if (income > 0 || isIncomeType(type, category)) {
    return 'مبيعات';
  }

  const isSettlement = /سداد.*(مستحق|آجل|اجل|دين|دائن|مورد|التزام)|سداد مشتريات|تسوية التزامات/i.test(combined) ||
                      description.includes('سداد مستحقات') || 
                      description.includes('سداد آجل') ||
                      category.includes('سداد مشتريات');
  if (isSettlement) {
    return 'سداد مستحقات';
  }

  const isAccrual = isAccrualType(type, category, description);
  const isPurchase = category.includes('مشتريات') || category.includes('شراء') || combined.toLowerCase().includes('purchase') || description.includes('شراء');

  if (isPurchase) {
    return isAccrual ? 'مشتريات آجلة' : 'مشتريات';
  } else {
    return isAccrual ? 'مصاريف مستحقة' : 'مصاريف';
  }
};

