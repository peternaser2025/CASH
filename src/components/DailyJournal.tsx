import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  RefreshCw, 
  Search, 
  Wallet, 
  Building, 
  User, 
  ArrowDownRight, 
  Receipt, 
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  CalendarCheck2,
  TrendingDown,
  Coins,
  Layers
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';
import { parseReportRow, formatKWD, matchBranch, isTransferType, isAccrualType, isArabicSearchMatch, normalizeExcelDate } from '../utils/format';
import { exportReportToExcel } from '../utils/excelExport';
import { exportElementToPDF } from '../utils/pdfExport';
import { 
  getCompanyProfile, 
  getPrintDisplayOptions, 
  PrintDisplayOptions,
  CompanyPrintProfile
} from '../utils/printConfig';
import PrintHeader from './print/PrintHeader';
import PrintSignatures from './print/PrintSignatures';
import PrintWatermark from './print/PrintWatermark';
import PrintToolbar from './print/PrintToolbar';
import PrintSettingsModal from './PrintSettingsModal';
import VoucherModal, { VoucherData } from './VoucherModal';
import BranchMultiColumnJournal from './journal/BranchMultiColumnJournal';

interface DailyJournalProps {
  balances: EmployeeBalance[];
  branches: string[];
  categories?: string[];
  employees: string[];
  onRefresh?: () => void;
  onViewReport?: (employeeName: string) => void;
}

export interface FundExpenseItem {
  id: string | number | null;
  date: string;
  category: string;
  description: string;
  amount: number;
  branch: string;
  type: string;
  isTransfer: boolean;
  isAccrual: boolean;
}

export interface FundDayRecord {
  employee: string;
  branch: string;
  // رصيد أول اليوم: ما كان في ذمة الصندوق قبل بدء هذا اليوم
  openingBalance: number;
  // ما استلمه الصندوق اليوم (مقبوضات / تغذية عهدة واردة)
  todayIncome: number;
  // صرف إيه اليوم: إجمالي ما صرفه هذا الصندوق في هذا اليوم
  todaySpent: number;
  // بنود الصرف والمصروفات بالتفصيل
  spentItems: FundExpenseItem[];
  // ما استلمه اليوم بالتفصيل
  incomeItems: FundExpenseItem[];
  // عليه إيه: رصيد العهدة المستحقة القائمة في ذمة الصندوق بنهاية هذا اليوم
  // closingBalance = openingBalance + todayIncome - todaySpent
  closingBalance: number;
  // مبالغ مشتريات والتزامات آجلة مسجلة على عهدته
  unpaidAccruals: number;
  // عدد حركات الصرف في هذا اليوم
  spentCount: number;
  // هل قام بالصرف في هذا اليوم
  hasSpentToday: boolean;
  // هل كان هناك حركة (صرف أو وارد) في هذا اليوم
  hasActivityToday: boolean;
}

export default function DailyJournal({
  balances,
  branches,
  employees,
  onRefresh,
  onViewReport
}: DailyJournalProps) {
  // Today's date by default (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [journalViewMode, setJournalViewMode] = useState<'branch-multicolumn' | 'fund-summary'>('branch-multicolumn');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'spent' | 'owing' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expansion state for accordion rows (to show what each fund spent)
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  // Data states
  const [loading, setLoading] = useState(false);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Print & PDF states
  const [companyProfile, setCompanyProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [printOptions, setPrintOptions] = useState<PrintDisplayOptions>(() => ({
    ...getPrintDisplayOptions(),
    paperSize: 'A4-landscape'
  }));
  const [printDetailLevel] = useState<'summary' | 'detailed'>('detailed');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Voucher modal state
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // Fetch full report data from server
  const loadAllTransactions = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gasService.getReport({}, forceRefresh);
      if (data && Array.isArray(data.rows)) {
        setAllRows(data.rows);
      } else {
        setAllRows([]);
      }
    } catch (err) {
      console.error('Error fetching transactions for Daily Journal:', err);
      setError('تعذر جلب سجل الحركات من السيرفر. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTransactions();
  }, []);

  // Parse all rows
  const parsedRows = useMemo(() => {
    return allRows.map(parseReportRow);
  }, [allRows]);

  // Build the complete list of ALL cash funds / custodies in the organization
  const allKnownFundNames = useMemo(() => {
    const ignoreNames = [
      'balances', 'settings', 'sheet1', 'الرئيسية', 'عمليات', 
      'employee', 'البيانات', 'dashboard', 'sheet2', 'sheet3', 'users'
    ];
    const set = new Set<string>();

    // 1. From balances prop
    balances.forEach(b => {
      const clean = (b.name || '').trim();
      if (clean && !ignoreNames.includes(clean.toLowerCase())) {
        set.add(clean);
      }
    });

    // 2. From employees prop
    employees.forEach(emp => {
      const clean = (emp || '').trim();
      if (clean && !ignoreNames.includes(clean.toLowerCase())) {
        set.add(clean);
      }
    });

    // 3. From transactions history
    parsedRows.forEach(r => {
      const clean = (r.employee || '').trim();
      if (clean && clean !== 'عام' && !ignoreNames.includes(clean.toLowerCase())) {
        set.add(clean);
      }
    });

    if (set.size === 0) {
      set.add('الخزينة الرئيسية');
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [balances, employees, parsedRows]);

  // CORE COMPUTATION:
  // For the selected date, compute for EVERY single fund:
  // 1. openingBalance: what was in their custody before this date (prior transactions)
  // 2. todaySpent (صرف إيه): total spent on selectedDate + detailed list of items spent
  // 3. todayIncome (الوارد): total received on selectedDate
  // 4. closingBalance (عليه إيه): balance remaining on their custody at end of selectedDate
  const allFundRecords = useMemo<FundDayRecord[]>(() => {
    const recordsMap = new Map<string, FundDayRecord>();

    // Initialize an entry for EVERY fund in the organization
    allKnownFundNames.forEach(empName => {
      // Guess branch from balances or transactions
      let branch = 'المركز الرئيسي';
      const bObj = balances.find(b => b.name.trim().toLowerCase() === empName.toLowerCase());
      if (bObj && (bObj as any).branch) {
        branch = (bObj as any).branch;
      }

      recordsMap.set(empName, {
        employee: empName,
        branch,
        openingBalance: 0,
        todayIncome: 0,
        todaySpent: 0,
        spentItems: [],
        incomeItems: [],
        closingBalance: 0,
        unpaidAccruals: 0,
        spentCount: 0,
        hasSpentToday: false,
        hasActivityToday: false
      });
    });

    // Group transactions by date relative to selectedDate
    parsedRows.forEach(row => {
      const emp = (row.employee || 'عام').trim();
      if (!emp || emp === 'عام') return;

      if (!recordsMap.has(emp)) {
        recordsMap.set(emp, {
          employee: emp,
          branch: row.branch || 'المركز الرئيسي',
          openingBalance: 0,
          todayIncome: 0,
          todaySpent: 0,
          spentItems: [],
          incomeItems: [],
          closingBalance: 0,
          unpaidAccruals: 0,
          spentCount: 0,
          hasSpentToday: false,
          hasActivityToday: false
        });
      }

      const rec = recordsMap.get(emp)!;
      if (row.branch && (!rec.branch || rec.branch === 'المركز الرئيسي')) {
        rec.branch = row.branch;
      }

      const rowDate = normalizeExcelDate(row.date);
      const targetDate = normalizeExcelDate(selectedDate);
      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);

      // 1. Transaction occurred BEFORE selectedDate => contributes to openingBalance
      if (rowDate && targetDate && rowDate < targetDate) {
        if (isTransfer) {
          rec.openingBalance += (row.income - row.expense);
        } else if (!isAccrual) {
          rec.openingBalance += (row.income - row.expense);
        }
      } 
      // 2. Transaction occurred ON selectedDate => current day's activity
      else if (rowDate && targetDate && rowDate === targetDate) {
        rec.hasActivityToday = true;

        if (isTransfer) {
          if (row.income > 0) {
            rec.todayIncome += row.income;
            rec.incomeItems.push({
              id: row.id,
              date: row.date,
              category: row.category,
              description: row.description,
              amount: row.income,
              branch: row.branch,
              type: row.type,
              isTransfer: true,
              isAccrual: false
            });
          }
          if (row.expense > 0) {
            rec.todaySpent += row.expense;
            rec.spentCount += 1;
            rec.hasSpentToday = true;
            rec.spentItems.push({
              id: row.id,
              date: row.date,
              category: row.category,
              description: row.description,
              amount: row.expense,
              branch: row.branch,
              type: row.type,
              isTransfer: true,
              isAccrual: false
            });
          }
        } else if (isAccrual) {
          rec.unpaidAccruals += row.expense;
        } else {
          // Cash income
          if (row.income > 0) {
            rec.todayIncome += row.income;
            rec.incomeItems.push({
              id: row.id,
              date: row.date,
              category: row.category,
              description: row.description,
              amount: row.income,
              branch: row.branch,
              type: row.type,
              isTransfer: false,
              isAccrual: false
            });
          }
          // Cash expense (صرف إيه!)
          if (row.expense > 0) {
            rec.todaySpent += row.expense;
            rec.spentCount += 1;
            rec.hasSpentToday = true;
            rec.spentItems.push({
              id: row.id,
              date: row.date,
              category: row.category,
              description: row.description,
              amount: row.expense,
              branch: row.branch,
              type: row.type,
              isTransfer: false,
              isAccrual: false
            });
          }
        }
      }
      // Transactions AFTER selectedDate are strictly ignored to reflect historical reality
    });

    // Compute closing balance (عليه إيه) for every fund
    const list: FundDayRecord[] = [];
    recordsMap.forEach(rec => {
      // عليه إيه = رصيد أول اليوم + ما استلمه اليوم - ما صرفه اليوم
      rec.closingBalance = rec.openingBalance + rec.todayIncome - rec.todaySpent;
      list.push(rec);
    });

    // Sort: funds that spent today first, then by total spent descending, then by remaining balance
    return list.sort((a, b) => {
      if (a.hasSpentToday && !b.hasSpentToday) return -1;
      if (!a.hasSpentToday && b.hasSpentToday) return 1;
      if (b.todaySpent !== a.todaySpent) return b.todaySpent - a.todaySpent;
      return b.closingBalance - a.closingBalance;
    });
  }, [allKnownFundNames, parsedRows, selectedDate, balances]);

  // Apply user filters
  const filteredFundRecords = useMemo(() => {
    return allFundRecords.filter(rec => {
      // Branch filter
      if (selectedBranch !== 'all' && !matchBranch(rec.branch, selectedBranch)) {
        return false;
      }
      // Employee filter
      if (selectedEmployee !== 'all' && rec.employee.trim().toLowerCase() !== selectedEmployee.trim().toLowerCase()) {
        return false;
      }
      // Status filter
      if (statusFilter === 'spent' && !rec.hasSpentToday) return false;
      if (statusFilter === 'owing' && rec.closingBalance <= 0) return false;
      if (statusFilter === 'inactive' && rec.hasActivityToday) return false;

      // Search query (matches fund name, branch, or spent item descriptions/categories)
      if (searchQuery.trim()) {
        const spentTexts = rec.spentItems.map(i => `${i.category} ${i.description} ${i.amount}`).join(' ');
        if (!isArabicSearchMatch(searchQuery, rec.employee, rec.branch, spentTexts)) {
          return false;
        }
      }

      return true;
    });
  }, [allFundRecords, selectedBranch, selectedEmployee, statusFilter, searchQuery]);

  // Aggregate Top Daily Metrics
  const dailyTotals = useMemo(() => {
    let totalOpening = 0;
    let totalIncome = 0;
    let totalSpent = 0;
    let totalClosing = 0;
    let totalAccruals = 0;
    let fundsSpentCount = 0;
    let totalSpentTransactions = 0;

    filteredFundRecords.forEach(rec => {
      totalOpening += rec.openingBalance;
      totalIncome += rec.todayIncome;
      totalSpent += rec.todaySpent;
      totalClosing += rec.closingBalance;
      totalAccruals += rec.unpaidAccruals;
      if (rec.hasSpentToday) {
        fundsSpentCount += 1;
        totalSpentTransactions += rec.spentCount;
      }
    });

    return {
      totalOpening,
      totalIncome,
      totalSpent,
      totalClosing,
      totalAccruals,
      fundsSpentCount,
      totalSpentTransactions,
      totalFunds: filteredFundRecords.length
    };
  }, [filteredFundRecords]);

  // All single expense transactions on this day (for the detailed transactions section)
  const allTodaySpentItems = useMemo(() => {
    const items: (FundExpenseItem & { employee: string })[] = [];
    filteredFundRecords.forEach(rec => {
      rec.spentItems.forEach(item => {
        items.push({
          ...item,
          employee: rec.employee
        });
      });
    });
    return items.sort((a, b) => b.amount - a.amount);
  }, [filteredFundRecords]);

  // Toggle expand/collapse for a fund row
  const toggleEmployeeExpand = (emp: string) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [emp]: !prev[emp]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    filteredFundRecords.forEach(r => {
      if (r.spentItems.length > 0) {
        all[r.employee] = true;
      }
    });
    setExpandedEmployees(all);
  };

  const collapseAll = () => {
    setExpandedEmployees({});
  };

  // Open voucher modal
  const handleOpenVoucher = (item: FundExpenseItem, employee: string) => {
    setActiveVoucher({
      voucherNo: `PV-${item.date.replace(/-/g, '')}-${item.id || '1'}`,
      voucherType: item.isTransfer ? 'Transfer' : 'Payment',
      date: item.date,
      amount: item.amount,
      beneficiary: item.category || 'الجهة المستفيدة',
      payer: employee,
      employee: employee,
      paymentMethod: 'Cash',
      category: item.category,
      branch: item.branch,
      description: item.description,
      targetMonth: ''
    });
    setIsVoucherModalOpen(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (journalViewMode === 'branch-multicolumn') {
      const activeBranches = branches.filter(b => b && b !== 'all' && b !== 'عام');
      const filteredDayTx = parsedRows.filter(row => {
        if (row.date && selectedDate && row.date !== selectedDate) return false;
        if (selectedBranch !== 'all' && !matchBranch(row.branch, selectedBranch)) return false;
        if (selectedEmployee !== 'all' && row.employee.trim().toLowerCase() !== selectedEmployee.trim().toLowerCase()) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const combined = `${row.employee} ${row.category} ${row.description} ${row.branch}`.toLowerCase();
          if (!combined.includes(q)) return false;
        }
        return true;
      });

      const branchHeaders = activeBranches.map(b => `مصروفات فرع ${b} (-)`);
      const headers = [
        'م',
        'المسؤول / الصندوق',
        'الفرع التابع',
        'التصنيف',
        'البيان والتفاصيل',
        'عمود المقبوضات (وارد +)',
        ...branchHeaders,
        'مصروفات أخرى / غير مصنفة (-)',
        'إجمالي المصروفات (-)',
        'صافي الأثر النقدي (د.ك)'
      ];

      let totReceipts = 0;
      let totExpenses = 0;
      const branchExpenseSums: Record<string, number> = {};
      activeBranches.forEach(b => { branchExpenseSums[b] = 0; });
      let totOther = 0;

      const rows = filteredDayTx.map((row, idx) => {
        const receiptAmt = row.income > 0 ? row.income : 0;
        const expAmt = row.expense > 0 ? row.expense : 0;
        totReceipts += receiptAmt;
        totExpenses += expAmt;

        let matchedBranch = '';
        if (expAmt > 0) {
          for (const b of activeBranches) {
            if (matchBranch(row.branch, b)) {
              matchedBranch = b;
              break;
            }
          }
          if (matchedBranch) {
            branchExpenseSums[matchedBranch] = (branchExpenseSums[matchedBranch] || 0) + expAmt;
          } else {
            totOther += expAmt;
          }
        }

        return [
          idx + 1,
          row.employee,
          row.branch,
          row.category,
          row.description,
          receiptAmt,
          ...activeBranches.map(b => b === matchedBranch ? expAmt : 0),
          matchedBranch ? 0 : expAmt,
          expAmt,
          receiptAmt - expAmt
        ];
      });

      const totalsRow = [
        'الإجمالي العام لليومية',
        '-',
        '-',
        '-',
        `عدد العمليات: ${rows.length}`,
        totReceipts,
        ...activeBranches.map(b => branchExpenseSums[b] || 0),
        totOther,
        totExpenses,
        totReceipts - totExpenses
      ];

      exportReportToExcel({
        fileName: `يومية_المقبوضات_ومصروفات_الأفرع_${selectedDate}`,
        sheetName: 'اليومية التحليلية بالأفرع',
        reportTitle: `دفتر اليومية العامة والتحليلية متعددة الأعمدة (المقبوضات ومصروفات الأفرع)`,
        subtitle: `تاريخ اليومية: ${selectedDate} | إجمالي المقبوضات: ${formatKWD(totReceipts)} د.ك | إجمالي المصروفات: ${formatKWD(totExpenses)} د.ك | صافي اليومية: ${formatKWD(totReceipts - totExpenses)} د.ك`,
        summaryCards: [
          { label: 'إجمالي المقبوضات اليومية (+)', value: totReceipts },
          { label: 'إجمالي مصروفات الأفرع (-)', value: totExpenses },
          { label: 'صافي حركة اليومية (د.ك)', value: totReceipts - totExpenses },
          { label: 'عدد العمليات', value: `${rows.length} حركة` }
        ],
        headers,
        rows,
        totalsRow
      });
      return;
    }

    const fileName = `يومية_الصناديق_صرف_وعليه_${selectedDate}`;

    // Table 1: Funds Summary (صرف إيه وعليه إيه)
    const summaryHeaders = [
      'م',
      'الصندوق / أمين العهدة',
      'الفرع التابع',
      'رصيد أول اليوم (د.ك)',
      'الوارد والتغذية اليوم (+)',
      'ما صرفه اليوم (صرف إيه) (-)',
      'ما عليه بنهاية اليوم (عليه إيه) (د.ك)',
      'التزامات آجلة',
      'عدد حركات الصرف',
      'الموقف المالي'
    ];

    const summaryRows = filteredFundRecords.map((rec, idx) => {
      const status = rec.closingBalance > 0 ? 'عهدة قائمة في ذمته' : (rec.closingBalance < 0 ? 'مستحق له (دائن)' : 'مسوّى مطابق');
      return [
        idx + 1,
        rec.employee,
        rec.branch,
        rec.openingBalance,
        rec.todayIncome,
        rec.todaySpent,
        rec.closingBalance,
        rec.unpaidAccruals,
        rec.spentCount,
        status
      ];
    });

    // Table 2: Detailed Items Spent
    const detailHeaders = [
      'م',
      'الصندوق / العهدة',
      'الفرع',
      'نوع الصرف',
      'التصنيف / البند',
      'البيان والشرح التفصيلي',
      'المبلغ المنصرف (د.ك)'
    ];

    const detailRows = allTodaySpentItems.map((item, idx) => [
      idx + 1,
      item.employee,
      item.branch,
      item.isTransfer ? 'تحويل نقدية' : 'مصروف نقدي',
      item.category,
      item.description,
      item.amount
    ]);

    exportReportToExcel({
      fileName,
      sheetName: 'يومية الصناديق',
      reportTitle: `تقرير اليومية المجمعة للصناديق والعهد (بيان ما صُرف وما في الذمة)`,
      subtitle: `تاريخ اليومية: ${selectedDate} | عدد الصناديق: ${filteredFundRecords.length} | الصناديق التي قامت بالصرف: ${dailyTotals.fundsSpentCount}`,
      summaryCards: [
        { label: 'إجمالي ما صُرف اليوم (صرف إيه)', value: dailyTotals.totalSpent },
        { label: 'إجمالي الوارد والتغذية اليوم (+)', value: dailyTotals.totalIncome },
        { label: 'إجمالي العهد القائمة (عليه إيه)', value: dailyTotals.totalClosing },
        { label: 'رصيد أول اليوم لكافة الصناديق', value: dailyTotals.totalOpening },
        { label: 'عدد حركات الصرف المنفذة', value: dailyTotals.totalSpentTransactions }
      ],
      headers: summaryHeaders,
      rows: summaryRows,
      totalsRow: [
        'الإجمالي المجمع لكافة الصناديق',
        '-',
        '-',
        dailyTotals.totalOpening,
        dailyTotals.totalIncome,
        dailyTotals.totalSpent,
        dailyTotals.totalClosing,
        dailyTotals.totalAccruals,
        dailyTotals.totalSpentTransactions,
        '-'
      ],
      sections: [
        {
          title: `بيان مفردات وبنود الصرف التفصيلية لتاريخ ${selectedDate}`,
          headers: detailHeaders,
          rows: detailRows,
          totalsRow: [
            'إجمالي المنصرف لكافة البنود',
            '-',
            '-',
            '-',
            '-',
            `عدد البنود: ${allTodaySpentItems.length}`,
            dailyTotals.totalSpent
          ]
        }
      ]
    });
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const targetId = journalViewMode === 'branch-multicolumn' ? 'printable-branch-journal' : 'printable-daily-journal';
    const el = document.getElementById(targetId);
    if (!el) return;

    setPdfLoading(true);
    try {
      const orientation = printOptions.paperSize === 'A4-portrait' ? 'portrait' : 'landscape';
      const filename = journalViewMode === 'branch-multicolumn'
        ? `يومية_المقبوضات_ومصروفات_الأفرع_${selectedDate}.pdf`
        : `يومية_الصناديق_صرف_وعليه_${selectedDate}.pdf`;
      await exportElementToPDF(el, {
        filename,
        orientation,
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('حدث خطأ أثناء تصدير ملف اليومية كـ PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Direct Browser Print
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print border-b border-gray-200 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">
              Daily Cash Reconciliation & Fund Auditing
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-none flex items-center gap-3">
            <span>دفتر</span>
            <span className="text-emerald-600 font-serif italic">اليومية المجمعة</span>
          </h1>
          <p className="text-slate-600 max-w-2xl font-medium text-sm sm:text-base leading-relaxed">
            حدد أي تاريخ لعرض الموقف المالي الدقيق لكل صندوق وعُهدة: <strong className="text-slate-900 font-black">صرف إيه في هذا اليوم</strong> بالتفصيل، و<strong className="text-emerald-700 font-black">عليه إيه في ذمته</strong> من رصيد عهدة متبقية.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              loadAllTransactions(true);
              if (onRefresh) onRefresh();
            }}
            disabled={loading}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="تحديث البيانات من السيرفر"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={loading || pdfLoading || (journalViewMode === 'branch-multicolumn' ? parsedRows.length === 0 : filteredFundRecords.length === 0)}
            className="px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            <FileDown size={16} />
            <span>{pdfLoading ? 'جاري إنشاء PDF...' : 'تصدير PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || (journalViewMode === 'branch-multicolumn' ? parsedRows.length === 0 : filteredFundRecords.length === 0)}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير إكسيل (Excel)</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={loading || (journalViewMode === 'branch-multicolumn' ? parsedRows.length === 0 : filteredFundRecords.length === 0)}
            className="px-5 py-3 bg-slate-950 hover:bg-black text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40"
          >
            <Printer size={16} />
            <span>طباعة اليومية</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher (No Print) */}
      <div className="no-print bg-slate-100 p-1.5 rounded-2xl flex flex-col sm:flex-row items-stretch gap-2 border border-slate-200">
        <button
          onClick={() => setJournalViewMode('branch-multicolumn')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center sm:justify-start gap-2.5 cursor-pointer ${
            journalViewMode === 'branch-multicolumn'
              ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={18} className={journalViewMode === 'branch-multicolumn' ? 'text-emerald-600' : 'text-slate-400'} />
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="font-black">اليومية التحليلية بالأفرع والمقبوضات (الأمريكية)</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                journalViewMode === 'branch-multicolumn' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                مقسمة بالأفرع
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              عمود مخصص للمقبوضات + أعمدة مستقلة لمصروفات كل فرع + إجمالي المنصرف والصافي + طباعة رسمية
            </span>
          </div>
        </button>

        <button
          onClick={() => setJournalViewMode('fund-summary')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center sm:justify-start gap-2.5 cursor-pointer ${
            journalViewMode === 'fund-summary'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet size={18} className={journalViewMode === 'fund-summary' ? 'text-emerald-600' : 'text-slate-400'} />
          <div className="text-right">
            <span className="font-black">موقف الصناديق والعهد (صرف إيه وعليه إيه)</span>
            <span className="text-[11px] text-slate-500 font-medium block">
              كشف تفصيلي لحسابات أمناء الصناديق: الرصيد الافتتاحي، الوارد، ما صرفه، وما عليه في ذمته
            </span>
          </div>
        </button>
      </div>

      {/* Filter Control Bar (no-print) */}
      <div className="no-print bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Date Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar size={15} className="text-emerald-600" />
              <span>تاريخ اليومية المطلوب</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all"
            />
          </div>

          {/* 2. Branch Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Building size={15} className="text-emerald-600" />
              <span>الفرع المستهدف</span>
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all cursor-pointer"
            >
              <option value="all">كافة الفروع والمواقع</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* 3. Employee / Custodian Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <User size={15} className="text-emerald-600" />
              <span>الصندوق / أمين العهدة</span>
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all cursor-pointer"
            >
              <option value="all">كافة الصناديق والعهد ({allKnownFundNames.length} صندوق)</option>
              {allKnownFundNames.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          {/* 4. Quick Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Search size={15} className="text-emerald-600" />
              <span>بحث سريع في الصندوق أو البند</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث باسم الصندوق أو بند الصرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all"
              />
              <Search size={14} className="absolute right-2.5 top-3 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Quick Date Presets & Status Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Quick Date Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-bold ml-1">تاريخ سريع:</span>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-black ${
                selectedDate === todayStr ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              اليوم ({todayStr})
            </button>
            <button
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y.toISOString().split('T')[0]);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer font-bold"
            >
              أمس
            </button>
            <button
              onClick={() => {
                const b = new Date();
                b.setDate(b.getDate() - 2);
                setSelectedDate(b.toISOString().split('T')[0]);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer font-bold"
            >
              قبل يومين
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setSelectedDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer font-bold"
            >
              أول الشهر
            </button>
          </div>

          {/* Fund Status Toggle Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-950 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كافة الصناديق ({allFundRecords.length})
            </button>
            <button
              onClick={() => setStatusFilter('spent')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'spent' ? 'bg-white text-rose-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              صرفت اليوم فقط ({allFundRecords.filter(r => r.hasSpentToday).length})
            </button>
            <button
              onClick={() => setStatusFilter('owing')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'owing' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              عليها عهدة في ذمتها ({allFundRecords.filter(r => r.closingBalance > 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Content: Multi-column Branch Journal (Default) vs Fund Summary */}
      {journalViewMode === 'branch-multicolumn' ? (
        <BranchMultiColumnJournal
          selectedDate={selectedDate}
          transactions={parsedRows}
          branches={branches}
          companyProfile={companyProfile}
          printOptions={printOptions}
          onChangePrintOptions={setPrintOptions}
          onOpenSettings={() => setIsSettingsOpen(true)}
          searchQuery={searchQuery}
          selectedBranchFilter={selectedBranch}
          selectedEmployeeFilter={selectedEmployee}
        />
      ) : (
        <>
          {/* Print Toolbar Component */}
          <div className="no-print">
        <PrintToolbar
          options={printOptions}
          onChangeOptions={setPrintOptions}
          onPrint={handlePrint}
          onExportPDF={handleExportPDF}
          pdfLoading={pdfLoading}
          onOpenSettings={() => setIsSettingsOpen(true)}
          allowThermal={true}
        />
      </div>

      {/* Main Printable & Display Container */}
      <div 
        id="printable-daily-journal" 
        className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden print:border-none print:shadow-none print:overflow-visible relative"
      >
        <PrintWatermark type={printOptions.watermark} />

        {/* Global Print CSS Styles */}
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
              margin: 8mm;
              size: ${printOptions.paperSize === 'A4-portrait' ? 'A4 portrait' : 'A4 landscape'};
            }
            body {
              background: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-family: system-ui, -apple-system, sans-serif !important;
            }
            #printable-daily-journal {
              font-size: 8.5pt;
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
              border: 1px solid #475569 !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            th, td {
              border: 1px solid #94a3b8 !important;
              padding: 4px 6px !important;
              text-align: right !important;
              font-size: 8.5pt !important;
            }
            th {
              font-weight: 800 !important;
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
            }
            .print-hidden-row {
              display: none !important;
            }
            .break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        ` }} />

        {/* Printable Official Document Header */}
        <div className="p-6 border-b border-slate-200">
          <PrintHeader
            documentTitleAr="يومية الصناديق والعهد (بيان ما صُرف وما في الذمة)"
            documentTitleEn="DAILY CONSOLIDATED CASH JOURNAL & CUSTODY BALANCES"
            documentNumber={`JRNL-${selectedDate.replace(/-/g, '')}`}
            date={selectedDate}
            profile={companyProfile}
            showQRCode={printOptions.showQRCode}
            showLetterhead={printOptions.showLetterhead}
            qrPayload={JSON.stringify({
              org: companyProfile.companyNameAr,
              doc: 'يومية الصناديق',
              dt: selectedDate,
              spent: dailyTotals.totalSpent,
              owing: dailyTotals.totalClosing,
              funds: filteredFundRecords.length
            })}
            extraMeta={[
              { label: 'تاريخ اليومية', value: selectedDate },
              { label: 'الفرع المستهدف', value: selectedBranch === 'all' ? 'كافة الفروع' : selectedBranch },
              { label: 'إجمالي ما صُرف اليوم', value: `${formatKWD(dailyTotals.totalSpent)} د.ك` },
              { label: 'إجمالي العهد القائمة (عليه إيه)', value: `${formatKWD(dailyTotals.totalClosing)} د.ك` }
            ]}
          />
        </div>

        {/* Top 4 Financial Metric Cards: (صرف إيه وعليه إيه) */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: What funds spent today (صرف إيه اليوم) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-xs font-black uppercase">ما صُرف اليوم (صرف إيه)</span>
                <TrendingDown size={18} />
              </div>
              <p className="text-2xl font-black text-rose-700 font-mono">
                {formatKWD(dailyTotals.totalSpent)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                صرفته {dailyTotals.fundsSpentCount} صناديق ({dailyTotals.totalSpentTransactions} حركة مصروفات)
              </p>
            </div>

            {/* Card 2: What was received today (الوارد والتغذية) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-blue-200 shadow-xs">
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-xs font-black uppercase">الوارد والتغذية المستلمة</span>
                <ArrowDownRight size={18} />
              </div>
              <p className="text-2xl font-black text-blue-700 font-mono">
                {formatKWD(dailyTotals.totalIncome)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                مقبوضات وتغذية عهد واردة للصناديق
              </p>
            </div>

            {/* Card 3: What funds owe / Custody Remaining (عليه إيه في ذمته) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-black uppercase">العهد القائمة (عليه إيه)</span>
                <Wallet size={18} />
              </div>
              <p className="text-2xl font-black text-emerald-800 font-mono">
                {formatKWD(dailyTotals.totalClosing)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                صافي رصيد العهد المتبقية في ذمة أمناء الصناديق
              </p>
            </div>

            {/* Card 4: Opening balance of all funds (رصيد أول اليوم) */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-xs font-black uppercase">رصيد أول اليوم في الذمة</span>
                <Coins size={18} className="text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 font-mono">
                {formatKWD(dailyTotals.totalOpening)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-400 font-bold mt-1">
                الرصيد في ذمة الصناديق عند بداية اليوم
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Main Table (كل صندوق: صرف إيه وعليه إيه) */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck2 size={20} className="text-emerald-600" />
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  أولاً: موقف كافة الصناديق والعهد بتاريخ {selectedDate} (صرف إيه وعليه إيه)
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                جدول تدقيق تفصيلي يوضح الرصيد الافتتاحي، الوارد، ما صرفه كل صندوق، وما في ذمته حتى نهاية اليوم
              </p>
            </div>

            {/* Expand / Collapse All Details Buttons (no-print) */}
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                فتح كافة بنود الصرف
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                طي التفاصيل
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={32} className="animate-spin text-emerald-600" />
              <p className="text-sm font-bold text-slate-700">جاري تجميع وحساب أرصدة ومصروفات الصناديق...</p>
            </div>
          ) : filteredFundRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-sm font-bold text-slate-700">لا توجد صناديق مطابقة للفلاتر المحددة.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-300">
                    <th className="py-3 px-2 w-10 text-center">م</th>
                    <th className="py-3 px-3">الصندوق / أمين العهدة</th>
                    <th className="py-3 px-3">الفرع التابع</th>
                    <th className="py-3 px-3 font-bold text-slate-700 text-left">رصيد أول اليوم</th>
                    <th className="py-3 px-3 font-black text-blue-700 text-left">الوارد اليوم (+)</th>
                    <th className="py-3 px-4 font-black text-rose-700 text-left bg-rose-50/70">
                      ما صرفه اليوم (صرف إيه) (-)
                    </th>
                    <th className="py-3 px-4 font-black text-emerald-800 text-left bg-emerald-50/70">
                      ما عليه في ذمته (عليه إيه)
                    </th>
                    <th className="py-3 px-3">بيان بنود ما صُرف</th>
                    <th className="py-3 px-2.5 text-center no-print w-16">تفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredFundRecords.map((rec, idx) => {
                    const isExpanded = !!expandedEmployees[rec.employee];
                    const hasSpent = rec.hasSpentToday;

                    return (
                      <React.Fragment key={rec.employee}>
                        <tr 
                          className={`hover:bg-slate-50 transition-colors ${
                            hasSpent ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          {/* 1. Index */}
                          <td className="py-2.5 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>

                          {/* 2. Employee / Fund Name */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${hasSpent ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></span>
                              <span className="font-black text-slate-950 text-xs sm:text-sm">{rec.employee}</span>
                            </div>
                          </td>

                          {/* 3. Branch */}
                          <td className="py-2.5 px-3 text-slate-600 font-medium">{rec.branch}</td>

                          {/* 4. Opening Balance (أول اليوم) */}
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 text-left">
                            {formatKWD(rec.openingBalance)}
                          </td>

                          {/* 5. Today Received (الوارد) */}
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700 text-left">
                            {rec.todayIncome > 0 ? (
                              <span className="text-blue-700">+{formatKWD(rec.todayIncome)}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* 6. WHAT WAS SPENT TODAY (صرف إيه!) */}
                          <td className="py-2.5 px-4 font-mono font-black text-rose-700 text-left bg-rose-50/40">
                            {rec.todaySpent > 0 ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-rose-700 font-black text-xs sm:text-sm">
                                  -{formatKWD(rec.todaySpent)}
                                </span>
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-md font-sans text-[10px] font-black">
                                  {rec.spentCount} بنود
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-sans font-bold text-[11px]">لم يصرف شيئاً</span>
                            )}
                          </td>

                          {/* 7. WHAT DOES HE OWE (عليه إيه!) */}
                          <td className="py-2.5 px-4 font-mono font-black text-left bg-emerald-50/40">
                            {rec.closingBalance > 0 ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-emerald-800 text-xs sm:text-sm">
                                  {formatKWD(rec.closingBalance)} د.ك
                                </span>
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-sans text-[10px] font-black">
                                  في ذمته
                                </span>
                              </div>
                            ) : rec.closingBalance < 0 ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-rose-700 text-xs sm:text-sm">
                                  {formatKWD(rec.closingBalance)} د.ك
                                </span>
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-md font-sans text-[10px] font-black">
                                  مستحق له
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-sans font-bold text-[11px]">مسوّى (0.000)</span>
                            )}
                          </td>

                          {/* 8. Summary of items spent */}
                          <td className="py-2.5 px-3 max-w-xs">
                            {rec.spentItems.length > 0 ? (
                              <div className="text-[11px] text-slate-700 truncate space-x-1" title={rec.spentItems.map(i => `${i.category}: ${i.description} (${formatKWD(i.amount)})`).join(' | ')}>
                                {rec.spentItems.map((item, iIdx) => (
                                  <span key={iIdx} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-medium ml-1">
                                    {item.category}: {formatKWD(item.amount)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[11px]">-</span>
                            )}
                          </td>

                          {/* 9. Action Button to expand / collapse & view report */}
                          <td className="py-2.5 px-2.5 text-center no-print">
                            <div className="flex items-center justify-center gap-1">
                              {onViewReport && (
                                <button
                                  onClick={() => onViewReport(rec.employee)}
                                  className="p-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer flex items-center justify-center"
                                  title={`عرض كشف الحساب التفصيلي لـ ${rec.employee}`}
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                              {rec.spentItems.length > 0 ? (
                                <button
                                  onClick={() => toggleEmployeeExpand(rec.employee)}
                                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                                    isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                  title="عرض بنود ما تم صرفه"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>

                        {/* EXPANDED ACCORDION: What this specific fund spent in detail */}
                        {(isExpanded || (rec.spentItems.length > 0 && printDetailLevel === 'detailed')) && (
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <td colSpan={9} className="p-3 pr-8">
                              <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Receipt size={15} className="text-rose-600" />
                                    <span className="text-xs font-black text-slate-900">
                                      مفردات وبنود ما صرفه ({rec.employee}) في تاريخ {selectedDate}:
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono font-black text-rose-700">
                                      إجمالي المنصرف: {formatKWD(rec.todaySpent)} د.ك
                                    </span>
                                    {onViewReport && (
                                      <button
                                        onClick={() => onViewReport(rec.employee)}
                                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                        title={`الانتقال إلى كشف الحساب لـ ${rec.employee}`}
                                      >
                                        <FileText size={12} />
                                        <span>كشف الحساب الكامل</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                  {rec.spentItems.map((item, itemIdx) => (
                                    <div 
                                      key={itemIdx} 
                                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70 flex items-start justify-between gap-2"
                                    >
                                      <div className="space-y-0.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-black">
                                            {item.category}
                                          </span>
                                          {item.isTransfer && (
                                            <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">
                                              تحويل
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-slate-800 font-medium text-[11px] truncate" title={item.description}>
                                          {item.description}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                          الفرع: {item.branch || rec.branch}
                                        </p>
                                      </div>

                                      <div className="text-left shrink-0 space-y-1">
                                        <p className="font-mono font-black text-rose-700 text-xs">
                                          {formatKWD(item.amount)} د.ك
                                        </p>
                                        <button
                                          onClick={() => handleOpenVoucher(item, rec.employee)}
                                          className="no-print p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                                          title="طباعة سند صرف رسمي لهذا البند"
                                        >
                                          <Printer size={11} />
                                          <span>سند</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Footer Totals Row */}
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black">
                    <td colSpan={3} className="py-3 px-3 text-right">
                      الإجمالي المجمع لكافة الصناديق ({filteredFundRecords.length} صندوق)
                    </td>
                    <td className="py-3 px-3 font-mono text-left text-amber-300">
                      {formatKWD(dailyTotals.totalOpening)} د.ك
                    </td>
                    <td className="py-3 px-3 font-mono text-left text-blue-300">
                      {formatKWD(dailyTotals.totalIncome)} د.ك
                    </td>
                    <td className="py-3 px-4 font-mono text-left text-rose-300 bg-rose-950/50 text-sm">
                      {formatKWD(dailyTotals.totalSpent)} د.ك
                    </td>
                    <td className="py-3 px-4 font-mono text-left text-emerald-300 bg-emerald-950/50 text-sm">
                      {formatKWD(dailyTotals.totalClosing)} د.ك
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-[11px] text-slate-300 text-left">
                      صافي العهد القائمة في الذمة: {formatKWD(dailyTotals.totalClosing)} د.ك
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Full Detailed Expenses Ledger (بيان كافة بنود ومفردات الصرف لليوم) */}
        {allTodaySpentItems.length > 0 && (
          <div className="p-6 bg-slate-50/40 border-t border-slate-200 break-inside-avoid">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-rose-600" />
                <h3 className="text-sm font-black text-slate-900">
                  ثانياً: بيان كافة بنود ومفردات الصرف المنفذة في هذا اليوم ({allTodaySpentItems.length} حركة صرف)
                </h3>
              </div>
              <span className="text-xs font-mono font-black text-rose-700">
                إجمالي المنصرف: {formatKWD(dailyTotals.totalSpent)} د.ك
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-200/80 text-slate-900 border-b border-slate-300">
                    <th className="py-2 px-2.5 w-10 text-center">م</th>
                    <th className="py-2 px-3">الصندوق / أمين العهدة</th>
                    <th className="py-2 px-3">الفرع</th>
                    <th className="py-2 px-3">التصنيف / البند</th>
                    <th className="py-2 px-4">البيان والشرح التفصيلي</th>
                    <th className="py-2 px-3 text-rose-700 font-black text-left">المبلغ المنصرف (د.ك)</th>
                    <th className="py-2 px-2.5 text-center no-print w-16">سند</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {allTodaySpentItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-black text-slate-950">{item.employee}</td>
                      <td className="py-2 px-3 text-slate-600">{item.branch}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-900 leading-relaxed">
                        {item.description}
                      </td>
                      <td className="py-2 px-3 font-mono font-black text-rose-700 text-left">
                        {formatKWD(item.amount)}
                      </td>
                      <td className="py-2 px-2.5 text-center no-print">
                        <button
                          onClick={() => handleOpenVoucher(item, item.employee)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-950 rounded transition-colors cursor-pointer"
                          title="طباعة سند صرف"
                        >
                          <Receipt size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white font-black">
                    <td colSpan={5} className="py-2.5 px-4 text-right">إجمالي مبالغ الصرف</td>
                    <td className="py-2.5 px-3 font-mono text-rose-300 text-left">
                      {formatKWD(dailyTotals.totalSpent)} د.ك
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Official Signatures */}
        <div className="p-6 border-t border-slate-200 break-inside-avoid">
          <PrintSignatures
            preparedBy="المحاسب المالي"
            auditedBy="أمين الصندوق / العهدة"
            approvedBy="المدير المالي / الاعتماد"
            receivedBy="المستلم / صاحب العلاقة"
            profile={companyProfile}
          />
        </div>
      </div>
    </>
  )}

      {/* Print Settings Modal */}
      <PrintSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(updatedProfile) => {
          setCompanyProfile(updatedProfile);
          setPrintOptions(getPrintDisplayOptions());
        }}
      />

      {/* Official Voucher Modal */}
      {isVoucherModalOpen && activeVoucher && (
        <VoucherModal
          isOpen={isVoucherModalOpen}
          onClose={() => setIsVoucherModalOpen(false)}
          voucher={activeVoucher}
        />
      )}
    </div>
  );
}
