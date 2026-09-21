import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  RefreshCw, 
  Search, 
  Filter, 
  Wallet, 
  Building, 
  User, 
  ArrowDownRight, 
  ArrowUpRight, 
  ArrowRightLeft, 
  CheckCircle2, 
  DollarSign, 
  Receipt, 
  SlidersHorizontal, 
  Eye,
  Sliders,
  Check,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Building2,
  FileText
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';
import { parseReportRow, formatKWD, matchBranch, isTransferType, isAccrualType } from '../utils/format';
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

interface DailyJournalProps {
  balances: EmployeeBalance[];
  branches: string[];
  categories: string[];
  employees: string[];
  onRefresh?: () => void;
}

export interface CustodyDailySummary {
  employee: string;
  branch: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalTransferIn: number;
  totalTransferOut: number;
  unpaidAccruals: number;
  closingBalance: number;
  transactionsCount: number;
}

export default function DailyJournal({
  balances,
  branches,
  categories,
  employees,
  onRefresh
}: DailyJournalProps) {
  // Today by default (in local YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data states
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Print & PDF states
  const [companyProfile, setCompanyProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [printOptions, setPrintOptions] = useState<PrintDisplayOptions>(() => ({
    ...getPrintDisplayOptions(),
    paperSize: 'A4-landscape'
  }));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Voucher modal state
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // Fetch report data for the selected date
  const fetchDayData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gasService.getReport(
        {
          startDate: selectedDate,
          endDate: selectedDate,
          employee: selectedEmployee === 'all' ? '' : selectedEmployee,
          branch: selectedBranch === 'all' ? '' : selectedBranch,
          type: ''
        },
        forceRefresh
      );

      if (data && Array.isArray(data.rows)) {
        setRawRows(data.rows);
      } else {
        setRawRows([]);
      }
    } catch (err) {
      console.error('Error fetching daily journal data:', err);
      setError('تعذر جلب بيانات اليومية المجمعة من السيرفر.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayData();
  }, [selectedDate, selectedBranch, selectedEmployee]);

  // Parse rows
  const parsedRows = useMemo(() => {
    return rawRows.map(parseReportRow);
  }, [rawRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return parsedRows.filter(row => {
      // Branch filter
      if (selectedBranch !== 'all' && !matchBranch(row.branch, selectedBranch)) {
        return false;
      }
      // Employee filter
      if (selectedEmployee !== 'all') {
        const empClean = (row.employee || '').trim().toLowerCase();
        const selClean = selectedEmployee.trim().toLowerCase();
        if (empClean !== selClean && empClean !== 'عام') return false;
      }
      // Operation Type filter
      if (selectedType !== 'all') {
        const isTransfer = isTransferType(row.type, row.category, row.description);
        const isAccrual = isAccrualType(row.type, row.category, row.description);
        if (selectedType === 'income' && (row.income <= 0 || isTransfer)) return false;
        if (selectedType === 'expense' && (row.expense <= 0 || isTransfer || isAccrual)) return false;
        if (selectedType === 'transfer' && !isTransfer) return false;
        if (selectedType === 'accrual' && !isAccrual) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const combined = `${row.description} ${row.category} ${row.employee} ${row.branch} ${row.type}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }
      return true;
    });
  }, [parsedRows, selectedBranch, selectedEmployee, selectedType, searchQuery]);

  // Aggregate daily metrics
  const dailyMetrics = useMemo(() => {
    let totalIncome = 0;
    let totalCashExpense = 0;
    let totalTransfer = 0;
    let totalAccrual = 0;

    filteredRows.forEach(row => {
      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);

      if (isTransfer) {
        totalTransfer += (row.income > 0 ? row.income : row.expense);
      } else if (isAccrual) {
        totalAccrual += row.expense;
      } else {
        totalIncome += row.income;
        totalCashExpense += row.expense;
      }
    });

    const netCashFlow = totalIncome - totalCashExpense;

    return {
      totalIncome,
      totalCashExpense,
      totalTransfer,
      totalAccrual,
      netCashFlow,
      count: filteredRows.length
    };
  }, [filteredRows]);

  // Build Custody / Fund Daily Summary (الموقف المالي لكل صندوق/عهدة في اليوم المحدد)
  const custodyDailySummaries = useMemo<CustodyDailySummary[]>(() => {
    const map = new Map<string, {
      employee: string;
      branch: string;
      totalIncome: number;
      totalExpense: number;
      totalTransferIn: number;
      totalTransferOut: number;
      unpaidAccruals: number;
      txCount: number;
    }>();

    // Initialize with known employees if applicable or just active ones
    filteredRows.forEach(row => {
      const emp = row.employee || 'صندوق عام';
      if (!map.has(emp)) {
        map.set(emp, {
          employee: emp,
          branch: row.branch || '-',
          totalIncome: 0,
          totalExpense: 0,
          totalTransferIn: 0,
          totalTransferOut: 0,
          unpaidAccruals: 0,
          txCount: 0
        });
      }
      const item = map.get(emp)!;
      item.txCount += 1;
      if (row.branch && item.branch === '-') {
        item.branch = row.branch;
      }

      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);

      if (isTransfer) {
        if (row.income > 0) item.totalTransferIn += row.income;
        if (row.expense > 0) item.totalTransferOut += row.expense;
      } else if (isAccrual) {
        item.unpaidAccruals += row.expense;
      } else {
        item.totalIncome += row.income;
        item.totalExpense += row.expense;
      }
    });

    // Match with current balances to estimate opening and closing balances
    const summaries: CustodyDailySummary[] = [];
    map.forEach((item, emp) => {
      const bObj = balances.find(b => b.name.trim().toLowerCase() === emp.trim().toLowerCase());
      const currentBalance = bObj ? bObj.balance : 0;
      
      // Closing = currentBalance if viewing today, else calculated
      const netChange = (item.totalIncome + item.totalTransferIn) - (item.totalExpense + item.totalTransferOut);
      // Rough opening before today's netChange
      const openingBalance = currentBalance - netChange;
      const closingBalance = openingBalance + netChange;

      summaries.push({
        employee: item.employee,
        branch: item.branch,
        openingBalance,
        totalIncome: item.totalIncome,
        totalExpense: item.totalExpense,
        totalTransferIn: item.totalTransferIn,
        totalTransferOut: item.totalTransferOut,
        unpaidAccruals: item.unpaidAccruals,
        closingBalance,
        transactionsCount: item.txCount
      });
    });

    return summaries.sort((a, b) => b.totalExpense - a.totalExpense);
  }, [filteredRows, balances]);

  // Breakdown by Branch
  const branchBreakdown = useMemo(() => {
    const bMap = new Map<string, { income: number; expense: number; count: number }>();
    filteredRows.forEach(row => {
      const bName = row.branch || 'غير محدد';
      if (!bMap.has(bName)) {
        bMap.set(bName, { income: 0, expense: 0, count: 0 });
      }
      const bData = bMap.get(bName)!;
      bData.count += 1;
      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);
      if (!isTransfer && !isAccrual) {
        bData.income += row.income;
        bData.expense += row.expense;
      }
    });
    return Array.from(bMap.entries()).map(([branch, stat]) => ({
      branch,
      income: stat.income,
      expense: stat.expense,
      count: stat.count,
      net: stat.income - stat.expense
    }));
  }, [filteredRows]);

  // Export to Excel
  const handleExportExcel = () => {
    const fileName = `اليومية_المجمعة_لكافة_الصناديق_${selectedDate}`;
    
    // Main journal transactions
    const mainHeaders = [
      'م',
      'التاريخ',
      'الفرع',
      'الصندوق / أمين العهدة',
      'نوع الحركة',
      'التصنيف / البند',
      'البيان والشرح',
      'المقبوضات (+)',
      'المدفوعات (-)',
      'النوع المالي'
    ];

    const mainRows = filteredRows.map((row, idx) => {
      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);
      const opDesc = isTransfer ? 'تحويل نقدية' : isAccrual ? 'آجل مستحق' : (row.income > 0 ? 'مقبوضات نقدية' : 'مصروفات نقدية');

      return [
        idx + 1,
        row.date,
        row.branch,
        row.employee,
        row.type,
        row.category,
        row.description,
        row.income > 0 ? row.income : 0,
        row.expense > 0 ? row.expense : 0,
        opDesc
      ];
    });

    // Custody summary section
    const custodyHeaders = [
      'أمين الصندوق / العهدة',
      'الفرع التابع',
      'عدد الحركات',
      'إجمالي الوارد (+)',
      'تحويلات واردة (+)',
      'إجمالي المنصرف (-)',
      'تحويلات صادرة (-)',
      'آجل غير مسدد',
      'صافي حركة اليوم'
    ];

    const custodyRows = custodyDailySummaries.map(c => [
      c.employee,
      c.branch,
      c.transactionsCount,
      c.totalIncome,
      c.totalTransferIn,
      c.totalExpense,
      c.totalTransferOut,
      c.unpaidAccruals,
      (c.totalIncome + c.totalTransferIn) - (c.totalExpense + c.totalTransferOut)
    ]);

    exportReportToExcel({
      fileName,
      sheetName: 'دفتر اليومية المجمعة',
      reportTitle: `دفتر اليومية المجمعة لكافة الصناديق والعهد المالية - دولة الكويت`,
      subtitle: `تاريخ اليومية: ${selectedDate} | الفرع: ${selectedBranch === 'all' ? 'كافة الفروع' : selectedBranch} | إجمالي الحركات: ${filteredRows.length}`,
      summaryCards: [
        { label: 'إجمالي المقبوضات النقدية (+)', value: dailyMetrics.totalIncome },
        { label: 'إجمالي المدفوعات والمصروفات (-)', value: dailyMetrics.totalCashExpense },
        { label: 'التحويلات وتغذية العهد (⇄)', value: dailyMetrics.totalTransfer },
        { label: 'المشتريات الآجلة (غير مسدد)', value: dailyMetrics.totalAccrual },
        { label: 'صافي التدفق النقدي لليومية', value: dailyMetrics.netCashFlow },
      ],
      headers: mainHeaders,
      rows: mainRows,
      totalsRow: [
        'الإجمالي العام لليومية',
        '-',
        '-',
        '-',
        '-',
        '-',
        `عدد الحركات: ${filteredRows.length}`,
        dailyMetrics.totalIncome,
        dailyMetrics.totalCashExpense,
        `الصافي: ${formatKWD(dailyMetrics.netCashFlow)} د.ك`
      ],
      sections: [
        {
          title: 'ملخص موقف الصناديق والعهد في هذا اليوم (Custody Reconciliation)',
          headers: custodyHeaders,
          rows: custodyRows,
          totalsRow: [
            'إجمالي الصناديق',
            '-',
            filteredRows.length,
            dailyMetrics.totalIncome,
            '-',
            dailyMetrics.totalCashExpense,
            '-',
            dailyMetrics.totalAccrual,
            dailyMetrics.netCashFlow
          ]
        }
      ]
    });
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const el = document.getElementById('printable-daily-journal');
    if (!el) return;

    setPdfLoading(true);
    try {
      const orientation = printOptions.paperSize === 'A4-landscape' ? 'landscape' : 'portrait';
      await exportElementToPDF(el, {
        filename: `دفتر_اليومية_المجمعة_${selectedDate}.pdf`,
        orientation,
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error generating Daily Journal PDF:', err);
      alert('حدث خطأ أثناء تصدير ملف اليومية كـ PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Immediate Print
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

  const handleOpenVoucher = (row: any, index: number) => {
    const isTransfer = isTransferType(row.type, row.category, row.description);
    const isIncome = row.income > 0 && !isTransfer;
    const amount = isIncome ? row.income : row.expense;
    const vType = isTransfer ? 'transfer' : (isIncome ? 'receipt' : 'payment');

    setActiveVoucher({
      voucherNumber: `JRNL-${row.date.replace(/-/g, '')}-${index + 1}`,
      type: vType as any,
      date: row.date,
      amount: amount,
      paidTo: isTransfer ? (row.employee || 'المستلم') : (row.category || 'الجهة المستفيدة'),
      receivedFrom: isTransfer ? (row.employee || 'المحول') : 'الخزينة الرئيسية',
      paymentMethod: 'cash',
      category: row.category,
      branch: row.branch,
      department: row.department,
      description: row.description,
      targetMonth: row.targetMonth,
      preparedBy: 'أمين الصندوق'
    });
    setIsVoucherModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Top Main Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print border-b border-gray-200 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-emerald-500 rounded-full"></div>
            <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">
              Daily Financial Journal & Treasury Auditing
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight leading-none flex items-center gap-3">
            <span>دفتر</span>
            <span className="text-emerald-600 italic font-serif">اليومية المجمعة</span>
          </h1>
          <p className="text-slate-600 max-w-xl font-medium text-base leading-relaxed">
            تقرير رقابي يومي شامل يدمج كافة حركات الصناديق والعهد النقدية، مقبوضاتها ومصروفاتها وتحويلاتها لضبط السيولة بنظام التدقيق اليومي الموحد.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fetchDayData(true)}
            disabled={loading}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="تحديث البيانات من السيرفر"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={loading || pdfLoading || filteredRows.length === 0}
            className="px-5 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40"
          >
            <FileDown size={17} />
            <span>{pdfLoading ? 'جاري التحميل...' : 'تصدير PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || filteredRows.length === 0}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet size={17} />
            <span>تصدير إكسيل (Excel)</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={loading || filteredRows.length === 0}
            className="px-5 py-3.5 bg-slate-950 hover:bg-black text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40"
          >
            <Printer size={17} />
            <span>طباعة اليومية</span>
          </button>
        </div>
      </div>

      {/* Filter and Date Bar (no-print) */}
      <div className="no-print bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Date Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-600" />
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
            <label className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <Building size={14} className="text-emerald-600" />
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
            <label className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <User size={14} className="text-emerald-600" />
              <span>أمين العهدة / الصندوق</span>
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all cursor-pointer"
            >
              <option value="all">كافة أمناء العهد والصناديق</option>
              {employees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          {/* 4. Type Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <Filter size={14} className="text-emerald-600" />
              <span>نوع الحركة المالية</span>
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all cursor-pointer"
            >
              <option value="all">كافة الحركات (وارد / صادر / تحويل / آجل)</option>
              <option value="income">مقبوضات وتوريدات نقدية فقط (+)</option>
              <option value="expense">مصاريف ومدفوعات نقدية فقط (-)</option>
              <option value="transfer">تحويلات وتغذية عهد (⇄)</option>
              <option value="accrual">مشتريات والتزامات آجلة (مستحق)</option>
            </select>
          </div>

          {/* 5. Search Bar */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <Search size={14} className="text-emerald-600" />
              <span>بحث في البيان أو التصنيف</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث في نص البيان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all"
              />
              <Search size={14} className="absolute right-2.5 top-3 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-bold">
            <span>تاريخ سريع:</span>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-black ${
                selectedDate === todayStr ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">عدد الحركات المطابقة:</span>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-full text-xs">
              {filteredRows.length} حركة
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
          {error}
        </div>
      )}

      {/* Top Print Toolbar (no-print) */}
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

      {/* Printable Report Container */}
      <div 
        id="printable-daily-journal" 
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:overflow-visible relative"
      >
        <PrintWatermark type={printOptions.watermark} />

        {/* Print Styles */}
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
            .break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
          }
        ` }} />

        {/* Print Header */}
        <div className="p-6 border-b border-slate-200">
          <PrintHeader
            documentTitleAr="دفتر اليومية المجمعة لكافة الصناديق والعهد"
            documentTitleEn="CONSOLIDATED DAILY JOURNAL & CASH RECONCILIATION"
            documentNumber={`JRNL-${selectedDate.replace(/-/g, '')}`}
            date={selectedDate}
            profile={companyProfile}
            showQRCode={printOptions.showQRCode}
            showLetterhead={printOptions.showLetterhead}
            qrPayload={JSON.stringify({
              org: companyProfile.companyNameAr,
              doc: 'اليومية المجمعة',
              dt: selectedDate,
              inc: dailyMetrics.totalIncome,
              exp: dailyMetrics.totalCashExpense,
              net: dailyMetrics.netCashFlow,
              tx: filteredRows.length
            })}
            extraMeta={[
              { label: 'تاريخ اليومية', value: selectedDate },
              { label: 'الفرع المستهدف', value: selectedBranch === 'all' ? 'كافة الفروع' : selectedBranch },
              { label: 'الصندوق / العهدة', value: selectedEmployee === 'all' ? 'كافة الصناديق' : selectedEmployee },
              { label: 'إجمالي الحركات', value: `${filteredRows.length} حركة` }
            ]}
          />
        </div>

        {/* Top Metric Cards (Printed and Screen) */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {/* Card 1: Total In */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-[11px] font-black">إجمالي المقبوضات (+)</span>
                <ArrowDownRight size={16} />
              </div>
              <p className="text-xl font-black text-emerald-700 font-mono">
                {formatKWD(dailyMetrics.totalIncome)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">مبيعات وتوريدات نقدية مباشرة</p>
            </div>

            {/* Card 2: Total Cash Out */}
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-[11px] font-black">إجمالي المدفوعات (-)</span>
                <ArrowUpRight size={16} />
              </div>
              <p className="text-xl font-black text-rose-700 font-mono">
                {formatKWD(dailyMetrics.totalCashExpense)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">مصاريف ومشتريات نقدية مسددة</p>
            </div>

            {/* Card 3: Custody Transfers */}
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-[11px] font-black">حركات التغذية والتحويل</span>
                <ArrowRightLeft size={16} />
              </div>
              <p className="text-xl font-black text-blue-700 font-mono">
                {formatKWD(dailyMetrics.totalTransfer)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">تحويلات بين الصناديق والعهد</p>
            </div>

            {/* Card 4: Unpaid Accruals */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-[11px] font-black">مشتريات آجلة (مستحقة)</span>
                <Receipt size={16} />
              </div>
              <p className="text-xl font-black text-amber-700 font-mono">
                {formatKWD(dailyMetrics.totalAccrual)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">التزامات موردين لم تسدد نقداً</p>
            </div>

            {/* Card 5: Net Cash Flow */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xs col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-[11px] font-black">صافي التدفق النقدي</span>
                <DollarSign size={16} className="text-emerald-400" />
              </div>
              <p className={`text-xl font-black font-mono ${dailyMetrics.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {dailyMetrics.netCashFlow >= 0 ? '+' : ''}{formatKWD(dailyMetrics.netCashFlow)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">الفارق بين المقبوض والمدفوع</p>
            </div>
          </div>
        </div>

        {/* Section 1: Summary of Custody & Cash Funds (موقف أرصدة الصناديق والعهد) */}
        {custodyDailySummaries.length > 0 && (
          <div className="p-6 border-b border-slate-200 break-inside-avoid">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-emerald-600" />
                <h2 className="text-base font-black text-slate-900">
                  أولاً: ملخص حركة الصناديق والعهد النقدية لليوم (Custody Summary)
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                {custodyDailySummaries.length} صندوق/عهدة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="py-2 px-3">م</th>
                    <th className="py-2 px-3">أمين الصندوق / العهدة</th>
                    <th className="py-2 px-3">الفرع</th>
                    <th className="py-2 px-3 text-center">عدد الحركات</th>
                    <th className="py-2 px-3 text-emerald-700 font-black">مقبوضات (+د.ك)</th>
                    <th className="py-2 px-3 text-blue-700 font-black">تغذية واردة (⇄)</th>
                    <th className="py-2 px-3 text-rose-700 font-black">مدفوعات (-د.ك)</th>
                    <th className="py-2 px-3 text-indigo-700 font-black">تحويل صادر (⇄)</th>
                    <th className="py-2 px-3 text-amber-700 font-black">آجل مستحق</th>
                    <th className="py-2 px-3 text-slate-950 font-black">صافي الحركة اليومية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {custodyDailySummaries.map((c, idx) => {
                    const netMovement = (c.totalIncome + c.totalTransferIn) - (c.totalExpense + c.totalTransferOut);
                    return (
                      <tr key={c.employee} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-black text-slate-900">{c.employee}</td>
                        <td className="py-2 px-3 text-slate-600">{c.branch}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-500">{c.transactionsCount}</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                          {c.totalIncome > 0 ? formatKWD(c.totalIncome) : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">
                          {c.totalTransferIn > 0 ? formatKWD(c.totalTransferIn) : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-700">
                          {c.totalExpense > 0 ? formatKWD(c.totalExpense) : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">
                          {c.totalTransferOut > 0 ? formatKWD(c.totalTransferOut) : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-700">
                          {c.unpaidAccruals > 0 ? formatKWD(c.unpaidAccruals) : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-slate-900">
                          <span className={netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {netMovement >= 0 ? '+' : ''}{formatKWD(netMovement)} د.ك
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black">
                    <td colSpan={3} className="py-2 px-3 text-right">الإجمالي المجمع لكافة الصناديق</td>
                    <td className="py-2 px-3 text-center">{filteredRows.length}</td>
                    <td className="py-2 px-3 font-mono text-emerald-300">{formatKWD(dailyMetrics.totalIncome)}</td>
                    <td className="py-2 px-3 font-mono text-blue-300">
                      {formatKWD(custodyDailySummaries.reduce((a, b) => a + b.totalTransferIn, 0))}
                    </td>
                    <td className="py-2 px-3 font-mono text-rose-300">{formatKWD(dailyMetrics.totalCashExpense)}</td>
                    <td className="py-2 px-3 font-mono text-indigo-300">
                      {formatKWD(custodyDailySummaries.reduce((a, b) => a + b.totalTransferOut, 0))}
                    </td>
                    <td className="py-2 px-3 font-mono text-amber-300">{formatKWD(dailyMetrics.totalAccrual)}</td>
                    <td className="py-2 px-3 font-mono text-white">
                      {dailyMetrics.netCashFlow >= 0 ? '+' : ''}{formatKWD(dailyMetrics.netCashFlow)} د.ك
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Section 2: Detailed Daily Transactions Table (جدول حركات اليومية التفصيلي) */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-emerald-600" />
              <h2 className="text-base font-black text-slate-900">
                ثانياً: بيان حركات اليومية التفصيلي (Transactions Ledger)
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-bold">
              تاريخ: <span className="font-mono text-slate-900 font-black">{selectedDate}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className="animate-spin text-emerald-600" />
              <p className="text-sm font-bold">جاري تحميل حركات اليومية المجمعة...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-sm font-bold text-slate-700">لا توجد حركات مالية مسجلة في هذا التاريخ المحدد ({selectedDate}).</p>
              <p className="text-xs text-slate-400 mt-1">يمكنك تغيير التاريخ من شريط الفلاتر بأعلى الصفحة، أو اختيار تاريخ آخر.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-300">
                    <th className="py-2.5 px-2.5 w-10 text-center">م</th>
                    <th className="py-2.5 px-3">الفرع</th>
                    <th className="py-2.5 px-3">أمين العهدة / الصندوق</th>
                    <th className="py-2.5 px-3">التصنيف / البند</th>
                    <th className="py-2.5 px-4">البيان والشرح التفصيلي</th>
                    <th className="py-2.5 px-2.5 text-center">النوع</th>
                    <th className="py-2.5 px-3 text-emerald-700 font-black text-left">وارد (+د.ك)</th>
                    <th className="py-2.5 px-3 text-rose-700 font-black text-left">صادر (-د.ك)</th>
                    <th className="py-2.5 px-2.5 text-center no-print">سند</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row, idx) => {
                    const isTransfer = isTransferType(row.type, row.category, row.description);
                    const isAccrual = isAccrualType(row.type, row.category, row.description);

                    return (
                      <tr 
                        key={row.id || `${row.date}_${idx}`} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isTransfer ? 'bg-blue-50/30' : isAccrual ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{row.branch || '-'}</td>
                        <td className="py-2 px-3 font-black text-slate-950">{row.employee || '-'}</td>
                        <td className="py-2 px-3 font-bold text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                            {row.category || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-slate-900 leading-relaxed max-w-xs sm:max-w-md">
                          {row.description}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {isTransfer ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-bold text-[10px]">
                              تحويل
                            </span>
                          ) : isAccrual ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px]">
                              آجل
                            </span>
                          ) : row.income > 0 ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                              مقبوض
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                              مصروف
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-left">
                          {row.income > 0 ? formatKWD(row.income) : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-700 text-left">
                          {row.expense > 0 ? formatKWD(row.expense) : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center no-print">
                          <button
                            onClick={() => handleOpenVoucher(row, idx)}
                            className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-950 rounded-lg transition-colors cursor-pointer"
                            title="طباعة سند صرف / قبض رسمي"
                          >
                            <Receipt size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black">
                    <td colSpan={6} className="py-3 px-4 text-right">
                      إجمالي مبالغ اليومية ({selectedDate})
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-300 text-left text-sm">
                      {formatKWD(dailyMetrics.totalIncome)} د.ك
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-300 text-left text-sm">
                      {formatKWD(dailyMetrics.totalCashExpense)} د.ك
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Branch Breakdown Cards (تحليل الصرف والمبيعات بالفروع) */}
        {branchBreakdown.length > 1 && (
          <div className="p-6 bg-slate-50/50 border-t border-slate-200 break-inside-avoid">
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-emerald-600" />
              <span>ثالثاً: توزيع حركة السيولة النقدية بحسب الفروع لهذا اليوم</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {branchBreakdown.map(b => (
                <div key={b.branch} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-xs font-black text-slate-950">{b.branch}</p>
                  <p className="text-[10px] text-slate-400 font-bold mb-2">{b.count} حركة مسجلة</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">وارد:</span>
                      <span className="font-mono font-bold text-emerald-600">{formatKWD(b.income)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">صادر:</span>
                      <span className="font-mono font-bold text-rose-600">{formatKWD(b.expense)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 font-black">
                      <span className="text-slate-800">الصافي:</span>
                      <span className={`font-mono ${b.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatKWD(b.net)} د.ك
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Official Signatures & Stamp Footer */}
        <div className="p-6 border-t border-slate-200 break-inside-avoid">
          <PrintSignatures
            profile={companyProfile}
            showStamp={printOptions.showStamp}
            preparedBy="أمين الصندوق (محاسب اليومية)"
            auditedBy="المراجع المالي المعتمد"
            approvedBy="مدير الرقابة المالية والحسابات"
            receivedBy="الإدارة العامة والاعتماد"
          />
        </div>
      </div>

      {/* Official Voucher Print Modal */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        voucher={activeVoucher}
      />

      {/* Print Settings Modal */}
      <PrintSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(p) => setCompanyProfile(p)}
      />
    </div>
  );
}
