import React, { useMemo, useState } from 'react';
import { 
  Building2, 
  Receipt, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  ArrowDownRight, 
  Coins, 
  CheckCircle2, 
  Layers, 
  Calendar,
  FileSpreadsheet,
  FileDown,
  Info
} from 'lucide-react';
import { NormalizedReportRow, formatKWD, matchBranch, isTransferType, isAccrualType } from '../../utils/format';
import { CompanyPrintProfile, PrintDisplayOptions } from '../../utils/printConfig';
import PrintHeader from '../print/PrintHeader';
import PrintSignatures from '../print/PrintSignatures';
import PrintWatermark from '../print/PrintWatermark';
import PrintToolbar from '../print/PrintToolbar';
import { exportReportToExcel } from '../../utils/excelExport';
import { exportElementToPDF } from '../../utils/pdfExport';
import VoucherModal, { VoucherData } from '../VoucherModal';

interface BranchMultiColumnJournalProps {
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
}

export interface MultiColumnRow {
  index: number;
  id: string | number;
  date: string;
  employee: string;
  category: string;
  description: string;
  originalBranch: string;
  receiptAmount: number; // عمود المقبوضات
  branchExpenses: Record<string, number>; // أعمدة مصروفات الأفرع
  otherBranchExpense: number; // فروع أخرى / غير محدد
  totalExpense: number; // إجمالي المنصرف
  netImpact: number; // مقبوضات - مصروفات
  runningBalance: number;
  isTransfer: boolean;
  isAccrual: boolean;
  targetMonth?: string;
}

export default function BranchMultiColumnJournal({
  selectedDate,
  transactions,
  branches,
  companyProfile,
  printOptions,
  onChangePrintOptions,
  onOpenSettings,
  searchQuery = '',
  selectedBranchFilter = 'all',
  selectedEmployeeFilter = 'all'
}: BranchMultiColumnJournalProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [showBranchSummary, setShowBranchSummary] = useState(true);

  // 1. Determine active branch list for columns
  const displayBranches = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // Add branches that have transactions or from configured branches
    if (branches && branches.length > 0) {
      branches.forEach(b => {
        const clean = b.trim();
        if (clean && clean !== 'all' && clean !== 'عام' && !seen.has(clean)) {
          seen.add(clean);
          list.push(clean);
        }
      });
    }

    // Also check current day transactions
    transactions.forEach(t => {
      if (t.branch && t.branch.trim() && t.branch.trim() !== 'عام' && !seen.has(t.branch.trim())) {
        seen.add(t.branch.trim());
        list.push(t.branch.trim());
      }
    });

    if (list.length === 0) {
      return ['سيتي', 'رونزا', 'دار السلام', 'الورده الانيقة', 'تعبئة وتغليف'];
    }

    return list;
  }, [branches, transactions]);

  // 2. Filter transactions for the selected day and criteria
  const dayTransactions = useMemo(() => {
    return transactions.filter(row => {
      // Date match
      const rowDate = (row.date || '').trim();
      if (rowDate && selectedDate && rowDate !== selectedDate) {
        return false;
      }

      // Branch filter
      if (selectedBranchFilter !== 'all' && !matchBranch(row.branch, selectedBranchFilter)) {
        return false;
      }

      // Employee filter
      if (selectedEmployeeFilter !== 'all' && row.employee.trim().toLowerCase() !== selectedEmployeeFilter.trim().toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const combined = `${row.employee} ${row.category} ${row.description} ${row.branch}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      return true;
    });
  }, [transactions, selectedDate, selectedBranchFilter, selectedEmployeeFilter, searchQuery]);

  // 3. Map transactions into Multi-Column Journal structure
  const { multiColumnRows, totals, branchBreakdown } = useMemo(() => {
    let runningBalance = 0;
    let totalReceipts = 0;
    let totalExpenses = 0;
    const branchExpenseTotals: Record<string, number> = {};
    let totalOtherExpense = 0;

    // Initialize branch totals
    displayBranches.forEach(b => {
      branchExpenseTotals[b] = 0;
    });

    // Breakdown for branch matrix
    const breakdownMap: Record<string, {
      name: string;
      receipts: number;
      expenses: number;
      count: number;
    }> = {};

    displayBranches.forEach(b => {
      breakdownMap[b] = { name: b, receipts: 0, expenses: 0, count: 0 };
    });
    breakdownMap['أخرى'] = { name: 'فروع أخرى / عام', receipts: 0, expenses: 0, count: 0 };

    const rows: MultiColumnRow[] = dayTransactions.map((row, idx) => {
      const isTransfer = isTransferType(row.type, row.category, row.description);
      const isAccrual = isAccrualType(row.type, row.category, row.description);

      // Receipts (مقبوضات / وارد)
      let receiptAmount = 0;
      if (row.income > 0) {
        receiptAmount = row.income;
      }

      // Expenses (مصروفات / من صرف)
      let expenseAmount = 0;
      if (row.expense > 0 && !isAccrual) {
        expenseAmount = row.expense;
      }

      // Distribute expense across branch columns
      const rowBranchExpenses: Record<string, number> = {};
      displayBranches.forEach(b => {
        rowBranchExpenses[b] = 0;
      });

      let matchedBranchName = '';
      if (expenseAmount > 0) {
        for (const b of displayBranches) {
          if (matchBranch(row.branch, b)) {
            matchedBranchName = b;
            break;
          }
        }

        if (matchedBranchName) {
          rowBranchExpenses[matchedBranchName] = expenseAmount;
          branchExpenseTotals[matchedBranchName] = (branchExpenseTotals[matchedBranchName] || 0) + expenseAmount;
        } else {
          totalOtherExpense += expenseAmount;
        }
      }

      // Track branch breakdown
      const targetBranchKey = matchedBranchName || (displayBranches.find(b => matchBranch(row.branch, b)) || 'أخرى');
      if (breakdownMap[targetBranchKey]) {
        breakdownMap[targetBranchKey].receipts += receiptAmount;
        breakdownMap[targetBranchKey].expenses += expenseAmount;
        breakdownMap[targetBranchKey].count += 1;
      }

      totalReceipts += receiptAmount;
      totalExpenses += expenseAmount;
      const netImpact = receiptAmount - expenseAmount;
      runningBalance += netImpact;

      return {
        index: idx + 1,
        id: row.id || `row_${idx}`,
        date: row.date,
        employee: row.employee || 'الخزينة العامة',
        category: row.category || 'عام',
        description: row.description || '',
        originalBranch: row.branch || 'المركز',
        receiptAmount,
        branchExpenses: rowBranchExpenses,
        otherBranchExpense: matchedBranchName ? 0 : expenseAmount,
        totalExpense: expenseAmount,
        netImpact,
        runningBalance,
        isTransfer,
        isAccrual,
        targetMonth: row.targetMonth
      };
    });

    const breakdownList = Object.values(breakdownMap).filter(b => b.count > 0 || b.receipts > 0 || b.expenses > 0);

    return {
      multiColumnRows: rows,
      totals: {
        totalReceipts,
        totalExpenses,
        branchExpenseTotals,
        totalOtherExpense,
        netBalance: totalReceipts - totalExpenses,
        count: rows.length
      },
      branchBreakdown: breakdownList
    };
  }, [dayTransactions, displayBranches]);

  // Open voucher modal for an item
  const handleOpenVoucher = (row: MultiColumnRow) => {
    setActiveVoucher({
      voucherNo: `VCH-${row.date.replace(/-/g, '')}-${row.index}`,
      voucherType: row.receiptAmount > 0 ? 'Receipt' : 'Payment',
      date: row.date,
      amount: row.receiptAmount > 0 ? row.receiptAmount : row.totalExpense,
      beneficiary: row.category,
      payer: row.employee,
      employee: row.employee,
      paymentMethod: 'Cash',
      category: row.category,
      branch: row.originalBranch,
      description: row.description,
      targetMonth: row.targetMonth
    });
    setIsVoucherModalOpen(true);
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

  // Export to PDF
  const handleExportPDF = async () => {
    const el = document.getElementById('printable-branch-journal');
    if (!el) return;

    setPdfLoading(true);
    try {
      await exportElementToPDF(el, {
        filename: `يومية_المقبوضات_ومصروفات_الأفرع_${selectedDate}.pdf`,
        orientation: 'landscape',
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('حدث خطأ أثناء تصدير PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Export to Excel with multi-column layout
  const handleExportExcel = () => {
    const fileName = `يومية_المقبوضات_ومصروفات_الأفرع_${selectedDate}`;

    const headers = [
      'م',
      'الوقت / المرجع',
      'الصندوق / المسؤول',
      'الفرع التابع',
      'التصنيف / البند',
      'البيان والشرح التفصيلي',
      'عمود المقبوضات (وارد +)',
      ...displayBranches.map(b => `مصروفات فرع ${b} (-)`),
      'مصروفات أخرى / غير مصنفة (-)',
      'إجمالي المصروفات (-)',
      'صافي الأثر النقدي (د.ك)',
      'الرصيد التراكمي (د.ك)'
    ];

    const rows = multiColumnRows.map(r => [
      r.index,
      `TRX-${r.index}`,
      r.employee,
      r.originalBranch,
      r.category,
      r.description,
      r.receiptAmount,
      ...displayBranches.map(b => r.branchExpenses[b] || 0),
      r.otherBranchExpense,
      r.totalExpense,
      r.netImpact,
      r.runningBalance
    ]);

    const totalsRow = [
      'الإجمالي العام لليومية',
      '-',
      '-',
      '-',
      '-',
      `عدد الحركات: ${multiColumnRows.length}`,
      totals.totalReceipts,
      ...displayBranches.map(b => totals.branchExpenseTotals[b] || 0),
      totals.totalOtherExpense,
      totals.totalExpenses,
      totals.netBalance,
      totals.netBalance
    ];

    const branchSummaryHeaders = [
      'الفرع / الموقع',
      'إجمالي المقبوضات (+)',
      'إجمالي المصروفات (-)',
      'صافي التدفق المالي (د.ك)',
      'نسبة المصروف من الإجمالي',
      'عدد الحركات'
    ];

    const branchSummaryRows = branchBreakdown.map(b => {
      const pct = totals.totalExpenses > 0 ? ((b.expenses / totals.totalExpenses) * 100).toFixed(1) + '%' : '0.0%';
      return [
        b.name,
        b.receipts,
        b.expenses,
        b.receipts - b.expenses,
        pct,
        b.count
      ];
    });

    exportReportToExcel({
      fileName,
      sheetName: 'اليومية التحليلية بالأفرع',
      reportTitle: `دفتر اليومية العامة والتحليلية متعددة الأعمدة (المقبوضات ومصروفات الأفرع)`,
      subtitle: `تاريخ اليومية: ${selectedDate} | إجمالي المقبوضات: ${formatKWD(totals.totalReceipts)} د.ك | إجمالي المصروفات: ${formatKWD(totals.totalExpenses)} د.ك | صافي اليوم: ${formatKWD(totals.netBalance)} د.ك`,
      summaryCards: [
        { label: 'إجمالي المقبوضات اليومية (+)', value: totals.totalReceipts },
        { label: 'إجمالي مصروفات الأفرع (-)', value: totals.totalExpenses },
        { label: 'صافي التدفق النقدي لليومية', value: totals.netBalance },
        { label: 'عدد العمليات المنفذة', value: `${multiColumnRows.length} حركة` }
      ],
      headers,
      rows,
      totalsRow,
      sections: [
        {
          title: `ملخص حركة وتوزيع الأفرع ليوم ${selectedDate}`,
          headers: branchSummaryHeaders,
          rows: branchSummaryRows,
          totalsRow: [
            'الإجمالي المجمع للأفرع',
            totals.totalReceipts,
            totals.totalExpenses,
            totals.netBalance,
            '100%',
            multiColumnRows.length
          ]
        }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar (No Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                اليومية التحليلية متعددة الأعمدة (مقبوضات ومصروفات الأفرع)
              </h2>
              <span className="text-[11px] font-bold text-slate-500">
                ({multiColumnRows.length} حركة بتاريخ {selectedDate})
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              عمود مخصص للمقبوضات + أعمدة مستقلة لمصروفات كل فرع تتيح التدقيق الفوري والتوزيع المحاسبي الدقيق
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBranchSummary(!showBranchSummary)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              showBranchSummary 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Building2 size={14} />
            <span>{showBranchSummary ? 'إخفاء ملخص الأفرع' : 'عرض ملخص الأفرع'}</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={pdfLoading || multiColumnRows.length === 0}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <FileDown size={14} />
            <span>{pdfLoading ? 'جاري الإنشاء...' : 'تصدير PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={multiColumnRows.length === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet size={14} />
            <span>تصدير إكسيل</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={multiColumnRows.length === 0}
            className="px-4 py-2 bg-slate-950 hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <Printer size={14} />
            <span>طباعة اليومية الرسمية</span>
          </button>
        </div>
      </div>

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

      {/* Printable & Screen Container */}
      <div 
        id="printable-branch-journal" 
        className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden print:border-none print:shadow-none print:overflow-visible relative"
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
            #printable-branch-journal {
              font-size: 8pt;
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
              padding: 3.5px 5px !important;
              font-size: 7.5pt !important;
              line-height: 1.25 !important;
            }
            th {
              font-weight: 800 !important;
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
            }
            .print-receipt-col {
              background-color: #ecfdf5 !important;
              color: #065f46 !important;
              font-weight: 800 !important;
            }
            .print-branch-col {
              background-color: #ffffff !important;
              color: #0f172a !important;
            }
            .print-total-col {
              background-color: #fff1f2 !important;
              color: #9f1239 !important;
              font-weight: 800 !important;
            }
            .print-balance-col {
              background-color: #f8fafc !important;
              font-weight: 800 !important;
            }
            .print-totals-row {
              background-color: #0f172a !important;
              color: white !important;
              font-weight: 900 !important;
            }
            .print-totals-row td {
              border: 1px solid #0f172a !important;
            }
          }
        ` }} />

        {/* Official Header */}
        <div className="p-6 border-b border-slate-200">
          <PrintHeader
            documentTitleAr="دفتر اليومية التحليلية متعددة الأعمدة (المقبوضات ومصروفات الأفرع)"
            documentTitleEn="DAILY ANALYTICAL CASH JOURNAL (RECEIPTS & BRANCH EXPENSES)"
            documentNumber={`JRNL-BR-${selectedDate.replace(/-/g, '')}`}
            date={selectedDate}
            profile={companyProfile}
            showQRCode={printOptions.showQRCode}
            showLetterhead={printOptions.showLetterhead}
            qrPayload={JSON.stringify({
              org: companyProfile.companyNameAr,
              doc: 'اليومية التحليلية بالأفرع',
              date: selectedDate,
              in: totals.totalReceipts,
              out: totals.totalExpenses,
              net: totals.netBalance,
              rows: multiColumnRows.length
            })}
            extraMeta={[
              { label: 'تاريخ اليومية', value: selectedDate },
              { label: 'إجمالي المقبوضات (+)', value: `${formatKWD(totals.totalReceipts)} د.ك` },
              { label: 'إجمالي مصروفات الأفرع (-)', value: `${formatKWD(totals.totalExpenses)} د.ك` },
              { label: 'صافي حركة اليوم', value: `${formatKWD(totals.netBalance)} د.ك` }
            ]}
          />
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Receipts (المقبوضات) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-black uppercase">إجمالي المقبوضات (وارد +)</span>
                <TrendingUp size={18} />
              </div>
              <p className="text-2xl font-black text-emerald-800 font-mono">
                {formatKWD(totals.totalReceipts)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                مبيعات نقدية، تحصيلات، وتغذية عهد واردة
              </p>
            </div>

            {/* Card 2: Branch Expenses (المصروفات) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-xs font-black uppercase">إجمالي مصروفات الأفرع (-)</span>
                <TrendingDown size={18} />
              </div>
              <p className="text-2xl font-black text-rose-700 font-mono">
                {formatKWD(totals.totalExpenses)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                موزعة عبر {displayBranches.length} أفرع ومواقع تشغيلية
              </p>
            </div>

            {/* Card 3: Net Cash Flow (الصافي) */}
            <div className={`bg-white p-4 rounded-2xl border-2 shadow-xs ${
              totals.netBalance >= 0 ? 'border-blue-200' : 'border-amber-300'
            }`}>
              <div className="flex items-center justify-between text-slate-700 mb-1">
                <span className="text-xs font-black uppercase">صافي حركة النقدية لليوم</span>
                <Coins size={18} className={totals.netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'} />
              </div>
              <p className={`text-2xl font-black font-mono ${
                totals.netBalance >= 0 ? 'text-blue-700' : 'text-amber-700'
              }`}>
                {totals.netBalance >= 0 ? '+' : ''}{formatKWD(totals.netBalance)} <span className="text-xs font-bold font-sans">د.ك</span>
              </p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                {totals.netBalance >= 0 ? 'فائض نقدي موجب باليومية' : 'عجز / منصرف يتجاوز المقبوضات'}
              </p>
            </div>

            {/* Card 4: Operations Count */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-xs font-black uppercase">عدد العمليات المسجلة</span>
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 font-mono">
                {multiColumnRows.length} <span className="text-xs font-bold font-sans text-slate-300">حركة</span>
              </p>
              <p className="text-[11px] text-slate-400 font-bold mt-1">
                بيان يومي معتمد وموثق محاسبياً
              </p>
            </div>
          </div>
        </div>

        {/* Executive Branch Summary Matrix (Shown if active or printing) */}
        {showBranchSummary && branchBreakdown.length > 0 && (
          <div className="p-6 bg-white border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  ملخص توزيع المقبوضات والمصروفات حسب الأفرع ليوم {selectedDate}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                إجمالي الأفرع النشطة: {branchBreakdown.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-300">
                    <th className="py-2 px-3">الفرع / الموقع</th>
                    <th className="py-2 px-3 text-emerald-800 text-left">المقبوضات (+)</th>
                    <th className="py-2 px-3 text-rose-700 text-left">المصروفات (-)</th>
                    <th className="py-2 px-3 text-left">صافي التدفق المالي</th>
                    <th className="py-2 px-3 text-center">نسبة المنصرف</th>
                    <th className="py-2 px-3 text-center">عدد الحركات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {branchBreakdown.map((b, idx) => {
                    const net = b.receipts - b.expenses;
                    const pct = totals.totalExpenses > 0 ? ((b.expenses / totals.totalExpenses) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-black text-slate-900 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{b.name}</span>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-left">
                          {b.receipts > 0 ? `+${formatKWD(b.receipts)}` : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-700 text-left">
                          {b.expenses > 0 ? `-${formatKWD(b.expenses)}` : '-'}
                        </td>
                        <td className={`py-2 px-3 font-mono font-black text-left ${net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                          {net >= 0 ? '+' : ''}{formatKWD(net)} د.ك
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600 font-bold">
                          {pct}%
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">
                          {b.count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                    <td className="py-2 px-3 text-slate-900">إجمالي الأفرع</td>
                    <td className="py-2 px-3 font-mono text-emerald-800 text-left">
                      {formatKWD(totals.totalReceipts)} د.ك
                    </td>
                    <td className="py-2 px-3 font-mono text-rose-700 text-left">
                      {formatKWD(totals.totalExpenses)} د.ك
                    </td>
                    <td className={`py-2 px-3 font-mono text-left ${totals.netBalance >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>
                      {totals.netBalance >= 0 ? '+' : ''}{formatKWD(totals.netBalance)} د.ك
                    </td>
                    <td className="py-2 px-3 text-center font-mono">100%</td>
                    <td className="py-2 px-3 text-center font-mono">{multiColumnRows.length}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Main Multi-Column Table (الجدول التحليلي متعدد الأعمدة) */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900">
                جدول اليومية التحليلي التفصيلي (عمود المقبوضات + أعمدة الفروع)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {multiColumnRows.length} حركة مسجلة
            </span>
          </div>

          {multiColumnRows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-sm font-bold text-slate-700">لا توجد حركات مالية مسجلة لتاريخ {selectedDate}.</p>
              <p className="text-xs text-slate-400 mt-1">اختر تاريخاً آخر أو قم بتعديل فلاتر البحث.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                {/* Two-tier Table Header */}
                <thead>
                  {/* Top Tier Header */}
                  <tr className="bg-slate-200 text-slate-900 border-b border-slate-300 text-[11px] font-black">
                    <th colSpan={4} className="py-2 px-2.5 text-center bg-slate-200 border-r border-slate-300">
                      بيانات العملية والمصدر
                    </th>
                    <th className="py-2 px-3 text-center bg-emerald-100 text-emerald-950 border-r border-slate-300 font-black">
                      المقبوضات (+)
                    </th>
                    <th colSpan={displayBranches.length + 1} className="py-2 px-3 text-center bg-rose-100 text-rose-950 border-r border-slate-300 font-black">
                      المصروفات موزعة تبعاً للأفرع (-)
                    </th>
                    <th className="py-2 px-3 text-center bg-rose-200 text-rose-950 border-r border-slate-300 font-black">
                      إجمالي المنصرف
                    </th>
                    <th className="py-2 px-3 text-center bg-slate-200 border-r border-slate-300 font-black">
                      الأثر / الرصيد
                    </th>
                    <th className="py-2 px-2 text-center no-print w-14">
                      سند
                    </th>
                  </tr>

                  {/* Sub-Tier Column Names */}
                  <tr className="bg-slate-100 text-slate-800 border-b-2 border-slate-300 text-[10px] font-bold">
                    <th className="py-2 px-2 w-8 text-center">م</th>
                    <th className="py-2 px-2.5">المسؤول / الصندوق</th>
                    <th className="py-2 px-2.5">التصنيف</th>
                    <th className="py-2 px-3 max-w-xs">البيان والشرح</th>
                    
                    {/* Receipts Column */}
                    <th className="py-2 px-3 text-emerald-800 font-black text-left bg-emerald-50/70 border-r border-slate-300">
                      الوارد (د.ك)
                    </th>

                    {/* Branch Columns */}
                    {displayBranches.map(b => (
                      <th key={b} className="py-2 px-2.5 text-left font-bold text-slate-700 bg-slate-50/60 border-r border-slate-200 whitespace-nowrap">
                        {b}
                      </th>
                    ))}

                    {/* Other Branches Column */}
                    <th className="py-2 px-2 text-left font-bold text-slate-600 bg-slate-50/60 border-r border-slate-300 whitespace-nowrap">
                      أخرى / عام
                    </th>

                    {/* Total Outflow */}
                    <th className="py-2 px-3 text-rose-800 font-black text-left bg-rose-50/70 border-r border-slate-300">
                      المنصرف (د.ك)
                    </th>

                    {/* Running / Net Balance */}
                    <th className="py-2 px-3 text-slate-800 font-black text-left bg-slate-100/80">
                      الصافي (د.ك)
                    </th>

                    <th className="py-2 px-2 text-center no-print w-14">
                      إجراء
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-slate-200 bg-white">
                  {multiColumnRows.map(row => (
                    <tr key={row.index} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Index */}
                      <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10px]">{row.index}</td>

                      {/* 2. Employee / Custodian */}
                      <td className="py-2 px-2.5 font-black text-slate-950 whitespace-nowrap">
                        {row.employee}
                      </td>

                      {/* 3. Category */}
                      <td className="py-2 px-2.5 text-slate-700 font-bold whitespace-nowrap">
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                          {row.category}
                        </span>
                      </td>

                      {/* 4. Description */}
                      <td className="py-2 px-3 text-slate-800 max-w-xs leading-tight text-[11px]">
                        <span title={row.description}>{row.description}</span>
                        {row.originalBranch && (
                          <span className="block text-[9px] text-slate-600 font-semibold mt-0.5">
                            الفرع المدون: {row.originalBranch}
                          </span>
                        )}
                      </td>

                      {/* 5. Receipts Column (عمود المقبوضات) */}
                      <td className="py-2 px-3 font-mono font-black text-emerald-700 text-left bg-emerald-50/40 border-r border-slate-200 whitespace-nowrap">
                        {row.receiptAmount > 0 ? (
                          <span className="text-emerald-700 font-black">+{formatKWD(row.receiptAmount)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 6..N. Branch Expense Columns */}
                      {displayBranches.map(b => {
                        const amt = row.branchExpenses[b] || 0;
                        return (
                          <td 
                            key={b} 
                            className={`py-2 px-2.5 font-mono text-left border-r border-slate-200 whitespace-nowrap ${
                              amt > 0 ? 'font-black text-rose-700 bg-rose-50/30' : 'text-slate-300'
                            }`}
                          >
                            {amt > 0 ? formatKWD(amt) : '-'}
                          </td>
                        );
                      })}

                      {/* Other / Unassigned Branch Expense */}
                      <td className={`py-2 px-2 font-mono text-left border-r border-slate-200 whitespace-nowrap ${
                        row.otherBranchExpense > 0 ? 'font-black text-rose-700 bg-rose-50/30' : 'text-slate-300'
                      }`}>
                        {row.otherBranchExpense > 0 ? formatKWD(row.otherBranchExpense) : '-'}
                      </td>

                      {/* Total Expense for this row */}
                      <td className="py-2 px-3 font-mono font-black text-rose-700 text-left bg-rose-50/40 border-r border-slate-200 whitespace-nowrap">
                        {row.totalExpense > 0 ? `-${formatKWD(row.totalExpense)}` : '-'}
                      </td>

                      {/* Net impact of this row */}
                      <td className={`py-2 px-3 font-mono font-bold text-left whitespace-nowrap ${
                        row.netImpact > 0 ? 'text-emerald-700 font-black' : (row.netImpact < 0 ? 'text-rose-700' : 'text-slate-400')
                      }`}>
                        {row.netImpact !== 0 ? `${row.netImpact > 0 ? '+' : ''}${formatKWD(row.netImpact)}` : '0.000'}
                      </td>

                      {/* Action: Voucher */}
                      <td className="py-2 px-2 text-center no-print">
                        <button
                          onClick={() => handleOpenVoucher(row)}
                          className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
                          title="طباعة سند رسمي"
                        >
                          <Receipt size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Totals Row */}
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-xs print-totals-row">
                    <td colSpan={4} className="py-3 px-3 text-right">
                      الإجمالي العام لليومية ({multiColumnRows.length} حركة)
                    </td>

                    {/* Total Receipts */}
                    <td className="py-3 px-3 font-mono text-left text-emerald-300 bg-emerald-950/60 border-r border-slate-700 whitespace-nowrap">
                      +{formatKWD(totals.totalReceipts)} د.ك
                    </td>

                    {/* Branch Expense Column Totals */}
                    {displayBranches.map(b => (
                      <td key={b} className="py-3 px-2.5 font-mono text-left text-rose-300 border-r border-slate-800 whitespace-nowrap">
                        {totals.branchExpenseTotals[b] > 0 ? formatKWD(totals.branchExpenseTotals[b]) : '0.000'}
                      </td>
                    ))}

                    {/* Other Expense Total */}
                    <td className="py-3 px-2 font-mono text-left text-rose-300 border-r border-slate-800 whitespace-nowrap">
                      {totals.totalOtherExpense > 0 ? formatKWD(totals.totalOtherExpense) : '0.000'}
                    </td>

                    {/* Total Expenses Across All Branches */}
                    <td className="py-3 px-3 font-mono text-left text-rose-300 bg-rose-950/60 border-r border-slate-700 whitespace-nowrap text-sm">
                      -{formatKWD(totals.totalExpenses)} د.ك
                    </td>

                    {/* Net Day Movement */}
                    <td className={`py-3 px-3 font-mono text-left whitespace-nowrap text-sm ${
                      totals.netBalance >= 0 ? 'text-blue-300' : 'text-amber-300'
                    }`}>
                      {totals.netBalance >= 0 ? '+' : ''}{formatKWD(totals.netBalance)} د.ك
                    </td>

                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Executive Accounting Signatures Block */}
        <div className="p-6 border-t border-slate-200 break-inside-avoid">
          <PrintSignatures
            preparedBy="المحاسب المسؤول / أمين الصندوق"
            auditedBy="المراجع والمدقق الداخلي"
            approvedBy="المدير المالي والاعتماد"
            receivedBy="المعتمد بالتوقيع"
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
