import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Printer, 
  FileSpreadsheet,
  Columns,
  Loader2
} from 'lucide-react';
import { exportReportToExcel } from '../utils/excelExport';
import { exportElementToPDF } from '../utils/pdfExport';
import { 
  getCompanyProfile, 
  getPrintDisplayOptions, 
  PrintDisplayOptions,
  CompanyPrintProfile
} from '../utils/printConfig';
import PrintHeader from './print/PrintHeader';
import PrintWatermark from './print/PrintWatermark';
import PrintToolbar from './print/PrintToolbar';
import PrintSettingsModal from './PrintSettingsModal';
import { gasService } from '../services/gasService';
import { ReportFilter, ReportData, EmployeeBalance } from '../types';
import VoucherModal, { VoucherData } from './VoucherModal';
import { 
  formatKWD, 
  isTransferType, 
  isAccrualType, 
  getAccountingOperationType,
  matchBranch,
  parseReportRow,
  NormalizedReportRow,
  normalizeExcelDate
} from '../utils/format';

import ReportTable, { ComputedReportRow } from './report/ReportTable';
import ReportAnalytics from './report/ReportAnalytics';
import ReportFilterSection from './report/ReportFilterSection';
import ReportMetricCards from './report/ReportMetricCards';
import ColumnCustomizationModal from './report/ColumnCustomizationModal';
import EditTransactionModal from './report/EditTransactionModal';
import ReportPrintFooter from './report/ReportPrintFooter';

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
    department: '',
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
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Column Customization State
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

  // Print Configuration State
  const [companyProfile, setCompanyProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [printOptions, setPrintOptions] = useState<PrintDisplayOptions>(() => ({
    ...getPrintDisplayOptions(),
    paperSize: 'A4-landscape'
  }));
  const [isPrintSettingsModalOpen, setIsPrintSettingsModalOpen] = useState(false);

  // Auto-generate report when initialEmployee is passed from parent (e.g., from Balance cards or Journal)
  useEffect(() => {
    if (initialEmployee) {
      setFilters(prev => ({ ...prev, employee: initialEmployee }));
      const cleanFilters = {
        employee: initialEmployee,
        branch: '',
        department: '',
        type: '',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      };
      setLoading(true);
      setError(null);
      gasService.getReport(cleanFilters)
        .then(data => {
          if (data && Array.isArray(data.rows)) {
            setReport(data);
          }
        })
        .catch(err => {
          console.error('Failed to auto-load report for employee:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialEmployee]);

  const toggleColumn = (colId: ReportColumnId) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [colId]: !prev[colId] };
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
    if (printOptions.paperSize === 'thermal-80mm') {
      document.body.classList.add('thermal-mode');
    } else {
      document.body.classList.remove('thermal-mode');
    }
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('thermal-mode');
      }, 1000);
    }, 150);
  };

  const handleExportPDF = async () => {
    const el = document.getElementById('printable-report');
    if (!el || !report) return;

    setPdfLoading(true);
    try {
      const entity = filters.employee || filters.branch || 'تقرير_كشف_حساب';
      const cleanEntity = entity.replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `كشف_حساب_${cleanEntity}_${filters.startDate}_إلى_${filters.endDate}.pdf`;

      const orientation = printOptions.paperSize === 'A4-landscape' ? 'landscape' : 'portrait';
      await exportElementToPDF(el, {
        filename,
        orientation: orientation,
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF، يرجى المحاولة مرة أخرى.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !editingTransaction.id) return;
    
    setIsUpdating(true);
    const updatedData = {
      ...editingTransaction,
      amount: parseFloat(String(editingTransaction.amount)),
      targetMonth: editingTransaction.targetMonth || ''
    };
    
    const res = await gasService.updateTransaction(editingTransaction.id, updatedData);
    setIsUpdating(false);
    
    if (res.success) {
      setIsEditModalOpen(false);
      handleGenerate();
      alert('تم تحديث العملية بنجاح');
    } else {
      alert('خطأ في التحديث: ' + res.error);
    }
  };

  // Parse raw rows
  const rawRows = report ? report.rows.map(parseReportRow) : [];

  // Filter rows
  const filteredRows = rawRows.filter(pRow => {
    if (filters.branch && filters.branch !== 'كافة الفروع' && filters.branch !== 'الكل') {
      if (!matchBranch(pRow.branch, filters.branch)) return false;
    }

    const isCity = matchBranch(filters.branch, 'سيتي') || filters.branch === 'سيتي';
    if (isCity && filters.department && filters.department !== 'All' && filters.department !== 'الكل' && filters.department !== '') {
      if (filters.department === 'unassigned' || filters.department === 'غير محدد / بيانات سابقة') {
        if (pRow.department && pRow.department.trim() !== '') return false;
      } else {
        if (!pRow.department || pRow.department.trim() !== filters.department.trim()) return false;
      }
    }

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

  // Chronological sort
  const sortedFilteredRows = [...filteredRows].sort((a, b) => {
    const timeA = new Date(normalizeExcelDate(a.date)).getTime() || 0;
    const timeB = new Date(normalizeExcelDate(b.date)).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  const initialOpeningBalance = parseFloat(report?.openingBalance || '0') || 0;
  let runningAcc = initialOpeningBalance;

  const computedRows: ComputedReportRow[] = sortedFilteredRows.map(pRow => {
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

  const isUnpaidAccrualRow = (row: ComputedReportRow | NormalizedReportRow) => {
    return isAccrualType(row.type, row.category, row.description);
  };

  const filteredIn = computedRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) return acc;
    return acc + row.income;
  }, 0);

  const filteredCashOut = computedRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) return acc;
    if (isUnpaidAccrualRow(row)) return acc;
    return acc + row.expense;
  }, 0);

  const filteredUnpaidAccruals = computedRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) return acc;
    if (isUnpaidAccrualRow(row)) return acc + row.expense;
    return acc;
  }, 0);

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
    const categoryTotals: Record<string, { count: number; totalExpense: number; totalIncome: number }> = {};
    
    computedRows.forEach(row => {
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

  const handlePrintVoucher = (row: ComputedReportRow, rowIndexInSheet: number) => {
    const isTransfer = isTransferType(row.type);
    const isIncome = row.income > 0 && !isTransfer;
    const amount = isIncome ? row.income : row.expense;
    const vType = isTransfer ? 'transfer' : (isIncome ? 'receipt' : 'payment');
    
    setActiveVoucher({
      voucherNumber: `VCH-${row.date.replace(/-/g, '')}-${rowIndexInSheet}`,
      type: vType as any,
      date: row.date,
      amount: amount,
      paidTo: isTransfer ? (row.employee || 'المستلم') : (row.category || 'الجهة المستفيدة'),
      receivedFrom: isTransfer ? (row.employee || 'المحول') : 'الخزينة العامة',
      paymentMethod: 'cash',
      category: row.category,
      branch: row.branch,
      department: row.department,
      description: row.description,
      targetMonth: row.targetMonth,
      preparedBy: 'المحاسب المسؤول'
    });
    setIsVoucherModalOpen(true);
  };

  const handleEditTransaction = (row: ComputedReportRow, rowIndexInSheet: number) => {
    const calculatedRowId = row.id || `${row.date}_${rowIndexInSheet}`;
    const isTransfer = isTransferType(row.type);
    const isIncome = row.income > 0 && !isTransfer;

    setEditingTransaction({
      id: calculatedRowId,
      rowIndex: rowIndexInSheet,
      date: row.date,
      branch: row.branch,
      category: row.category,
      department: row.department,
      description: row.description,
      amount: row.income > 0 ? row.income : row.expense,
      type: isTransfer ? 'Transfer' : (isIncome ? 'Income' : 'Expense'),
      targetMonth: row.targetMonth,
      employee: row.employee,
      sender: isTransfer ? row.employee : '',
      receiver: '' 
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteTransaction = async (row: ComputedReportRow, rowIndexInSheet: number) => {
    const calculatedRowId = row.id || `${row.date}_${rowIndexInSheet}`;
    if (window.confirm('هل أنت متأكد من حذف هذه العملية؟')) {
      const res = await gasService.deleteTransaction(calculatedRowId, {
        id: calculatedRowId,
        rowIndex: rowIndexInSheet,
        date: row.date,
        employee: row.employee,
        branch: row.branch,
        category: row.category,
        amount: row.income > 0 ? row.income : row.expense,
        description: row.description
      });
      if (res && res.success) {
        handleGenerate();
      } else {
        alert('تنبيه: ' + (res?.error || 'تعذر العثور على المعرف في السيرفر'));
      }
    }
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
            <span>تصدير إلى إكسيل (Excel)</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!report}
            className="flex items-center gap-2 px-6 py-4 bg-slate-900 hover:bg-black text-white rounded-full font-bold text-sm shadow-md transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Printer size={18} />
            <span>طباعة فورية</span>
          </button>
        </div>
      </div>

      {/* Filter Section Module */}
      <ReportFilterSection
        filters={filters}
        onChangeFilters={setFilters}
        employees={employees}
        branches={branches}
        accrualFilter={accrualFilter}
        onChangeAccrualFilter={setAccrualFilter}
        onGenerate={handleGenerate}
        loading={loading}
        totalRecordsCount={report ? report.rows.length : undefined}
      />

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          {error}
        </div>
      )}

      {/* Main Report View */}
      <AnimatePresence>
        {report && (
          <div className="space-y-6">
            {/* Top Print Toolbar */}
            <div className="no-print">
              <PrintToolbar
                options={printOptions}
                onChangeOptions={setPrintOptions}
                onPrint={handlePrint}
                onExportPDF={handleExportPDF}
                pdfLoading={pdfLoading}
                onOpenSettings={() => setIsPrintSettingsModalOpen(true)}
                allowThermal={true}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:overflow-visible relative"
              id="printable-report"
            >
              <PrintWatermark type={printOptions.watermark} />
              
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
                  body.voucher-modal-active #printable-report,
                  body.order-invoice-active #printable-report {
                    display: none !important;
                  }
                  @page {
                    margin: 8mm;
                    size: ${printOptions.paperSize === 'A4-landscape' ? 'A4 landscape' : printOptions.paperSize === 'A5' ? 'A5' : 'A4 portrait'};
                  }
                  body {
                    background: white !important;
                    color: black !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    font-family: system-ui, -apple-system, sans-serif !important;
                  }
                  #printable-report {
                    font-size: 9pt;
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
                    padding: 4px 6px !important;
                    text-align: right !important;
                    font-size: 9px !important;
                  }
                  th {
                    font-weight: 800 !important;
                    background-color: #f1f5f9 !important;
                    color: #0f172a !important;
                  }
                  .break-inside-avoid {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                  .no-print { display: none !important; }
                  .print-only { display: block !important; }
                  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
                }
              ` }} />

              {/* Print Header */}
              <div className="hidden print:block print-only mb-6 p-4">
                <PrintHeader
                  documentTitleAr="كشف حساب مالي تفصيلي ومطابقة عهدة"
                  documentTitleEn="FINANCIAL STATEMENT & RECONCILIATION SCHEDULE"
                  documentNumber={`STMT-${Date.now().toString().slice(-6)}`}
                  date={new Date().toLocaleDateString('ar-KW')}
                  profile={companyProfile}
                  showQRCode={printOptions.showQRCode}
                  showLetterhead={printOptions.showLetterhead}
                  qrPayload={JSON.stringify({
                    org: companyProfile.companyNameAr,
                    type: 'STATEMENT',
                    emp: filters.employee,
                    br: filters.branch,
                    start: filters.startDate,
                    end: filters.endDate,
                    bal: report.finalBalance
                  })}
                  extraMeta={[
                    { label: 'الموظف / العهدة', value: filters.employee || 'كافة الموظفين' },
                    { label: 'الفرع المستفيد', value: filters.branch || 'كافة الفروع' },
                    { label: 'فترة الكشف', value: `${filters.startDate} إلى ${filters.endDate}` },
                    { label: 'الرصيد الختامي', value: `${formatKWD(report.finalBalance)} د.ك` }
                  ]}
                />
              </div>

              {/* On-screen Header */}
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
                    <span>تصدير إكسيل (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Metric Cards Module */}
              <ReportMetricCards
                openingBalance={initialOpeningBalance}
                filteredIn={filteredIn}
                filteredCashOut={filteredCashOut}
                filteredUnpaidAccruals={filteredUnpaidAccruals}
                cashEndingBalance={cashEndingBalance}
              />

              {/* Modular Table Component */}
              <ReportTable
                computedRows={computedRows}
                openingBalance={initialOpeningBalance}
                finalBalance={cashEndingBalance}
                totalIncome={filteredIn}
                totalExpense={filteredCashOut}
                visibleColumns={visibleColumns}
                onPrintVoucher={handlePrintVoucher}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />

              {/* Modular Financial Analytics & Charts Component */}
              <ReportAnalytics
                rows={report.rows}
                computedRows={computedRows}
              />

              {/* Formal Bank Style Print Footer */}
              <ReportPrintFooter
                rows={report.rows}
                computedRows={computedRows}
                finalBalance={cashEndingBalance}
                companyProfile={companyProfile}
                showSignatures={printOptions.showSignatures}
                showStamp={printOptions.showStamp}
                employeeName={filters.employee}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal Module */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        transaction={editingTransaction}
        onChangeTransaction={setEditingTransaction}
        onSubmit={handleUpdate}
        branches={branches}
        categories={categories}
        isUpdating={isUpdating}
      />

      {/* Column Customization Modal Module */}
      <ColumnCustomizationModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onApplyPreset={applyPreset}
      />

      {/* Official Voucher Print Modal */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        voucher={activeVoucher}
      />

      {/* Print Settings Modal */}
      <PrintSettingsModal
        isOpen={isPrintSettingsModalOpen}
        onClose={() => setIsPrintSettingsModalOpen(false)}
        onSaved={(p) => {
          setCompanyProfile(p);
          setPrintOptions(getPrintDisplayOptions());
        }}
      />
    </div>
  );
}
