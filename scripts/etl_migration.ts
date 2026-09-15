import * as xlsx from 'xlsx';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// ضبط متغيرات البيئة والاتصال بـ Supabase
// ============================================================================
const SUPABASE_URL: string = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY: string = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const EXCEL_FILE_PATH: string = './data/cash_ledger_source.xlsx';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('تنبيه: SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY غير محددين، يتم العمل في وضع المحاكاة أو الإعداد المسبق.');
}

const supabase: SupabaseClient = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_SERVICE_ROLE_KEY || 'placeholder', {
  auth: { persistSession: false }
});

interface ExcelRawTransaction {
  ID?: any;
  Date?: any;
  Employee?: any;
  Branch?: any;
  Type?: any;
  Category?: any;
  Amount?: any;
  Description?: any;
  Related_ID?: any;
  Timestamp?: any;
  'رقم الكمبيوتر'?: any;
}

interface ExcelRawEmployee {
  'Employee Name'?: any;
  'Current Balance'?: any;
  Status?: any;
}

interface ProcessedTransaction {
  id: string;
  date: string;
  employee: string;
  branch: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  relatedId: string | null;
  timestamp: string | null;
  rawRow: ExcelRawTransaction;
  rowIndex: number;
  isMonthlyClosingIntent: boolean;
  isZeroingCycleIntent: boolean;
}

function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

function parseKWD(val: any): number {
  if (val === null || val === undefined || val === '') return 0.000;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  if (isNaN(parsed)) return 0.000;
  return Math.round(parsed * 1000) / 1000;
}

function parseISODate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + val * 86400000);
    return jsDate.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function extractAccrualMonth(dateStr: string, description: string): string {
  const desc = description.toLowerCase();
  const yearMatch = dateStr.substring(0, 4);

  if (desc.includes('شهر 1 ') || desc.includes('يناير')) return `${yearMatch}-01`;
  if (desc.includes('شهر 2 ') || desc.includes('فبراير')) return `${yearMatch}-02`;
  if (desc.includes('شهر 3 ') || desc.includes('مارس')) return `${yearMatch}-03`;
  if (desc.includes('شهر 4 ') || desc.includes('ابريل')) return `${yearMatch}-04`;
  if (desc.includes('شهر 5 ') || desc.includes('مايو')) return `${yearMatch}-05`;
  if (desc.includes('شهر 6 ') || desc.includes('يونيو')) return `${yearMatch}-06`;
  if (desc.includes('شهر 7 ') || desc.includes('يوليو')) return `${yearMatch}-07`;
  if (desc.includes('شهر 8 ') || desc.includes('اغسطس')) return `${yearMatch}-08`;
  if (desc.includes('شهر 9 ') || desc.includes('سبتمبر')) return `${yearMatch}-09`;
  if (desc.includes('شهر 10') || desc.includes('اكتوبر')) return `${yearMatch}-10`;
  if (desc.includes('شهر 11') || desc.includes('نوفمبر')) return `${yearMatch}-11`;
  if (desc.includes('شهر 12') || desc.includes('ديسمبر')) return `${yearMatch}-12`;

  return dateStr.substring(0, 7);
}

function checkClosingIntent(type: string, desc: string, cat: string): { isClosing: boolean; isZeroing: boolean } {
  const combined = `${type} ${desc} ${cat}`.toLowerCase();
  const isZeroing = combined.includes('تصفير') || combined.includes('تصفير شهر');
  const isClosing = isZeroing || combined.includes('إغلاق') || combined.includes('اغلاق') || combined.includes('تص') || combined.includes('اقفال');
  return { isClosing, isZeroing };
}

async function syncJournalEntryWithLines(
  entryNumber: string,
  entryDate: string,
  referenceType: string,
  referenceId: string,
  memo: string,
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    branchId?: string | null;
    custodianId?: string | null;
    notes?: string | null;
  }>
): Promise<void> {
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .upsert({
      entry_number: entryNumber,
      entry_date: entryDate,
      reference_type: referenceType,
      reference_id: referenceId,
      memo: memo,
      is_posted: true
    }, { onConflict: 'entry_number' })
    .select('id')
    .single();

  if (jeErr || !je) {
    console.error(`خطأ في إنشاء رأس القيد ${entryNumber}:`, jeErr);
    return;
  }

  // حذف السطور القديمة لتجنب التكرار تماماً
  await supabase
    .from('journal_entry_lines')
    .delete()
    .eq('journal_entry_id', je.id);

  const linesToInsert = lines.map(l => ({
    journal_entry_id: je.id,
    account_id: l.accountId,
    debit: l.debit,
    credit: l.credit,
    branch_id: l.branchId || null,
    custodian_id: l.custodianId || null,
    notes: l.notes || memo
  }));

  await supabase.from('journal_entry_lines').insert(linesToInsert);
}

export async function executeEnterpriseETL(): Promise<void> {
  console.log('بدء تشغيل سكربت الترحيل والتدقيق المالي المحاسبي المتقدم (KWD Finance)');
}
