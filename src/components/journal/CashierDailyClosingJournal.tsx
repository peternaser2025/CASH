import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Receipt, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  CheckCircle2, 
  Calendar,
  FileSpreadsheet,
  FileDown,
  Calculator,
  User,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { NormalizedReportRow, formatKWD, matchBranch, isTransferType, isAccrualType, normalizeExcelDate } from '../../utils/format';
import { toFils, toKWD } from '../../utils/money';
import { tafqeetKWD } from '../../utils/tafqeet';
import { CompanyPrintProfile, PrintDisplayOptions } from '../../utils/printConfig';
import PrintHeader from '../print/PrintHeader';
import PrintSignatures from '../print/PrintSignatures';
import PrintWatermark from '../print/PrintWatermark';
import PrintToolbar from '../print/PrintToolbar';
import { exportReportToExcel } from '../../utils/excelExport';
import { exportElementToPDF } from '../../utils/pdfExport';
import VoucherModal, { VoucherData } from '../VoucherModal';

interface CashierDailyClosingJournalProps {
  selectedDate: string;
  transactions: NormalizedReportRow[];
  branches: string[];
  companyProfile: CompanyPrintProfile;
  printOptions: PrintDisplayOptions;
  onChangePrintOptions: (opts: PrintDisplayOptions) => void;
  onOpenSettings: () => void;
  searchQuery?: string;
  selectedBranchFilter?: string;
  selectedEmployeeFilter?: string;
  openingBalanceOverride?: number;
}

export interface CashierReceiptItem {
  id: string | number;
  date: string;
  time?: string;
  source: string;
  payer: string;
  description: string;
  branch: string;
  amount: number;
  raw: any;
}

export interface CashierExpenseItem {
  id: string | number;
  date: string;
  time?: string;
  branch: string;
  category: string;
  description: string;
  employee: string;
  amount: number;
  raw: any;
}

// Cash Denomination counts for Kuwaiti Dinar
interface CashDenominations {
  d20: number; // 20 KWD note
  d10: number; // 10 KWD note
  d5: number;  // 5 KWD note
  d1: number;  // 1 KWD note
  dHalf: number; // 0.500 KWD note
  dQuarter: number; // 0.250 KWD note
  coins: number; // Loose coins in KWD
}

export default function CashierDailyClosingJournal({
  selectedDate,
  transactions,
  branches,
  companyProfile,
  printOptions,
  onChangePrintOptions,
  onOpenSettings,
  searchQuery = '',
  selectedBranchFilter = 'all',
  selectedEmployeeFilter = 'all',
  openingBalanceOverride
}: CashierDailyClosingJournalProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [showDenominationsDrawer, setShowDenominationsDrawer] = useState(false);

  // Cash denomination counts for drawer count
  const [denominations, setDenominations] = useState<CashDenominations>({
    d20: 0,
    d10: 0,
    d5: 0,
    d1: 0,
    dHalf: 0,
    dQuarter: 0,
    coins: 0
  });

  // Calculate actual physical cash in drawer
  const actualDrawerCash = useMemo(() => {
    const totalFils = 
      (denominations.d20 * 20000) +
      (denominations.d10 * 10000) +
      (denominations.d5 * 5000) +
      (denominations.d1 * 1000) +
      (denominations.dHalf * 500) +
      (denominations.dQuarter * 250) +
      toFils(denominations.coins || 0);
    return toKWD(totalFils);
  }, [denominations]);

  // 1. Separate transactions of the selected date into Receipts and Branch Expenses
  const { receipts, expenses, openingBalanceCalculated } = useMemo(() => {
    const receiptsList: CashierReceiptItem[] = [];
    const expensesList: CashierExpenseItem[] = [];

    const normSelectedDate = normalizeExcelDate(selectedDate);

    // Filter by date and criteria
    transactions.forEach(row => {
      const normRowDate = normalizeExcelDate(row.date);

      // Check if matches the selected day
      const isDateMatch = !normRowDate || !normSelectedDate || normRowDate === normSelectedDate;
      if (!isDateMatch) return;

      // Check employee filter
      if (selectedEmployeeFilter !== 'all' && row.employee.trim().toLowerCase() !== selectedEmployeeFilter.trim().toLowerCase()) {
        return;
      }

      // Check branch filter
      if (selectedBranchFilter !== 'all' && !matchBranch(row.branch, selectedBranchFilter)) {
        return;
      }

      // Check search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${row.employee} ${row.category} ${row.description} ${row.branch}`.toLowerCase();
        if (!text.includes(q)) return;
      }

      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);

      // Receipts side (مقبوضات / وارد)
      if (row.income > 0) {
        receiptsList.push({
          id: row.id || `rec_${receiptsList.length + 1}`,
          date: row.date,
          source: row.category || 'وارد نقدية / تحصيل',
          payer: row.employee || 'الخزينة',
          description: row.description || 'مقبوضات نقدية واردة',
          branch: row.branch || 'المركز',
          amount: row.income,
          raw: row
        });
      }

      // Disbursements / Branch Expenses side (يقابله: فرع كذا يوم كذا صرف كذا)
      if (row.expense > 0 && !isAccrual) {
        expensesList.push({
          id: row.id || `exp_${expensesList.length + 1}`,
          date: row.date,
          branch: row.branch || 'عام / غير محدد',
          category: row.category || 'مصروفات',
          description: row.description || 'منصرف نقدي',
          employee: row.employee || 'أمين العهدة',
          amount: row.expense,
          raw: row
        });
      }
    });

    // Compute opening balance before this date if possible
    let opBalFils = 0;
    if (openingBalanceOverride !== undefined) {
      opBalFils = toFils(openingBalanceOverride);
    } else {
      // Sum all income - expense strictly before selectedDate using exact integer fils
      transactions.forEach(row => {
        const normRowDate = normalizeExcelDate(row.date);
        if (normRowDate && normSelectedDate && normRowDate < normSelectedDate) {
          if (selectedEmployeeFilter === 'all' || row.employee.trim().toLowerCase() === selectedEmployeeFilter.trim().toLowerCase()) {
            opBalFils += toFils(row.income || 0);
            if (!isAccrualType(row.type, row.category, row.description)) {
              opBalFils -= toFils(row.expense || 0);
            }
          }
        }
      });
    }

    return {
      receipts: receiptsList,
      expenses: expensesList,
      openingBalanceCalculated: toKWD(opBalFils)
    };
  }, [transactions, selectedDate, selectedBranchFilter, selectedEmployeeFilter, searchQuery, openingBalanceOverride]);

  // 2. Build Paired Rows: [عمود المقبوضات] يقابله [عمود فرع كذا يوم كذا صرف كذا]
  const maxRows = Math.max(receipts.length, expenses.length, 1);
  const pairedRows = useMemo(() => {
    const list: {
      index: number;
      receipt?: CashierReceiptItem;
      expense?: CashierExpenseItem;
    }[] = [];

    for (let i = 0; i < maxRows; i++) {
      list.push({
        index: i + 1,
        receipt: receipts[i],
        expense: expenses[i]
      });
    }
    return list;
  }, [receipts, expenses, maxRows]);

  // 3. Bottom Totals & Branch Breakdown (وتجميعات تحت بالكل والرصيد)
  const totals = useMemo(() => {
    const totalReceiptsFils = receipts.reduce((sum, r) => sum + toFils(r.amount), 0);
    const totalExpensesFils = expenses.reduce((sum, e) => sum + toFils(e.amount), 0);

    // Group expenses by Branch (فرع كذا صرف إجمالي كذا)
    const branchMap: Record<string, { branch: string; totalFils: number; count: number }> = {};
    expenses.forEach(e => {
      const bName = e.branch.trim() || 'فرع عام / غير محدد';
      if (!branchMap[bName]) {
        branchMap[bName] = { branch: bName, totalFils: 0, count: 0 };
      }
      branchMap[bName].totalFils += toFils(e.amount);
      branchMap[bName].count += 1;
    });

    const branchSummaryList = Object.values(branchMap)
      .map(b => ({
        branch: b.branch,
        total: toKWD(b.totalFils),
        count: b.count
      }))
      .sort((a, b) => b.total - a.total);

    // Cash Closing Calculation:
    // رصيد أول اليوم + إجمالي المقبوضات - إجمالي المنصرف = رصيد نهاية اليوم بالصندوق
    const opBalFils = toFils(openingBalanceCalculated);
    const netCashChangeFils = totalReceiptsFils - totalExpensesFils;
    const closingBalanceFils = opBalFils + netCashChangeFils;

    // Discrepancy if actual drawer cash counted
    const actualDrawerCashFils = toFils(actualDrawerCash);
    const hasCountedCash = actualDrawerCashFils > 0;
    const discrepancyFils = hasCountedCash ? (actualDrawerCashFils - closingBalanceFils) : 0;

    return {
      totalReceipts: toKWD(totalReceiptsFils),
      totalExpenses: toKWD(totalExpensesFils),
      netCashChange: toKWD(netCashChangeFils),
      openingBalance: openingBalanceCalculated,
      closingBalance: toKWD(closingBalanceFils),
      branchSummaryList,
      hasCountedCash,
      actualDrawerCash,
      discrepancy: toKWD(discrepancyFils)
    };
  }, [receipts, expenses, openingBalanceCalculated, actualDrawerCash]);

  // Handle voucher modal opening
  const handleOpenVoucherFromItem = (item: CashierReceiptItem | CashierExpenseItem, type: 'Receipt' | 'Payment') => {
    setActiveVoucher({
      voucherNo: `VCH-${item.date.replace(/-/g, '')}-${item.id}`,
      voucherType: type,
      date: item.date,
      amount: item.amount,
      beneficiary: type === 'Payment' ? (item as CashierExpenseItem).branch : (item as CashierReceiptItem).source,
      payer: type === 'Receipt' ? (item as CashierReceiptItem).payer : (item as CashierExpenseItem).employee,
      employee: (item as any).employee || (item as any).payer || 'أمين الصندوق',
      branch: item.branch,
      category: (item as any).category || (item as any).source || 'عام',
      description: item.description,
      paymentMethod: 'Cash'
    });
    setIsVoucherModalOpen(true);
  };

  // Browser Print
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

  // Export to PDF
  const handleExportPDF = async () => {
    const el = document.getElementById('printable-cashier-closing');
    if (!el) return;

    setPdfLoading(true);
    try {
      await exportElementToPDF(el, {
        filename: `محضر_تقفيل_الصندوق_واليومية_${selectedDate}.pdf`,
        orientation: 'landscape',
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('حدث خطأ أثناء إنشاء PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Export to Excel with dual-sided layout & totals
  const handleExportExcel = () => {
    const headers = [
      'م',
      'تاريخ القبض',
      'المصدر / البيان (مقبوضات)',
      'الفرع التابع',
      'المبلغ المقبوض (+)',
      '||',
      'الفرع (فرع كذا)',
      'تاريخ الصرف (يوم كذا)',
      'بيان ما صرفه (صرف كذا)',
      'المسؤول / الصندوق',
      'المبلغ المنصرف (-)'
    ];

    const rows = pairedRows.map(p => [
      p.index,
      p.receipt ? p.receipt.date : '-',
      p.receipt ? p.receipt.description : '-',
      p.receipt ? p.receipt.branch : '-',
      p.receipt ? p.receipt.amount : 0,
      '||',
      p.expense ? p.expense.branch : '-',
      p.expense ? p.expense.date : '-',
      p.expense ? p.expense.description : '-',
      p.expense ? p.expense.employee : '-',
      p.expense ? p.expense.amount : 0
    ]);

    const totalsRow = [
      'الإجمالي العام لتقفيل الصندوق',
      '-',
      `عدد المقبوضات: ${receipts.length}`,
      '-',
      totals.totalReceipts,
      '||',
      `عدد الفروع: ${totals.branchSummaryList.length}`,
      '-',
      `عدد المصروفات: ${expenses.length}`,
      '-',
      totals.totalExpenses
    ];

    // Branch Breakdown Sheet Section
    const branchHeaders = ['الفرع (فرع كذا)', 'إجمالي المنصرف (صرف كذا) (د.ك)', 'نسبة المنصرف', 'عدد الحركات'];
    const branchRows = totals.branchSummaryList.map(b => [
      b.branch,
      b.total,
      totals.totalExpenses > 0 ? ((b.total / totals.totalExpenses) * 100).toFixed(1) + '%' : '0%',
      b.count
    ]);

    exportReportToExcel({
      fileName: `تقفيل_صندوق_كاشير_${selectedDate}`,
      sheetName: 'تقفيل الصندوق اليومي',
      reportTitle: `محضر تقفيل الصندوق اليومي وجدول المقبوضات ومنصرف الأفرع (نظام الكاشير)`,
      subtitle: `تاريخ التقفيل: ${selectedDate} | رصيد أول: ${formatKWD(totals.openingBalance)} د.ك | مقبوضات: ${formatKWD(totals.totalReceipts)} د.ك | منصرف: ${formatKWD(totals.totalExpenses)} د.ك | رصيد الإغلاق: ${formatKWD(totals.closingBalance)} د.ك`,
      summaryCards: [
        { label: 'رصيد أول الصندوق (الافتتاحي)', value: totals.openingBalance },
        { label: 'إجمالي المقبوضات (+)', value: totals.totalReceipts },
        { label: 'إجمالي منصرف الأفرع (-)', value: totals.totalExpenses },
        { label: 'رصيد الإغلاق المتبقي بالصندوق', value: totals.closingBalance }
      ],
      headers,
      rows,
      totalsRow,
      sections: [
        {
          title: `تجميعات منصرف الأفرع بالتفصيل ليوم ${selectedDate}`,
          headers: branchHeaders,
          rows: branchRows,
          totalsRow: [
            'إجمالي كل الأفرع',
            totals.totalExpenses,
            '100%',
            expenses.length
          ]
        }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Cashier Toolbar (No Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Scale size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-950">
                اليومية العامة وتقفيل الصندوق (نظام الكاشير: مقبوضات يقابلها منصرف الأفرع)
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                مطابقة فورية
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              عمود مقبوضات يقابله فرع كذا يوم كذا صرف كذا + تجميعات بالكل تحت والرصيد المتبقي بالصندوق
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Drawer Denomination Calculator Toggle */}
          <button
            onClick={() => setShowDenominationsDrawer(!showDenominationsDrawer)}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
              showDenominationsDrawer
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Calculator size={15} />
            <span>{showDenominationsDrawer ? 'إخفاء حاسبة الدرج' : 'جرد فئات النقدية بالدرج'}</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={pdfLoading || pairedRows.length === 0}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <FileDown size={14} />
            <span>{pdfLoading ? 'جاري التصدير...' : 'تصدير PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={pairedRows.length === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet size={14} />
            <span>تصدير إكسيل</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={pairedRows.length === 0}
            className="px-4 py-2 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <Printer size={14} />
            <span>طباعة تقفيل الصندوق الرسمي</span>
          </button>
        </div>
      </div>

      {/* Cash Denomination Counting Drawer (Screen Only) */}
      {showDenominationsDrawer && (
        <div className="no-print bg-white p-5 rounded-3xl border-2 border-emerald-300 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                جرد ومطابقة فئات النقدية بالدرج (Cash Drawer Reconciliation)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">النقدية الفعلية بالدرج:</span>
              <span className="text-sm font-mono font-black text-emerald-700">
                {formatKWD(actualDrawerCash)} د.ك
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* 20 KWD */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">فئة 20 د.ك</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={denominations.d20 || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, d20: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD((denominations.d20 || 0) * 20)}
              </span>
            </div>

            {/* 10 KWD */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">فئة 10 د.ك</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={denominations.d10 || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, d10: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD((denominations.d10 || 0) * 10)}
              </span>
            </div>

            {/* 5 KWD */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">فئة 5 د.ك</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={denominations.d5 || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, d5: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD((denominations.d5 || 0) * 5)}
              </span>
            </div>

            {/* 1 KWD */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">فئة 1 د.ك</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={denominations.d1 || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, d1: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD((denominations.d1 || 0) * 1)}
              </span>
            </div>

            {/* 0.500 KWD */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">نصف د.ك (500 فلس)</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={denominations.dHalf || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, dHalf: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD((denominations.dHalf || 0) * 0.5)}
              </span>
            </div>

            {/* 0.250 KWD */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">ربع د.ك (250 فلس)</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={denominations.dQuarter || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, dQuarter: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD((denominations.dQuarter || 0) * 0.25)}
              </span>
            </div>

            {/* Loose Coins */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-black text-slate-800 block">خردة وعملات معدنية</span>
              <input
                type="number"
                step="0.050"
                min="0"
                placeholder="0.000"
                value={denominations.coins || ''}
                onChange={(e) => setDenominations(prev => ({ ...prev, coins: parseFloat(e.target.value) || 0 }))}
                className="w-full mt-1 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                = {formatKWD(denominations.coins || 0)}
              </span>
            </div>
          </div>

          {/* Drawer Reconciliation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500 font-bold block text-[11px]">الرصيد الدفتري المطلوب:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {formatKWD(totals.closingBalance)} د.ك
                </span>
              </div>
              <div className="border-r border-slate-300 pr-4">
                <span className="text-slate-500 font-bold block text-[11px]">الرصيد الفعلي المعدود بالدرج:</span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {formatKWD(actualDrawerCash)} د.ك
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {totals.discrepancy === 0 ? (
                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg font-black flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>الصندوق مطابق 100% (بدون عجز أو زيادة)</span>
                </span>
              ) : totals.discrepancy < 0 ? (
                <span className="px-3 py-1.5 bg-rose-100 text-rose-800 rounded-lg font-black flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  <span>عجز في الصندوق: {formatKWD(Math.abs(totals.discrepancy))} د.ك</span>
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg font-black flex items-center gap-1.5">
                  <Coins size={15} />
                  <span>زيادة في الصندوق: +{formatKWD(totals.discrepancy)} د.ك</span>
                </span>
              )}

              <button
                onClick={() => setDenominations({ d20: 0, d10: 0, d5: 0, d1: 0, dHalf: 0, dQuarter: 0, coins: 0 })}
                className="px-2 py-1 text-slate-500 hover:text-rose-600 rounded text-[11px] cursor-pointer"
              >
                تصفير الجرد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Options Toolbar (Screen Only) */}
      <div className="no-print">
        <PrintToolbar
          options={printOptions}
          onChangeOptions={onChangePrintOptions}
          onPrint={handlePrint}
          onExportPDF={handleExportPDF}
          pdfLoading={pdfLoading}
          onOpenSettings={onOpenSettings}
          allowThermal={false}
        />
      </div>

      {/* Main Printable Container: كشف تقفيل الصندوق واليومية المتقابلة */}
      <div 
        id="printable-cashier-closing" 
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:overflow-visible relative"
      >
        <PrintWatermark type={printOptions.watermark} />

        {/* Global Print Styles */}
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
              margin: 7mm;
              size: A4 landscape;
            }
            body {
              background: white !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-family: system-ui, -apple-system, sans-serif !important;
            }
            #printable-cashier-closing {
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
              border: 1px solid #334155 !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            th, td {
              border: 1px solid #64748b !important;
              padding: 4px 6px !important;
              font-size: 8pt !important;
              line-height: 1.25 !important;
            }
            th {
              font-weight: 800 !important;
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
            }
            .print-receipt-header {
              background-color: #ecfdf5 !important;
              color: #065f46 !important;
            }
            .print-expense-header {
              background-color: #fff1f2 !important;
              color: #9f1239 !important;
            }
            .print-totals-box {
              border: 1.5px solid #0f172a !important;
              background-color: #f8fafc !important;
            }
          }
        ` }} />

        {/* Official Header */}
        <div className="p-6 border-b border-slate-200">
          <PrintHeader
            documentTitleAr="كشف تقفيل الصندوق واليومية العامة (المقبوضات ومنصرف الأفرع)"
            documentTitleEn="DAILY CASHIER REGISTER & CASH BOX CLOSING STATEMENT"
            documentNumber={`CSH-${selectedDate.replace(/-/g, '')}`}
            date={selectedDate}
            profile={companyProfile}
            showQRCode={printOptions.showQRCode}
            showLetterhead={printOptions.showLetterhead}
            qrPayload={JSON.stringify({
              org: companyProfile.companyNameAr,
              doc: 'تقفيل الصندوق اليومي',
              date: selectedDate,
              open: totals.openingBalance,
              rec: totals.totalReceipts,
              exp: totals.totalExpenses,
              close: totals.closingBalance
            })}
            extraMeta={[
              { label: 'تاريخ اليومية', value: selectedDate },
              { label: 'الصندوق / الكاشير', value: selectedEmployeeFilter === 'all' ? 'الخزينة المجمعة' : selectedEmployeeFilter },
              { label: 'رصيد أول الصندوق', value: `${formatKWD(totals.openingBalance)} د.ك` },
              { label: 'الرصيد المتبقي بالصندوق', value: `${formatKWD(totals.closingBalance)} د.ك` }
            ]}
          />
        </div>

        {/* 4 Summary Cards (زي نظام الكاشير) */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Opening Cash */}
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-xs">
              <div className="flex items-center justify-between text-slate-700 mb-1">
                <span className="text-xs font-black uppercase">رصيد أول الصندوق (عهدة البداية)</span>
                <Coins size={17} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {formatKWD(totals.openingBalance)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                الرصيد المتاح عند فتح الصندوق
              </p>
            </div>

            {/* 2. Total Receipts (المقبوضات) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-black uppercase">إجمالي المقبوضات (الوارد +)</span>
                <TrendingUp size={17} />
              </div>
              <p className="text-2xl font-black text-emerald-800 font-mono">
                +{formatKWD(totals.totalReceipts)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                {receipts.length} حركة قبض وتوريد نقدية
              </p>
            </div>

            {/* 3. Total Branch Expenses (المنصرف بالأفرع) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-xs font-black uppercase">إجمالي منصرف الأفرع (-)</span>
                <TrendingDown size={17} />
              </div>
              <p className="text-2xl font-black text-rose-700 font-mono">
                -{formatKWD(totals.totalExpenses)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                {expenses.length} حركة صرف موزعة على {totals.branchSummaryList.length} أفرع
              </p>
            </div>

            {/* 4. Final Closing Cash in Box (الرصيد المتبقي بالصندوق) */}
            <div className={`p-4 rounded-2xl border-2 shadow-xs ${
              totals.closingBalance >= 0 ? 'bg-emerald-950 text-white border-emerald-900' : 'bg-rose-950 text-white border-rose-900'
            }`}>
              <div className="flex items-center justify-between mb-1 opacity-90">
                <span className="text-xs font-black uppercase">الرصيد المتبقي بالصندوق (نهاية اليوم)</span>
                <CheckCircle2 size={17} className={totals.closingBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
              </div>
              <p className={`text-2xl font-black font-mono ${
                totals.closingBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                {formatKWD(totals.closingBalance)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] opacity-80 font-bold mt-1">
                {totals.closingBalance >= 0 ? 'صافي النقدية المفترض وجودها بالدرج' : 'عجز في رصيد الصندوق'}
              </p>
            </div>
          </div>
        </div>

        {/* CORE DUAL TABLE: 
            [عمود مقبوضات] يقابله [عمود فرع كذا يوم كذا صرف كذا] 
        */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-emerald-700" />
              <h3 className="text-sm font-black text-slate-950">
                جدول اليومية المزدوج (جانب المقبوضات يقابله جانب منصرف الأفرع بالتاريخ والتفصيل)
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500">
              تاريخ الحركة: {selectedDate}
            </span>
          </div>

          {pairedRows.length === 0 || (receipts.length === 0 && expenses.length === 0) ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-sm font-bold text-slate-700">لا توجد مقبوضات أو مصروفات مسجلة لتاريخ {selectedDate}.</p>
              <p className="text-xs text-slate-400 mt-1">اختر تاريخاً آخر من شريط الفلاتر بأعلى الصفحة.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                {/* Two-Tier Main Header */}
                <thead>
                  {/* Tier 1 Header: Clear Dual Separation */}
                  <tr className="border-b border-slate-300 text-xs font-black">
                    {/* Receipts Super Header */}
                    <th colSpan={4} className="py-2.5 px-3 text-center bg-emerald-100 text-emerald-950 border-r-2 border-slate-400">
                      🟢 جانب المقبوضات (الوارد والمتحصلات +)
                    </th>
                    {/* Disbursements Super Header */}
                    <th colSpan={5} className="py-2.5 px-3 text-center bg-rose-100 text-rose-950">
                      🔴 جانب المنصرف حسب الأفرع (فرع كذا - يوم كذا - صرف كذا -)
                    </th>
                  </tr>

                  {/* Tier 2 Header: Individual Columns */}
                  <tr className="bg-slate-100 text-slate-800 border-b-2 border-slate-300 text-[11px] font-black">
                    {/* Receipts Columns */}
                    <th className="py-2 px-2 w-8 text-center bg-emerald-50/70">م</th>
                    <th className="py-2 px-2.5 bg-emerald-50/70">التاريخ (يوم كذا)</th>
                    <th className="py-2 px-3 bg-emerald-50/70">البيان والمصدر المقبوض منه</th>
                    <th className="py-2 px-3 text-emerald-800 font-black text-left bg-emerald-100/80 border-r-2 border-slate-400">
                      مبلغ المقبوضات (+)
                    </th>

                    {/* Expenses Columns: الفرع | تاريخ الصرف | بيان ما صرفه | المسؤول | المبلغ */}
                    <th className="py-2 px-3 bg-rose-50/70 text-slate-900 font-black">
                      الفرع (فرع كذا)
                    </th>
                    <th className="py-2 px-2.5 bg-rose-50/70">
                      تاريخ الصرف (يوم كذا)
                    </th>
                    <th className="py-2 px-3 bg-rose-50/70">
                      بيان ما صُرف وتفاصيله (صرف كذا)
                    </th>
                    <th className="py-2 px-2.5 bg-rose-50/70 text-slate-600">
                      المسؤول / الصندوق
                    </th>
                    <th className="py-2 px-3 text-rose-800 font-black text-left bg-rose-100/80">
                      مبلغ المنصرف (-)
                    </th>
                  </tr>
                </thead>

                {/* Table Rows: Each row pairs receipt with branch expense */}
                <tbody className="divide-y divide-slate-200 bg-white">
                  {pairedRows.map((row) => {
                    const rec = row.receipt;
                    const exp = row.expense;

                    return (
                      <tr key={row.index} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Receipt Serial */}
                        <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10px] bg-emerald-50/20">
                          {rec ? row.index : '-'}
                        </td>

                        {/* 2. Receipt Date */}
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap bg-emerald-50/20">
                          {rec ? rec.date : '-'}
                        </td>

                        {/* 3. Receipt Description & Source */}
                        <td className="py-2 px-3 text-slate-900 max-w-xs leading-tight bg-emerald-50/20">
                          {rec ? (
                            <div>
                              <span className="font-bold block">{rec.description}</span>
                              <span className="text-[10px] text-emerald-800 font-semibold">
                                {rec.source} {rec.payer ? `• من: ${rec.payer}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* 4. Receipt Amount (+) */}
                        <td className="py-2 px-3 font-mono font-black text-emerald-700 text-left bg-emerald-50/40 border-r-2 border-slate-400 whitespace-nowrap">
                          {rec ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span>+{formatKWD(rec.amount)}</span>
                              <button
                                onClick={() => handleOpenVoucherFromItem(rec, 'Receipt')}
                                className="no-print p-1 text-emerald-800 hover:bg-emerald-100 rounded cursor-pointer"
                                title="طباعة سند قبض"
                              >
                                <Receipt size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* 5. Expense Branch (فرع كذا) */}
                        <td className="py-2 px-3 font-black text-slate-950 whitespace-nowrap bg-rose-50/20">
                          {exp ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900 font-black">
                              {exp.branch}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* 6. Expense Date (يوم كذا) */}
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap bg-rose-50/20">
                          {exp ? exp.date : '-'}
                        </td>

                        {/* 7. Expense Description (صرف كذا) */}
                        <td className="py-2 px-3 text-slate-900 max-w-xs leading-tight bg-rose-50/20">
                          {exp ? (
                            <div>
                              <span className="font-bold block">{exp.description}</span>
                              <span className="text-[10px] text-rose-800 font-semibold">
                                البند: {exp.category}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* 8. Expense Custodian / Fund */}
                        <td className="py-2 px-2.5 text-slate-600 text-[11px] whitespace-nowrap bg-rose-50/20">
                          {exp ? exp.employee : '-'}
                        </td>

                        {/* 9. Expense Amount (-) */}
                        <td className="py-2 px-3 font-mono font-black text-rose-700 text-left bg-rose-50/40 whitespace-nowrap">
                          {exp ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span>-{formatKWD(exp.amount)}</span>
                              <button
                                onClick={() => handleOpenVoucherFromItem(exp, 'Payment')}
                                className="no-print p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                title="طباعة سند صرف"
                              >
                                <Receipt size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Subtotals Footer Row */}
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-xs">
                    {/* Receipts Total */}
                    <td colSpan={3} className="py-3 px-3 text-right">
                      إجمالي المقبوضات ({receipts.length} حركة)
                    </td>
                    <td className="py-3 px-3 font-mono text-left text-emerald-300 bg-emerald-950 border-r-2 border-slate-600 whitespace-nowrap text-sm">
                      +{formatKWD(totals.totalReceipts)} د.ك
                    </td>

                    {/* Expenses Total */}
                    <td colSpan={4} className="py-3 px-3 text-right">
                      إجمالي المنصرف لكافة الأفرع ({expenses.length} حركة)
                    </td>
                    <td className="py-3 px-3 font-mono text-left text-rose-300 bg-rose-950 whitespace-nowrap text-sm">
                      -{formatKWD(totals.totalExpenses)} د.ك
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* 
            THE COMPREHENSIVE BOTTOM TOTALS & CASH RECONCILIATION BLOCK:
            "وتجمعيات تحت بالكل والرصيد زي نظام كاشير او اعتبره تقفيل صندوق يومي"
        */}
        <div className="p-6 bg-slate-50 border-t-2 border-slate-300 break-inside-avoid">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-slate-900" />
              <h3 className="text-sm sm:text-base font-black text-slate-950">
                التجميعات العامة تحت بالكل وتوزيع الأفرع وتقفيل رصيد الصندوق
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500">
              معادلة الكاشير: (رصيد أول + المقبوضات - المنصرف = رصيد الصندوق)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Breakdown of Branch Expenses (تجميعات تحت بالكل لكل فرع) */}
            <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs">
                  <Building2 size={15} className="text-rose-600" />
                  <span>تجميعات ما تم صرفه مقسماً تبعاً للأفرع (فرع كذا صرف إجمالي كذا):</span>
                </div>
                <span className="text-xs font-mono font-black text-rose-700">
                  الإجمالي العام: {formatKWD(totals.totalExpenses)} د.ك
                </span>
              </div>

              {totals.branchSummaryList.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">لا توجد مصروفات لأي فرع في هذا اليوم.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                        <th className="py-1.5 px-2.5">الفرع (فرع كذا)</th>
                        <th className="py-1.5 px-3 text-rose-700 text-left font-black">إجمالي ما صُرف (صرف كذا)</th>
                        <th className="py-1.5 px-2.5 text-center">نسبة المنصرف</th>
                        <th className="py-1.5 px-2 text-center">عدد الحركات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {totals.branchSummaryList.map((b, idx) => {
                        const pct = totals.totalExpenses > 0 ? ((b.total / totals.totalExpenses) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 font-black text-slate-900 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              <span>{b.branch}</span>
                            </td>
                            <td className="py-1.5 px-3 font-mono font-black text-rose-700 text-left">
                              {formatKWD(b.total)} د.ك
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-mono text-slate-600 font-bold">
                              {pct}%
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                              {b.count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t border-slate-300">
                        <td className="py-2 px-2.5 text-slate-900">إجمالي مصروفات كل الأفرع</td>
                        <td className="py-2 px-3 font-mono text-rose-800 text-left text-xs sm:text-sm">
                          {formatKWD(totals.totalExpenses)} د.ك
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono">100%</td>
                        <td className="py-2 px-2 text-center font-mono">{expenses.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Right 5 Columns: Final Cash Reconciliation Ledger (تقفيل الصندوق والرصيد زي نظام كاشير) */}
            <div className="lg:col-span-5 bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs">
                    <Scale size={15} className="text-emerald-700" />
                    <span>كشف تقفيل الصندوق اليومي (Cash Closing):</span>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded font-bold">
                    معتمد محاسبياً
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Line 1: Opening Balance */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="font-bold text-slate-600">رصيد أول اليوم (العهدة الافتتاحية):</span>
                    <span className="font-mono font-black text-slate-900">
                      +{formatKWD(totals.openingBalance)} د.ك
                    </span>
                  </div>

                  {/* Line 2: Total Receipts (+) */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 text-emerald-800">
                    <span className="font-bold">يُضاف: إجمالي المقبوضات (الوارد):</span>
                    <span className="font-mono font-black">
                      +{formatKWD(totals.totalReceipts)} د.ك
                    </span>
                  </div>

                  {/* Line 3: Total Expenses (-) */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 text-rose-700">
                    <span className="font-bold">يُطرح: إجمالي المنصرف (كافة الأفرع):</span>
                    <span className="font-mono font-black">
                      -{formatKWD(totals.totalExpenses)} د.ك
                    </span>
                  </div>

                  {/* Line 4: Net Day Change */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-200 text-slate-700">
                    <span className="font-bold">صافي حركة النقدية لليوم:</span>
                    <span className={`font-mono font-black ${totals.netCashChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {totals.netCashChange >= 0 ? '+' : ''}{formatKWD(totals.netCashChange)} د.ك
                    </span>
                  </div>

                  {/* Line 5: Final Closing Balance (الرصيد المتبقي بالصندوق) */}
                  <div className="flex items-center justify-between p-3 bg-slate-900 text-white rounded-xl mt-2">
                    <div>
                      <span className="font-black block text-xs">الرصيد الدفتري المتبقي بالصندوق:</span>
                      <span className="text-[10px] text-slate-300">الرصيد المفترض وجوده بالدرج</span>
                    </div>
                    <span className="text-lg font-mono font-black text-emerald-300">
                      {formatKWD(totals.closingBalance)} د.ك
                    </span>
                  </div>

                  {/* Actual drawer cash if counted */}
                  {totals.hasCountedCash && (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                      <div>
                        <span className="font-bold text-emerald-950 block">الجرد الفعلي للنقدية بالدرج:</span>
                        <span className="font-mono font-black text-emerald-900">
                          {formatKWD(totals.actualDrawerCash)} د.ك
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-500 block">فارق المطابقة:</span>
                        <span className={`font-mono font-black text-xs ${
                          totals.discrepancy === 0 ? 'text-emerald-700' : totals.discrepancy < 0 ? 'text-rose-700' : 'text-blue-700'
                        }`}>
                          {totals.discrepancy === 0 ? '0.000 (مطابق)' : `${totals.discrepancy > 0 ? '+' : ''}${formatKWD(totals.discrepancy)} د.ك`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tafqeet (تفقيط كتابي للرصيد) */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                  <span className="font-black text-slate-800 ml-1">المبلغ كتابة:</span>
                  {tafqeetKWD(totals.closingBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Official Accounting Signatures Block (تقفيل شفت الكاشير والمراجعة) */}
        <div className="p-6 border-t border-slate-200 break-inside-avoid">
          <PrintSignatures
            preparedBy="أمين الصندوق / الكاشير المسلّم"
            auditedBy="المراجع الداخلي / مشرف الشفت"
            approvedBy="المدير المالي والاعتماد"
            receivedBy="مستلم النقدية / الخزينة المركزية"
            profile={companyProfile}
          />
        </div>
      </div>

      {/* Voucher Modal */}
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
