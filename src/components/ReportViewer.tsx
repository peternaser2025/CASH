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
          <button
            onClick={handlePrint}
            disabled={!report}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm font-bold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} />
            طباعة الكشف
          </button>
          <button
            disabled={!report}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            تصدير PDF
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
            className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden print:shadow-none print:border-none"
            id="printable-report"
          >
            {/* Print Header - Formal Accounting Style */}
            <div className="hidden print:block mb-10">
              <div className="flex justify-between items-center border-b-4 border-emerald-600 pb-6">
                <div className="text-right">
                  <h1 className="text-4xl font-black text-gray-900">كشف حساب مالي تفصيلي</h1>
                  <p className="text-lg font-bold text-emerald-600 mt-1">KWD FINANCE PRO - نظام إدارة العهد الذكي</p>
                  <div className="mt-4 space-y-1 text-sm text-gray-600">
                    <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-KW')}</p>
                    <p>رقم المرجع: #REP-{Math.floor(Math.random() * 1000000)}</p>
                  </div>
                </div>
                <div className="text-left flex flex-col items-end">
                  <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-black text-4xl mb-3 shadow-xl">K</div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Official Document</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-400 uppercase">بيانات الحساب</p>
                  <p className="text-lg font-black text-gray-900">الموظف: <span className="text-emerald-600">{filters.employee || 'كافة الموظفين'}</span></p>
                  <p className="text-sm font-bold text-gray-600">الفرع: {filters.branch || 'كافة الفروع'}</p>
                </div>
                <div className="space-y-2 text-left">
                  <p className="text-xs font-black text-gray-400 uppercase">الفترة الزمنية</p>
                  <p className="text-lg font-black text-gray-900">من: {filters.startDate}</p>
                  <p className="text-lg font-black text-gray-900">إلى: {filters.endDate}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-10 bg-white print:p-0 print:mb-12 print:grid-cols-4 print:gap-2">
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm print:border-2 print:p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl print:hidden">
                    <Wallet size={20} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest print:text-gray-600">الرصيد الافتتاحي</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-gray-900">{formatKWD(report.openingBalance)}</p>
                  <span className="text-xs font-bold text-gray-400">د.ك</span>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm print:border-2 print:p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl print:hidden">
                    <TrendingDown size={20} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest print:text-gray-600">إجمالي الصادر</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-red-600">
                    {formatKWD(report.rows.reduce((acc, row) => {
                      const type = String(row[4] || ''); // Type is at index 4
                      const amount = Math.abs(parseFloat(row[6]) || 0); // Amount is at index 6
                      return isExpenseType(type) ? acc + amount : acc;
                    }, 0))}
                  </p>
                  <span className="text-xs font-bold text-gray-400">د.ك</span>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-sm print:border-2 print:p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl print:hidden">
                    <TrendingUp size={20} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest print:text-gray-600">إجمالي الوارد</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-emerald-600">
                    {formatKWD(report.rows.reduce((acc, row) => {
                      const type = String(row[4] || ''); // Type is at index 4
                      const amount = Math.abs(parseFloat(row[6]) || 0); // Amount is at index 6
                      return isIncomeType(type) ? acc + amount : acc;
                    }, 0))}
                  </p>
                  <span className="text-xs font-bold text-gray-400">د.ك</span>
                </div>
              </div>

              <div className={`p-6 rounded-3xl border shadow-xl print:shadow-none print:p-4 print:border-2 ${
                parseFloat(report.finalBalance) >= 0 
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20 print:bg-white print:text-emerald-700 print:border-emerald-600' 
                  : 'bg-red-600 border-red-500 text-white shadow-red-500/20 print:bg-white print:text-red-700 print:border-red-600'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-xl print:hidden">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-[10px] font-black text-white/80 uppercase tracking-widest print:text-gray-600">الرصيد الختامي</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black">{formatKWD(report.finalBalance)}</p>
                  <span className="text-xs font-bold text-white/70 print:text-gray-400">د.ك</span>
                </div>
              </div>
            </div>

            <div className="px-10 pb-10 overflow-x-auto print:overflow-visible print:px-0">
              <table className="w-full text-right text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-white print:bg-gray-100 print:text-gray-900">
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] first:rounded-tr-2xl last:rounded-tl-2xl">التاريخ</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">الفرع</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">النوع / التصنيف</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">البيان والتفاصيل</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-emerald-400 print:text-emerald-800">وارد (+)</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-red-400 print:text-red-800">صادر (-)</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] bg-white/10 print:bg-gray-200">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 print:divide-y-2 print:divide-gray-200">
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
                      const date = String(row[1] || '');
                      const branch = String(row[3] || 'عام');
                      const typeStr = String(row[4] || '');
                      const category = String(row[5] || '');
                      const amount = Math.abs(parseFloat(row[6]) || 0);
                      const description = String(row[7] || '-');
                      // Balance is usually the last column added by GAS
                      const balance = row[row.length - 1];
                      
                      const isIncome = isIncomeType(typeStr);
                      const isExpense = isExpenseType(typeStr);
                      const isTransfer = isTransferType(typeStr);

                      return (
                        <tr key={i} className="hover:bg-gray-50/80 transition-all group print:break-inside-avoid">
                          <td className="px-6 py-6">
                            <span className="font-mono font-black text-gray-900 text-base">{date}</span>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-gray-300" />
                              <span className="font-bold text-gray-700">{branch}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex flex-col gap-2">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider w-fit border ${
                                isIncome 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : isTransfer
                                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                  : 'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                {isIncome ? <TrendingUp size={12} /> : isTransfer ? <ArrowRightLeft size={12} /> : <TrendingDown size={12} />}
                                {typeStr}
                              </div>
                              <span className="text-[11px] font-black text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                                <Info size={10} />
                                {category}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <p className="text-gray-900 font-bold text-xs leading-relaxed max-w-[300px]">{description}</p>
                          </td>
                          <td className="px-6 py-6">
                            <span className={`font-black text-lg ${isIncome ? 'text-emerald-600' : 'text-gray-200'}`}>
                              {isIncome ? `+${amount.toFixed(3)}` : '0.000'}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span className={`font-black text-lg ${isExpense ? 'text-red-600' : 'text-gray-200'}`}>
                              {isExpense ? `-${amount.toFixed(3)}` : '0.000'}
                            </span>
                          </td>
                          <td className="px-6 py-6 bg-gray-50/30 group-hover:bg-emerald-50/50 transition-colors print:bg-gray-100">
                            <div className="flex flex-col items-end">
                              <span className="font-black text-gray-900 font-mono text-lg">{formatKWD(balance)}</span>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">KWD</span>
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
            <div className="p-16 hidden print:block border-t-4 border-emerald-600 mt-12 bg-gray-50 rounded-b-[3rem]">
              <div className="grid grid-cols-3 gap-16 text-center">
                <div className="space-y-8">
                  <div className="h-1 bg-gray-200 w-full rounded-full"></div>
                  <div>
                    <p className="text-sm font-black text-gray-900">توقيع المحاسب المسؤول</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Audit & Verification</p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="h-1 bg-gray-200 w-full rounded-full"></div>
                  <div>
                    <p className="text-sm font-black text-gray-900">توقيع الموظف / صاحب العهدة</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Account Holder Acknowledgment</p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="h-1 bg-gray-200 w-full rounded-full"></div>
                  <div>
                    <p className="text-sm font-black text-gray-900">اعتماد الإدارة العامة</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Executive Approval Seal</p>
                  </div>
                </div>
              </div>
              <div className="mt-20 text-center border-t border-gray-200 pt-10">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.8em]">KWD FINANCE PRO - SECURE ENTERPRISE REPORTING SYSTEM</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
