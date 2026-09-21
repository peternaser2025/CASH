/**
 * Financial formatting and accounting utilities for KWD (Kuwaiti Dinar)
 */

/**
 * Unifies, sanitizes, and standardizes any date value coming from Excel (.xlsx, .xls),
 * Google Sheets (GAS API, getValues), or CSV imports into the standard ISO format: YYYY-MM-DD
 * 
 * Handles:
 * - Excel Serial Days (e.g. 45532, "45532", 45532.5) using standard 1899-12-30 epoch
 * - JavaScript Date objects (from XLSX cellDates or Google Apps Script getValues())
 * - Arabic / Eastern-Indic digits (e.g. ٢٠٢٤/٠٩/٢٥ or ٢٥-٠٩-٢٠٢٤ -> 2024-09-25)
 * - Gulf / Middle East / British notation: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, D/M/YYYY
 * - US notation: MM/DD/YYYY (when month <= 12 and day > 12)
 * - ISO notation: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - Short 2-digit years: DD/MM/YY or YY-MM-DD (e.g. 24 -> 2024)
 * - Datetimes with timestamps: "2024-09-25 14:30:00", "2024-09-25T14:30:00.000Z"
 * - Epoch timestamps in milliseconds or seconds
 */
export const normalizeExcelDate = (val: any): string => {
  if (val === undefined || val === null) return '';

  // 1. If it's already a Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If it's a Number
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return '';
    // Epoch timestamp in milliseconds (e.g. 1712345678000)
    if (val > 100000000000) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    // Epoch timestamp in seconds (e.g. 1712345678)
    if (val > 1000000000) {
      const d = new Date(val * 1000);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    // Excel serial number (typically between 1000 and 100000, e.g. 45532 = 2024-08-28)
    if (val >= 1000 && val <= 100000) {
      const wholeDays = Math.floor(val);
      // Base epoch for Excel: 1899-12-30 UTC
      const epochMs = Date.UTC(1899, 11, 30);
      const targetDate = new Date(epochMs + wholeDays * 86400000);
      const y = targetDate.getUTCFullYear();
      const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  let str = String(val).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '';

  // 3. Convert Arabic/Eastern-Indic digits to standard 0-9
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(arabicDigits[i], 'g'), String(i));
    str = str.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }

  // Strip leading/trailing quotes
  str = str.replace(/^["']+|["']+$/g, '').trim();

  // 4. If string is a numeric string (e.g. "45532" or "45532.5")
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (!isNaN(num) && num >= 1000 && num <= 100000) {
      const wholeDays = Math.floor(num);
      const epochMs = Date.UTC(1899, 11, 30);
      const targetDate = new Date(epochMs + wholeDays * 86400000);
      const y = targetDate.getUTCFullYear();
      const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 5. Check ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 6. Check Middle East / British format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    let d = p1;
    let m = p2;
    // If first number is <= 12 and second number is > 12, it's MM/DD/YYYY
    if (p1 <= 12 && p2 > 12) {
      m = p1;
      d = p2;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 7. Check 2-digit year format: DD/MM/YY or YY-MM-DD
  const dmyShortMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const p1 = parseInt(dmyShortMatch[1], 10);
    const p2 = parseInt(dmyShortMatch[2], 10);
    let yr = parseInt(dmyShortMatch[3], 10);
    yr = yr < 50 ? 2000 + yr : 1900 + yr;
    let d = p1;
    let m = p2;
    if (p1 <= 12 && p2 > 12) {
      m = p1;
      d = p2;
    }
    return `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 8. General Date parsing fallback (e.g. "Wed Sep 25 2024", "25 Sep 2024", "September 25, 2024")
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    if (y >= 1990 && y <= 2100) {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  // 9. Fallback: split by 'T' or space if it matches standard date
  const cleanPart = str.split(/[ T]/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanPart)) {
    return cleanPart;
  }

  return cleanPart || '';
};

/**
 * Validates whether an arbitrary cell or value looks like a valid date representation
 */
export const isValidDateLike = (val: any): boolean => {
  if (val === null || val === undefined || val === '') return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') {
    return (val >= 1000 && val <= 100000) || val > 1000000000;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return false;
    // Pure numeric Excel serial
    if (/^\d{4,5}(\.\d+)?$/.test(s)) {
      const num = parseFloat(s);
      return num >= 1000 && num <= 100000;
    }
    // Formats with separators
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) return true;
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(s)) return true;
    if (/^[٠-٩]{4}[-/.]/.test(s) || /^[٠-٩]{1,2}[-/.]/.test(s)) return true;
    const p = Date.parse(s);
    if (!isNaN(p)) {
      const y = new Date(p).getFullYear();
      return y >= 1990 && y <= 2100;
    }
  }
  return false;
};

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

export const normalizeArabic = normalizeArabicSearch;

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
  department?: string | null;
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
    let inc = parseFloat(row.income !== undefined ? row.income : (row.in || 0)) || 0;
    let exp = parseFloat(row.expense !== undefined ? row.expense : (row.out || 0)) || 0;
    const typeStr = String(row.type || '');
    const catStr = String(row.category || row.cat || 'عام');
    const descStr = String(row.description || row.desc || row.notes || row.details || '-');
    const empStr = String(row.employee || row.emp || row.user || 'عام').trim();
    const branchStr = String(row.branch || row.location || 'المركز الرئيسي').trim();

    // If inc and exp were not explicitly provided, calculate them from amount and type/category
    if (inc === 0 && exp === 0 && rawAmt > 0) {
      if (isIncomeType(typeStr, catStr, descStr) || typeStr === 'Income' || typeStr === 'إيراد' || typeStr === 'تغذية عهدة' || typeStr === 'رصيد إفتتاحي') {
        inc = rawAmt;
      } else {
        exp = rawAmt;
      }
    }

    const finalAmount = rawAmt > 0 ? rawAmt : (inc > 0 ? inc : exp);
    const unifiedDate = normalizeExcelDate(row.date ?? row.Date ?? row['التاريخ'] ?? row['تاريخ'] ?? row.time ?? row.timestamp);

    return {
      id: row.id ?? row.rowId ?? row.rowIndex ?? null,
      date: unifiedDate,
      employee: empStr || 'عام',
      branch: branchStr || 'المركز الرئيسي',
      department: row.department ? String(row.department).trim() : null,
      type: typeStr || (inc > 0 ? 'إيراد' : 'مصروف'),
      category: catStr,
      income: inc,
      expense: exp,
      amount: finalAmount,
      description: descStr,
      targetMonth: String(row.targetMonth || row.month || ''),
      rawBalance: typeof row.balance === 'number' ? row.balance : (parseFloat(row.balance) || 0),
      raw: row
    };
  }

  // 2. If it's an Array
  if (Array.isArray(row)) {
    // Check if row[1] is a Date: Format [0:id, 1:date, 2:type, 3:category, 4:employee, 5:amount, 6:description, 7:branch]
    const isMainSheetWithId = isValidDateLike(row[1]) && (row.length <= 9 || !isValidDateLike(row[0]));

    if (isMainSheetWithId) {
      const idVal = row[0];
      const dateVal = normalizeExcelDate(row[1]);
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

    // Check if row[0] is Date and row[1] is a transaction Type: [0:date, 1:type, 2:category, 3:employee, 4:amount, 5:description, 6:branch]
    const isMainSheetWithoutId = isValidDateLike(row[0]) &&
                                 row.length <= 8 &&
                                 typeof row[1] === 'string' &&
                                 (row[1].includes('مصروف') || row[1].includes('إيراد') || row[1].includes('Expense') || row[1].includes('Income') || row[1].includes('تحويل'));

    if (isMainSheetWithoutId) {
      const dateVal = normalizeExcelDate(row[0]);
      const typeVal = String(row[1] || '');
      const catVal = String(row[2] || 'عام');
      const empVal = String(row[3] || 'عام').trim();
      const amtVal = parseFloat(row[4]) || 0;
      const descVal = String(row[5] || '-');
      const branchVal = String(row[6] || 'المركز الرئيسي').trim();

      let inc = 0;
      let exp = 0;
      if (isIncomeType(typeVal, catVal, descVal) || typeVal === 'Income' || typeVal === 'إيراد') {
        inc = amtVal;
      } else {
        exp = amtVal;
      }

      return {
        id: null,
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
    const dateVal = normalizeExcelDate(row[0]);

    return {
      id: row.length > 10 ? row[10] : (row[0] && typeof row[0] === 'number' && !isValidDateLike(row[0]) ? row[0] : null),
      date: dateVal,
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


