import React, { useState } from 'react';
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
  Info,
  CalendarClock,
  Edit2,
  Trash2,
  BarChart3,
  PieChart as PieChartIcon,
  X
} from 'lucide-react';
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
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !editingTransaction.id) return;
    
    setIsUpdating(true);
    const res = await gasService.updateTransaction(editingTransaction.id, editingTransaction);
    setIsUpdating(false);
    
    if (res.success) {
      setIsEditModalOpen(false);
      handleGenerate(); // Re-fetch report
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
        <div className="flex items-center gap-4 relative">
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
                  size: A4 ${printSettings.orientation};
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
                  zoom: ${printSettings.scale}%;
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
                          report.rows.reduce((acc: Record<string, number>, row) => {
                            const cat = String(row[4] || 'غير مصنف');
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
                      report.rows.reduce((acc: Record<string, number>, row) => {
                        const branch = String(row[2] || 'عام');
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
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] border-l border-white/10">الرصيد</th>
                    <th className="px-6 py-5 font-black text-[10px] uppercase tracking-[0.2em] no-print">إجراءات</th>
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
                    <td className="px-6 py-4 text-center bg-emerald-50/50 border-l border-gray-900">
                      <span className="font-black text-gray-900 font-mono text-sm">{formatKWD(report.openingBalance)}</span>
                    </td>
                    <td className="px-6 py-4 text-center no-print">---</td>
                  </tr>

                  {report.rows.map((row, i) => {
                    const date = String(row[0] || '');
                    const branch = String(row[2] || 'عام');
                    const category = String(row[4] || '');
                    const income = parseFloat(row[5]) || 0;
                    const expense = parseFloat(row[6]) || 0;
                    const balance = row[7];
                    const description = row.length > 8 ? String(row[8] || '-') : '-';
                    const targetMonth = row.length > 9 ? String(row[9] || '') : '';
                    const rowId = row.length > 10 ? row[10] : null;
                    
                    const isIncome = income > 0;

                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 text-center border-l border-gray-900">
                          <span className="font-mono font-bold text-gray-600 text-[11px]">{date}</span>
                          {targetMonth && (
                            <div className="mt-1">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded-full border border-blue-100 uppercase">
                                يخص: {targetMonth}
                              </span>
                            </div>
                          )}
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
                        <td className="px-6 py-4 text-center bg-gray-50 group-hover:bg-emerald-50/30 transition-colors border-l border-gray-900">
                          <span className="font-black text-gray-900 font-mono text-sm">{formatKWD(balance)}</span>
                        </td>
                        <td className="px-6 py-4 text-center no-print">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTransaction({
                                  id: rowId,
                                  date: date,
                                  branch: branch,
                                  category: category,
                                  description: description,
                                  amount: isIncome ? income : expense,
                                  type: isIncome ? 'Income' : 'Expense',
                                  targetMonth: targetMonth
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('هل أنت متأكد من حذف هذه العملية؟')) {
                                  if (rowId) {
                                    const res = await gasService.deleteTransaction(rowId);
                                    if (res.success) {
                                      handleGenerate();
                                    } else {
                                      alert('خطأ في الحذف: ' + res.error);
                                    }
                                  } else {
                                    alert('لا يمكن حذف هذه العملية (ID مفقود)');
                                  }
                                }
                              }}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Detailed Financial Analysis Section */}
            <div className="px-10 pb-10 grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Branch Analysis */}
              <div className="p-6 border-2 border-gray-900 rounded-3xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">
                    <Building2 size={16} />
                  </div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">تحليل المصروفات حسب الفرع</h3>
                </div>
                <div className="space-y-3">
                  {(Object.entries(
                    report.rows.reduce((acc: Record<string, number>, row) => {
                      const branch = String(row[2] || 'عام');
                      const expense = parseFloat(String(row[6])) || 0;
                      if (expense > 0) acc[branch] = (acc[branch] || 0) + expense;
                      return acc;
                    }, {} as Record<string, number>)
                  ) as [string, number][]).map(([branch, total]) => (
                    <div key={branch} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl">
                      <span className="text-[10px] font-black text-gray-500 uppercase">{branch}</span>
                      <span className="font-mono font-black text-rose-600 text-xs">{formatKWD(total)}</span>
                    </div>
                  ))}
                  {Object.keys(report.rows.reduce((acc, row) => {
                    const branch = String(row[2] || 'عام');
                    const expense = parseFloat(row[6]) || 0;
                    if (expense > 0) acc[branch] = (acc[branch] || 0) + expense;
                    return acc;
                  }, {} as Record<string, number>)).length === 0 && (
                    <p className="text-[10px] text-gray-400 italic text-center py-4">لا توجد مصروفات مسجلة</p>
                  )}
                </div>
              </div>

              {/* Category Analysis */}
              <div className="p-6 border-2 border-gray-900 rounded-3xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">
                    <Filter size={16} />
                  </div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">تحليل العمليات حسب التصنيف</h3>
                </div>
                <div className="space-y-3">
                  {(Object.entries(
                    report.rows.reduce((acc: Record<string, { in: number, out: number }>, row) => {
                      const cat = String(row[4] || 'غير مصنف');
                      const income = parseFloat(String(row[5])) || 0;
                      const expense = parseFloat(String(row[6])) || 0;
                      if (!acc[cat]) acc[cat] = { in: 0, out: 0 };
                      acc[cat].in += income;
                      acc[cat].out += expense;
                      return acc;
                    }, {} as Record<string, { in: number, out: number }>)
                  ) as [string, { in: number, out: number }][]).map(([cat, totals]) => (
                    <div key={cat} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-900 uppercase">{cat}</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-bold">
                        <span className="text-emerald-600">وارد: {formatKWD(totals.in)}</span>
                        <span className="text-rose-600">صادر: {formatKWD(totals.out)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Month Analysis */}
              <div className="p-6 border-2 border-gray-900 rounded-3xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white">
                    <CalendarClock size={16} />
                  </div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">تحليل حسب شهر الاستحقاق</h3>
                </div>
                <div className="space-y-3">
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
                    <div key={month} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-blue-600 uppercase">{month}</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-bold">
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
                    <p className="text-[10px] text-gray-400 italic text-center py-4">لا توجد عمليات مخصصة لشهور محددة</p>
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
                        <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0))}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>إجمالي الدائن (صادر):</span>
                        <span className="font-mono">{formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0))}</span>
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

              <form onSubmit={handleUpdate} className="p-8 space-y-6">
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
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">الفرع</label>
                    <select
                      value={editingTransaction.branch}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, branch: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    >
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">التصنيف</label>
                    <input
                      type="text"
                      value={editingTransaction.category}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
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
