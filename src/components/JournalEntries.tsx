import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Download, 
  Printer, 
  RefreshCw, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Layers, 
  ArrowRightLeft, 
  CheckCircle2, 
  FileSpreadsheet,
  Building,
  Calendar,
  User,
  Scale,
  FileText
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';
import { parseReportRow, matchBranch, normalizeArabic, formatKWD } from '../utils/format';
import VoucherModal, { VoucherData } from './VoucherModal';

interface JournalEntriesProps {
  balances: EmployeeBalance[];
  branches: string[];
  categories: string[];
  employees: string[];
  onRefresh: () => void;
}

interface JournalLine {
  id: string;
  voucherNo: string;
  date: string;
  accountDebit: string;
  accountCredit: string;
  debit: number;
  credit: number;
  statement: string;
  branch: string;
  employee: string;
  category: string;
  refNo?: string;
}

export default function JournalEntries({
  balances,
  branches,
  categories,
  employees,
  onRefresh
}: JournalEntriesProps) {
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await gasService.getReport({}, true);
      setReportRows(data?.rows || []);
    } catch (e) {
      console.error('Failed to load transactions for journal:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Convert raw rows into professional Double-Entry Accounting Journal Entries
  const journalEntries: JournalLine[] = useMemo(() => {
    const entries: JournalLine[] = [];

    reportRows.forEach((r, idx) => {
      const pRow = parseReportRow(r);
      const date = pRow.date || '';
      const type = pRow.type || '';
      const cat = pRow.category || 'مصروفات متنوعة';
      const desc = pRow.description || '';
      const inc = pRow.income;
      const exp = pRow.expense;
      const branch = pRow.branch || 'المركز الرئيسي';
      const employee = pRow.employee || 'الخزينة';
      
      const voucherNo = `JV-${date ? date.replace(/-/g, '').slice(2) : '000000'}-${String(idx + 1).padStart(4, '0')}`;

      // Check if Accrual (Purchase on credit)
      const isSettlement = /سداد|تسوية/i.test(cat + " " + desc);
      const isAccrual = isSettlement ? false : /آجل|اجل|مستحق|مستحقة|مستحقه|رواتب مستحقة|دين|دائن|مورد|مؤجل|غير مسدد|لم يسدد/i.test(cat + " " + desc);

      if (exp > 0) {
        if (isAccrual) {
          // Accrual Entry: Dr. Expense / Cr. Accounts Payable (الموردين والالتزامات)
          entries.push({
            id: `j-${idx}-1`,
            voucherNo,
            date,
            accountDebit: `حـ/ مصروفات ${cat} - فرع ${branch}`,
            accountCredit: `حـ/ أرصدة دائنة وموردين (${desc || cat})`,
            debit: exp,
            credit: exp,
            statement: `إثبات استحقاق: ${desc || cat}`,
            branch,
            employee,
            category: cat
          });
        } else {
          // Cash Expense: Dr. Expense Account / Cr. Employee Custody Account
          entries.push({
            id: `j-${idx}-1`,
            voucherNo,
            date,
            accountDebit: `حـ/ مصروفات ${cat} - فرع ${branch}`,
            accountCredit: `حـ/ عهدة نقدية للموظف - ${employee}`,
            debit: exp,
            credit: exp,
            statement: `صرف نقدي من العهدة: ${desc || cat}`,
            branch,
            employee,
            category: cat
          });
        }
      } else if (inc > 0) {
        if (type.includes('تحويل') || desc.includes('تحويل') || cat.includes('تحويل')) {
          // Transfer between accounts / Custody Feeding
          entries.push({
            id: `j-${idx}-1`,
            voucherNo,
            date,
            accountDebit: `حـ/ عهدة نقدية للموظف - ${employee}`,
            accountCredit: `حـ/ الصندوق الرئيسي / البنك`,
            debit: inc,
            credit: inc,
            statement: `تغذية عهدة نقدية: ${desc || 'إيداع/تحويل رصيد'}`,
            branch,
            employee,
            category: cat
          });
        } else {
          // General Income / Settlement
          entries.push({
            id: `j-${idx}-1`,
            voucherNo,
            date,
            accountDebit: `حـ/ عهدة نقدية للموظف - ${employee}`,
            accountCredit: `حـ/ إيرادات متنوعة وتسويات`,
            debit: inc,
            credit: inc,
            statement: `تسجيل إيراد / تسوية: ${desc || cat}`,
            branch,
            employee,
            category: cat
          });
        }
      }
    });

    return entries.reverse(); // Newest first
  }, [reportRows]);

  // Filtered Journal Entries
  const filteredEntries = useMemo(() => {
    return journalEntries.filter(entry => {
      if (selectedBranch !== 'all' && !matchBranch(entry.branch, selectedBranch)) return false;
      if (selectedEmployee !== 'all' && entry.employee !== selectedEmployee) return false;
      if (selectedCategory !== 'all' && entry.category !== selectedCategory) return false;
      if (searchTerm) {
        const q = normalizeArabic(searchTerm.toLowerCase().trim());
        const matches = 
          normalizeArabic(entry.voucherNo).includes(q) ||
          normalizeArabic(entry.statement).includes(q) ||
          normalizeArabic(entry.accountDebit).includes(q) ||
          normalizeArabic(entry.accountCredit).includes(q) ||
          normalizeArabic(entry.employee).includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [journalEntries, selectedBranch, selectedEmployee, selectedCategory, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    filteredEntries.forEach(e => {
      totalDebit += e.debit;
      totalCredit += e.credit;
    });
    return {
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.001,
      count: filteredEntries.length
    };
  }, [filteredEntries]);

  const copyAsText = () => {
    const text = filteredEntries.map(e => 
      `${e.date}\t${e.voucherNo}\t${e.accountDebit}\t${e.debit.toFixed(3)}\t0.000\t${e.statement}\n` +
      `${e.date}\t${e.voucherNo}\t${e.accountCredit}\t0.000\t${e.credit.toFixed(3)}\t${e.statement}`
    ).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const exportCSV = () => {
    const headers = ['التاريخ', 'رقم السند', 'الحساب المدين (Dr)', 'الحساب الدائن (Cr)', 'المبلغ المدين (KWD)', 'المبلغ الدائن (KWD)', 'البيان المحاسبي', 'الفرع', 'الموظف'];
    const rows = filteredEntries.map(e => [
      `"${e.date}"`,
      `"${e.voucherNo}"`,
      `"${e.accountDebit}"`,
      `"${e.accountCredit}"`,
      e.debit.toFixed(3),
      e.credit.toFixed(3),
      `"${e.statement.replace(/"/g, '""')}"`,
      `"${e.branch}"`,
      `"${e.employee}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Journal_Entries_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Banner - Control & Export Bar */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
            <BookOpen size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                النظام المحاسبي المزدوج (Double-Entry Engine)
              </span>
              <span className="text-xs text-emerald-400 font-bold">• قيود متوازنة 100%</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">دفتر القيود المحاسبية اليومية وميزان الحركة</h1>
            <p className="text-xs text-slate-300 font-bold mt-1">
              توليد قيود اليومية آلياً (من حـ/ مدين إلى حـ/ دائن) بدقة الفلس الكويتي وجاهزة للترحيل إلى ERP أو Excel
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => {
              loadData();
              onRefresh();
            }}
            disabled={loading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl border border-slate-600 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
            <span>تحديث القيود</span>
          </button>

          <button
            onClick={copyAsText}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl border border-slate-600 transition-all cursor-pointer"
            title="نسخ جدول القيود المحاسبية لبرنامج المحاسبة أو الإكسيل"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'تم النسخ بنجاح' : 'نسخ القيود'}</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>تصدير Excel / CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl border border-slate-600 transition-all cursor-pointer"
            title="طباعة دفتر القيود"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Accounting Totals & Balance Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        {/* Total Debit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase">إجمالي الجانب المدين (Dr.)</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">
              {totals.totalDebit.toFixed(3)} <span className="text-xs font-normal">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">{totals.count} قيد محاسبي</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Scale size={22} />
          </div>
        </div>

        {/* Total Credit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase">إجمالي الجانب الدائن (Cr.)</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">
              {totals.totalCredit.toFixed(3)} <span className="text-xs font-normal">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">مطابق تماماً للمدين</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Scale size={22} />
          </div>
        </div>

        {/* Double-Entry Equilibrium Check */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
          totals.isBalanced ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <div>
            <p className="text-[11px] font-black text-slate-600">شرط توازن القيود المحاسبية</p>
            <p className="text-lg font-black mt-1 flex items-center gap-1.5">
              {totals.isBalanced ? (
                <>
                  <CheckCircle2 size={18} className="text-emerald-600 inline" />
                  <span>الدفتر متوازن 100% (المدين = الدائن)</span>
                </>
              ) : (
                <span>⚠️ يوجد عدم توازن بمقدار {Math.abs(totals.totalDebit - totals.totalCredit).toFixed(3)} د.ك</span>
              )}
            </p>
            <p className="text-[10px] text-emerald-700 font-bold mt-0.5">معتمد ومطابق للمعايير المحاسبية الدولية</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar - Hidden on print */}
      <div className="no-print bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="بحث برقم السند، الحساب، البيان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Branch Filter */}
          <div className="relative">
            <Building className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">كافة الفروع</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div className="relative">
            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">كافة أمناء العهد</option>
              {employees.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Layers className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">كافة بنود وتصنيفات المصروفات</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Letterhead - Visible only when printing */}
      <div className="hidden print:block mb-6 p-4 border-b-2 border-slate-900 bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-950">دفتر اليومية العامة وسجل القيود المحاسبية</h1>
            <p className="text-xs text-slate-600 font-bold mt-1">نظام إدارة العهد والمصروفات — دولة الكويت</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">تاريخ الاستخراج والطباعة: {new Date().toLocaleDateString('ar-KW')} - {new Date().toLocaleTimeString('ar-KW')}</p>
          </div>
          <div className="text-left bg-slate-50 p-2.5 rounded-xl border border-slate-300">
            <span className="text-[9px] text-slate-500 font-bold block">إجمالي توازن القيود (Dr = Cr)</span>
            <span className="text-lg font-black font-mono text-slate-900">{totals.totalDebit.toFixed(3)} د.ك</span>
            <span className="text-[9px] text-emerald-700 font-bold block mt-0.5">قيود متوازنة ومعتمدة 100%</span>
          </div>
        </div>
      </div>

      {/* Main Journal Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-black text-slate-900">دفتر اليومية العامة وسجل القيود التفصيلي</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              عرض القيود المحاسبية بصيغة طرف مدين وطرف دائن متطابقة
            </p>
          </div>
          <span className="text-xs font-black text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-mono">
            {filteredEntries.length} قيد مسجل
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-24">التاريخ</th>
                <th className="p-3.5 w-28">رقم السند</th>
                <th className="p-3.5">طرفي القيد المحاسبي (دليل الحسابات)</th>
                <th className="p-3.5">البيان والشرح المحاسبي</th>
                <th className="p-3.5 text-left w-28 text-blue-800">مدين Dr. (د.ك)</th>
                <th className="p-3.5 text-left w-28 text-indigo-800">دائن Cr. (د.ك)</th>
                <th className="p-3.5 w-24">الفرع</th>
                <th className="p-3.5 w-24 text-center no-print">طباعة السند</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold">
              {filteredEntries.map((e, index) => (
                <React.Fragment key={e.id}>
                  {/* Debit Line */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td rowSpan={2} className="p-3.5 text-slate-500 font-mono text-[11px] align-top border-l border-slate-100 bg-slate-50/30">
                      {e.date}
                    </td>
                    <td rowSpan={2} className="p-3.5 font-mono text-[11px] font-black text-slate-700 align-top border-l border-slate-100 bg-slate-50/30">
                      {e.voucherNo}
                    </td>
                    <td className="p-2.5 font-black text-slate-900 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-mono">من حـ/</span>
                      <span className="text-blue-950">{e.accountDebit}</span>
                    </td>
                    <td rowSpan={2} className="p-3.5 text-slate-600 align-top max-w-xs text-[11px]">
                      {e.statement}
                    </td>
                    <td className="p-2.5 text-left font-mono font-black text-blue-700">
                      {e.debit.toFixed(3)}
                    </td>
                    <td className="p-2.5 text-left font-mono text-slate-300">
                      —
                    </td>
                    <td rowSpan={2} className="p-3.5 text-slate-500 align-top text-[11px]">
                      {e.branch}
                    </td>
                    <td rowSpan={2} className="p-3.5 align-top text-center no-print border-r border-slate-100">
                      <button
                        onClick={() => {
                          setActiveVoucher({
                            voucherNo: e.voucherNo,
                            voucherType: 'Journal',
                            date: e.date,
                            amount: e.debit,
                            employee: e.employee,
                            branch: e.branch,
                            category: e.category,
                            description: e.statement,
                            accountDebit: e.accountDebit,
                            accountCredit: e.accountCredit,
                            paymentMethod: 'Cash'
                          });
                          setIsVoucherModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        title="معاينة وطباعة سند قيد اليومية"
                      >
                        <FileText size={12} />
                        <span>سند</span>
                      </button>
                    </td>
                  </tr>

                  {/* Credit Line */}
                  <tr className="bg-slate-50/30 hover:bg-slate-50/50 transition-colors border-b-2 border-slate-100">
                    <td className="p-2.5 font-black text-slate-700 pr-6 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[9px] font-mono">إلى حـ/</span>
                      <span className="text-indigo-950">{e.accountCredit}</span>
                    </td>
                    <td className="p-2.5 text-left font-mono text-slate-300">
                      —
                    </td>
                    <td className="p-2.5 text-left font-mono font-black text-indigo-700">
                      {e.credit.toFixed(3)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    لا توجد قيود محاسبية مطابقة لمعايير البحث الحالية
                  </td>
                </tr>
              )}
            </tbody>

            {/* Total Balance Summary Foot */}
            <tfoot className="bg-slate-900 text-white font-black">
              <tr>
                <td colSpan={4} className="p-4 text-xs font-black">
                  إجمالي حركة دفتر القيود المحاسبية:
                </td>
                <td className="p-4 text-left font-mono text-sm text-emerald-400 font-black">
                  {totals.totalDebit.toFixed(3)} د.ك
                </td>
                <td className="p-4 text-left font-mono text-sm text-emerald-400 font-black">
                  {totals.totalCredit.toFixed(3)} د.ك
                </td>
                <td className="p-4 text-center text-[10px] text-emerald-400">
                  متطابق ✅
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Official Signatures Footer Block for Printing */}
      <div className="hidden print:block print-signatures-block">
        <div className="print-signature-box">
          <p>إعداد المحاسب القانوني</p>
          <div className="print-signature-line">التوقيع والتاريخ</div>
        </div>
        <div className="print-signature-box">
          <p>المراجع والمدقق المالي</p>
          <div className="print-signature-line">التوقيع والتاريخ</div>
        </div>
        <div className="print-signature-box">
          <p>اعتماد الإدارة المالية العامة</p>
          <div className="print-signature-line">الختم والاعتماد</div>
        </div>
      </div>

      {/* Voucher Print Modal */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        voucher={activeVoucher}
      />
    </div>
  );
}
