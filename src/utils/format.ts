/**
 * Financial formatting and accounting utilities for KWD (Kuwaiti Dinar)
 */

/**
 * Formats a number to KWD standard (3 decimal places)
 */
export const formatKWD = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null) return '0.000';
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0.000';
  return value.toFixed(3);
};

/**
 * Formats a number with a sign for financial statements
 */
export const formatFinancialAmount = (amount: number | string | undefined | null, type?: string): string => {
  if (amount === undefined || amount === null) return '0.000';
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0.000';
  
  const formatted = Math.abs(value).toFixed(3);
  
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};

/**
 * Advanced Arabic text normalizer for smooth, lightning-fast, and forgiving search queries
 */
export const normalizeArabicSearch = (text: string | number | undefined | null): string => {
  if (text === undefined || text === null) return '';
  let str = String(text).toLowerCase().trim();

  // Convert Arabic-Indic (Eastern Arabic) digits to Western digits: ٠-٩ -> 0-9
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(arabicDigits[i], 'g'), String(i));
    str = str.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }

  // Remove Arabic diacritics / Tashkeel & Tatweel (kashida)
  str = str.replace(/[\u064B-\u065F\u0670\u0640]/g, '');

  // Normalize Alef variations (إ, أ, آ, ٱ, ا -> ا)
  str = str.replace(/[إأآٱ]/g, 'ا');

  // Normalize Taa Marbouta / Haa (ة -> ه)
  str = str.replace(/ة/g, 'ه');

  // Normalize Yaa / Alef Maqsoura / Hamza on Nabira (ي, ى, ئ -> ي)
  str = str.replace(/[ىئ]/g, 'ي');

  // Normalize Hamza on Waw (ؤ -> و)
  str = str.replace(/ؤ/g, 'و');

  // Remove common punctuation and collapse spaces
  str = str.replace(/[-_.,/\\()[\]{}#@!?:;"'«»]/g, ' ').replace(/\s+/g, ' ').trim();

  return str;
};

/**
 * Smooth multi-keyword search matcher across multiple fields
 * Returns true if ALL keywords in query exist in ANY of the target fields.
 */
export const isArabicSearchMatch = (query: string, ...targets: (string | number | undefined | null)[]): boolean => {
  if (!query || !query.trim()) return true;

  const normalizedQuery = normalizeArabicSearch(query);
  const queryTokens = normalizedQuery.split(' ').filter(token => token.length > 0);

  if (queryTokens.length === 0) return true;

  // Build a single unified searchable text from all targets
  const combinedTargetText = targets
    .map(t => {
      if (t === undefined || t === null) return '';
      if (typeof t === 'number') {
        return `${t} ${t.toFixed(3)} ${t.toFixed(2)}`;
      }
      return String(t);
    })
    .join(' ');

  const normalizedTarget = normalizeArabicSearch(combinedTargetText);

  // Every token from the search query must be present in the normalized target text
  return queryTokens.every(token => normalizedTarget.includes(token));
};

/**
 * Determines if a transaction row is a transfer type or custody movement
 */
export const isTransferType = (type: string, category?: string, description?: string): boolean => {
  const combined = `${type || ''} ${category || ''} ${description || ''}`.toLowerCase();
  return (
    combined.includes('transfer') || 
    combined.includes('تحويل') || 
    combined.includes('تغذية عهدة') ||
    combined.includes('تسليم عهدة') ||
    combined.includes('استلام عهدة') ||
    combined.includes('تحويل مالي') ||
    combined.includes('نقل عهدة')
  );
};

/**
 * Determines if a transaction row is an income type
 */
export const isIncomeType = (type: string, category?: string, description?: string): boolean => {
  if (isTransferType(type, category, description)) return false;
  const combined = `${type || ''} ${category || ''} ${description || ''}`.toLowerCase();
  return (
    combined.includes('income') || 
    combined.includes('إيراد') || 
    combined.includes('ايراد') || 
    combined.includes('مبيعات') || 
    combined.includes('توريد') || 
    combined.includes('وارد') || 
    combined.includes('إيداع') ||
    combined.includes('ايداع') ||
    combined.includes('تغذية')
  );
};

/**
 * Determines if a transaction row is an expense type
 */
export const isExpenseType = (type: string, category?: string, description?: string): boolean => {
  if (isTransferType(type, category, description)) return false;
  const combined = `${type || ''} ${category || ''} ${description || ''}`.toLowerCase();
  return (
    combined.includes('expense') || 
    combined.includes('صرف') || 
    combined.includes('مصروف') || 
    combined.includes('سحب') || 
    combined.includes('مشتريات') ||
    combined.includes('شراء')
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
  
  if (isTransferType(type, category, description)) {
    return 'تحويل مالي';
  }

  if (combined.includes('إغلاق صندوق') || combined.includes('تصفية صندوق') || combined.includes('تسوية رصيد') || combined.includes('إغلاق عهدة')) {
    return 'إغلاق وتصفية صندوق';
  }

  if (income > 0 || isIncomeType(type, category, description)) {
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
    normalizeArabicSearch(str).replace(/^فرع\s+/, '');

  const cleanRow = normalize(rowBranch);
  const cleanSel = normalize(selectedBranch);

  return cleanRow === cleanSel || cleanRow.includes(cleanSel) || cleanSel.includes(cleanRow);
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
  amount: number;
  description: string;
  targetMonth: string;
  rawBalance: number;
  raw: any;
}

/**
 * Accurately extracts From/To party names for cash transfers & feedings
 */
export const extractTransferParties = (
  description: string, 
  category: string, 
  currentEmployee: string, 
  isIncoming: boolean
): { fromWhom: string; toWhom: string } => {
  const desc = (description || '').trim();
  const cat = (category || '').trim();

  let fromWhom = isIncoming ? 'الخزينة العامة / الإدارة المالية' : currentEmployee;
  let toWhom = isIncoming ? currentEmployee : 'موظف / فرع آخر';

  if (!desc && !cat) {
    return { fromWhom, toWhom };
  }

  // Check for 'من ... إلى ...' pattern
  // Example: 'تحويل عهدة نقدية من محمد الأحمد إلى خالد الدوسري'
  const fromToMatch = desc.match(/من\s+([^إالي,،–\-]+?)(?:\s+(?:إلى|الي|لـ|لصالح)\s+([^,،–\-\n]+))?$/i) ||
                      desc.match(/من\s+([^\s,،]+(?:\s+[^\s,،]+)?)\s+(?:إلى|الي|لـ|لصالح)\s+([^\s,،]+(?:\s+[^\s,،]+)?)/i);

  if (fromToMatch) {
    if (fromToMatch[1]) {
      const cleanSender = fromToMatch[1].replace(/عهدة|حساب|الموظف|الأستاذ|السيد/g, '').trim();
      if (cleanSender) fromWhom = cleanSender;
    }
    if (fromToMatch[2]) {
      const cleanReceiver = fromToMatch[2].replace(/عهدة|حساب|الموظف|الأستاذ|السيد/g, '').trim();
      if (cleanReceiver) toWhom = cleanReceiver;
    }
    return { fromWhom, toWhom };
  }

  // Check for individual 'من' match
  const fromMatch = desc.match(/من\s+([^إالي,،–\-\n\d]+)/i);
  if (fromMatch && fromMatch[1]) {
    const clean = fromMatch[1].replace(/عهدة|حساب|الموظف|الأستاذ|السيد/g, '').trim();
    if (clean && !clean.startsWith('تاريخ') && !clean.startsWith('مبلغ') && !clean.startsWith('قيمة')) {
      fromWhom = clean;
    }
  }

  // Check for individual 'إلى' or 'الي' or 'لـ' match
  const toMatch = desc.match(/(?:إلى|الي|لـ|لصالح|للموظف)\s+([^,،–\-\n\d]+)/i);
  if (toMatch && toMatch[1]) {
    const clean = toMatch[1].replace(/عهدة|حساب|الموظف|الأستاذ|السيد/g, '').trim();
    if (clean && !clean.startsWith('تاريخ') && !clean.startsWith('مبلغ') && !clean.startsWith('قيمة')) {
      toWhom = clean;
    }
  }

  // Check specialized keywords
  if (desc.includes('رصيد افتتاحي') || desc.includes('رصيد سابق') || cat.includes('رصيد افتتاحي')) {
    fromWhom = 'رصيد افتتاحي مدور';
  } else if (desc.includes('توريد للخزينة') || desc.includes('إيداع بنكي') || desc.includes('توريد بنك')) {
    toWhom = 'الخزينة العامة / البنك';
  } else if (desc.includes('مبيعات') || cat.includes('مبيعات') || cat.includes('إيراد')) {
    fromWhom = 'إيرادات ومبيعات نقدية';
  }

  return { fromWhom, toWhom };
};

/**
 * Universal, ultra-robust parser for any report row format (GAS Object or Array tuple)
 */
export const parseReportRow = (row: any): NormalizedReportRow => {
  if (!row) {
    return {
      id: null,
      date: '',
      employee: 'عام',
      branch: 'المركز الرئيسي',
      type: '',
      category: 'عام',
      income: 0,
      expense: 0,
      amount: 0,
      description: '-',
      targetMonth: '',
      rawBalance: 0,
      raw: row
    };
  }

  // 1. If it's a JavaScript Object (returned by modern GAS script or Firebase)
  if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
    const rawAmt = parseFloat(row.amount) || 0;
    let inc = parseFloat(row.income) || 0;
    let exp = parseFloat(row.expense) || 0;
    const typeStr = String(row.type || '');
    const catStr = String(row.category || row.cat || 'عام');
    const descStr = String(row.description || row.desc || row.notes || row.details || '-');

    // If inc and exp were not explicitly provided, calculate them from amount and type/category
    if (inc === 0 && exp === 0 && rawAmt > 0) {
      if (isIncomeType(typeStr, catStr, descStr) || typeStr === 'Income' || typeStr === 'إيراد' || typeStr === 'تغذية عهدة' || typeStr === 'رصيد إفتتاحي') {
        inc = rawAmt;
      } else {
        exp = rawAmt;
      }
    }

    const finalAmount = rawAmt > 0 ? rawAmt : (inc > 0 ? inc : exp);

    return {
      id: row.id ?? row.rowId ?? row.rowIndex ?? null,
      date: String(row.date || '').split('T')[0],
      employee: String(row.employee || row.emp || 'عام').trim(),
      branch: String(row.branch || 'المركز الرئيسي').trim(),
      type: typeStr || (inc > 0 ? 'إيراد' : 'مصروف'),
      category: catStr,
      income: inc,
      expense: exp,
      amount: finalAmount,
      description: descStr,
      targetMonth: String(row.targetMonth || ''),
      rawBalance: typeof row.balance === 'number' ? row.balance : (parseFloat(row.balance) || 0),
      raw: row
    };
  }

  // 2. If it's an Array
  if (Array.isArray(row)) {
    // Check if row[0] is an ID (number like 1712345678 or timestamp) and row[1] is a date YYYY-MM-DD
    // Array format from Google Sheets mainSheet: [0:id, 1:date, 2:type, 3:category, 4:employee, 5:amount, 6:description, 7:branch]
    const isMainSheetFormat = (typeof row[0] === 'number' || (typeof row[0] === 'string' && /^\d{10,}$/.test(row[0]))) &&
                              (typeof row[1] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row[1]));

    if (isMainSheetFormat) {
      const idVal = row[0];
      const dateVal = String(row[1] || '').split('T')[0];
      const typeVal = String(row[2] || '');
      const catVal = String(row[3] || 'عام');
      const empVal = String(row[4] || 'عام').trim();
      const amtVal = parseFloat(row[5]) || 0;
      const descVal = String(row[6] || '-');
      const branchVal = String(row[7] || 'المركز الرئيسي').trim();

      let inc = 0;
      let exp = 0;
      if (isIncomeType(typeVal, catVal, descVal) || typeVal === 'Income' || typeVal === 'إيراد' || typeVal === 'تغذية عهدة' || typeVal === 'رصيد إفتتاحي') {
        inc = amtVal;
      } else {
        exp = amtVal;
      }

      return {
        id: idVal,
        date: dateVal,
        employee: empVal,
        branch: branchVal,
        type: typeVal,
        category: catVal,
        income: inc,
        expense: exp,
        amount: amtVal,
        description: descVal,
        targetMonth: '',
        rawBalance: 0,
        raw: row
      };
    }

    // Standard 10-column report tuple: [0:date, 1:emp, 2:branch, 3:type, 4:cat, 5:inc, 6:exp, 7:bal, 8:desc, 9:targetMonth, 10:id]
    const inc = parseFloat(row[5]) || 0;
    const exp = parseFloat(row[6]) || 0;
    const typeVal = String(row[3] || (inc > 0 ? 'إيراد' : 'مصروف'));
    const catVal = String(row[4] || 'عام');
    const descVal = row.length > 8 && row[8] !== undefined ? String(row[8]) : (typeof row[7] === 'string' ? String(row[7]) : '-');
    const amt = inc > 0 ? inc : exp;

    return {
      id: row.length > 10 ? row[10] : (row[0] && typeof row[0] === 'number' ? row[0] : null),
      date: String(row[0] || '').split('T')[0],
      employee: String(row[1] || 'عام').trim(),
      branch: String(row[2] || 'المركز الرئيسي').trim(),
      type: typeVal,
      category: catVal,
      income: inc,
      expense: exp,
      amount: amt,
      description: descVal,
      targetMonth: row.length > 9 ? String(row[9] || '') : '',
      rawBalance: parseFloat(row[7]) || 0,
      raw: row
    };
  }

  return {
    id: null,
    date: '',
    employee: 'عام',
    branch: 'المركز الرئيسي',
    type: '',
    category: 'عام',
    income: 0,
    expense: 0,
    amount: 0,
    description: '-',
    targetMonth: '',
    rawBalance: 0,
    raw: row
  };
};


