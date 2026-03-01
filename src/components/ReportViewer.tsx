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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowPrintConfig(!showPrintConfig)}
            disabled={!report}
            className="group relative flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-900 rounded-full hover:bg-gray-900 hover:text-white transition-all duration-500 font-black text-sm disabled:opacity-30 disabled:pointer-events-none"
          >
            <Printer size={18} className="group-hover:rotate-12 transition-transform" />
            تخصيص الطباعة
          </button>
          
          <button
            onClick={handlePrint}
            disabled={!report}
            className="flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 font-black text-sm disabled:opacity-30"
          >
            <Download size={18} />
            تصدير التقرير
          </button>
        </div>
      </div>

      {/* Filters Section - Technical Grid Style */}
      <div className="relative no-print">
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] overflow-hidden shadow-2xl shadow-gray-200/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-gray-900">
            <div className="p-6 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <User size={12} className="text-emerald-500" />
                الموظف المسؤول
              </label>
              <select
                value={filters.employee}
                onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                className="w-full bg-transparent font-black text-gray-900 outline-none cursor-pointer appearance-none"
              >
                <option value="">كافة الموظفين</option>
                {employees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <div className="p-6 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Building2 size={12} className="text-emerald-500" />
                الفرع / الموقع
              </label>
              <select
                value={filters.branch}
                onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                className="w-full bg-transparent font-black text-gray-900 outline-none cursor-pointer appearance-none"
              >
                <option value="">كافة الفروع</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="p-6 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <ArrowRightLeft size={12} className="text-emerald-500" />
                نوع العملية
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full bg-transparent font-black text-gray-900 outline-none cursor-pointer appearance-none"
              >
                <option value="All">كافة العمليات</option>
                <option value="Expense">مصروفات</option>
                <option value="Income">توريدات</option>
                <option value="Transfer">تحويلات</option>
              </select>
            </div>

            <div className="p-6 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Calendar size={12} className="text-emerald-500" />
                من تاريخ
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full bg-transparent font-black text-gray-900 outline-none"
              />
            </div>

            <div className="p-6 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Calendar size={12} className="text-emerald-500" />
                إلى تاريخ
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full bg-transparent font-black text-gray-900 outline-none"
              />
            </div>
          </div>
          
          <div className="border-t-2 border-gray-900 p-4 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4 px-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">System Ready</span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <p className="text-[10px] font-bold text-gray-400">يرجى تحديد المعايير بدقة للحصول على أفضل النتائج</p>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-3 px-12 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-emerald-600 transition-all duration-500 disabled:bg-gray-200 active:scale-95 group"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} className="group-hover:scale-110 transition-transform" />}
              توليد التقرير المالي
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-800"
            >
              <AlertCircle size={18} />
              <p className="text-xs font-black">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
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
                  font-family: "Inter", sans-serif !important;
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
                  border: 2px solid #000 !important;
                }
                th, td {
                  border: 1px solid #000 !important;
                  padding: 8px 10px !important;
                  text-align: right !important;
                  font-size: 10px !important;
                }
                th {
                  background-color: #f1f5f9 !important;
                  font-weight: 900 !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.05em !important;
                }
                .no-print { display: none !important; }
                .print-only { display: block !important; }
                .font-mono { font-family: "JetBrains Mono", monospace !important; }
              }
            ` }} />
            {/* Professional Header - Bank Statement Style */}
            <div className="hidden print:block mb-10">
              <div className="flex justify-between items-start border-b-4 border-black pb-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white font-black text-2xl">K</div>
                    <div>
                      <h1 className="text-2xl font-black tracking-tighter leading-none">KWD FINANCE PRO</h1>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Enterprise Solutions</p>
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">كشف حساب مالي تفصيلي</h2>
                  <div className="flex gap-6 text-[10px] text-gray-500 font-bold">
                    <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-KW')}</p>
                    <p>رقم المرجع: #FIN-{Math.floor(Math.random() * 1000000)}</p>
                  </div>
                </div>
                
                <div className="text-left space-y-4">
                  <div className="p-4 border-2 border-black rounded-2xl bg-gray-50">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">الرصيد الختامي</p>
                    <p className="text-3xl font-black text-black font-mono">{formatKWD(report.finalBalance)} <span className="text-xs">KWD</span></p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-8 mt-8">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">صاحب الحساب</p>
                  <p className="text-sm font-black text-black">{filters.employee || 'كافة الموظفين'}</p>
                  <p className="text-[10px] font-bold text-gray-500">{filters.branch || 'كافة الفروع'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">فترة التقرير</p>
                  <p className="text-sm font-black text-black">{filters.startDate} ↔ {filters.endDate}</p>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">حالة الحساب</p>
                  <p className="text-sm font-black text-emerald-600 uppercase">نشط / مدقق</p>
                </div>
              </div>
            </div>

            <div className="p-10 border-b border-gray-100 flex justify-between items-center print:hidden">
              <div className="flex gap-6 items-center">
                <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-gray-900/20">
                  <FileText size={32} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-gray-900">كشف الحساب التفصيلي</h1>
                  <div className="flex gap-3 mt-2">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg border border-emerald-100">
                      {filters.employee || 'كافة الموظفين'}
                    </span>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg border border-blue-100">
                      {filters.startDate} ↔ {filters.endDate}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">System Generated Report</p>
                <p className="text-[10px] font-bold text-gray-500">{new Date().toLocaleString('ar-KW')}</p>
              </div>
            </div>

            {/* Redesigned Summary Cards - Hardware/Widget Style */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-b-2 border-gray-900 no-print">
              {[
                { label: 'الرصيد الافتتاحي', value: report.openingBalance, icon: Wallet, color: 'blue' },
                { label: 'إجمالي الوارد', value: report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0), icon: TrendingUp, color: 'emerald' },
                { label: 'إجمالي الصادر', value: report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0), icon: TrendingDown, color: 'rose' },
                { label: 'الرصيد الختامي', value: report.finalBalance, icon: CheckCircle2, color: parseFloat(report.finalBalance) >= 0 ? 'emerald' : 'rose', highlight: true }
              ].map((card, idx) => (
                <div 
                  key={idx}
                  className={`p-8 flex flex-col justify-between border-l last:border-l-0 border-gray-900 relative overflow-hidden group ${
                    card.highlight ? 'bg-gray-900 text-white' : 'bg-white'
                  }`}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${card.highlight ? 'text-emerald-400' : 'text-gray-400'}`}>
                        {card.label}
                      </p>
                      <card.icon size={16} className={card.highlight ? 'text-white/20' : 'text-gray-200'} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-black font-mono tracking-tighter ${card.highlight ? 'text-white' : 'text-gray-900'}`}>
                        {formatKWD(card.value)}
                      </span>
                      <span className={`text-xs font-bold ${card.highlight ? 'text-white/40' : 'text-gray-400'}`}>KWD</span>
                    </div>
                  </div>
                  
                  {/* Decorative Grid Pattern for Highlight Card */}
                  {card.highlight && (
                    <div className="absolute inset-0 opacity-10 pointer-events-none data-grid-bg"></div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-10 py-10 overflow-x-auto print:overflow-visible print:px-0">
              <table className="w-full text-right border-collapse border-2 border-gray-900">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10">التاريخ</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10">الفرع</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10">التصنيف</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10">البيان</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10 text-emerald-400">وارد (+)</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10 text-rose-400">صادر (-)</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] bg-white/10">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-900">
                  {/* Opening Balance Row */}
                  <tr className="bg-emerald-50/30">
                    <td className="px-6 py-4 text-center text-gray-400 font-mono text-[10px] border-l border-gray-900">---</td>
                    <td className="px-6 py-4 text-center text-gray-400 text-[10px] border-l border-gray-900">---</td>
                    <td className="px-6 py-4 border-l border-gray-900">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Initial Balance</span>
                    </td>
                    <td className="px-6 py-4 border-l border-gray-900">
                      <p className="text-gray-500 text-[11px] font-bold italic">الرصيد المرحل من الفترات السابقة</p>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs border-l border-gray-900 text-gray-300">0.000</td>
                    <td className="px-6 py-4 text-center font-mono text-xs border-l border-gray-900 text-gray-300">0.000</td>
                    <td className="px-6 py-4 text-center bg-emerald-50/50">
                      <span className="font-black text-gray-900 font-mono text-sm">{formatKWD(report.openingBalance)}</span>
                    </td>
                  </tr>

                  {report.rows.map((row, i) => {
                    const date = String(row[0] || '');
                    const branch = String(row[2] || 'عام');
                    const category = String(row[4] || '');
                    const income = parseFloat(row[5]) || 0;
                    const expense = parseFloat(row[6]) || 0;
                    const balance = row[7];
                    const description = row.length > 8 ? String(row[8] || '-') : '-';
                    
                    const isIncome = income > 0;

                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 text-center border-l border-gray-900">
                          <span className="font-mono font-bold text-gray-600 text-[11px]">{date}</span>
                        </td>
                        <td className="px-6 py-4 text-center border-l border-gray-900">
                          <span className="font-black text-gray-400 text-[10px] uppercase tracking-tighter">{branch}</span>
                        </td>
                        <td className="px-6 py-4 border-l border-gray-900">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            isIncome ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {category}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-l border-gray-900">
                          <p className="text-gray-900 font-bold text-xs leading-relaxed max-w-[320px]">
                            {description}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center border-l border-gray-900">
                          <span className={`font-black font-mono text-sm ${isIncome ? 'text-emerald-600' : 'text-gray-200'}`}>
                            {income > 0 ? income.toFixed(3) : '0.000'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center border-l border-gray-900">
                          <span className={`font-black font-mono text-sm ${expense > 0 ? 'text-rose-600' : 'text-gray-200'}`}>
                            {expense > 0 ? expense.toFixed(3) : '0.000'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center bg-gray-50 group-hover:bg-emerald-50/30 transition-colors">
                          <span className="font-black text-gray-900 font-mono text-sm">{formatKWD(balance)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Redesigned Footer - Formal Bank Style */}
            <div className="p-12 hidden print:block border-t-4 border-black bg-white">
              <div className="grid grid-cols-3 gap-12 mb-16">
                <div className="p-6 border-2 border-black rounded-2xl">
                  <p className="text-[8px] font-black text-gray-400 uppercase mb-2">ملخص العمليات</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>إجمالي الوارد:</span>
                      <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0))}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>إجمالي الصادر:</span>
                      <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0))}</span>
                    </div>
                    <div className="pt-2 border-t border-black flex justify-between text-xs font-black">
                      <span>الرصيد النهائي:</span>
                      <span className="font-mono">{formatKWD(report.finalBalance)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-8">
                  <div className="space-y-12">
                    <div className="border-b-2 border-black pb-2">
                      <p className="text-[10px] font-black text-black">توقيع المحاسب المسؤول</p>
                    </div>
                    <div className="border-b-2 border-black pb-2">
                      <p className="text-[10px] font-black text-black">توقيع الموظف / صاحب العهدة</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-4">
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
    </div>
  );
}
