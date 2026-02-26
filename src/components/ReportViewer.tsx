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
  ArrowRightLeft,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { ReportFilter, ReportData } from '../types';
import { BRANCHES } from '../constants';

interface ReportViewerProps {
  employees: string[];
}

export default function ReportViewer({ employees }: ReportViewerProps) {
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
      // Clean up filters: if type is 'All', send empty string
      const cleanFilters = {
        ...filters,
        type: filters.type === 'All' ? '' : filters.type,
        // Ensure dates are valid
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
    <div className="space-y-8">
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">كشف حساب مفصل</h2>
          <p className="text-gray-500 mt-1">توليد تقارير احترافية بناءً على فلاتر مخصصة</p>
        </div>
        {report && (
          <div className="flex gap-3">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <Printer size={16} />
              طباعة التقرير
            </button>
          </div>
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">الموظف</label>
            <select
              value={filters.employee}
              onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            >
              <option value="">اختر الموظف (الكل)</option>
              {employees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">الفرع</label>
            <select
              value={filters.branch}
              onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            >
              <option value="">الكل</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">النوع</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            >
              <option value="All">الكل</option>
              <option value="Expense">مصروفات</option>
              <option value="Income">توريدات</option>
              <option value="Transfer">تحويلات</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">من تاريخ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">إلى تاريخ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
          <div className="md:col-span-5 flex flex-col gap-4 mt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:bg-gray-300"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              توليد الكشف
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
      {report && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-none"
          id="printable-report"
        >
          {/* Print Header */}
          <div className="hidden print:flex justify-between items-center mb-8 border-b-2 border-gray-900 pb-6">
            <div className="text-right">
              <h1 className="text-3xl font-black text-gray-900">كشف حساب مالي</h1>
              <p className="text-sm font-bold text-gray-500">KWD Finance Pro - نظام إدارة العهد</p>
            </div>
            <div className="text-left">
              <div className="w-16 h-16 bg-gray-900 rounded-lg flex items-center justify-center text-white font-black text-2xl mb-2">K</div>
              <p className="text-[10px] text-gray-400">تاريخ التقرير: {new Date().toLocaleDateString('ar-KW')}</p>
            </div>
          </div>

          <div className="p-8 border-b border-gray-100 flex justify-between items-start print:border-none print:p-0 print:mb-6">
            <div className="flex gap-6 items-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 print:hidden">
                <FileText size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900">كشف حساب تفصيلي</h1>
                <div className="flex gap-4 mt-2 text-sm font-medium text-gray-500">
                  <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                    <User size={14} />
                    {filters.employee || 'كافة الموظفين'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                    <Calendar size={14} />
                    {filters.startDate} ↔ {filters.endDate}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-emerald-600 tracking-widest">KWD FINANCE PRO</p>
              <p className="text-xs text-gray-400 mt-1">رقم التقرير: {Math.floor(Math.random() * 1000000)}</p>
              <p className="text-xs text-gray-400">تاريخ الاستخراج: {new Date().toLocaleString('ar-KW')}</p>
            </div>
          </div>

          {/* Hero Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-8 bg-gray-50/50 print:bg-white print:p-0 print:mb-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border print:p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Wallet size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">الرصيد الافتتاحي</p>
              </div>
              <p className="text-2xl font-black text-gray-900">{report.openingBalance} <span className="text-sm font-medium text-gray-400">د.ك</span></p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border print:p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <TrendingDown size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">إجمالي الصادر</p>
              </div>
              <p className="text-2xl font-black text-red-600">
                {report.rows.reduce((acc, row) => {
                  const type = row[3] || '';
                  const amount = parseFloat(row[6]) || 0;
                  const isExpense = type.includes('Expense') || type.includes('Ex') || type.includes('صرف');
                  return isExpense ? acc + Math.abs(amount) : acc;
                }, 0).toFixed(3)} <span className="text-sm font-medium text-gray-400">د.ك</span>
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border print:p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">إجمالي الوارد</p>
              </div>
              <p className="text-2xl font-black text-emerald-600">
                {report.rows.reduce((acc, row) => {
                  const type = row[3] || '';
                  const amount = parseFloat(row[6]) || 0;
                  const isIncome = type.includes('Income') || type.includes('In') || type.includes('توريد');
                  return isIncome ? acc + amount : acc;
                }, 0).toFixed(3)} <span className="text-sm font-medium text-gray-400">د.ك</span>
              </p>
            </div>

            <div className={`p-6 rounded-2xl border shadow-lg print:shadow-none print:p-4 ${
              parseFloat(report.finalBalance) >= 0 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20' 
                : 'bg-red-600 border-red-500 text-white shadow-red-500/20'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-white/80 uppercase">الرصيد الختامي</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black">{report.finalBalance}</p>
                <span className="text-sm font-medium text-white/70">د.ك</span>
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider bg-white/20 inline-block px-2 py-0.5 rounded">
                {parseFloat(report.finalBalance) >= 0 ? 'فائض مالي' : 'عجز مالي'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-100 print:bg-gray-100 print:text-gray-900">
                  <th className="px-6 py-4 font-bold">التاريخ</th>
                  <th className="px-6 py-4 font-bold">الفرع</th>
                  <th className="px-6 py-4 font-bold">النوع</th>
                  <th className="px-6 py-4 font-bold">التصنيف</th>
                  <th className="px-6 py-4 font-bold text-emerald-600 print:text-emerald-800">وارد (+)</th>
                  <th className="px-6 py-4 font-bold text-red-600 print:text-red-800">صادر (-)</th>
                  <th className="px-6 py-4 font-bold bg-gray-100/50 print:bg-gray-200">الرصيد الجاري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!report.rows || report.rows.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Search size={40} className="opacity-20" />
                        <p className="font-bold">لا توجد بيانات لهذه الفترة أو لهذا الموظف</p>
                        <p className="text-xs">تأكد من اختيار الفلاتر الصحيحة أو تسجيل عمليات جديدة</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, i) => {
                    const type = row[3] || '';
                    const amount = parseFloat(row[6]) || 0;
                    const isIncome = type.includes('Income') || type.includes('In') || type.includes('توريد');
                    const isExpense = type.includes('Expense') || type.includes('Ex') || type.includes('صرف');
                    const isTransfer = type.includes('Transfer') || type.includes('تحويل');

                    return (
                      <tr key={i} className="hover:bg-gray-50/50 transition-all group print:break-inside-avoid">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-gray-900">{row[0]}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-tighter">تاريخ العملية</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                              <Building2 size={14} />
                            </div>
                            <span className="font-medium">{row[2] || 'عام'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isIncome 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : isTransfer
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {isIncome ? <TrendingUp size={12} /> : isTransfer ? <ArrowRightLeft size={12} /> : <TrendingDown size={12} />}
                            {type}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-medium">{row[4]}</span>
                            <span className="text-[10px] text-gray-400 max-w-[200px] truncate">{row[5] || 'لا يوجد وصف إضافي'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-black text-lg ${isIncome ? 'text-emerald-600' : 'text-gray-300'}`}>
                            {isIncome ? `+${amount.toFixed(3)}` : '0.000'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-black text-lg ${isExpense ? 'text-red-600' : 'text-gray-300'}`}>
                            {isExpense ? `-${Math.abs(amount).toFixed(3)}` : '0.000'}
                          </span>
                        </td>
                        <td className="px-6 py-4 bg-gray-50/50 group-hover:bg-emerald-50/30 transition-colors">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-gray-900 font-mono">{parseFloat(row[7]).toFixed(3)}</span>
                            <span className="text-[10px] text-gray-400 uppercase">د.ك</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer for Print */}
          <div className="p-12 hidden print:block border-t border-gray-100 mt-8">
            <div className="grid grid-cols-3 gap-12 text-center">
              <div className="space-y-4">
                <div className="h-px bg-gray-300 w-full"></div>
                <p className="text-sm font-bold">توقيع المحاسب</p>
              </div>
              <div className="space-y-4">
                <div className="h-px bg-gray-300 w-full"></div>
                <p className="text-sm font-bold">توقيع الموظف</p>
              </div>
              <div className="space-y-4">
                <div className="h-px bg-gray-300 w-full"></div>
                <p className="text-sm font-bold">ختم الشركة</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
