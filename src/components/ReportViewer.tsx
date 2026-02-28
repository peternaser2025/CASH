import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Filter, 
  Printer, 
  Download, 
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
  Info
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { ReportFilter, ReportData, EmployeeBalance } from '../types';
import { BRANCHES } from '../constants';
import { formatKWD, isIncomeType, isExpenseType, isTransferType } from '../utils/format';

interface ReportViewerProps {
  employees: string[];
  balances: EmployeeBalance[];
}

export default function ReportViewer({ employees, balances }: ReportViewerProps) {
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
  const [printSettings, setPrintSettings] = useState({
    margins: 'narrow' as 'none' | 'narrow' | 'normal' | 'wide',
    fontSize: 'normal' as 'small' | 'normal' | 'large',
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
      case 'small': return '8px';
      case 'large': return '12px';
      default: return '10px';
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">التقارير المالية</h2>
          <p className="text-gray-500 mt-2 font-medium">استخراج كشوف حساب تفصيلية وتحليل حركة العهد</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowPrintConfig(!showPrintConfig)}
              disabled={!report}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm font-bold text-gray-700 disabled:opacity-50"
            >
              <Printer size={18} />
              إعدادات الطباعة
            </button>

            <AnimatePresence>
              {showPrintConfig && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-100 shadow-2xl rounded-3xl p-6 z-50 space-y-4"
                >
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">حجم الهوامش</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['none', 'narrow', 'normal', 'wide'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setPrintSettings({ ...printSettings, margins: m })}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                            printSettings.margins === m ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-600'
                          }`}
                        >
                          {m === 'none' ? 'بدون' : m === 'narrow' ? 'ضيقة' : m === 'normal' ? 'عادية' : 'واسعة'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">حجم الخط</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'normal', 'large'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setPrintSettings({ ...printSettings, fontSize: s })}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                            printSettings.fontSize === s ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-600'
                          }`}
                        >
                          {s === 'small' ? 'صغير' : s === 'normal' ? 'متوسط' : 'كبير'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50">
                    <button
                      onClick={() => {
                        setShowPrintConfig(false);
                        handlePrint();
                      }}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      بدء الطباعة الآن
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={handlePrint}
            disabled={!report}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} />
            طباعة / تصدير PDF
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 no-print">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <Filter size={20} />
          </div>
          <h3 className="text-xl font-black text-gray-900">فلاتر البحث المتقدم</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">الموظف المسؤول</label>
            <div className="relative">
              <select
                value={filters.employee}
                onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900 appearance-none"
              >
                <option value="">كافة الموظفين</option>
                {employees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">الفرع / الموقع</label>
            <div className="relative">
              <select
                value={filters.branch}
                onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900 appearance-none"
              >
                <option value="">كافة الفروع</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">نوع العملية</label>
            <div className="relative">
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900 appearance-none"
              >
                <option value="All">كافة العمليات</option>
                <option value="Expense">مصروفات فقط</option>
                <option value="Income">توريدات فقط</option>
                <option value="Transfer">تحويلات فقط</option>
              </select>
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">من تاريخ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">إلى تاريخ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-5 flex flex-col gap-4 mt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 disabled:bg-gray-200 active:scale-95"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
              توليد كشف الحساب التفصيلي
            </button>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-800"
                >
                  <AlertCircle size={18} />
                  <p className="text-xs font-black">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <AnimatePresence mode="wait">
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden print:shadow-none print:border-none print:overflow-visible"
            id="printable-report"
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  margin: ${getPageMargins()};
                  size: A4 landscape;
                }
                body {
                  background: white !important;
                  color: black !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
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
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                }
                .print-container {
                  width: 100% !important;
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                }
                .print-compact-row {
                  padding-top: 4px !important;
                  padding-bottom: 4px !important;
                }
                table {
                  border-collapse: collapse !important;
                  width: 100% !important;
                  margin: 0 auto !important;
                  border: 2px solid #000 !important;
                  table-layout: auto !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                th, td {
                  border: 1px solid #000 !important;
                  color: black !important;
                  background: transparent !important;
                  padding: 4px 2px !important;
                  text-align: right !important;
                  word-wrap: break-word !important;
                }
                thead tr {
                  border-bottom: 2px solid #000 !important;
                  background-color: #f0f0f0 !important;
                }
                .no-print {
                  display: none !important;
                }
                .print-only {
                  display: block !important;
                }
              }
            ` }} />
            {/* Print Header - Formal Accounting Style */}
            <div className="hidden print:block mb-4">
              <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                <div className="text-right">
                  <h1 className="text-xl font-black text-gray-900">كشف حساب مالي تفصيلي</h1>
                  <p className="text-[10px] font-bold text-emerald-600">KWD FINANCE PRO - نظام إدارة العهد الذكي</p>
                  <div className="mt-1 flex gap-4 text-[8px] text-gray-500">
                    <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-KW')}</p>
                    <p>رقم المرجع: #REP-{Math.floor(Math.random() * 1000000)}</p>
                  </div>
                </div>
                <div className="text-left flex flex-col items-end">
                  <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md">K</div>
                  <p className="text-[6px] font-black text-gray-400 uppercase tracking-widest">Official Document</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-2 p-2 bg-white rounded-lg border border-black print:bg-white">
                <div className="space-y-0.5">
                  <p className="text-[7px] font-black text-gray-500 uppercase">بيانات الحساب</p>
                  <p className="text-[10px] font-black text-gray-900">الموظف: <span className="text-black">{filters.employee || 'كافة الموظفين'}</span></p>
                  <p className="text-[8px] font-bold text-gray-600">الفرع: {filters.branch || 'كافة الفروع'}</p>
                </div>
                <div className="space-y-0.5 text-left">
                  <p className="text-[7px] font-black text-gray-500 uppercase">الفترة الزمنية</p>
                  <p className="text-[9px] font-black text-gray-900">من: {filters.startDate}</p>
                  <p className="text-[9px] font-black text-gray-900">إلى: {filters.endDate}</p>
                </div>
                <div className="space-y-0.5 bg-white border-2 border-black p-2 rounded text-black text-center">
                  <p className="text-[7px] font-black opacity-80 uppercase">الرصيد الافتتاحي</p>
                  <p className="text-sm font-black">{formatKWD(report.openingBalance)} د.ك</p>
                </div>
              </div>
            </div>

            <div className="p-10 border-b border-gray-50 flex justify-between items-start print:hidden bg-gray-50/30">
              <div className="flex gap-6 items-center">
                <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                  <FileText size={40} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-gray-900">كشف حساب تفصيلي</h1>
                  <div className="flex gap-4 mt-3 text-sm font-bold text-gray-500">
                    <span className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                      <User size={16} className="text-emerald-500" />
                      {filters.employee || 'كافة الموظفين'}
                    </span>
                    <span className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                      <Calendar size={16} className="text-emerald-500" />
                      {filters.startDate} ↔ {filters.endDate}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-emerald-600 tracking-widest">KWD FINANCE PRO</p>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Report ID: {Math.floor(Math.random() * 1000000)}</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Generated: {new Date().toLocaleString('ar-KW')}</p>
                </div>
              </div>
            </div>

            {/* Hero Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-10 bg-white print:p-0 print:mb-4 print:grid-cols-4 print:gap-1 print:border-b print:border-black">
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm print:border print:rounded-none print:p-1.5 print:bg-white">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest print:text-[6px] print:text-black mb-1 hidden print:block">الرصيد الافتتاحي</p>
                <div className="flex items-center gap-3 mb-4 print:hidden">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                    <Wallet size={20} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">الرصيد الافتتاحي</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-gray-900 print:text-xs">{formatKWD(report.openingBalance)}</p>
                  <span className="text-xs font-bold text-gray-400 print:text-[6px] print:text-black">د.ك</span>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm print:border print:rounded-none print:p-1.5 print:bg-white">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest print:text-[6px] print:text-black mb-1 hidden print:block">إجمالي الصادر</p>
                <div className="flex items-center gap-3 mb-4 print:hidden">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <TrendingDown size={20} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي الصادر</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-red-600 print:text-xs print:text-black">
                    {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0))}
                  </p>
                  <span className="text-xs font-bold text-gray-400 print:text-[6px] print:text-black">د.ك</span>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm print:border print:rounded-none print:p-1.5 print:bg-white">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest print:text-[6px] print:text-black mb-1 hidden print:block">إجمالي الوارد</p>
                <div className="flex items-center gap-3 mb-4 print:hidden">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <TrendingUp size={20} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي الوارد</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-emerald-600 print:text-xs print:text-black">
                    {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0))}
                  </p>
                  <span className="text-xs font-bold text-gray-400 print:text-[6px] print:text-black">د.ك</span>
                </div>
              </div>

              <div className={`p-6 rounded-3xl border shadow-xl print:shadow-none print:p-1.5 print:border-2 print:border-black print:rounded-none print:bg-white ${
                parseFloat(report.finalBalance) >= 0 
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20 print:text-black' 
                  : 'bg-red-600 border-red-500 text-white shadow-red-500/20 print:text-black'
              }`}>
                <p className="text-[10px] font-black text-white/80 uppercase tracking-widest print:text-[6px] print:text-black mb-1 hidden print:block">الرصيد الختامي</p>
                <div className="flex items-center gap-3 mb-4 print:hidden">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">الرصيد الختامي</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black print:text-sm print:text-black">{formatKWD(report.finalBalance)}</p>
                  <span className="text-xs font-bold text-white/70 print:text-[6px] print:text-black">د.ك</span>
                </div>
              </div>
            </div>

            <div className="px-10 pb-10 overflow-x-auto print:overflow-visible print:px-0">
              <table className="w-full text-right text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-white print:bg-gray-100 print:text-gray-900">
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px] first:rounded-tr-2xl last:rounded-tl-2xl">التاريخ</th>
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px]">الفرع</th>
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px]">النوع / التصنيف</th>
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px]">البيان والتفاصيل</th>
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px] text-emerald-400 print:text-emerald-800">وارد (+)</th>
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px] text-red-400 print:text-red-800">صادر (-)</th>
                    <th className="px-6 py-5 print:px-1 print:py-1 font-black uppercase tracking-widest text-[10px] print:text-[7px] bg-white/10 print:bg-gray-200">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 print:divide-y-2 print:divide-gray-200">
                  {/* سطر الرصيد الافتتاحي - أول سطر في كشف الحساب */}
                  {report && report.openingBalance !== undefined && (
                    <tr className="bg-emerald-50/30 font-black print:bg-white border-b border-gray-100 print:border-black">
                      <td className="px-4 py-4 print:px-1 print:py-1 text-center text-gray-400 font-mono text-xs print:text-[8px] print:text-black">---</td>
                      <td className="px-4 py-4 print:px-1 print:py-1 text-center text-gray-400 text-[10px] print:text-[8px] print:text-black">---</td>
                      <td className="px-4 py-4 print:px-1 print:py-1">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] print:text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 print:bg-white print:text-black print:border-black">
                          رصيد افتتاحي
                        </div>
                      </td>
                      <td className="px-4 py-4 print:px-1 print:py-1">
                        <div className="flex flex-col">
                          <span className="text-[8px] print:text-[6px] font-black text-emerald-600 uppercase tracking-tighter print:text-black">INITIAL BALANCE</span>
                          <p className="text-gray-500 text-[10px] print:text-[8px] font-bold print:text-black">الرصيد المتوفر قبل {filters.startDate}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 print:px-1 print:py-1 text-center text-gray-300 font-mono print:text-[8px] print:text-black">0.000</td>
                      <td className="px-4 py-4 print:px-1 print:py-1 text-center text-gray-300 font-mono print:text-[8px] print:text-black">0.000</td>
                      <td className="px-4 py-4 print:px-1 print:py-1 bg-emerald-50/50 text-center border-l border-emerald-100 print:bg-white print:border-black">
                        <span className="font-black text-gray-900 font-mono text-sm print:text-[10px] print:text-black">{formatKWD(report.openingBalance)}</span>
                      </td>
                    </tr>
                  )}

                  {(!report.rows || report.rows.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-24 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-6">
                          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                            <Search size={48} className="opacity-10" />
                          </div>
                          <div>
                            <p className="font-black text-2xl text-gray-900">لا توجد سجلات مالية</p>
                            <p className="text-sm font-medium mt-2">يرجى التأكد من اختيار الموظف والفترة الزمنية الصحيحة</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, i) => {
                      // ترتيب الأعمدة الصارم المتوقع من السيرفر:
                      // 0: التاريخ، 1: الموظف، 2: الفرع، 3: النوع، 4: التصنيف، 5: وارد، 6: صادر، 7: الرصيد، 8: البيان (الوصف)
                      const date = String(row[0] || '');
                      const branch = String(row[2] || 'عام');
                      const typeStr = String(row[3] || '');
                      const category = String(row[4] || '');
                      const income = parseFloat(row[5]) || 0;
                      const expense = parseFloat(row[6]) || 0;
                      const balance = row[7];
                      
                      // قراءة البيان من العمود رقم 9 (Index 8)
                      const description = row.length > 8 ? String(row[8] || '-') : '-';
                      
                      const isIncome = income > 0;
                      const isExpense = expense > 0;
                      const isTransfer = isTransferType(typeStr);

                      return (
                        <tr key={i} className="hover:bg-gray-50/80 transition-all group print:break-inside-avoid border-b border-gray-100 print:border-black">
                          <td className="px-4 py-4 print:px-1 print:py-0.5 text-center print-compact-row">
                            <span className="font-mono font-black text-gray-900 text-sm print:text-[8px] print:text-black">{date}</span>
                          </td>
                          <td className="px-4 py-4 print:px-1 print:py-0.5 text-center print-compact-row">
                            <span className="font-bold text-gray-500 text-[10px] print:text-[6px] print:text-black">{branch}</span>
                          </td>
                          <td className="px-4 py-4 print:px-1 print:py-0.5 print-compact-row">
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] print:text-[6px] font-black uppercase tracking-wider w-fit border print:px-1 print:py-0 print:bg-white print:text-black print:border-black ${
                              isIncome 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : isTransfer
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {typeStr}
                            </div>
                          </td>
                          <td className="px-4 py-4 print:px-1 print:py-0.5 print-compact-row">
                            <div className="flex flex-col">
                              <span className="text-[10px] print:text-[6px] font-black text-emerald-600 uppercase tracking-tighter print:text-black">
                                {category}
                              </span>
                              <p className="text-gray-900 font-black text-xs print:text-[7px] leading-tight max-w-[350px] bg-gray-50/50 p-1 rounded print:bg-transparent print:p-0 print:text-black">
                                {description}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 print:px-1 print:py-0.5 text-center print-compact-row">
                            <span className={`font-black text-sm print:text-[8px] print:text-black ${isIncome ? 'text-emerald-600' : 'text-gray-200'}`}>
                              {income > 0 ? `+${income.toFixed(3)}` : '0.000'}
                            </span>
                          </td>
                          <td className="px-4 py-4 print:px-1 print:py-0.5 text-center print-compact-row">
                            <span className={`font-black text-sm print:text-[8px] print:text-black ${isExpense ? 'text-red-600' : 'text-gray-200'}`}>
                              {expense > 0 ? `-${expense.toFixed(3)}` : '0.000'}
                            </span>
                          </td>
                          <td className="px-4 py-4 print:px-1 print:py-0.5 bg-gray-50/30 group-hover:bg-emerald-50/50 transition-colors print:bg-white text-center border-l border-gray-100 print:border-black print-compact-row">
                            <div className="flex flex-col items-center">
                              <span className="font-black text-gray-900 font-mono text-sm print:text-[8px] print:text-black">{formatKWD(balance)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer for Print - Formal Signatures */}
            <div className="p-16 hidden print:block border-t border-black mt-4 bg-white rounded-b-xl print:p-4">
              <div className="grid grid-cols-3 gap-8 mb-12 print:mb-4 print:gap-2">
                <div className="bg-white p-6 rounded-2xl border-2 border-black text-center print:p-2 print:rounded-none print:border">
                  <p className="text-[10px] font-black text-black uppercase mb-2 print:text-[6px] print:mb-0.5">إجمالي الوارد (+)</p>
                  <p className="text-2xl font-black text-black print:text-sm">
                    {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0))}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border-2 border-black text-center print:p-2 print:rounded-none print:border">
                  <p className="text-[10px] font-black text-black uppercase mb-2 print:text-[6px] print:mb-0.5">إجمالي الصادر (-)</p>
                  <p className="text-2xl font-black text-black print:text-sm">
                    {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0))}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border-2 border-black text-center print:p-2 print:rounded-none print:border">
                  <p className="text-[10px] font-black text-black uppercase mb-2 print:text-[6px] print:mb-0.5">الصافي النهائي</p>
                  <p className="text-2xl font-black text-black print:text-sm">{formatKWD(report.finalBalance)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-16 text-center print:gap-4">
                <div className="space-y-8 print:space-y-2">
                  <div className="h-0.5 bg-black w-full rounded-full"></div>
                  <div>
                    <p className="text-sm font-black text-black print:text-[8px]">توقيع المحاسب المسؤول</p>
                  </div>
                </div>
                <div className="space-y-8 print:space-y-2">
                  <div className="h-0.5 bg-black w-full rounded-full"></div>
                  <div>
                    <p className="text-sm font-black text-black print:text-[8px]">توقيع الموظف / صاحب العهدة</p>
                  </div>
                </div>
                <div className="space-y-8 print:space-y-2">
                  <div className="h-0.5 bg-black w-full rounded-full"></div>
                  <div>
                    <p className="text-sm font-black text-black print:text-[8px]">اعتماد الإدارة العامة</p>
                  </div>
                </div>
              </div>
              <div className="mt-20 text-center border-t border-black pt-10 print:mt-4 print:pt-2">
                <p className="text-[10px] font-black text-black uppercase tracking-[0.8em] print:text-[6px] print:tracking-[0.2em]">KWD FINANCE PRO - SECURE ENTERPRISE REPORTING SYSTEM</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
