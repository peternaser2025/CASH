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

          <div className="p-8 border-b border-gray-100 flex justify-between items-start print:hidden">
            <div className="flex gap-6 items-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-8 bg-gray-50/50 print:bg-white print:p-0 print:mb-12 print:grid-cols-4 print:gap-2">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border-2 print:p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg print:hidden">
                  <Wallet size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">الرصيد الافتتاحي</p>
              </div>
              <p className="text-2xl font-black text-gray-900">{parseFloat(report.openingBalance).toFixed(3)} <span className="text-sm font-medium text-gray-400">د.ك</span></p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border-2 print:p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg print:hidden">
                  <TrendingDown size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">إجمالي الصادر</p>
              </div>
              <p className="text-2xl font-black text-red-600">
                {report.rows.reduce((acc, row) => {
                  const type = String(row[3] || '').toLowerCase();
                  const amount = Math.abs(parseFloat(row[6]) || 0);
                  // Logic: If it's an Expense OR a Transfer where the employee is the sender
                  const isExpense = type.includes('expense') || type.includes('صرف') || type.includes('مصروف');
                  const isTransferOut = type.includes('transfer') || type.includes('تحويل');
                  return (isExpense || isTransferOut) ? acc + amount : acc;
                }, 0).toFixed(3)} <span className="text-sm font-medium text-gray-400">د.ك</span>
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:border-2 print:p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg print:hidden">
                  <TrendingUp size={20} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">إجمالي الوارد</p>
              </div>
              <p className="text-2xl font-black text-emerald-600">
                {report.rows.reduce((acc, row) => {
                  const type = String(row[3] || '').toLowerCase();
                  const amount = Math.abs(parseFloat(row[6]) || 0);
                  const isIncome = type.includes('income') || type.includes('توريد') || type.includes('وارد');
                  return isIncome ? acc + amount : acc;
                }, 0).toFixed(3)} <span className="text-sm font-medium text-gray-400">د.ك</span>
              </p>
            </div>

            <div className={`p-6 rounded-2xl border shadow-lg print:shadow-none print:p-4 print:border-2 ${
              parseFloat(report.finalBalance) >= 0 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20 print:bg-white print:text-emerald-700 print:border-emerald-600' 
                : 'bg-red-600 border-red-500 text-white shadow-red-500/20 print:bg-white print:text-red-700 print:border-red-600'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg print:hidden">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-white/80 uppercase print:text-gray-600">الرصيد الختامي</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black">{parseFloat(report.finalBalance).toFixed(3)}</p>
                <span className="text-sm font-medium text-white/70 print:text-gray-400">د.ك</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-100 print:bg-gray-100 print:text-gray-900 print:border-b-2 print:border-gray-900">
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">التاريخ</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">الفرع</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">النوع / التصنيف</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">البيان والتفاصيل</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-emerald-600 print:text-emerald-800">وارد (+)</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-red-600 print:text-red-800">صادر (-)</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] bg-gray-100/50 print:bg-gray-200">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 print:divide-y-2 print:divide-gray-200">
                {(!report.rows || report.rows.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-4">
                        <Search size={64} className="opacity-10" />
                        <p className="font-black text-xl">لا توجد سجلات مالية مطابقة</p>
                        <p className="text-sm font-medium">يرجى التأكد من اختيار الموظف والفترة الزمنية الصحيحة</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, i) => {
                    const typeStr = String(row[3] || '').toLowerCase();
                    const category = String(row[4] || '');
                    const amount = Math.abs(parseFloat(row[6]) || 0);
                    
                    const isIncome = typeStr.includes('income') || typeStr.includes('توريد') || typeStr.includes('وارد');
                    const isExpense = typeStr.includes('expense') || typeStr.includes('صرف') || typeStr.includes('مصروف');
                    const isTransfer = typeStr.includes('transfer') || typeStr.includes('تحويل');

                    return (
                      <tr key={i} className="hover:bg-gray-50/50 transition-all group print:break-inside-avoid">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-gray-900">{row[0]}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700">{row[2] || 'عام'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider w-fit ${
                              isIncome 
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                : isTransfer
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                            }`}>
                              {isIncome ? <TrendingUp size={10} /> : isTransfer ? <ArrowRightLeft size={10} /> : <TrendingDown size={10} />}
                              {row[3]}
                            </div>
                            <span className="text-[11px] font-bold text-gray-500">{category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-gray-900 font-medium text-xs leading-relaxed max-w-[250px]">{row[5] || '-'}</p>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`font-black text-base ${isIncome ? 'text-emerald-600' : 'text-gray-200'}`}>
                            {isIncome ? `+${amount.toFixed(3)}` : '0.000'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`font-black text-base ${(isExpense || isTransfer) ? 'text-red-600' : 'text-gray-200'}`}>
                            {(isExpense || isTransfer) ? `-${amount.toFixed(3)}` : '0.000'}
                          </span>
                        </td>
                        <td className="px-6 py-5 bg-gray-50/50 group-hover:bg-emerald-50/30 transition-colors print:bg-gray-100">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-gray-900 font-mono text-base">{parseFloat(row[7]).toFixed(3)}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase">KWD</span>
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
          <div className="p-16 hidden print:block border-t-2 border-gray-100 mt-12 bg-gray-50 rounded-b-[3rem]">
            <div className="grid grid-cols-3 gap-16 text-center">
              <div className="space-y-6">
                <div className="h-0.5 bg-gray-300 w-full"></div>
                <p className="text-sm font-black text-gray-900">توقيع المحاسب المسؤول</p>
                <p className="text-[10px] text-gray-400">المراجعة والتدقيق</p>
              </div>
              <div className="space-y-6">
                <div className="h-0.5 bg-gray-300 w-full"></div>
                <p className="text-sm font-black text-gray-900">توقيع الموظف / صاحب العهدة</p>
                <p className="text-[10px] text-gray-400">إقرار بصحة البيانات</p>
              </div>
              <div className="space-y-6">
                <div className="h-0.5 bg-gray-300 w-full"></div>
                <p className="text-sm font-black text-gray-900">اعتماد الإدارة العامة</p>
                <p className="text-[10px] text-gray-400">ختم الشركة الرسمي</p>
              </div>
            </div>
            <div className="mt-16 text-center border-t border-gray-200 pt-8">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em]">KWD FINANCE PRO - GENERATED SECURELY</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
