import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Printer, 
  FileSpreadsheet,
  Columns,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  X
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
  normalizeExcelDate,
  getEffectiveDueMonth,
  formatMonthLabelAr,
  isArabicSearchMatch
} from '../utils/format';
import { toFils, toKWD, addMoney, subMoney, sumMoney } from '../utils/money';

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
  balances?: EmployeeBalance[];
  branches: string[];
  categories: string[];
  initialEmployee?: string;
}

export default function ReportViewer({ employees, balances = [], branches, categories, initialEmployee }: ReportViewerProps) {
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
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' | 'error' } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ row: ComputedReportRow; rowIndex: number } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [accrualFilter, setAccrualFilter] = useState<'All' | 'Due' | 'Paid'>('All');
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeReportSection, setActiveReportSection] = useState<'all' | 'table' | 'dueMonths' | 'charts'>('all');

  const showToast = (message: string, type: 'success' | 'warning' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Live Ledger Balance for selected employee
  const liveEmployeeBalance = React.useMemo(() => {
    if (!filters.employee || !balances.length) return null;
    const found = balances.find(b => b.name.trim() === filters.employee.trim());
    return found ? found.balance : null;
  }, [filters.employee, balances]);

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

  const handleGenerate = async (forceRefresh: boolean = false) => {
    if (!filters.employee && !filters.branch) {
      setError('يرجى اختيار موظف أو فرع على الأقل لتوليد التقرير');
      return;
    }

    if (!forceRefresh) {
      setLoading(true);
      setError(null);
      setReport(null);
    }

    try {
      const cleanFilters = {
        ...filters,
        type: filters.type === 'All' ? '' : filters.type,
        startDate: filters.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: filters.endDate || new Date().toISOString().split('T')[0]
      };

      const data = await gasService.getReport(cleanFilters, forceRefresh);
      
      if (!data) {
        if (!forceRefresh) setError('لم يتم العثور على بيانات لهذا البحث. يرجى التأكد من اختيار الموظف الصحيح أو الفترة الزمنية.');
      } else if (!Array.isArray(data.rows)) {
        if (!forceRefresh) setError('تنسيق البيانات المستلمة غير صحيح. يرجى مراجعة السيرفر.');
      } else {
        setReport(data);
        if (data.rows.length === 0 && !forceRefresh) {
          setError('لا توجد حركات مسجلة لهذا الموظف في هذه الفترة.');
        }
      }
    } catch (err) {
      if (!forceRefresh) setError('حدث خطأ غير متوقع أثناء جلب التقرير.');
      console.error(err);
    } finally {
      if (!forceRefresh) setLoading(false);
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
      showToast('حدث خطأ أثناء إنشاء ملف PDF، يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    
    setIsUpdating(true);
    const amountVal = parseFloat(String(editingTransaction.amount)) || 0;
    const isInc = editingTransaction.type === 'Income' || editingTransaction.type === 'إيراد';
    const isExp = editingTransaction.type === 'Expense' || editingTransaction.type === 'مصروف';
    const isTransfer = editingTransaction.type === 'Transfer';
    const incAmt = isInc ? amountVal : 0;
    const expAmt = (isExp || isTransfer) ? amountVal : 0;

    const updatedData = {
      ...editingTransaction,
      amount: amountVal,
      income: incAmt,
      expense: expAmt,
      type: editingTransaction.type || (incAmt > 0 ? 'Income' : 'Expense'),
      targetMonth: editingTransaction.targetMonth || ''
    };
    
    // 1. Immediately apply update to local report rows in memory so UI reflects change instantly without deletion or abbreviation!
    if (report && Array.isArray(report.rows)) {
      const newRows = report.rows.map((r: any, idx: number) => {
        const p = parseReportRow(r);
        const isMatch = (editingTransaction.id && p.id === editingTransaction.id) ||
                        (editingRowIndex !== null && (idx === editingRowIndex || (idx + 2) === editingRowIndex));
        if (isMatch) {
          if (typeof r === 'object' && !Array.isArray(r)) {
            return {
              ...r,
              date: updatedData.date,
              branch: updatedData.branch,
              category: updatedData.category,
              department: updatedData.department,
              description: updatedData.description,
              amount: amountVal,
              income: incAmt,
              expense: expAmt,
              type: updatedData.type,
              targetMonth: updatedData.targetMonth
            };
          } else if (Array.isArray(r)) {
            const arr = [...r];
            arr[1] = updatedData.date;
            arr[2] = updatedData.branch;
            arr[3] = updatedData.category;
            arr[4] = updatedData.description;
            arr[5] = incAmt;
            arr[6] = expAmt;
            if (arr.length > 8) arr[8] = updatedData.targetMonth || '';
            return arr;
          }
        }
        return r;
      });
      setReport({ ...report, rows: newRows });
    }

    try {
      const res = await gasService.updateTransaction(editingTransaction.id, updatedData);
      setIsUpdating(false);
      setIsEditModalOpen(false);
      
      if (res && res.success !== false) {
        showToast('تم حفظ وتحديث الحركة المالية بنجاح دون أي حذف أو اختصار', 'success');
        handleGenerate(true);
      } else {
        showToast(res?.error || 'تم التحديث في الكشف محلياً بنجاح', 'info');
      }
    } catch (err: any) {
      setIsUpdating(false);
      setIsEditModalOpen(false);
      showToast('تم حفظ التعديل محلياً في الكشف', 'info');
    }
  };

  // Parse raw rows
  const rawRows = report ? report.rows.map(parseReportRow) : [];

  // Available unique due months across all raw rows for filter selector
  const availableTargetMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    rawRows.forEach(row => {
      const m = getEffectiveDueMonth(row);
      if (m && m !== 'غير محدد') monthsSet.add(m);
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [rawRows]);

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

    if (filters.targetMonth && filters.targetMonth !== 'All' && filters.targetMonth !== 'الكل' && filters.targetMonth !== '') {
      const rowDueMonth = getEffectiveDueMonth(pRow);
      if (rowDueMonth !== filters.targetMonth) return false;
    }

    if (filters.searchKeyword && filters.searchKeyword.trim() !== '') {
      const matchesSearch = isArabicSearchMatch(
        filters.searchKeyword,
        pRow.description,
        pRow.category,
        pRow.employee,
        pRow.branch,
        pRow.department,
        pRow.id,
        pRow.type,
        pRow.targetMonth,
        pRow.income > 0 ? pRow.income : '',
        pRow.expense > 0 ? pRow.expense : '',
        pRow.amount
      );
      if (!matchesSearch) return false;
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

  const initialOpeningBalanceFils = toFils(report?.openingBalance || '0');
  let runningAccFils = initialOpeningBalanceFils;

  let totalDisplayIncomeFils = 0;
  let totalDisplayCashExpenseFils = 0;
  let totalDisplayAccrualFils = 0;

  const computedRows: ComputedReportRow[] = sortedFilteredRows.map(pRow => {
    const isAccrued = isAccrualType(pRow.type, pRow.category, pRow.description);
    const incFils = toFils(pRow.income);
    const expFils = toFils(pRow.expense);

    totalDisplayIncomeFils += incFils;

    if (!isAccrued) {
      runningAccFils += incFils - expFils;
      totalDisplayCashExpenseFils += expFils;
    } else {
      totalDisplayAccrualFils += expFils;
    }

    const opType = getAccountingOperationType(pRow.type, pRow.category, pRow.description, pRow.income, pRow.expense);
    return {
      ...pRow,
      isAccrued,
      computedBalance: toKWD(runningAccFils),
      opType
    };
  });

  const totalDisplayExpenseFils = totalDisplayCashExpenseFils + totalDisplayAccrualFils;
  const cashEndingBalanceFils = initialOpeningBalanceFils + totalDisplayIncomeFils - totalDisplayCashExpenseFils;

  const initialOpeningBalance = toKWD(initialOpeningBalanceFils);
  const filteredIn = toKWD(totalDisplayIncomeFils);
  const filteredCashOut = toKWD(totalDisplayCashExpenseFils);
  const filteredUnpaidAccruals = toKWD(totalDisplayAccrualFils);
  const filteredTotalExpense = toKWD(totalDisplayExpenseFils);
  const cashEndingBalance = toKWD(cashEndingBalanceFils);

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

    setEditingRowIndex(rowIndexInSheet);
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

  const handleDeleteTransaction = (row: ComputedReportRow, rowIndexInSheet: number) => {
    setDeletingItem({ row, rowIndex: rowIndexInSheet });
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    const { row, rowIndex } = deletingItem;
    const calculatedRowId = row.id || `${row.date}_${rowIndex}`;

    // Immediately remove from local state
    if (report && Array.isArray(report.rows)) {
      const newRows = report.rows.filter((r: any, idx: number) => {
        const p = parseReportRow(r);
        return !(p.id === calculatedRowId || idx === rowIndex || (idx + 2) === rowIndex);
      });
      setReport({ ...report, rows: newRows });
    }

    setDeletingItem(null);
    showToast('جاري حذف العملية وتحديث الرصيد...', 'info');

    try {
      const res = await gasService.deleteTransaction(calculatedRowId, {
        id: calculatedRowId,
        rowIndex: rowIndex,
        date: row.date,
        employee: row.employee,
        branch: row.branch,
        category: row.category,
        amount: row.income > 0 ? row.income : row.expense,
        description: row.description
      });
      if (res && res.success !== false) {
        showToast('تم حذف الحركة المالية وتحديث الرصيد بنجاح', 'success');
        handleGenerate(true);
      } else {
        showToast('تمت إزالة الحركة محلياً من الكشف', 'info');
      }
    } catch (err: any) {
      showToast('تمت إزالة الحركة محلياً', 'info');
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
        availableTargetMonths={availableTargetMonths}
        accrualFilter={accrualFilter}
        onChangeAccrualFilter={setAccrualFilter}
        onGenerate={handleGenerate}
        loading={loading}
        totalRecordsCount={report ? report.rows.length : undefined}
      />

      {/* Live Custody Ledger Summary Card */}
      {filters.employee && liveEmployeeBalance !== null && (
        <div className="no-print p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-xs">
              {filters.employee.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">{filters.employee}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                  رصيد الخزينة الحي
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">الرصيد الفعلي المعتمد في السجلات المركزية للعهدة</p>
            </div>
          </div>
          <div className="text-left font-mono">
            <span className={`text-xl font-black ${liveEmployeeBalance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatKWD(liveEmployeeBalance)} د.ك
            </span>
          </div>
        </div>
      )}

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
                      {filters.targetMonth && (
                        <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold rounded-md">
                          شهر الاستحقاق: {formatMonthLabelAr(filters.targetMonth)}
                        </span>
                      )}
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

              {/* Modern Structural Section Switcher (No Print) */}
              <div className="no-print px-4 sm:px-6 py-3.5 bg-slate-100/90 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-800">طريقة العرض والتنقل:</span>
                  <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setActiveReportSection('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        activeReportSection === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      العرض الشامل الموحد
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveReportSection('table')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        activeReportSection === 'table'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      كشف الحساب والعمليات ({computedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveReportSection('dueMonths')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        activeReportSection === 'dueMonths'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      المصاريف حسب شهور الاستحقاق
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveReportSection('charts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        activeReportSection === 'charts'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      الرسوم البيانية والتحليل
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-bold hidden md:block">
                  تطوير هيكلي تفاعلي مع حفظ كامل البيانات دون حذف أو اختصار
                </div>
              </div>

              {/* Modular Table Component */}
              <div className={`${activeReportSection === 'all' || activeReportSection === 'table' ? 'block' : 'hidden print:block'}`}>
                <ReportTable
                  computedRows={computedRows}
                  openingBalance={initialOpeningBalance}
                  finalBalance={cashEndingBalance}
                  totalIncome={filteredIn}
                  totalExpense={filteredTotalExpense}
                  totalCashExpense={filteredCashOut}
                  totalAccrual={filteredUnpaidAccruals}
                  visibleColumns={visibleColumns}
                  searchKeyword={filters.searchKeyword || ''}
                  onSearchChange={(val) => setFilters(prev => ({ ...prev, searchKeyword: val }))}
                  totalUnfilteredCount={rawRows.length}
                  onPrintVoucher={handlePrintVoucher}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenColumnCustomization={() => setShowColumnModal(true)}
                />
              </div>

              {/* Modular Financial Analytics & Charts Component */}
              <div className={`${activeReportSection === 'all' || activeReportSection === 'dueMonths' || activeReportSection === 'charts' ? 'block' : 'hidden print:block'}`}>
                <ReportAnalytics
                  rows={report.rows}
                  computedRows={computedRows}
                  onEditTransaction={handleEditTransaction}
                  viewMode={activeReportSection === 'dueMonths' ? 'dueMonthsOnly' : activeReportSection === 'charts' ? 'chartsOnly' : 'all'}
                />
              </div>

              {/* Formal Bank Style Print Footer */}
              <ReportPrintFooter
                rows={report.rows}
                computedRows={computedRows}
                finalBalance={cashEndingBalance}
                totalIncome={filteredIn}
                totalExpense={filteredTotalExpense}
                totalCashExpense={filteredCashOut}
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

      {/* In-app Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3.5 rounded-2xl shadow-2xl border font-bold text-sm flex items-center gap-3 backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-4 duration-300 no-print ${
          toast.type === 'success' ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/50 shadow-emerald-950/40' :
          toast.type === 'warning' ? 'bg-amber-950/95 text-amber-100 border-amber-500/50 shadow-amber-950/40' :
          toast.type === 'error' ? 'bg-rose-950/95 text-rose-100 border-rose-500/50 shadow-rose-950/40' :
          'bg-slate-950/95 text-slate-100 border-slate-700 shadow-slate-950/40'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-400 shrink-0" />}
          {toast.type === 'error' && <XCircle size={18} className="text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info size={18} className="text-blue-400 shrink-0" />}
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer transition-colors text-slate-300 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">تأكيد حذف الحركة المالية</h3>
                <p className="text-xs text-slate-400 font-bold">سيتم حذف المعاملة وتحديث الرصيد المحاسبي</p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5 font-bold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">التاريخ:</span>
                <span className="font-mono text-slate-900">{deletingItem.row.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المبلغ:</span>
                <span className="font-mono text-rose-700 font-black">
                  {formatKWD(deletingItem.row.income > 0 ? deletingItem.row.income : deletingItem.row.expense)} د.ك
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">البيان:</span>
                <span className="text-slate-900 line-clamp-1">{deletingItem.row.description || '-'}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                نعم، احذف العملية
              </button>
              <button
                onClick={() => setDeletingItem(null)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-sm rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

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
