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

/**
 * Matches branch names accurately with Arabic normalization and prefix stripping
 */
export const matchBranch = (rowBranch: string, selectedBranch: string): boolean => {
  if (!selectedBranch || selectedBranch === 'All' || selectedBranch === 'الكل' || selectedBranch === 'كافة الفروع' || selectedBranch === 'كل الفروع') {
    return true;
  }
  if (!rowBranch) return false;

  const normalize = (str: string) => 
    String(str)
      .trim()
      .toLowerCase()
      .replace(/^فرع\s+/, '')
      .replace(/أ|إ|آ/g, 'ا')
      .replace(/ة/g, 'ه');

  const cleanRow = normalize(rowBranch);
  const cleanSel = normalize(selectedBranch);

  return cleanRow === cleanSel || String(rowBranch).trim().toLowerCase() === String(selectedBranch).trim().toLowerCase();
};

export interface NormalizedReportRow {
  id: string | number | null;
  date: string;
  employee: string;
  branch: string;
  type: string;
  category: string;
  income: number;
  expense: number;
  description: string;
  targetMonth: string;
  rawBalance: number;
  raw: any;
}

/**
 * Safely parses any transaction row format (object or array tuple) into a standard normalized structure
 */
export const parseReportRow = (row: any): NormalizedReportRow => {
  if (!row) {
    return {
      id: null,
      date: '',
      employee: 'عام',
      branch: 'عام',
      type: '',
      category: 'عام',
      income: 0,
      expense: 0,
      description: '-',
      targetMonth: '',
      rawBalance: 0,
      raw: row
    };
  }

  const isObj = typeof row === 'object' && row !== null && !Array.isArray(row);

  if (isObj) {
    const inc = parseFloat(row.income) || 0;
    const exp = parseFloat(row.expense) || 0;
    const typeVal = String(row.type || (inc > 0 ? 'إيرادات' : 'مصروفات'));

    return {
      id: row.id ?? row.rowId ?? row.rowIndex ?? null,
      date: String(row.date || '').split('T')[0],
      employee: String(row.employee || row.emp || 'عام'),
      branch: String(row.branch || 'عام'),
      type: typeVal,
      category: String(row.category || row.cat || 'عام'),
      income: inc,
      expense: exp,
      description: String(row.description || row.desc || row.notes || row.details || '-'),
      targetMonth: String(row.targetMonth || ''),
      rawBalance: typeof row.balance === 'number' ? row.balance : (parseFloat(row.balance) || 0),
      raw: row
    };
  }

  // Tuple array format: [0:date, 1:emp, 2:branch, 3:type, 4:cat, 5:inc, 6:exp, 7:bal, 8:desc, 9:targetMonth, 10:id]
  const inc = parseFloat(row[5]) || 0;
  const exp = parseFloat(row[6]) || 0;
  const typeVal = String(row[3] || (inc > 0 ? 'إيرادات' : 'مصروفات'));

  let desc = '-';
  if (row.length > 8 && row[8] !== undefined && row[8] !== null) {
    desc = String(row[8]);
  } else if (row[7] !== undefined && row[7] !== null && typeof row[7] === 'string') {
    desc = String(row[7]);
  }

  return {
    id: row.length > 10 ? row[10] : (row[0] && typeof row[0] === 'number' ? row[0] : null),
    date: String(row[0] || '').split('T')[0],
    employee: String(row[1] || 'عام'),
    branch: String(row[2] || 'عام'),
    type: typeVal,
    category: String(row[4] || 'عام'),
    income: inc,
    expense: exp,
    description: desc,
    targetMonth: row.length > 9 ? String(row[9] || '') : '',
    rawBalance: parseFloat(row[7]) || 0,
    raw: row
  };
};


