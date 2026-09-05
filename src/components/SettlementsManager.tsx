import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, 
  Printer, 
  RefreshCw, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  ShieldCheck,
  Building,
  Sparkles,
  ArrowRightLeft,
  ShoppingBag,
  SlidersHorizontal,
  Download,
  Eye,
  FileText,
  Building2,
  Receipt,
  X,
  Loader2,
  TrendingUp,
  Gauge,
  FileDown,
  Check
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';
import VoucherModal, { VoucherData } from './VoucherModal';
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
import { 
  formatKWD, 
  parseReportRow, 
  isArabicSearchMatch, 
  isTransferType, 
  isIncomeType, 
  isExpenseType, 
  isAccrualType, 
  extractTransferParties, 
  matchBranch 
} from '../utils/format';

interface SettlementsManagerProps {
  balances: EmployeeBalance[];
  branches: string[];
  categories: string[];
  employees: string[];
  onRefresh: () => void;
}

type PrintMode = 'all' | 'summary' | 'transfers' | 'purchases' | 'branches';

export default function SettlementsManager({
  balances,
  branches,
  categories,
  employees,
  onRefresh
}: SettlementsManagerProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<string>(employees[0] || '');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [actualCashCount, setActualCashCount] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('شركة دار السلام للتجارة العامة والمقاولات');
  const [companyProfile, setCompanyProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [printOptions, setPrintOptions] = useState<PrintDisplayOptions>(getPrintDisplayOptions());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Print mode and visible sections toggle
  const [printMode, setPrintMode] = useState<PrintMode>('all');
  const [showBranchesSection, setShowBranchesSection] = useState(true);
  const [showTransfersSection, setShowTransfersSection] = useState(true);
  const [showPurchasesSection, setShowPurchasesSection] = useState(true);
  const [showSummaryTable, setShowSummaryTable] = useState(true);

  // Search & Filter States
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<'all' | 'cash' | 'accrual'>('all');
  const [transferSearch, setTransferSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(employees[0]);
    }
  }, [employees, selectedEmployee]);

  const loadEmployeeData = async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const data = await gasService.getReport({
        employee: selectedEmployee,
        startDate,
        endDate
      }, true);
      
      setReportRows(data?.rows || []);
    } catch (e) {
      console.error('Failed to load settlement data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeData();
    }
  }, [selectedEmployee, startDate, endDate]);

  // Current balance from employee balances list
  const currentEmployeeBalance = useMemo(() => {
    const found = balances.find(b => b.name === selectedEmployee);
    return found ? found.balance : 0;
  }, [balances, selectedEmployee]);

  // Categorize and compute deep settlement analytics
  const settlementStats = useMemo(() => {
    let totalFeeding = 0; // Total cash inflows / feeding
    let totalExpenses = 0; // Total cash expenses
    let expenseByCategory: { [cat: string]: number } = {};
    let expenseByBranch: { [branch: string]: { amount: number; count: number } } = {};
    
    // Transfers Analysis
    const incomingTransfers: Array<{
      date: string;
      fromWhom: string;
      description: string;
      amount: number;
      refNo: string;
      type: string;
    }> = [];

    const outgoingTransfers: Array<{
      date: string;
      toWhom: string;
      description: string;
      amount: number;
      refNo: string;
      type: string;
    }> = [];

    // Detailed Itemized Purchases / Expenses
    const purchasesList: Array<{
      index: number;
      date: string;
      branch: string;
      category: string;
      description: string;
      amount: number;
      isAccrual: boolean;
      type: string;
    }> = [];

    reportRows.forEach((rawRow, idx) => {
      const row = parseReportRow(rawRow);
      const date = row.date;
      const type = row.type;
      const cat = row.category;
      const desc = row.description;
      const inc = row.income;
      const exp = row.expense;
      const branch = row.branch || 'المركز الرئيسي';
      const emp = row.employee || selectedEmployee;
      
      const isSettlement = /سداد|تسوية/i.test(cat + " " + desc);
      const isAccrual = isSettlement ? false : isAccrualType(type, cat, desc);
      const isTransfer = isTransferType(type, cat, desc);

      // INCOMING CASH FLOWS (تغذية عهدة، استلام مبالغ، إيراد)
      if (inc > 0) {
        totalFeeding += inc;

        const { fromWhom } = extractTransferParties(desc, cat, selectedEmployee, true);

        incomingTransfers.push({
          date,
          fromWhom,
          description: desc && desc !== '-' ? desc : `تغذية عهدة نقدية للموظف ${emp}`,
          amount: inc,
          refNo: `TR-IN-${String(idx + 1).padStart(4, '0')}`,
          type: isTransfer ? 'تحويل وارد' : (cat.includes('مبيعات') ? 'إيراد نقدي' : 'تغذية عهدة')
        });
      }

      // OUTGOING EXPENSES & TRANSFERS (مصروفات، مشتريات، تحويلات صادرة)
      if (exp > 0) {
        totalExpenses += exp;

        if (isTransfer) {
          // Outflow transfer to another employee/branch or back to treasury
          const { toWhom } = extractTransferParties(desc, cat, selectedEmployee, false);

          outgoingTransfers.push({
            date,
            toWhom,
            description: desc && desc !== '-' ? desc : `تحويل عهدة صادر إلى ${toWhom}`,
            amount: exp,
            refNo: `TR-OUT-${String(idx + 1).padStart(4, '0')}`,
            type: 'تحويل صادر'
          });
        } else {
          // Group by category
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp;

          // Group by branch
          if (!expenseByBranch[branch]) {
            expenseByBranch[branch] = { amount: 0, count: 0 };
          }
          expenseByBranch[branch].amount += exp;
          expenseByBranch[branch].count += 1;

          // Regular purchase / operating expense item
          purchasesList.push({
            index: idx + 1,
            date,
            branch,
            category: cat,
            description: desc,
            amount: exp,
            isAccrual,
            type
          });
        }
      }
    });

    const calculatedBookBalance = currentEmployeeBalance;
    const actualCash = parseFloat(actualCashCount) || 0;
    const variance = actualCashCount !== '' ? actualCash - calculatedBookBalance : 0;

    const totalIncomingTransfers = incomingTransfers.reduce((acc, t) => acc + t.amount, 0);
    const totalOutgoingTransfers = outgoingTransfers.reduce((acc, t) => acc + t.amount, 0);
    const totalItemizedPurchases = purchasesList.reduce((acc, p) => acc + p.amount, 0);

    return {
      totalFeeding,
      totalExpenses,
      expenseByCategory,
      expenseByBranch,
      incomingTransfers,
      outgoingTransfers,
      totalIncomingTransfers,
      totalOutgoingTransfers,
      purchasesList,
      totalItemizedPurchases,
      calculatedBookBalance,
      actualCash,
      variance,
      hasCount: actualCashCount !== '',
      expenseCount: purchasesList.length + outgoingTransfers.length
    };
  }, [reportRows, currentEmployeeBalance, actualCashCount, selectedEmployee]);

  // Smooth Filtered purchases list
  const filteredPurchases = useMemo(() => {
    return settlementStats.purchasesList.filter(p => {
      if (selectedBranchFilter !== 'all' && !matchBranch(p.branch, selectedBranchFilter)) return false;
      if (purchaseTypeFilter === 'cash' && p.isAccrual) return false;
      if (purchaseTypeFilter === 'accrual' && !p.isAccrual) return false;
      if (purchaseSearch.trim()) {
        const matches = isArabicSearchMatch(
          purchaseSearch,
          p.description,
          p.category,
          p.branch,
          p.date,
          p.amount,
          p.index
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [settlementStats.purchasesList, selectedBranchFilter, purchaseTypeFilter, purchaseSearch]);

  // Smooth Filtered incoming transfers
  const filteredIncomingTransfers = useMemo(() => {
    return settlementStats.incomingTransfers.filter(t => {
      if (transferSearch.trim()) {
        return isArabicSearchMatch(transferSearch, t.fromWhom, t.description, t.date, t.amount, t.refNo, t.type);
      }
      return true;
    });
  }, [settlementStats.incomingTransfers, transferSearch]);

  // Smooth Filtered outgoing transfers
  const filteredOutgoingTransfers = useMemo(() => {
    return settlementStats.outgoingTransfers.filter(t => {
      if (transferSearch.trim()) {
        return isArabicSearchMatch(transferSearch, t.toWhom, t.description, t.date, t.amount, t.refNo, t.type);
      }
      return true;
    });
  }, [settlementStats.outgoingTransfers, transferSearch]);

  // Overall Inventory & Audit Reconciliation Progress for Selected Custody
  const auditProgress = useMemo(() => {
    let score = 0;
    
    // Step 1: Physical cash count input (30%)
    const hasCount = settlementStats.hasCount;
    // Step 2: Variance & Balance Reconciliation (30%)
    const isExactMatch = hasCount && Math.abs(settlementStats.variance) < 0.001;
    const hasVariance = hasCount && Math.abs(settlementStats.variance) >= 0.001;
    // Step 3: Audit of Invoices & Transfers (25%)
    const hasTransactions = reportRows.length > 0 || settlementStats.totalExpenses > 0 || settlementStats.calculatedBookBalance === 0;
    // Step 4: Management decision & notes (15%)
    const hasNotes = settlementNotes.trim().length > 0;

    if (hasCount) score += 30;
    if (isExactMatch) score += 30;
    else if (hasVariance) score += 15; // Partial score for recording count with noted variance
    if (hasTransactions) score += 25;
    if (hasNotes) score += 15;

    const percentage = Math.min(100, score);

    // Custody Utilization / Liquidation Rate (المصروفات المنفذة مقابل إجمالي العهدة المتاحة)
    const totalInflow = settlementStats.totalFeeding > 0 
      ? settlementStats.totalFeeding 
      : (settlementStats.totalExpenses + Math.max(0, settlementStats.calculatedBookBalance));
    
    const liquidationRate = totalInflow > 0 
      ? Math.min(100, Math.round((settlementStats.totalExpenses / totalInflow) * 100)) 
      : 0;

    const steps = [
      {
        id: 'count',
        title: 'إدخال الجرد الفعلي للنقد',
        weight: 30,
        completed: hasCount,
        detail: hasCount ? `${settlementStats.actualCash.toFixed(3)} د.ك` : 'بانتظار الإدخال',
        statusLabel: hasCount ? 'تم الإدخال' : 'مطلوب'
      },
      {
        id: 'variance',
        title: 'مطابقة الرصيد وتصفير الفروق',
        weight: 30,
        completed: isExactMatch,
        partial: hasVariance,
        detail: !hasCount
          ? 'بانتظار الجرد الفعلي'
          : isExactMatch
          ? 'مطابقة تامة 100% (0.000 د.ك)'
          : settlementStats.variance < 0
          ? `عجز: ${Math.abs(settlementStats.variance).toFixed(3)} د.ك`
          : `زيادة: ${settlementStats.variance.toFixed(3)} د.ك`,
        statusLabel: !hasCount ? 'معلق' : isExactMatch ? 'مطابق ✅' : 'يوجد فرق ⚠️'
      },
      {
        id: 'invoices',
        title: 'تدقيق المشتريات والتحويلات',
        weight: 25,
        completed: hasTransactions,
        detail: `${settlementStats.purchasesList.length} مشتريات • ${settlementStats.incomingTransfers.length + settlementStats.outgoingTransfers.length} تحويلات`,
        statusLabel: 'تم الفحص'
      },
      {
        id: 'notes',
        title: 'اعتماد وقرار الإدارة المالية',
        weight: 15,
        completed: hasNotes,
        detail: hasNotes ? 'تم تسجيل القرار' : 'اختياري للاعتماد',
        statusLabel: hasNotes ? 'معتمد' : 'اختياري'
      }
    ];

    let statusTheme = {
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'from-rose-500 via-amber-500 to-emerald-500',
      progressBg: 'bg-rose-500',
      label: 'بانتظار إدخال الجرد الفعلي للنقد',
      ring: 'text-rose-500'
    };

    if (percentage === 100) {
      statusTheme = {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        bar: 'from-emerald-500 to-teal-500',
        progressBg: 'bg-emerald-600',
        label: 'مكتمل ومطابق 100% - جاهز للاعتماد والمصادقة',
        ring: 'text-emerald-600'
      };
    } else if (percentage >= 70) {
      statusTheme = {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        bar: 'from-blue-500 to-emerald-500',
        progressBg: 'bg-blue-600',
        label: 'شبه مكتمل - بانتظار الاعتماد النهائي',
        ring: 'text-blue-600'
      };
    } else if (percentage >= 40) {
      statusTheme = {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        bar: 'from-amber-500 to-yellow-500',
        progressBg: 'bg-amber-500',
        label: 'قيد التدقيق ومراجعة الفروق النقدية',
        ring: 'text-amber-500'
      };
    }

    return {
      percentage,
      steps,
      statusTheme,
      liquidationRate,
      totalInflow
    };
  }, [settlementStats, reportRows, settlementNotes]);

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExportPDF = async () => {
    const el = document.getElementById('printable-settlement-report');
    if (!el) {
      alert('لم يتم العثور على محضر الجرد والتصفية للتحميل');
      return;
    }

    setPdfLoading(true);
    try {
      const cleanEmp = (selectedEmployee || 'عام').replace(/[/\\?%*:|"<>]/g, '_');
      const filename = `محضر_جرد_وتصفية_عهدة_${cleanEmp}_${startDate}_${endDate}.pdf`;
      await exportElementToPDF(el, {
        filename,
        orientation: 'portrait',
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error generating Settlement PDF:', err);
      if (window.confirm('تعذر التحميل المباشر لملف PDF. هل تود فتح نافذة الطباعة للحفظ بصيغة PDF فوراً؟')) {
        window.print();
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = (mode: PrintMode = 'all') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const exportSettlementCSV = () => {
    const headers = ['م', 'التاريخ', 'الفرع المستفيد', 'التصنيف المحاسبي', 'البيان وتفاصيل الفاتورة / المورد', 'المبلغ (د.ك)', 'النوع'];
    const rows = settlementStats.purchasesList.map((p, i) => [
      i + 1,
      `"${p.date}"`,
      `"${p.branch}"`,
      `"${p.category}"`,
      `"${p.description.replace(/"/g, '""')}"`,
      p.amount.toFixed(3),
      `"${p.isAccrual ? 'آجل / مستحق' : 'نقداً من العهدة'}"`
    ]);

    const csvContent = '\uFEFF' + [
      `"محضر جرد وتصفية عهدة: ${selectedEmployee}"`,
      `"الفترة: من ${startDate} إلى ${endDate}"`,
      `"الرصيد الدفتري: ${settlementStats.calculatedBookBalance.toFixed(3)} د.ك"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Settlement_${selectedEmployee}_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Banner - Hidden on print */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
            <FileCheck2 size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                قسم الرقابة والتدقيق المالي الشامل
              </span>
              <span className="text-xs text-slate-400 font-bold">• تدقيق الفروع والتحويلات والمشتريات</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">محاضر جرد وتصفية وتسوية العهدة النقدية</h1>
            <p className="text-xs text-slate-300 font-bold mt-1">
              تقرير جرد تفصيلي معتمد: توزيع المصروفات بالفروع، كشف تحويلات العهد (لمن ومن أين)، وسجل تفصيلي للمشتريات
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            onClick={() => {
              loadEmployeeData();
              onRefresh();
            }}
            disabled={loading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl border border-slate-600 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={exportSettlementCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl border border-slate-600 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>تصدير Excel</span>
          </button>

          {/* Dedicated PDF Export Button */}
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-60"
            title="تصدير محضر الجرد والتصفية بصيغة PDF معتمدة ومطورة للطباعة"
          >
            {pdfLoading ? (
              <Loader2 size={14} className="animate-spin text-white" />
            ) : (
              <FileDown size={14} />
            )}
            <span>{pdfLoading ? 'جاري تجهيز PDF...' : 'تصدير PDF'}</span>
          </button>

          {/* Quick Print Menu */}
          <div className="flex items-center gap-1 bg-emerald-600 rounded-xl p-1 shadow-lg shadow-emerald-600/20">
            <button
              onClick={() => handlePrint('all')}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-xs font-black rounded-lg transition-all cursor-pointer"
              title="طباعة التقرير الشامل بكل الملاحق"
            >
              <Printer size={15} />
              <span>طباعة المحضر الشامل</span>
            </button>
            <button
              onClick={() => handlePrint('summary')}
              className="px-2 py-1.5 text-[11px] font-black text-emerald-100 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-all"
              title="طباعة الملخص التنفيذي صفحة واحدة"
            >
              ملخص صفحة واحدة
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Control Bar - Hidden on print */}
      <div className="no-print bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Employee Selector */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">الموظف المسؤول عن العهدة</label>
            <div className="relative">
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">من تاريخ</label>
            <div className="relative">
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">إلى تاريخ</label>
            <div className="relative">
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Actual Cash Count Input */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">
              الجرد الفعلي (النقد الموجود بالخزينة)
            </label>
            <div className="relative">
              <DollarSign className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
              <input
                type="number"
                step="0.001"
                placeholder="أدخل النقد الفعلي (د.ك)"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(e.target.value)}
                className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl pr-10 pl-4 py-2 text-xs text-emerald-900 font-black focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Company Name & Settlement Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">اسم المنشأة في الترويسة المطبوعة</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-black text-slate-700 mb-1.5">قرار وملاحظات رئيس الحسابات والمدير المالي</label>
            <input
              type="text"
              placeholder="مثال: تم تدقيق كافة الفواتير ومطابقتها مع السندات الأصلية وإبراء ذمة الموظف عن الفترة المذكورة."
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Section Visibility Toggles (Custom Printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="font-black text-slate-600 flex items-center gap-1.5">
            <SlidersHorizontal size={14} className="text-emerald-600" />
            <span>تخصيص أقسام وملاحق محضر الجرد:</span>
          </span>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBranchesSection}
                onChange={(e) => setShowBranchesSection(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="font-bold text-slate-700">تحليل الفروع ومراكز التكلفة</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTransfersSection}
                onChange={(e) => setShowTransfersSection(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="font-bold text-slate-700">كشف حركة التحويلات (لمن ومن أين)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPurchasesSection}
                onChange={(e) => setShowPurchasesSection(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="font-bold text-slate-700">سجل الفواتير والمشتريات التفصيلي</span>
            </label>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INVENTORY & RECONCILIATION PROGRESS BAR SECTION (شريط تقدم ونسبة استكمال الجرد) */}
      {/* ========================================================================= */}
      <div className="no-print bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <Gauge size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-slate-900">مؤشر ونسبة استكمال جرد وتصفية العهدة</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${auditProgress.statusTheme.badge}`}>
                  {auditProgress.statusTheme.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                عهدة الموظف: <span className="text-slate-900 font-black">{selectedEmployee || '—'}</span> • الرصيد الدفتري المستحق: <span className="font-mono text-emerald-700 font-black">{settlementStats.calculatedBookBalance.toFixed(3)} د.ك</span>
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 self-start sm:self-auto shadow-2xs">
            <span className="text-xs text-slate-500 font-black">نسبة إنجاز الجرد والمطابقة:</span>
            <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
              {auditProgress.percentage}%
            </span>
          </div>
        </div>

        {/* Dynamic Multi-Step Visual Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${auditProgress.statusTheme.bar}`}
              style={{ width: `${Math.max(4, auditProgress.percentage)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
            <span>0% بدء الجرد</span>
            <span>25% فحص الحركات</span>
            <span>50% إدخال النقد الفعلي</span>
            <span>75% تصفير الفروق</span>
            <span className="text-emerald-700 font-black">100% اعتماد ومصادقة نهائية</span>
          </div>
        </div>

        {/* Step-by-Step Progress Milestone Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {auditProgress.steps.map((step, sIdx) => {
            const isDone = step.completed;
            const isPart = (step as any).partial;
            return (
              <div
                key={step.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : isPart
                    ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs font-mono">
                    المرحلة {sIdx + 1} ({step.weight}%)
                  </span>
                  {isDone ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700">
                      <CheckCircle2 size={13} />
                      <span>{step.statusLabel}</span>
                    </span>
                  ) : isPart ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-700">
                      <AlertTriangle size={13} />
                      <span>{step.statusLabel}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">
                      {step.statusLabel}
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-slate-900">{step.title}</h4>
                <p className="text-[11px] font-bold text-slate-600 mt-1 truncate font-mono">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>

        {/* Secondary Metric: Liquidation Rate vs Custody & Quick Employee Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp size={16} />
            </div>
            <div>
              <span className="font-black text-slate-700">نسبة تصفية العهدة بالفواتير والمصروفات: </span>
              <span className="font-mono font-black text-blue-700 text-sm">{auditProgress.liquidationRate}%</span>
              <span className="text-slate-400 text-[11px] mr-1">
                (تم صرف {settlementStats.totalExpenses.toFixed(3)} د.ك من أصل {auditProgress.totalInflow.toFixed(3)} د.ك)
              </span>
            </div>
          </div>

          {/* Quick Custody Switcher Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black text-slate-500 ml-1">التبديل السريع بين العهد:</span>
            {balances.slice(0, 6).map(b => (
              <button
                key={b.name}
                onClick={() => setSelectedEmployee(b.name)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer border ${
                  selectedEmployee === b.name
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {b.name} ({b.balance.toFixed(0)} د.ك)
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards - High Level Financial Metrics (Hidden on print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">إجمالي الفواتير والمصروفات</p>
            <p className="text-xl font-black text-rose-600 mt-1 font-mono">
              {settlementStats.totalExpenses.toFixed(3)} <span className="text-xs">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {settlementStats.purchasesList.length} مشتريات • {settlementStats.outgoingTransfers.length} تحويلات صادرة
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <ArrowDownLeft size={22} />
          </div>
        </div>

        {/* Total Inflows / Feedings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">إجمالي التغذيات المستلمة</p>
            <p className="text-xl font-black text-emerald-600 mt-1 font-mono">
              {settlementStats.totalFeeding.toFixed(3)} <span className="text-xs">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {settlementStats.incomingTransfers.length} حركات استلام وتغذية
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* Book Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">الرصيد الدفتري الحالي</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">
              {settlementStats.calculatedBookBalance.toFixed(3)} <span className="text-xs">د.ك</span>
            </p>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">المستحق بالعهدة</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
            <ClipboardList size={22} />
          </div>
        </div>

        {/* Variance Status */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
          !settlementStats.hasCount 
            ? 'bg-slate-50 border-slate-200' 
            : Math.abs(settlementStats.variance) < 0.001 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : settlementStats.variance < 0 
                ? 'bg-rose-50 border-rose-200' 
                : 'bg-amber-50 border-amber-200'
        }`}>
          <div>
            <p className="text-[11px] font-black text-slate-600">نتيجة الجرد والمطابقة</p>
            {!settlementStats.hasCount ? (
              <p className="text-sm font-black text-slate-500 mt-1">بانتظار إدخال الجرد الفعلي</p>
            ) : Math.abs(settlementStats.variance) < 0.001 ? (
              <div>
                <p className="text-lg font-black text-emerald-700 mt-0.5">مطابقة تامة 100% ✅</p>
                <p className="text-[10px] text-emerald-600 font-bold">لا توجد أي فروق نقدية</p>
              </div>
            ) : settlementStats.variance < 0 ? (
              <div>
                <p className="text-lg font-black text-rose-700 mt-0.5 font-mono">
                  عجز نقدي: {Math.abs(settlementStats.variance).toFixed(3)} د.ك
                </p>
                <p className="text-[10px] text-rose-600 font-bold">النقد الفعلي أقل من الدفتري</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-black text-amber-700 mt-0.5 font-mono">
                  زيادة نقدية: {settlementStats.variance.toFixed(3)} د.ك
                </p>
                <p className="text-[10px] text-amber-600 font-bold">النقد الفعلي أكثر من الدفتري</p>
              </div>
            )}
          </div>
          <div className="p-3 rounded-2xl bg-white/80 shadow-sm">
            {!settlementStats.hasCount ? (
              <DollarSign size={22} className="text-slate-400" />
            ) : Math.abs(settlementStats.variance) < 0.001 ? (
              <CheckCircle2 size={22} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={22} className={settlementStats.variance < 0 ? 'text-rose-600' : 'text-amber-600'} />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OFFICIAL SETTLEMENT FORM - HIGH PRECISION PRINTABLE & PREVIEW CONTAINER */}
      {/* ========================================================================= */}
      <div className="no-print mb-4">
        <PrintToolbar
          options={printOptions}
          onChangeOptions={setPrintOptions}
          onPrint={() => handlePrint('all')}
          onExportPDF={handleExportPDF}
          pdfLoading={pdfLoading}
          onOpenSettings={() => setIsSettingsOpen(true)}
          allowThermal={false}
        />
      </div>

      <div id="printable-settlement-report" className="bg-white rounded-3xl border border-slate-200 shadow-md p-8 sm:p-12 print:border-none print:shadow-none print:p-2 space-y-8 relative">
        <PrintWatermark type={printOptions.watermark} />
        
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body.voucher-modal-active #printable-settlement-report,
            body.order-invoice-active #printable-settlement-report {
              display: none !important;
            }
            @page {
              margin: ${printOptions.margins === 'narrow' ? '8mm' : printOptions.margins === 'wide' ? '20mm' : '12mm'};
              size: ${printOptions.paperSize === 'A4-landscape' ? 'A4 landscape' : printOptions.paperSize === 'A5' ? 'A5' : 'A4 portrait'};
            }
            #printable-settlement-report {
              font-size: ${printOptions.fontSize === 'compact' ? '11px' : printOptions.fontSize === 'large' ? '14px' : '12.5px'};
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: white !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        ` }} />
        
        {/* Official Letterhead Header */}
        <PrintHeader
          documentTitleAr="محضر جرد وتصفية وتسوية عهدة نقدية"
          documentTitleEn="PETTY CASH RECONCILIATION & AUDIT STATEMENT"
          documentNumber={`SET-${Date.now().toString().slice(-6)}`}
          date={new Date().toISOString().split('T')[0]}
          profile={companyProfile}
          showQRCode={printOptions.showQRCode}
          showLetterhead={printOptions.showLetterhead}
          qrPayload={JSON.stringify({
            org: companyProfile.companyNameAr,
            doc: 'SETTLEMENT',
            emp: selectedEmployee,
            dt1: startDate,
            dt2: endDate,
            book: settlementStats.calculatedBookBalance,
            act: settlementStats.actualCash
          })}
          extraMeta={[
            { label: 'أمين ومسؤول العهدة', value: selectedEmployee || 'كافة العهد' },
            { label: 'فترة الجرد والتدقيق', value: `من ${startDate} إلى ${endDate}` },
            { label: 'الرصيد الدفتري المتبقي', value: `${settlementStats.calculatedBookBalance.toFixed(3)} د.ك` },
            { label: 'حالة المطابقة', value: settlementStats.hasCount ? (Math.abs(settlementStats.variance) < 0.001 ? 'مطابق تماماً' : settlementStats.variance < 0 ? 'يوجد عجز' : 'يوجد فائض') : 'جرد معلق' }
          ]}
        />

        {/* Basic Settlement Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="block text-slate-400 font-black">أمين ومسؤول العهدة:</span>
            <span className="font-black text-slate-900 text-sm">{selectedEmployee || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-black">فترة التسوية والجرد:</span>
            <span className="font-bold text-slate-900 font-mono">{startDate} إلى {endDate}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-black">حالة التدقيق:</span>
            <span className="font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md inline-block mt-0.5">
              جاهز للاعتماد والمصادقة
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-black">الإدارة المسؤولة:</span>
            <span className="font-black text-slate-900">إدارة الحسابات والرقابة المالية</span>
          </div>
        </div>

        {/* SECTION 1: Category Breakdown Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Layers size={17} className="text-emerald-600" />
              <span>أولاً: ملخص المصروفات حسب التصنيف المحاسبي</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500 font-mono no-print">
              إجمالي: {settlementStats.totalExpenses.toFixed(3)} د.ك
            </span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12">#</th>
                  <th className="p-3">بند / تصنيف المصروف</th>
                  <th className="p-3 text-left w-36">المبلغ المصروف (د.ك)</th>
                  <th className="p-3 text-left w-28">النسبة المئوية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                {Object.entries(settlementStats.expenseByCategory).map(([cat, amtVal], idx) => {
                  const amt = typeof amtVal === 'number' ? amtVal : parseFloat(String(amtVal)) || 0;
                  const pct = settlementStats.totalExpenses > 0 ? (amt / settlementStats.totalExpenses) * 100 : 0;
                  return (
                    <tr key={cat} className="hover:bg-slate-50/60">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-black text-slate-900">{cat}</td>
                      <td className="p-3 text-left font-mono font-black text-rose-600">{amt.toFixed(3)}</td>
                      <td className="p-3 text-left font-mono text-slate-500">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {Object.keys(settlementStats.expenseByCategory).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      لا توجد فواتير أو مصروفات مسجلة خلال الفترة المحددة
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-slate-900">
                <tr>
                  <td colSpan={2} className="p-3 font-black">إجمالي المصروفات المقبولة دفترياً:</td>
                  <td className="p-3 text-left font-mono text-sm text-rose-600 font-black">
                    {settlementStats.totalExpenses.toFixed(3)} د.ك
                  </td>
                  <td className="p-3 text-left font-mono">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* SECTION 2: Branch-by-Branch Breakdown (أي فرع) */}
        {(showBranchesSection || printMode === 'branches' || printMode === 'all') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building size={17} className="text-blue-600" />
                <span>ثانياً: توزيع المصروفات والمشتريات على الفروع ومراكز التكلفة (أي فرع)</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500 font-mono no-print">
                {Object.keys(settlementStats.expenseByBranch).length} فروع مستفيدة
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-blue-50/80 text-blue-950 font-black border-b border-blue-100">
                  <tr>
                    <th className="p-3 w-12">#</th>
                    <th className="p-3">الفرع المستفيد / مركز التكلفة</th>
                    <th className="p-3 text-center w-28">عدد الفواتير</th>
                    <th className="p-3 text-left w-36">إجمالي المنصرف (د.ك)</th>
                    <th className="p-3 text-left w-28">نسبة الفرع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                  {(Object.entries(settlementStats.expenseByBranch) as [string, { amount: number; count: number }][]).map(([brName, data], idx) => {
                    const pct = settlementStats.totalExpenses > 0 ? (data.amount / settlementStats.totalExpenses) * 100 : 0;
                    return (
                      <tr key={brName} className="hover:bg-slate-50/60">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-black text-slate-900 flex items-center gap-2">
                          <Building size={14} className="text-blue-500" />
                          <span>{brName}</span>
                        </td>
                        <td className="p-3 text-center font-mono">{data.count} فاتورة</td>
                        <td className="p-3 text-left font-mono font-black text-rose-600">{data.amount.toFixed(3)}</td>
                        <td className="p-3 text-left font-mono text-slate-500">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {Object.keys(settlementStats.expenseByBranch).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        لا توجد مصروفات مسجلة على أي فرع في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-slate-900">
                  <tr>
                    <td colSpan={3} className="p-3 font-black">إجمالي المصروفات الموزعة على الفروع:</td>
                    <td className="p-3 text-left font-mono text-sm text-rose-600 font-black">
                      {settlementStats.totalExpenses.toFixed(3)} د.ك
                    </td>
                    <td className="p-3 text-left font-mono">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 3: Transfers Analysis (التحويلات تمت لمين ومن أين) */}
        {(showTransfersSection || printMode === 'transfers' || printMode === 'all') && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
              <div>
                <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-indigo-600" />
                  <span>ثالثاً: كشف حركة تحويلات وتغذيات العهد النقدية تفصيلياً (تمت لمين ومن أين)</span>
                </h3>
                <p className="text-[11px] text-indigo-700 font-bold mt-0.5">
                  حصر دقيق لكافة مبالغ التغذية المستلمة والتحويلات الصادرة لزملاء أو فروع أخرى
                </p>
              </div>

              {/* Transfer Search Input */}
              <div className="no-print flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                  <input
                    type="text"
                    placeholder="بحث في التحويلات (اسم، جهة، بيان)..."
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                    className="w-56 sm:w-64 bg-white border border-indigo-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  {transferSearch && (
                    <button
                      onClick={() => setTransferSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <span className="text-[11px] font-bold text-indigo-900 font-mono bg-indigo-100/70 px-2.5 py-1 rounded-lg">
                  {filteredIncomingTransfers.length + filteredOutgoingTransfers.length} حركة
                </span>
              </div>
            </div>

            {/* Inflow vs Outflow Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Incoming Feedings (من من استلم) */}
              <div className="border border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center justify-between text-xs font-black text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight size={16} className="text-emerald-600" />
                    <span>تغذية العهدة والتحويلات الواردة (استلام من مين)</span>
                  </span>
                  <span className="font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded text-xs">
                    {filteredIncomingTransfers.reduce((acc, t) => acc + t.amount, 0).toFixed(3)} د.ك
                  </span>
                </div>
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-100">
                    <tr>
                      <th className="p-2.5 w-24">التاريخ</th>
                      <th className="p-2.5 w-36">المستلم منه (من مين)</th>
                      <th className="p-2.5">البيان والتفاصيل</th>
                      <th className="p-2.5 text-left w-24">المبلغ (د.ك)</th>
                      <th className="p-2.5 text-center w-12 no-print">سند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {filteredIncomingTransfers.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{t.date}</td>
                        <td className="p-2.5 font-black text-emerald-950 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>{t.fromWhom}</span>
                        </td>
                        <td className="p-2.5 text-slate-600 text-[11px]">
                          <div>{t.description}</div>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono mt-0.5 inline-block">
                            {t.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-left font-mono font-black text-emerald-600">{t.amount.toFixed(3)}</td>
                        <td className="p-2.5 text-center no-print">
                          <button
                            onClick={() => {
                              setActiveVoucher({
                                voucherNo: `TR-IN-${t.date.replace(/-/g, '')}-${idx + 1}`,
                                voucherType: 'Transfer',
                                date: t.date,
                                amount: t.amount,
                                beneficiary: selectedEmployee,
                                payer: t.fromWhom,
                                employee: selectedEmployee,
                                category: 'تغذية وتحويل عهدة',
                                description: `استلام تغذية عهدة نقدية: ${t.description || 'من ' + t.fromWhom}`,
                                paymentMethod: 'Cash'
                              });
                              setIsVoucherModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                            title="طباعة سند استلام عهدة"
                          >
                            <Printer size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredIncomingTransfers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          {transferSearch ? 'لا توجد تغذيات مطابقة لنص البحث' : 'لا توجد تغذيات مستلمة في هذه الفترة'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t border-slate-100 text-slate-900">
                    <tr>
                      <td colSpan={3} className="p-2.5">إجمالي الوارد:</td>
                      <td className="p-2.5 text-left font-mono text-emerald-600">
                        {filteredIncomingTransfers.reduce((acc, t) => acc + t.amount, 0).toFixed(3)} د.ك
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Outgoing Transfers (لمن تم التحويل) */}
              <div className="border border-rose-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-rose-50 p-3 border-b border-rose-100 flex items-center justify-between text-xs font-black text-rose-900">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft size={16} className="text-rose-600" />
                    <span>تحويلات صادرة من العهدة (تم التحويل لمين)</span>
                  </span>
                  <span className="font-mono text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded text-xs">
                    {filteredOutgoingTransfers.reduce((acc, t) => acc + t.amount, 0).toFixed(3)} د.ك
                  </span>
                </div>
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-100">
                    <tr>
                      <th className="p-2.5 w-24">التاريخ</th>
                      <th className="p-2.5 w-36">المحول إليه (لمين)</th>
                      <th className="p-2.5">البيان والتفاصيل</th>
                      <th className="p-2.5 text-left w-24">المبلغ (د.ك)</th>
                      <th className="p-2.5 text-center w-12 no-print">سند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {filteredOutgoingTransfers.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{t.date}</td>
                        <td className="p-2.5 font-black text-rose-950 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          <span>{t.toWhom}</span>
                        </td>
                        <td className="p-2.5 text-slate-600 text-[11px]">
                          <div>{t.description}</div>
                          <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-mono mt-0.5 inline-block">
                            {t.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-left font-mono font-black text-rose-600">{t.amount.toFixed(3)}</td>
                        <td className="p-2.5 text-center no-print">
                          <button
                            onClick={() => {
                              setActiveVoucher({
                                voucherNo: `TR-OUT-${t.date.replace(/-/g, '')}-${idx + 1}`,
                                voucherType: 'Transfer',
                                date: t.date,
                                amount: t.amount,
                                beneficiary: t.toWhom,
                                payer: selectedEmployee,
                                employee: selectedEmployee,
                                category: 'تحويل وتسليم عهدة',
                                description: `تحويل عهدة نقدية إلى ${t.toWhom}: ${t.description || ''}`,
                                paymentMethod: 'Cash'
                              });
                              setIsVoucherModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="طباعة سند تحويل وتسليم عهدة"
                          >
                            <Printer size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOutgoingTransfers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          {transferSearch ? 'لا توجد تحويلات مطابقة لنص البحث' : 'لا توجد تحويلات صادرة لأشخاص آخرين'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t border-slate-100 text-slate-900">
                    <tr>
                      <td colSpan={3} className="p-2.5">إجمالي المنصرف كتحويلات:</td>
                      <td className="p-2.5 text-left font-mono text-rose-600">
                        {filteredOutgoingTransfers.reduce((acc, t) => acc + t.amount, 0).toFixed(3)} د.ك
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: Itemized Purchases & Invoices Schedule (تفاصيل المشتريات) */}
        {(showPurchasesSection || printMode === 'purchases' || printMode === 'all') && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
              <div>
                <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-amber-600" />
                  <span>رابعاً: سجل فواتير المشتريات والمصروفات التشغيلية تفصيلياً</span>
                </h3>
                <p className="text-[11px] text-amber-800 font-bold mt-0.5">
                  عرض {filteredPurchases.length} فاتورة من إجمالي {settlementStats.purchasesList.length} فاتورة مسجلة
                </p>
              </div>

              {/* In-table filters for view mode */}
              <div className="no-print flex flex-wrap items-center gap-2">
                {/* Search Bar with Reset */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="بحث فوري في المشتريات..."
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    className="w-48 sm:w-56 bg-white border border-slate-200 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-amber-500 shadow-sm"
                  />
                  {purchaseSearch && (
                    <button
                      onClick={() => setPurchaseSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Type Filter Buttons */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm text-xs font-bold">
                  <button
                    onClick={() => setPurchaseTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      purchaseTypeFilter === 'all' ? 'bg-amber-500 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الكل ({settlementStats.purchasesList.length})
                  </button>
                  <button
                    onClick={() => setPurchaseTypeFilter('cash')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      purchaseTypeFilter === 'cash' ? 'bg-amber-500 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نقدي مسدد
                  </button>
                  <button
                    onClick={() => setPurchaseTypeFilter('accrual')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      purchaseTypeFilter === 'accrual' ? 'bg-amber-500 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    آجل / موردين
                  </button>
                </div>

                {/* Branch Selector */}
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-amber-500 shadow-sm cursor-pointer"
                >
                  <option value="all">كافة الفروع المستفيدة</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto print:max-h-none shadow-sm">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/90 text-slate-800 font-black border-b border-slate-200 sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="p-2.5 w-12 text-center">م</th>
                    <th className="p-2.5 w-24">التاريخ</th>
                    <th className="p-2.5 w-28">الفرع المستفيد</th>
                    <th className="p-2.5 w-36">البند والتصنيف</th>
                    <th className="p-2.5">البيان وتفاصيل الفاتورة / المورد / المواد</th>
                    <th className="p-2.5 w-28">طريقة الصرف</th>
                    <th className="p-2.5 text-left w-32">المبلغ (د.ك)</th>
                    <th className="p-2.5 text-center w-12 no-print">سند</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                  {filteredPurchases.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 text-slate-400 font-mono text-[11px] text-center">{i + 1}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">{p.date}</td>
                      <td className="p-2.5 font-black text-slate-900 flex items-center gap-1.5">
                        <Building size={13} className="text-blue-500 shrink-0" />
                        <span>{p.branch}</span>
                      </td>
                      <td className="p-2.5 font-black text-blue-900">{p.category}</td>
                      <td className="p-2.5 text-slate-700">{p.description || '—'}</td>
                      <td className="p-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          p.isAccrual ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {p.isAccrual ? 'آجل / مورد' : 'نقداً من العهدة'}
                        </span>
                      </td>
                      <td className="p-2.5 text-left font-mono font-black text-rose-600 text-sm">
                        {p.amount.toFixed(3)}
                      </td>
                      <td className="p-2.5 text-center no-print">
                        <button
                          onClick={() => {
                            setActiveVoucher({
                              voucherNo: `PUR-${p.date.replace(/-/g, '')}-${i + 1}`,
                              voucherType: 'Payment',
                              date: p.date,
                              amount: p.amount,
                              beneficiary: p.category || p.branch,
                              payer: selectedEmployee,
                              employee: selectedEmployee,
                              branch: p.branch,
                              category: p.category,
                              description: `فاتورة مشتريات ومصروفات: ${p.description || ''}`,
                              paymentMethod: p.isAccrual ? 'Accrual' : 'Cash'
                            });
                            setIsVoucherModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="طباعة سند صرف / فاتورة مشتريات"
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                        {purchaseSearch || selectedBranchFilter !== 'all' || purchaseTypeFilter !== 'all' 
                          ? 'لا توجد فواتير مطابقة لمعايير البحث والتصفية المحددة' 
                          : 'لا توجد فواتير مشتريات مسجلة في هذه الفترة'}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-slate-900">
                  <tr>
                    <td colSpan={6} className="p-3 font-black">إجمالي الفواتير المعروضة:</td>
                    <td className="p-3 text-left font-mono text-sm text-rose-600 font-black">
                      {filteredPurchases.reduce((acc, p) => acc + p.amount, 0).toFixed(3)} د.ك
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 5: Final Settlement Reconciliation & Cash Count Result */}
        <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
          <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
            <ShieldCheck size={18} />
            <span>خامساً: جدول مطابقة الرصيد الدفتري مع الجرد الفعلي وقرار التصفية</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs border-b border-slate-800 pb-5">
            <div>
              <span className="text-slate-400 font-bold block mb-1">1. الرصيد الدفتري المتبقي المستحق:</span>
              <span className="font-mono text-xl font-black text-white">
                {settlementStats.calculatedBookBalance.toFixed(3)} <span className="text-xs font-normal">د.ك</span>
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block mb-1">2. النقد الفعلي الموجود بالخزينة (الجرد):</span>
              <span className="font-mono text-xl font-black text-emerald-400">
                {settlementStats.hasCount ? `${settlementStats.actualCash.toFixed(3)} د.ك` : 'لم يتم إدخال الجرد'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block mb-1">3. الفروق النقدية الناتجة عن الجرد:</span>
              <span className={`font-mono text-xl font-black ${
                !settlementStats.hasCount 
                  ? 'text-slate-500' 
                  : Math.abs(settlementStats.variance) < 0.001 
                    ? 'text-emerald-400' 
                    : settlementStats.variance < 0 
                      ? 'text-rose-400' 
                      : 'text-amber-400'
              }`}>
                {settlementStats.hasCount ? `${settlementStats.variance.toFixed(3)} د.ك` : '—'}
              </span>
            </div>
          </div>

          {settlementNotes && (
            <div className="bg-slate-800/80 p-4 rounded-xl text-slate-300 text-xs">
              <span className="font-black text-white block mb-1">قرار وملاحظة الإدارة المالية ورئيس الحسابات:</span>
              <p>{settlementNotes}</p>
            </div>
          )}
        </div>

        {/* Official 4-Box Signatures & Stamp */}
        {printOptions.showSignatures && (
          <div className="pt-4 border-t-2 border-dashed border-slate-300">
            <PrintSignatures
              profile={companyProfile}
              showStamp={printOptions.showStamp}
              preparedBy={`أمين ومسؤول العهدة (${selectedEmployee || 'المسؤول'})`}
              auditedBy="رئيس الحسابات والتدقيق المالي"
              approvedBy="اعتماد المدير المالي العام"
              receivedBy="مصادقة الإدارة العامة والختم"
            />
          </div>
        )}

      </div>

      {/* Official Voucher Print Modal */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        voucher={activeVoucher}
      />

      {/* Print Settings & Company Profile Modal */}
      <PrintSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(p) => setCompanyProfile(p)}
      />
    </div>
  );
}
