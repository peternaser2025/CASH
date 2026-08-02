import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Filter, 
  Printer, 
  Download, 
  FileSpreadsheet,
  Search, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  User, 
  Building2, 
  ArrowRightLeft, 
  ArrowRight,
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  Info,
  CalendarClock,
  Edit2,
  Trash2,
  BarChart3,
  PieChart as PieChartIcon,
  X
} from 'lucide-react';
import { exportReportToExcel } from '../utils/excelExport';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { gasService } from '../services/gasService';
import { ReportFilter, ReportData, EmployeeBalance } from '../types';
import { formatKWD, isIncomeType, isExpenseType, isTransferType, isAccrualType } from '../utils/format';

interface ReportViewerProps {
  employees: string[];
  balances: EmployeeBalance[];
  branches: string[];
  categories: string[];
}

export default function ReportViewer({ employees, balances, branches, categories }: ReportViewerProps) {
  const [filters, setFilters] = useState<ReportFilter>({
    employee: '',
    branch: '',
    type: 'All',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [accrualFilter, setAccrualFilter] = useState<'All' | 'Due' | 'Paid'>('All');

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !editingTransaction.id) return;
    
    setIsUpdating(true);
    // Ensure amount is a number and targetMonth is cleaned
    const updatedData = {
      ...editingTransaction,
      amount: parseFloat(String(editingTransaction.amount)),
      targetMonth: editingTransaction.targetMonth || ''
    };
    
    const res = await gasService.updateTransaction(editingTransaction.id, updatedData);
    setIsUpdating(false);
    
    if (res.success) {
      setIsEditModalOpen(false);
      handleGenerate(); // Re-fetch report
      alert('تم تحديث العملية بنجاح');
    } else {
      alert('خطأ في التحديث: ' + res.error);
    }
  };
  const [printSettings, setPrintSettings] = useState({
    margins: 'narrow' as 'none' | 'narrow' | 'normal' | 'wide',
    fontSize: 'normal' as 'small' | 'normal' | 'large',
    orientation: 'landscape' as 'portrait' | 'landscape',
    scale: 100,
    showSummary: true
  });
  const [showPrintConfig, setShowPrintConfig] = useState(false);

  const getPageMargins = () => {
    switch (printSettings.margins) {
      case 'none': return '0';
      case 'narrow': return '5mm';
      case 'wide': return '20mm';
      default: return '10mm';
    }
  };

  const getFontSize = () => {
    switch (printSettings.fontSize) {
      case 'small': return '7pt';
      case 'large': return '11pt';
      default: return '9pt';
    }
  };

  const handleGenerate = async () => {
    if (!filters.employee && !filters.branch) {
      setError('يرجى اختيار موظف أو فرع على الأقل لتوليد التقرير');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const cleanFilters = {
        ...filters,
        type: filters.type === 'All' ? '' : filters.type,
        startDate: filters.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: filters.endDate || new Date().toISOString().split('T')[0]
      };

      const data = await gasService.getReport(cleanFilters);
      
      if (!data) {
        setError('لم يتم العثور على بيانات لهذا البحث. يرجى التأكد من اختيار الموظف الصحيح أو الفترة الزمنية.');
      } else if (!Array.isArray(data.rows)) {
        setError('تنسيق البيانات المستلمة غير صحيح. يرجى مراجعة السيرفر.');
      } else {
        setReport(data);
        if (data.rows.length === 0) {
          setError('لا توجد حركات مسجلة لهذا الموظف في هذه الفترة.');
        }
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع أثناء جلب التقرير.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredRows = report ? report.rows.filter(row => {
    const type = String(row[3] || '');
    const category = String(row[4] || '');
    const description = row.length > 8 ? String(row[8] || '') : '';
    
    const isTransactionAccrued = isAccrualType(type, category, description);

    if (accrualFilter === 'Due') return isTransactionAccrued;
    if (accrualFilter === 'Paid') return !isTransactionAccrued;
    return true;
  }) : [];

  const isUnpaidAccrualRow = (row: any) => {
    const type = String(row[3] || '');
    const category = String(row[4] || '');
    const description = row.length > 8 ? String(row[8] || '') : '';
    return isAccrualType(type, category, description);
  };

  const filteredIn = filteredRows.reduce((acc, row) => {
    const type = String(row[3] || '');
    const category = String(row[4] || '');
    if (isTransferType(type, category)) return acc;
    return acc + (parseFloat(row[5]) || 0);
  }, 0);

  // Actual cash paid out from treasury/box (EXCLUDES unpaid credit purchases)
  const filteredCashOut = filteredRows.reduce((acc, row) => {
    const type = String(row[3] || '');
    const category = String(row[4] || '');
    if (isTransferType(type, category)) return acc;
    if (isUnpaidAccrualRow(row)) return acc; // DO NOT deduct unpaid accruals from cash outflow!
    return acc + (parseFloat(row[6]) || 0);
  }, 0);

  // Unpaid credit accruals (tracked separately - no cash impact)
  const filteredUnpaidAccruals = filteredRows.reduce((acc, row) => {
    const type = String(row[3] || '');
    const category = String(row[4] || '');
    if (isTransferType(type, category)) return acc;
    if (isUnpaidAccrualRow(row)) return acc + (parseFloat(row[6]) || 0);
    return acc;
  }, 0);

  // Total costs accrued (cash + unpaid accruals) for accrual context
  const filteredTotalCosts = filteredCashOut + filteredUnpaidAccruals;

  // Actual Cash Box Balance (السيولة النقدية المتوفرة بالخزنة)
  const cashEndingBalance = (parseFloat(report?.openingBalance || '0') || 0) + filteredIn - filteredCashOut;

  const handleExportExcel = () => {
    if (!report) return;
    const fileName = `كشف_حساب_${filters.employee || 'كل_الموظفين'}_${filters.startDate}_إلى_${filters.endDate}`;
    
    const headers = [
      'التاريخ',
      'الفرع',
      'التصنيف',
      'الموظف المسؤول',
      'البيان والتفاصيل',
      'حالة الدفع',
      'وارد (+)',
      'صادر (-)',
      'الرصيد التراكمي'
    ];

    let runningBalance = parseFloat(report.openingBalance || '0') || 0;
    
    const rows = filteredRows.map(row => {
      const date = String(row[0] || '');
      const emp = String(row[1] || '');
      const branch = String(row[2] || '');
      const type = String(row[3] || '');
      const cat = String(row[4] || '');
      const inc = parseFloat(row[5]) || 0;
      const exp = parseFloat(row[6]) || 0;
      const desc = String(row[7] || '');
      const isAccrued = isUnpaidAccrualRow(row);
      
      if (!isAccrued) {
        if (isTransferType(type, cat)) {
          if (filters.employee && emp === filters.employee) {
            runningBalance += inc - exp;
          }
        } else {
          runningBalance += inc - exp;
        }
      }

      return [
        date,
        branch,
        cat || (isTransferType(type, cat) ? 'تحويل مالي' : 'عام'),
        emp,
        desc,
        isAccrued ? 'آجل / غير مدفوع' : 'نقدي / مسدد',
        inc > 0 ? inc : 0,
        exp > 0 ? exp : 0,
        runningBalance
      ];
    });

    exportReportToExcel({
      fileName,
      sheetName: 'كشف الحساب التفصيلي',
      reportTitle: 'كشف الحساب المالي التدقيقي والتفصيلي',
      subtitle: `الموظف المسؤول: ${filters.employee || 'كافة الموظفين'} | الفرع: ${filters.branch || 'كافة الفروع'} | الفترة: من ${filters.startDate} إلى ${filters.endDate}`,
      summaryCards: [
        { label: 'الرصيد الافتتاحي (د.ك)', value: formatKWD(report.openingBalance) },
        { label: 'إجمالي التوريدات والمقبوضات (+)', value: formatKWD(filteredIn) },
        { label: 'إجمالي المدفوعات النقدية (-)', value: formatKWD(filteredCashOut) },
        { label: 'مشتريات وآجل مستحق', value: formatKWD(filteredUnpaidAccruals) },
        { label: 'رصيد السيولة بالصندوق', value: formatKWD(cashEndingBalance) },
      ],
      headers,
      rows,
      totalsRow: [
        'الإجمالي النهائي',
        '-',
        '-',
        '-',
        '-',
        '-',
        filteredIn,
        filteredCashOut,
        cashEndingBalance
      ]
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 no-print border-b border-gray-200 pb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-1px bg-emerald-500"></div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Financial Intelligence</span>
          </div>
          <h2 className="text-6xl font-black text-gray-900 tracking-tighter leading-none">
            كشف <span className="text-emerald-600 italic font-serif font-light">الحساب</span>
          </h2>
          <p className="text-gray-500 max-w-md font-medium text-lg leading-relaxed">
            تحليل دقيق وشامل لكافة الحركات المالية والعهد النقدية بنظام التدقيق الموحد.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative">
          <button
            onClick={handleExportExcel}
            disabled={!report}
            className="flex items-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm shadow-md transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <FileSpreadsheet size={18} />
            تصدير إلى إكسيل (Excel)
          </button>

          <button
            onClick={() => setShowPrintConfig(!showPrintConfig)}
            disabled={!report}
            className="group relative flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-900 rounded-full hover:bg-gray-900 hover:text-white transition-all duration-500 font-black text-sm disabled:opacity-30 disabled:pointer-events-none"
          >
            <Printer size={18} className="group-hover:rotate-12 transition-transform" />
            تخصيص الطباعة
          </button>

          <AnimatePresence>
            {showPrintConfig && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute left-0 top-full mt-4 w-80 bg-white border-2 border-gray-900 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-6 z-50 space-y-6"
              >
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">حجم الهوامش (Margins)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['none', 'narrow', 'normal', 'wide'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setPrintSettings({ ...printSettings, margins: m })}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${
                          printSettings.margins === m ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {m === 'none' ? 'بدون' : m === 'narrow' ? 'ضيقة' : m === 'normal' ? 'عادية' : 'واسعة'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">حجم الخط (Font Size)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'normal', 'large'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setPrintSettings({ ...printSettings, fontSize: s })}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${
                          printSettings.fontSize === s ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {s === 'small' ? 'صغير' : s === 'normal' ? 'متوسط' : 'كبير'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">اتجاه الصفحة (Orientation)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['portrait', 'landscape'] as const).map(o => (
                      <button
                        key={o}
                        onClick={() => setPrintSettings({ ...printSettings, orientation: o })}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${
                          printSettings.orientation === o ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {o === 'portrait' ? 'طولي (Portrait)' : 'عرضي (Landscape)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">مقياس الرسم (Scale: {printSettings.scale}%)</p>
                  <input 
                    type="range" 
                    min="50" 
                    max="150" 
                    step="5"
                    value={printSettings.scale}
                    onChange={(e) => setPrintSettings({ ...printSettings, scale: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase">
                    <span>50%</span>
                    <span>100%</span>
                    <span>150%</span>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-gray-100 flex gap-2">
                  <button
                    onClick={() => setPrintSettings({
                      margins: 'narrow',
                      fontSize: 'normal',
                      orientation: 'landscape',
                      scale: 100,
                      showSummary: true
                    })}
                    className="px-4 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                  >
                    إعادة ضبط
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintConfig(false);
                      handlePrint();
                    }}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all hover:bg-emerald-700"
                  >
                    تطبيق والطباعة
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filters Section - Executive Professional Style */}
      <div className="relative no-print">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold">
                <Filter size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">تصفية واستخراج كشف الحساب</h3>
                <p className="text-xs font-medium text-slate-500">حدد الموظف أو الفرع والفترة الزمنية لعرض كشف الحساب المالي التدقيقي</p>
              </div>
            </div>
            {report && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200/60 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                تم استخراج {report.rows.length} حركة مالية
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200/70 p-2">
            <div className="p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <User size={14} className="text-emerald-600" />
                الموظف المسؤول
              </label>
              <select
                value={filters.employee}
                onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
              >
                <option value="">كافة الموظفين</option>
                {employees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <div className="p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Building2 size={14} className="text-emerald-600" />
                الفرع / الموقع
              </label>
              <select
                value={filters.branch}
                onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
              >
                <option value="">كافة الفروع</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <ArrowRightLeft size={14} className="text-emerald-600" />
                نوع العملية
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
              >
                <option value="All">كافة العمليات</option>
                <option value="Expense">مصروفات</option>
                <option value="Income">توريدات</option>
                <option value="Transfer">تحويلات</option>
              </select>
            </div>

            <div className="p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Filter size={14} className="text-emerald-600" />
                حالة الاستحقاق
              </label>
              <select
                value={accrualFilter}
                onChange={(e) => setAccrualFilter(e.target.value as 'All' | 'Due' | 'Paid')}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
              >
                <option value="All">كافة الحالات</option>
                <option value="Due">مستحقة / آجلة ⚠️</option>
                <option value="Paid">نقدي / مسدد ✅</option>
              </select>
            </div>

            <div className="p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Calendar size={14} className="text-emerald-600" />
                من تاريخ
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2 rounded-xl border border-slate-200 outline-none"
              />
            </div>

            <div className="p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Calendar size={14} className="text-emerald-600" />
                إلى تاريخ
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2 rounded-xl border border-slate-200 outline-none"
              />
            </div>
          </div>
          
          <div className="border-t border-slate-200 p-4 bg-slate-50/80 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">اختر اسم الموظف لمعاينة حركة عهدته وحسابه المالي بالتفصيل</p>
            
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl font-extrabold text-xs transition-all shadow-sm active:scale-95 disabled:bg-slate-300 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              عرض وتوليد التقرير
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800"
            >
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <p className="text-xs font-bold">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Report Content */}
      <AnimatePresence mode="wait">
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:overflow-visible"
            id="printable-report"
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                html, body, #root, .flex.h-screen, main, [dir="rtl"] {
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  overflow: visible !important;
                  display: block !important;
                  position: static !important;
                }
                aside, header, .no-print {
                  display: none !important;
                }
                @page {
                  margin: ${getPageMargins()};
                  size: A4 ${printSettings.orientation};
                }
                body {
                  background: white !important;
                  color: black !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                  font-family: system-ui, -apple-system, sans-serif !important;
                }
                #printable-report {
                  font-size: ${getFontSize()};
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 auto !important;
                  padding: 0 !important;
                  background: white !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                table {
                  border-collapse: collapse !important;
                  width: 100% !important;
                  margin: 0 auto !important;
                  border: 1px solid #64748b !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                th, td {
                  border: 1px solid #94a3b8 !important;
                  padding: 6px 8px !important;
                  text-align: right !important;
                  font-size: 10px !important;
                }
                th {
                  font-weight: 800 !important;
                  background-color: #f1f5f9 !important;
                  color: #0f172a !important;
                }
                .no-print { display: none !important; }
                .print-only { display: block !important; }
                .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
              }
            ` }} />

            {/* Professional Header - Enterprise Bank Statement Style */}
            <div className="hidden print:block mb-8 p-6 border-b-2 border-slate-900">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-lg">K</div>
                    <span className="text-xl font-black text-slate-900 tracking-tight">KWD FINANCE PRO</span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">كشف حساب مالي تفصيلي</h2>
                  <p className="text-xs text-slate-500 font-bold">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-KW')}</p>
                </div>
                
                <div className="text-left space-y-1 p-3 border border-slate-300 rounded-xl bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">الرصيد الختامي</p>
                  <p className="text-2xl font-black text-slate-900 font-mono">{formatKWD(report.finalBalance)} <span className="text-xs">د.ك</span></p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mt-6 p-3 bg-slate-100/60 rounded-xl text-xs font-bold border border-slate-200">
                <div>
                  <span className="text-slate-500 text-[10px] block">الموظف / العهدة:</span>
                  <span className="text-slate-900 font-black">{filters.employee || 'كافة الموظفين'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">الفرع:</span>
                  <span className="text-slate-900 font-black">{filters.branch || 'كافة الفروع'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">فترة الكشف:</span>
                  <span className="text-slate-900 font-black">{filters.startDate} إلى {filters.endDate}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-b border-slate-200 flex justify-between items-center print:hidden bg-slate-900 text-white">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                  <FileText size={26} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white">كشف الحساب التدقيقي التفصيلي</h1>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2.5 py-0.5 bg-white/10 text-emerald-300 text-xs font-bold rounded-md">
                      {filters.employee || 'كافة الموظفين'}
                    </span>
                    <span className="px-2.5 py-0.5 bg-white/10 text-slate-300 text-xs font-bold rounded-md">
                      {filters.startDate} ↔ {filters.endDate}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  تصدير إكسيل (.xlsx)
                </button>
                <div className="text-left hidden sm:block">
                  <span className="text-xs text-slate-400 font-semibold block">سجل الحركات المالية</span>
                  <span className="text-xs font-bold text-emerald-400">{new Date().toLocaleDateString('ar-KW')}</span>
                </div>
              </div>
            </div>

            {/* Redesigned Summary Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200 border-b border-slate-200 bg-slate-50/50 no-print">
              {[
                { label: 'الرصيد الافتتاحي', value: report.openingBalance, icon: Wallet, color: 'slate' },
                { 
                  label: 'المقبوضات (+)', 
                  value: filteredIn, 
                  icon: TrendingUp, 
                  color: 'emerald',
                  sub: 'توريدات نقدية' 
                },
                { 
                  label: 'المدفوعات النقدية (-)', 
                  value: filteredCashOut, 
                  icon: TrendingDown, 
                  color: 'rose',
                  sub: 'صرف نقدي مثبت'
                },
                { 
                  label: 'مشتريات وآجل مستحق', 
                  value: filteredUnpaidAccruals, 
                  icon: Info, 
                  color: 'amber',
                  sub: 'آجل غير مخصوم'
                },
                { 
                  label: 'رصيد السيولة بالصندوق', 
                  value: cashEndingBalance, 
                  icon: CheckCircle2, 
                  color: cashEndingBalance >= 0 ? 'emerald' : 'rose', 
                  highlight: true,
                  sub: 'الصافي في الصندوق'
                }
              ].map((card, idx) => (
                <div 
                  key={idx}
                  className={`p-5 flex flex-col justify-between relative ${
                    card.highlight ? 'bg-slate-900 text-white' : 'bg-white'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold ${card.highlight ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {card.label}
                      </p>
                      <card.icon size={16} className={card.highlight ? 'text-emerald-400' : card.color === 'amber' ? 'text-amber-500' : 'text-slate-400'} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-extrabold font-mono tracking-tight ${
                        card.highlight ? 'text-white' : card.color === 'emerald' ? 'text-emerald-600' : card.color === 'rose' ? 'text-rose-600' : card.color === 'amber' ? 'text-amber-600' : 'text-slate-900'
                      }`}>
                        {formatKWD(card.value)}
                      </span>
                      <span className={`text-xs font-bold ${card.highlight ? 'text-white/60' : 'text-slate-400'}`}>د.ك</span>
                    </div>
                    {card.sub && (
                      <p className={`text-[10px] font-semibold ${card.highlight ? 'text-emerald-300/80' : 'text-slate-400'}`}>
                        {card.sub}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Visual Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-b-2 border-gray-900 no-print">
              <div className="p-8 border-l border-gray-900 bg-white">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                    <PieChartIcon size={20} />
                  </div>
                  <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em]">توزيع المصروفات حسب التصنيف</h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(
                          filteredRows.reduce((acc: Record<string, number>, row) => {
                            const cat = String(row[4] || 'غير مصنف');
                            const type = String(row[3] || '');
                            if (isTransferType(type, cat)) return acc;
                            const expense = parseFloat(String(row[6])) || 0;
                            if (expense > 0) acc[cat] = (acc[cat] || 0) + expense;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatKWD(value)}
                        contentStyle={{ borderRadius: '16px', border: '2px solid #111827', fontWeight: 'bold', fontSize: '10px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-8 bg-white">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                    <BarChart3 size={20} />
                  </div>
                  <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em]">المصروفات حسب الفرع</h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(
                      filteredRows.reduce((acc: Record<string, number>, row) => {
                        const branch = String(row[2] || 'عام');
                        const type = String(row[3] || '');
                        const cat = String(row[4] || '');
                        if (isTransferType(type, cat)) return acc;
                        const expense = parseFloat(String(row[6])) || 0;
                        if (expense > 0) acc[branch] = (acc[branch] || 0) + expense;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([name, value]) => ({ name, value }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                      <Tooltip 
                        formatter={(value: number) => formatKWD(value)}
                        contentStyle={{ borderRadius: '16px', border: '2px solid #111827', fontWeight: 'bold', fontSize: '10px' }}
                      />
                      <Bar dataKey="value" fill="#111827" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-x-auto print:overflow-visible print:p-0">
              <table className="w-full text-right border-collapse border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr className="bg-slate-900 text-slate-100">
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">التاريخ</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">الفرع</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">التصنيف / الموظف</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">البيان والتفاصيل</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center">حالة الدفع</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-emerald-400">وارد (+)</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-rose-400">صادر (-)</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">الرصيد التراكمي</th>
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center no-print">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/70">
                    <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">---</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs">---</td>
                    <td className="px-4 py-3 font-bold text-xs text-slate-700">
                      رصيد افتتاحي
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs italic">
                      الرصيد المرحل من السجلات السابقة
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs">---</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">0.000</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">0.000</td>
                    <td className="px-4 py-3 font-mono text-sm font-extrabold text-slate-900">
                      {formatKWD(report.openingBalance)}
                    </td>
                    <td className="px-4 py-3 text-center no-print text-slate-300">---</td>
                  </tr>

                  {filteredRows.map((row, i) => {
                    const date = String(row[0] || '');
                    const branch = String(row[2] || 'عام');
                    const category = String(row[4] || '');
                    const type = String(row[3] || '');
                    const income = parseFloat(row[5]) || 0;
                    const expense = parseFloat(row[6]) || 0;
                    const balance = row[7];
                    const description = row.length > 8 ? String(row[8] || '-') : '-';
                    const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                    const rawRowId = row.length > 10 && row[10] !== undefined && row[10] !== null && row[10] !== '' ? row[10] : null;
                    const originalIndex = report ? report.rows.indexOf(row) : -1;
                    const calculatedRowId = rawRowId !== null ? rawRowId : (originalIndex !== -1 ? originalIndex + 2 : i + 2);
                    const employee = String(row[1] || '');
                    
                    const isIncome = isIncomeType(type) || (income > 0 && !isTransferType(type));
                    const isTransfer = isTransferType(type);

                    const isTransactionAccrued = 
                      category.includes('مستحق') || 
                      category.includes('مستحقة') || 
                      category.includes('آجل') || 
                      category.includes('مؤجل') || 
                      category.includes('رواتب مستحقة') ||
                      description.includes('مستحق') || 
                      description.includes('مستحقة') || 
                      description.includes('آجل') || 
                      description.includes('مؤجل') || 
                      description.includes('غير مسدد') || 
                      description.includes('لم يسدد') || 
                      description.includes('دين') ||
                      category.toLowerCase().includes('due') ||
                      category.toLowerCase().includes('accrued') ||
                      description.toLowerCase().includes('due') ||
                      description.toLowerCase().includes('accrued');

                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-600">
                          {date}
                          {targetMonth && (
                            <span className="mr-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200/60 inline-block">
                              يخص: {targetMonth}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">
                          {branch}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold ${
                              isTransfer ? 'text-blue-700' : isIncome ? 'text-emerald-700' : 'text-slate-900'
                            }`}>
                              {category || (isTransfer ? 'تحويل مالي' : 'عام')}
                            </span>
                            {employee && <span className="text-[10px] font-medium text-slate-400">{employee}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-800 font-medium leading-relaxed max-w-[300px]">
                          {description}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isTransactionAccrued ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200/80 text-xs font-bold">
                              <span>آجل / غير مدفوع</span>
                              <span className="text-[10px] text-amber-600">(لم يُخصم)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200/80 text-xs font-bold">
                              <span>نقدي / مسدد</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-sm text-emerald-600">
                          {income > 0 ? income.toFixed(3) : '0.000'}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-sm text-rose-600">
                          {expense > 0 ? expense.toFixed(3) : '0.000'}
                        </td>
                        <td className="px-4 py-3 font-mono font-extrabold text-sm text-slate-900 bg-slate-50/50">
                          {formatKWD(balance)}
                        </td>
                        <td className="px-4 py-3 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingTransaction({
                                  id: calculatedRowId,
                                  date: date,
                                  branch: branch,
                                  category: category,
                                  description: description,
                                  amount: income > 0 ? income : expense,
                                  type: isTransfer ? 'Transfer' : (isIncome ? 'Income' : 'Expense'),
                                  targetMonth: targetMonth,
                                  employee: employee,
                                  sender: isTransfer ? employee : '',
                                  receiver: '' 
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('هل أنت متأكد من حذف هذه العملية؟')) {
                                  const res = await gasService.deleteTransaction(calculatedRowId, {
                                    date,
                                    employee,
                                    branch,
                                    category,
                                    amount: income > 0 ? income : expense,
                                    description
                                  });
                                  if (res && res.success) {
                                    handleGenerate();
                                  } else {
                                    alert('تنبيه: ' + (res?.error || 'تعذر العثور على المعرف في السيرفر'));
                                  }
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-bold text-xs">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-left">إجمالي الكشف التدقيقي:</td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-extrabold text-sm">
                      {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 font-mono text-rose-400 font-extrabold text-sm">
                      {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0))}
                    </td>
                    <td colSpan={2} className="px-4 py-3 font-mono text-white font-black text-sm">
                      الرصيد: {formatKWD(report.finalBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Detailed Financial Analysis Section */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
              {/* Branch Analysis */}
              <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-slate-900 text-white rounded-lg">
                    <Building2 size={16} />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900">تحليل الفروع (نقدي vs آجل)</h3>
                </div>
                <div className="space-y-3">
                  {(Object.entries(
                    report.rows.reduce((acc: Record<string, { current: number, accruals: number }>, row) => {
                      const branch = String(row[2] || 'عام');
                      const type = String(row[3] || '');
                      if (isTransferType(type)) return acc;
                      
                      const expense = parseFloat(String(row[6])) || 0;
                      if (expense === 0) return acc;

                      const dateStr = String(row[0] || '');
                      const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                      
                      if (!acc[branch]) acc[branch] = { current: 0, accruals: 0 };
                      
                      const transactionMonth = dateStr.slice(0, 7);
                      if (targetMonth && targetMonth !== transactionMonth) {
                        acc[branch].accruals += expense;
                      } else {
                        acc[branch].current += expense;
                      }
                      
                      return acc;
                    }, {} as Record<string, { current: number, accruals: number }>)
                  ) as [string, { current: number, accruals: number }][]).map(([branch, data]) => (
                    <div key={branch} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">{branch}</span>
                        <span className="font-mono font-extrabold text-slate-900 text-xs">{formatKWD(data.current + data.accruals)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">مصاريف الشهر:</span>
                          <span className="font-mono font-bold text-emerald-600">{formatKWD(data.current)}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-slate-400 block">سداد استحقاقات:</span>
                          <span className="font-mono font-bold text-rose-600">{formatKWD(data.accruals)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Analysis */}
              <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-slate-900 text-white rounded-lg">
                    <Filter size={16} />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900">تحليل البنود الرئيسية</h3>
                </div>
                <div className="space-y-3">
                  {(Object.entries(
                    report.rows.reduce((acc: Record<string, { current: number, accruals: number }>, row) => {
                      const cat = String(row[4] || 'غير مصنف');
                      const type = String(row[3] || '');
                      if (isTransferType(type)) return acc;
                      
                      const expense = parseFloat(String(row[6])) || 0;
                      if (expense === 0) return acc;

                      const dateStr = String(row[0] || '');
                      const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                      
                      if (!acc[cat]) acc[cat] = { current: 0, accruals: 0 };
                      
                      const transactionMonth = dateStr.slice(0, 7);
                      if (targetMonth && targetMonth !== transactionMonth) {
                        acc[cat].accruals += expense;
                      } else {
                        acc[cat].current += expense;
                      }
                      
                      return acc;
                    }, {} as Record<string, { current: number, accruals: number }>)
                  ) as [string, { current: number, accruals: number }][]).map(([cat, data]) => (
                    <div key={cat} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">{cat}</span>
                        <span className="font-mono font-extrabold text-slate-900 text-xs">{formatKWD(data.current + data.accruals)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">فعلي:</span>
                          <span className="font-mono font-bold text-emerald-600">{formatKWD(data.current)}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-slate-400 block">استحقاق:</span>
                          <span className="font-mono font-bold text-rose-600">{formatKWD(data.accruals)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transfer Analysis */}
              <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-blue-600 text-white rounded-lg">
                    <ArrowRightLeft size={16} />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900">حركة التحويلات النقدية</h3>
                </div>
                <div className="space-y-2.5">
                  {(Object.entries(
                    report.rows.reduce((acc: Record<string, number>, row) => {
                      const type = String(row[3] || '');
                      if (!isTransferType(type)) return acc;
                      const employee = String(row[1] || 'غير محدد');
                      const amount = parseFloat(String(row[5])) || parseFloat(String(row[6])) || 0;
                      acc[employee] = (acc[employee] || 0) + amount;
                      return acc;
                    }, {} as Record<string, number>)
                  ) as [string, number][]).map(([emp, total]) => (
                    <div key={emp} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <span className="text-xs font-bold text-slate-700">{emp}</span>
                      <span className="font-mono font-extrabold text-blue-700 text-xs">{formatKWD(total)}</span>
                    </div>
                  ))}
                  {Object.keys(report.rows.filter(row => isTransferType(String(row[3] || '')))).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">لا توجد تحويلات مسجلة</p>
                  )}
                </div>
              </div>

              {/* Target Month Analysis */}
              <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-slate-900 text-white rounded-lg">
                    <CalendarClock size={16} />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900">شهور الاستحقاق المخصصة</h3>
                </div>
                <div className="space-y-2.5">
                  {(Object.entries(
                    report.rows.reduce((acc: Record<string, { in: number, out: number }>, row) => {
                      const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                      if (!targetMonth) return acc;
                      
                      const income = parseFloat(String(row[5])) || 0;
                      const expense = parseFloat(String(row[6])) || 0;
                      
                      if (!acc[targetMonth]) acc[targetMonth] = { in: 0, out: 0 };
                      acc[targetMonth].in += income;
                      acc[targetMonth].out += expense;
                      return acc;
                    }, {} as Record<string, { in: number, out: number }>)
                  ) as [string, { in: number, out: number }][]).sort((a, b) => b[0].localeCompare(a[0])).map(([month, totals]) => (
                    <div key={month} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                      <span className="text-xs font-extrabold text-blue-700 block">{month}</span>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-emerald-600">وارد: {formatKWD(totals.in)}</span>
                        <span className="text-rose-600">صادر: {formatKWD(totals.out)}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(report.rows.reduce((acc: Record<string, any>, row) => {
                    const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                    if (targetMonth) acc[targetMonth] = true;
                    return acc;
                  }, {})).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">لا توجد عمليات مخصصة لشهور محددة</p>
                  )}
                </div>
              </div>
            </div>

            {/* Redesigned Footer - Formal Bank Style */}
            <div className="p-12 hidden print:block border-t-4 border-black bg-white">
              <div className="grid grid-cols-1 gap-12 mb-16">
                {/* Print Summary Table */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black border-b-2 border-black pb-2">ملخص الحساب الإجمالي</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>إجمالي المدين (وارد):</span>
                        <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => {
                          const type = String(row[3] || '');
                          if (isTransferType(type)) return acc;
                          return acc + (parseFloat(row[5]) || 0);
                        }, 0))}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>إجمالي الدائن (صادر):</span>
                        <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => {
                          const type = String(row[3] || '');
                          if (isTransferType(type)) return acc;
                          return acc + (parseFloat(row[6]) || 0);
                        }, 0))}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-blue-600">
                        <span>إجمالي التحويلات:</span>
                        <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => {
                          const type = String(row[3] || '');
                          if (isTransferType(type)) {
                            return acc + (parseFloat(row[5]) || parseFloat(row[6]) || 0);
                          }
                          return acc;
                        }, 0))}</span>
                      </div>
                      <div className="pt-2 border-t border-black flex justify-between text-xs font-black">
                        <span>الرصيد النهائي:</span>
                        <span className="font-mono">{formatKWD(report.finalBalance)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black border-b-2 border-black pb-2">تحليل المصروفات حسب الفرع</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {(Object.entries(
                        report.rows.reduce((acc: Record<string, number>, row) => {
                          const branch = String(row[2] || 'عام');
                          const expense = parseFloat(String(row[6])) || 0;
                          if (expense > 0) acc[branch] = (acc[branch] || 0) + expense;
                          return acc;
                        }, {} as Record<string, number>)
                      ) as [string, number][]).map(([branch, total]) => (
                        <div key={branch} className="flex justify-between text-[9px] border-b border-gray-100 py-1">
                          <span className="font-bold">{branch}:</span>
                          <span className="font-mono">{formatKWD(total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black border-b-2 border-black pb-2">تحليل حسب شهر الاستحقاق</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {(Object.entries(
                        report.rows.reduce((acc: Record<string, number>, row) => {
                          const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                          if (!targetMonth) return acc;
                          const expense = parseFloat(String(row[6])) || 0;
                          if (expense > 0) acc[targetMonth] = (acc[targetMonth] || 0) + expense;
                          return acc;
                        }, {} as Record<string, number>)
                      ) as [string, number][]).sort((a, b) => b[0].localeCompare(a[0])).map(([month, total]) => (
                        <div key={month} className="flex justify-between text-[9px] border-b border-gray-100 py-1">
                          <span className="font-bold">{month}:</span>
                          <span className="font-mono">{formatKWD(total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-12 mt-8">
                  <div className="space-y-12">
                    <div className="border-b-2 border-black pb-2">
                      <p className="text-[10px] font-black text-black">توقيع المحاسب المسؤول</p>
                    </div>
                    <div className="border-b-2 border-black pb-2">
                      <p className="text-[10px] font-black text-black">توقيع الموظف / صاحب العهدة</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-4">
                    <div className="w-20 h-20 border-4 border-gray-100 rounded-full flex items-center justify-center opacity-20">
                      <span className="text-[8px] font-black text-center">OFFICIAL STAMP HERE</span>
                    </div>
                    <p className="text-[8px] font-black text-gray-300 mt-2 uppercase">ختم الشركة المعتمد</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-end pt-8 border-t border-gray-100">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.4em]">KWD FINANCE PRO | SECURE REPORTING ENGINE</p>
                  <p className="text-[6px] font-bold text-gray-300 italic">هذا المستند تم إنشاؤه آلياً ولا يتطلب توقيعاً حياً ليكون صالحاً للاستخدام الداخلي.</p>
                </div>
                <div className="text-left">
                  <p className="text-[8px] font-black text-gray-900">صفحة 1 من 1</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingTransaction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border-2 border-gray-900"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Edit2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">تعديل العملية</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">تعديل بيانات الحركة المالية المسجلة</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-gray-200"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
                  {[
                    { id: 'Expense', label: 'مصروف', color: 'rose' },
                    { id: 'Income', label: 'توريد', color: 'emerald' },
                    { id: 'Transfer', label: 'تحويل', color: 'blue' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditingTransaction({ ...editingTransaction, type: t.id })}
                      className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        editingTransaction.type === t.id 
                          ? `bg-white text-${t.color}-600 shadow-sm` 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">التاريخ</label>
                    <input
                      type="date"
                      required
                      value={editingTransaction.date}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">المبلغ</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={editingTransaction.amount}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                  
                  {editingTransaction.type === 'Transfer' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">المرسل (من)</label>
                        <select
                          required
                          value={editingTransaction.sender || ''}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, sender: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                          <option value="">اختر الموظف</option>
                          {employees.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">المستلم (إلى)</label>
                        <select
                          required
                          value={editingTransaction.receiver || ''}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, receiver: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                          <option value="">اختر الموظف</option>
                          {employees.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">الموظف المسؤول</label>
                        <select
                          required
                          value={editingTransaction.employee || ''}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, employee: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                          <option value="">اختر الموظف</option>
                          {employees.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">التصنيف</label>
                        <select
                          required
                          value={editingTransaction.category || ''}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                          <option value="">اختر التصنيف</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">الفرع</label>
                    <select
                      value={editingTransaction.branch}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, branch: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    >
                      <option value="">غير محدد / عام</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">شهر الاستحقاق (اختياري)</label>
                    <input
                      type="month"
                      value={editingTransaction.targetMonth || ''}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, targetMonth: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">البيان</label>
                    <textarea
                      required
                      rows={3}
                      value={editingTransaction.description}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    حفظ التعديلات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
