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
  X,
  Columns,
  Check,
  SlidersHorizontal,
  Settings2
} from 'lucide-react';
import { exportReportToExcel } from '../utils/excelExport';
import { exportElementToPDF } from '../utils/pdfExport';
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
import { 
  formatKWD, 
  isIncomeType, 
  isExpenseType, 
  isTransferType, 
  isAccrualType, 
  getAccountingOperationType,
  matchBranch,
  parseReportRow,
  NormalizedReportRow
} from '../utils/format';

export type ReportColumnId = 'date' | 'branch' | 'opType' | 'category' | 'description' | 'paymentStatus' | 'income' | 'expense' | 'balance';

export const ALL_COLUMNS: { id: ReportColumnId; label: string; desc: string }[] = [
  { id: 'date', label: 'التاريخ', desc: 'تاريخ تنفيذ الحركة المالية' },
  { id: 'branch', label: 'الفرع', desc: 'الفرع التابع للعملية' },
  { id: 'opType', label: 'نوع العملية', desc: 'مبيعات / مشتريات / مصاريف / تسوية' },
  { id: 'category', label: 'التصنيف / الموظف', desc: 'تصنيف البند والموظف المسؤول' },
  { id: 'description', label: 'البيان والتفاصيل', desc: 'ملاحظات وتفاصيل المعاملة' },
  { id: 'paymentStatus', label: 'حالة الدفع', desc: 'نقدي مسدد أو آجل مستحق' },
  { id: 'income', label: 'وارد (+)', desc: 'المبالغ المقبوضة والتوريدات' },
  { id: 'expense', label: 'صادر (-)', desc: 'المصاريف والمشتريات المدفوعة' },
  { id: 'balance', label: 'الرصيد التراكمي', desc: 'رصيد العهدة/الصندوق بعد الحركة' },
];

interface ReportViewerProps {
  employees: string[];
  balances: EmployeeBalance[];
  branches: string[];
  categories: string[];
  initialEmployee?: string;
}

export default function ReportViewer({ employees, balances, branches, categories, initialEmployee }: ReportViewerProps) {
  const [filters, setFilters] = useState<ReportFilter>({
    employee: initialEmployee || '',
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

  // PDF & Printable Column Customization State
  const [visibleColumns, setVisibleColumns] = useState<Record<ReportColumnId, boolean>>({
    date: true,
    branch: true,
    opType: true,
    category: true,
    description: true,
    paymentStatus: true,
    income: true,
    expense: true,
    balance: true,
  });
  const [showColumnModal, setShowColumnModal] = useState(false);

  const toggleColumn = (colId: ReportColumnId) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [colId]: !prev[colId] };
      // Prevent hiding all columns
      if (!Object.values(updated).some(Boolean)) return prev;
      return updated;
    });
  };

  const selectAllColumns = () => {
    setVisibleColumns({
      date: true,
      branch: true,
      opType: true,
      category: true,
      description: true,
      paymentStatus: true,
      income: true,
      expense: true,
      balance: true,
    });
  };

  const applyPreset = (preset: 'all' | 'essential' | 'financial' | 'nodetails') => {
    if (preset === 'all') {
      selectAllColumns();
    } else if (preset === 'essential') {
      setVisibleColumns({
        date: true,
        branch: false,
        opType: true,
        category: true,
        description: true,
        paymentStatus: false,
        income: true,
        expense: true,
        balance: true,
      });
    } else if (preset === 'financial') {
      setVisibleColumns({
        date: true,
        branch: false,
        opType: false,
        category: true,
        description: false,
        paymentStatus: false,
        income: true,
        expense: true,
        balance: true,
      });
    } else if (preset === 'nodetails') {
      setVisibleColumns({
        date: true,
        branch: true,
        opType: true,
        category: true,
        description: false,
        paymentStatus: true,
        income: true,
        expense: true,
        balance: true,
      });
    }
  };

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

  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const el = document.getElementById('printable-report');
    if (!el || !report) return;

    setPdfLoading(true);
    try {
      const entity = filters.employee || filters.branch || 'تقرير_كشف_حساب';
      const cleanEntity = entity.replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `كشف_حساب_${cleanEntity}_${filters.startDate}_إلى_${filters.endDate}.pdf`;

      await exportElementToPDF(el, {
        filename,
        orientation: printSettings.orientation,
        margins: printSettings.margins,
        scale: printSettings.scale
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF، يرجى المحاولة مرة أخرى.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Parse all raw rows from backend response into standardized object representations
  const rawRows = report ? report.rows.map(parseReportRow) : [];

  // Filter rows by Branch, Employee, and Accrual status with strict Arabic normalization
  const filteredRows = rawRows.filter(pRow => {
    // Branch Filter
    if (filters.branch && filters.branch !== 'كافة الفروع' && filters.branch !== 'الكل') {
      if (!matchBranch(pRow.branch, filters.branch)) {
        return false;
      }
    }

    // Employee Filter
    if (filters.employee && filters.employee !== 'كافة الموظفين' && filters.employee !== 'الكل') {
      if (pRow.employee && pRow.employee !== 'عام' && pRow.employee.trim().toLowerCase() !== filters.employee.trim().toLowerCase()) {
        return false;
      }
    }

    const isTransactionAccrued = isAccrualType(pRow.type, pRow.category, pRow.description);

    if (accrualFilter === 'Due') return isTransactionAccrued;
    if (accrualFilter === 'Paid') return !isTransactionAccrued;
    return true;
  });

  // Sort rows strictly in chronological order (Oldest -> Newest) for correct running balance calculation
  const sortedFilteredRows = [...filteredRows].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  // Calculate dynamic running balances and accounting operation types in exact chronological order
  const initialOpeningBalance = parseFloat(report?.openingBalance || '0') || 0;
  let runningAcc = initialOpeningBalance;

  const computedRows = sortedFilteredRows.map(pRow => {
    const isAccrued = isAccrualType(pRow.type, pRow.category, pRow.description);
    if (!isAccrued) {
      if (isTransferType(pRow.type, pRow.category)) {
        if (filters.employee && pRow.employee === filters.employee) {
          runningAcc += pRow.income - pRow.expense;
        }
      } else {
        runningAcc += pRow.income - pRow.expense;
      }
    }
    const opType = getAccountingOperationType(pRow.type, pRow.category, pRow.description, pRow.income, pRow.expense);
    return {
      ...pRow,
      isAccrued,
      computedBalance: runningAcc,
      opType
    };
  });

  const isUnpaidAccrualRow = (row: NormalizedReportRow) => {
    return isAccrualType(row.type, row.category, row.description);
  };

  const filteredIn = computedRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) return acc;
    return acc + row.income;
  }, 0);

  // Actual cash paid out from treasury/box (EXCLUDES unpaid credit purchases)
  const filteredCashOut = computedRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) return acc;
    if (isUnpaidAccrualRow(row)) return acc; // DO NOT deduct unpaid accruals from cash outflow!
    return acc + row.expense;
  }, 0);

  // Unpaid credit accruals (tracked separately - no cash impact)
  const filteredUnpaidAccruals = computedRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) return acc;
    if (isUnpaidAccrualRow(row)) return acc + row.expense;
    return acc;
  }, 0);

  // Total costs accrued (cash + unpaid accruals) for accrual context
  const filteredTotalCosts = filteredCashOut + filteredUnpaidAccruals;

  // Actual Cash Box Balance (السيولة النقدية المتوفرة بالخزنة)
  const cashEndingBalance = initialOpeningBalance + filteredIn - filteredCashOut;

  const handleExportExcel = () => {
    if (!report) return;
    const fileName = `كشف_حساب_${filters.employee || 'كل_الموظفين'}_${filters.startDate}_إلى_${filters.endDate}`;
    
    const headers: string[] = [];
    if (visibleColumns.date) headers.push('التاريخ');
    if (visibleColumns.branch) headers.push('الفرع');
    if (visibleColumns.category) headers.push('الموظف المسؤول');
    if (visibleColumns.opType) headers.push('نوع الحركة');
    if (visibleColumns.category) headers.push('التصنيف / البند');
    if (visibleColumns.description) headers.push('البيان والتفاصيل الشاملة');
    if (visibleColumns.paymentStatus) headers.push('حالة الدفع');
    if (visibleColumns.income) headers.push('وارد (+)');
    if (visibleColumns.expense) headers.push('صادر (-)');
    if (visibleColumns.balance) headers.push('الرصيد التراكمي (د.ك)');

    // Opening Balance row
    const openingRow: (string | number)[] = [];
    if (visibleColumns.date) openingRow.push('---');
    if (visibleColumns.branch) openingRow.push(filters.branch || 'كافة الفروع');
    if (visibleColumns.category) openingRow.push(filters.employee || 'كافة الموظفين');
    if (visibleColumns.opType) openingRow.push('رصيد افتتاحي');
    if (visibleColumns.category) openingRow.push('رصيد سابق');
    if (visibleColumns.description) openingRow.push('الرصيد المرحل بداية الفترة المالية');
    if (visibleColumns.paymentStatus) openingRow.push('مباشر');
    if (visibleColumns.income) openingRow.push(0);
    if (visibleColumns.expense) openingRow.push(0);
    if (visibleColumns.balance) openingRow.push(initialOpeningBalance);

    const rows: (string | number)[][] = [openingRow];

    // Category breakdown accumulator
    const categoryTotals: Record<string, { count: number; totalExpense: number; totalIncome: number }> = {};
    
    computedRows.forEach(row => {
      // Track categories for purchase/expense itemization
      if (!categoryTotals[row.category]) {
        categoryTotals[row.category] = { count: 0, totalExpense: 0, totalIncome: 0 };
      }
      categoryTotals[row.category].count += 1;
      categoryTotals[row.category].totalExpense += row.expense;
      categoryTotals[row.category].totalIncome += row.income;

      const r: (string | number)[] = [];
      if (visibleColumns.date) r.push(row.date);
      if (visibleColumns.branch) r.push(row.branch);
      if (visibleColumns.category) r.push(row.employee);
      if (visibleColumns.opType) r.push(row.opType);
      if (visibleColumns.category) r.push(row.category);
      if (visibleColumns.description) r.push(row.description);
      if (visibleColumns.paymentStatus) r.push(row.isAccrued ? 'آجل / غير مدفوع' : 'نقدي / مسدد');
      if (visibleColumns.income) r.push(row.income > 0 ? row.income : 0);
      if (visibleColumns.expense) r.push(row.expense > 0 ? row.expense : 0);
      if (visibleColumns.balance) r.push(row.computedBalance);

      rows.push(r);
    });

    // Build Itemized Category Breakdown Section
    const categoryBreakdownRows = Object.entries(categoryTotals).map(([catName, stat]) => {
      const sharePercentage = filteredCashOut > 0 ? ((stat.totalExpense / filteredCashOut) * 100).toFixed(1) + '%' : '0%';
      return [
        catName,
        stat.count,
        stat.totalIncome,
        stat.totalExpense,
        sharePercentage
      ];
    });

    exportReportToExcel({
      fileName,
      sheetName: 'كشف الحساب التفصيلي',
      reportTitle: 'كشف الحساب المالي والعهد التفصيلي للموظف',
      subtitle: `الموظف المسؤول: ${filters.employee || 'كافة الموظفين'} | الفرع: ${filters.branch || 'كافة الفروع'} | الفترة: من ${filters.startDate} إلى ${filters.endDate}`,
      summaryCards: [
        { label: 'الرصيد الافتتاحي (د.ك)', value: initialOpeningBalance },
        { label: 'إجمالي التوريدات والمقبوضات (+)', value: filteredIn },
        { label: 'إجمالي المدفوعات النقدية (-)', value: filteredCashOut },
        { label: 'مشتريات وآجل مستحق (-)', value: filteredUnpaidAccruals },
        { label: 'رصيد السيولة الحالي بالصندوق', value: cashEndingBalance },
      ],
      headers,
      rows,
      totalsRow: [
        'الإجمالي النهائي',
        '-',
        '-',
        '-',
        '-',
        'مجموع الحركات المفلترة',
        '-',
        filteredIn,
        filteredCashOut,
        cashEndingBalance
      ],
      sections: [
        {
          title: 'جدول تفصيلي بمشتريات ومصاريف كل بند على حدة (ملخص التصنيفات)',
          headers: ['التصنيف / البند', 'عدد العمليات', 'إجمالي الوارد (+)', 'إجمالي الصادر / المشتريات (-)', 'نسبة الاستهلاك من الصادر'],
          rows: categoryBreakdownRows,
          totalsRow: [
            'المجموع الكلي للبنود',
            filteredRows.length,
            filteredIn,
            filteredCashOut,
            '100%'
          ]
        }
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
            onClick={() => setShowColumnModal(true)}
            disabled={!report}
            className="flex items-center gap-2 px-5 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-full font-black text-sm shadow-md transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Columns size={18} />
            <span>تحديد أعمدة الـ PDF</span>
            <span className="px-2 py-0.5 bg-slate-900 text-amber-400 rounded-full text-[10px] font-black mr-1">
              {Object.values(visibleColumns).filter(Boolean).length}/{ALL_COLUMNS.length}
            </span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={!report || pdfLoading}
            className="flex items-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm shadow-md transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            <span>تصدير كـ PDF</span>
          </button>

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
                className="absolute left-0 top-full mt-4 w-88 bg-white border-2 border-gray-900 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-6 z-50 space-y-6"
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
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">تحديد أعمدة الـ PDF والطباعة</p>
                    <button
                      onClick={selectAllColumns}
                      className="text-[10px] font-bold text-emerald-600 hover:underline"
                    >
                      تحديد الكل
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1.5 border border-gray-200 rounded-2xl bg-gray-50/50">
                    {ALL_COLUMNS.map(col => {
                      const isChecked = visibleColumns[col.id];
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleColumn(col.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all text-right cursor-pointer ${
                            isChecked
                              ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                              : 'bg-white border-gray-200 text-gray-400'
                          }`}
                        >
                          <span className="truncate">{col.label}</span>
                          {isChecked ? <Check size={12} className="shrink-0 mr-1 text-amber-400" /> : <X size={12} className="shrink-0 mr-1 opacity-40" />}
                        </button>
                      );
                    })}
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

                <div className="pt-4 border-t-2 border-gray-100 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPrintSettings({
                        margins: 'narrow',
                        fontSize: 'normal',
                        orientation: 'landscape',
                        scale: 100,
                        showSummary: true
                      })}
                      className="px-4 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all"
                    >
                      إعادة ضبط
                    </button>
                    <button
                      onClick={() => {
                        setShowPrintConfig(false);
                        handlePrint();
                      }}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all hover:bg-emerald-700"
                    >
                      تطبيق والطباعة
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setShowPrintConfig(false);
                      handleExportPDF();
                    }}
                    disabled={pdfLoading}
                    className="w-full py-3 bg-red-600 text-white rounded-2xl font-black text-xs shadow-md shadow-red-600/20 active:scale-95 transition-all hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    <span>تنزيل كملف PDF بهذه الإعدادات</span>
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
            <div className="hidden print:block print-only mb-8 p-6 border-b-2 border-slate-900">
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
                  onClick={handleExportPDF}
                  disabled={!report || pdfLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-40"
                >
                  {pdfLoading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  <span>تصدير كـ PDF</span>
                </button>
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
                    {visibleColumns.date && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">التاريخ</th>}
                    {visibleColumns.branch && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">الفرع</th>}
                    {visibleColumns.opType && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center">نوع العملية</th>}
                    {visibleColumns.category && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">التصنيف / الموظف</th>}
                    {visibleColumns.description && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">البيان والتفاصيل</th>}
                    {visibleColumns.paymentStatus && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center">حالة الدفع</th>}
                    {visibleColumns.income && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-emerald-400">وارد (+)</th>}
                    {visibleColumns.expense && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-rose-400">صادر (-)</th>}
                    {visibleColumns.balance && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">الرصيد التراكمي</th>}
                    <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center no-print">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/70">
                    {visibleColumns.date && <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">---</td>}
                    {visibleColumns.branch && <td className="px-4 py-3 text-center text-slate-400 text-xs">---</td>}
                    {visibleColumns.opType && (
                      <td className="px-4 py-3 text-center font-bold text-xs text-slate-500 bg-slate-100/60 rounded">
                        رصيد دفتري
                      </td>
                    )}
                    {visibleColumns.category && (
                      <td className="px-4 py-3 font-bold text-xs text-slate-700">
                        رصيد افتتاحي
                      </td>
                    )}
                    {visibleColumns.description && (
                      <td className="px-4 py-3 text-slate-500 text-xs italic">
                        الرصيد المرحل من السجلات السابقة
                      </td>
                    )}
                    {visibleColumns.paymentStatus && <td className="px-4 py-3 text-center text-slate-400 text-xs">---</td>}
                    {visibleColumns.income && <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">0.000</td>}
                    {visibleColumns.expense && <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">0.000</td>}
                    {visibleColumns.balance && (
                      <td className="px-4 py-3 font-mono text-sm font-extrabold text-slate-900">
                        {formatKWD(report.openingBalance)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center no-print text-slate-300">---</td>
                  </tr>

                  {computedRows.map((row, i) => {
                    const date = row.date;
                    const employee = row.employee;
                    const branch = row.branch;
                    const type = row.type;
                    const category = row.category;
                    const income = row.income;
                    const expense = row.expense;
                    const balance = row.computedBalance;
                    const description = row.description;
                    const targetMonth = row.targetMonth;
                    
                    const calculatedRowId = row.id || (i + 2);
                    const rowIndexInSheet = (typeof row.raw === 'object' && row.raw?.rowIndex) ? row.raw.rowIndex : (i + 2);

                    const isIncome = isIncomeType(type) || (income > 0 && !isTransferType(type));
                    const isTransfer = isTransferType(type);
                    const isTransactionAccrued = row.isAccrued;
                    const opType = row.opType;

                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.date && (
                          <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-600">
                            {date}
                            {targetMonth && (
                              <span className="mr-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200/60 inline-block">
                                يخص: {targetMonth}
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColumns.branch && (
                          <td className="px-4 py-3 text-xs font-bold text-slate-700">
                            {branch}
                          </td>
                        )}
                        {visibleColumns.opType && (
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black border inline-block ${
                              opType === 'مبيعات' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                              opType === 'مشتريات' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                              opType === 'مصاريف' ? 'bg-red-100 text-red-900 border-red-300' :
                              opType === 'مشتريات آجلة' ? 'bg-orange-100 text-orange-950 border-orange-300 font-extrabold' :
                              opType === 'مصاريف مستحقة' ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold' :
                              opType === 'سداد مستحقات' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                              opType === 'إغلاق وتصفية صندوق' ? 'bg-teal-100 text-teal-900 border-teal-300 font-black' :
                              'bg-slate-100 text-slate-800 border-slate-300'
                            }`}>
                              {opType}
                            </span>
                          </td>
                        )}
                        {visibleColumns.category && (
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
                        )}
                        {visibleColumns.description && (
                          <td className="px-4 py-3 text-xs text-slate-800 font-medium leading-relaxed max-w-[300px]">
                            {description}
                          </td>
                        )}
                        {visibleColumns.paymentStatus && (
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
                        )}
                        {visibleColumns.income && (
                          <td className="px-4 py-3 font-mono font-bold text-sm text-emerald-600">
                            {income > 0 ? income.toFixed(3) : '0.000'}
                          </td>
                        )}
                        {visibleColumns.expense && (
                          <td className="px-4 py-3 font-mono font-bold text-sm text-rose-600">
                            {expense > 0 ? expense.toFixed(3) : '0.000'}
                          </td>
                        )}
                        {visibleColumns.balance && (
                          <td className="px-4 py-3 font-mono text-extrabold text-sm text-slate-900 bg-slate-50/50">
                            {formatKWD(balance)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingTransaction({
                                  id: calculatedRowId,
                                  rowIndex: rowIndexInSheet,
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
                                    id: calculatedRowId,
                                    rowIndex: rowIndexInSheet,
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
                {(() => {
                  let leadingColSpan = 0;
                  if (visibleColumns.date) leadingColSpan++;
                  if (visibleColumns.branch) leadingColSpan++;
                  if (visibleColumns.opType) leadingColSpan++;
                  if (visibleColumns.category) leadingColSpan++;
                  if (visibleColumns.description) leadingColSpan++;
                  if (visibleColumns.paymentStatus) leadingColSpan++;

                  let trailingColSpan = 0;
                  if (visibleColumns.balance) trailingColSpan++;

                  return (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        {leadingColSpan > 0 && (
                          <td colSpan={leadingColSpan} className="px-4 py-3 text-left">إجمالي الكشف التدقيقي:</td>
                        )}
                        {visibleColumns.income && (
                          <td className="px-4 py-3 font-mono text-emerald-400 font-extrabold text-sm">
                            {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[5]) || 0), 0))}
                          </td>
                        )}
                        {visibleColumns.expense && (
                          <td className="px-4 py-3 font-mono text-rose-400 font-extrabold text-sm">
                            {formatKWD(report.rows.reduce((acc, row) => acc + (parseFloat(row[6]) || 0), 0))}
                          </td>
                        )}
                        {trailingColSpan > 0 && (
                          <td colSpan={trailingColSpan} className="px-4 py-3 font-mono text-white font-black text-sm">
                            الرصيد: {formatKWD(report.finalBalance)}
                          </td>
                        )}
                        <td className="px-4 py-3 no-print"></td>
                      </tr>
                    </tfoot>
                  );
                })()}
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

        {/* Dedicated Column Customization Modal */}
        {showColumnModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                    <Columns size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base">تخصيص أعمدة التقرير المطبوع / PDF</h3>
                    <p className="text-xs text-slate-400">حدد الأعمدة المطلوبة للظهور في تقرير الـ PDF المصدّر</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowColumnModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">نماذج جاهزة</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('all')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                    >
                      عرض الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('essential')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                    >
                      أساسي
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('financial')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                    >
                      مالي فقط
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('nodetails')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                    >
                      مختصر
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">الأعمدة المتاحة</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALL_COLUMNS.map((col) => {
                      const isChecked = visibleColumns[col.id];
                      return (
                        <label
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-200 text-blue-900 font-bold'
                              : 'bg-slate-50 border-slate-100 text-slate-500 font-medium hover:bg-slate-100'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                            isChecked ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white'
                          }`}>
                            {isChecked && <CheckCircle2 size={14} />}
                          </div>
                          <span className="text-xs">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowColumnModal(false)}
                    className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-bold text-xs hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    اعتماد وتطبيق التخصيص
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
