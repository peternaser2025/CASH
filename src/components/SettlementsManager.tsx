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
  Receipt
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';

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

  // Print mode and visible sections toggle
  const [printMode, setPrintMode] = useState<PrintMode>('all');
  const [showBranchesSection, setShowBranchesSection] = useState(true);
  const [showTransfersSection, setShowTransfersSection] = useState(true);
  const [showPurchasesSection, setShowPurchasesSection] = useState(true);
  const [showSummaryTable, setShowSummaryTable] = useState(true);

  // Search in itemized purchases
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

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
      
      setReportRows(data.rows || []);
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
    }> = [];

    const outgoingTransfers: Array<{
      date: string;
      toWhom: string;
      description: string;
      amount: number;
      refNo: string;
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

    reportRows.forEach((row, idx) => {
      const date = String(row.date || row[1] || '').split('T')[0];
      const type = String(row.type || row[2] || '');
      const cat = String(row.category || row[3] || 'عام');
      const desc = String(row.description || row[4] || '');
      const inc = parseFloat(String(row.income !== undefined ? row.income : (row[5] || 0))) || 0;
      const exp = parseFloat(String(row.expense !== undefined ? row.expense : (row[6] || 0))) || 0;
      const branch = String(row.branch || row[8] || 'المركز الرئيسي');
      const emp = String(row.employee || row[9] || selectedEmployee);
      
      const isSettlement = /سداد|تسوية/i.test(cat + " " + desc);
      const isAccrual = isSettlement ? false : /آجل|اجل|مستحق|مستحقة|مستحقه|رواتب مستحقة|دين|دائن|مورد|مؤجل|غير مسدد|لم يسدد/i.test(cat + " " + desc);
      const isTransfer = type.includes('تحويل') || desc.includes('تحويل') || cat.includes('تحويل');

      if (inc > 0) {
        totalFeeding += inc;

        if (isTransfer) {
          // Inflow transfer
          // Extract who sent it if mentioned in description
          let fromParty = 'الخزينة العامة / البنك';
          const matchFrom = desc.match(/من\s+([^\s,،]+(?:\s+[^\s,،]+)?)/i);
          if (matchFrom && matchFrom[1]) {
            fromParty = matchFrom[1].replace(/عهدة|حساب/g, '').trim() || fromParty;
          }

          incomingTransfers.push({
            date,
            fromWhom: fromParty,
            description: desc || `تغذية عهدة نقدية للموظف ${emp}`,
            amount: inc,
            refNo: `TR-IN-${String(idx + 1).padStart(4, '0')}`
          });
        }
      }

      if (exp > 0) {
        totalExpenses += exp;

        // Group by category
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp;

        // Group by branch
        if (!expenseByBranch[branch]) {
          expenseByBranch[branch] = { amount: 0, count: 0 };
        }
        expenseByBranch[branch].amount += exp;
        expenseByBranch[branch].count += 1;

        if (isTransfer) {
          // Outflow transfer
          let toParty = 'موظف / فرع آخر';
          const matchTo = desc.match(/إلى\s+([^\s,،]+(?:\s+[^\s,،]+)?)|الي\s+([^\s,،]+(?:\s+[^\s,،]+)?)/i);
          if (matchTo && (matchTo[1] || matchTo[2])) {
            toParty = (matchTo[1] || matchTo[2]).replace(/عهدة|حساب/g, '').trim() || toParty;
          }

          outgoingTransfers.push({
            date,
            toWhom: toParty,
            description: desc || `تحويل صادر من عهدة ${emp}`,
            amount: exp,
            refNo: `TR-OUT-${String(idx + 1).padStart(4, '0')}`
          });
        } else {
          // Regular purchase / expense item
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

  // Filtered purchases list
  const filteredPurchases = useMemo(() => {
    return settlementStats.purchasesList.filter(p => {
      if (selectedBranchFilter !== 'all' && p.branch !== selectedBranchFilter) return false;
      if (purchaseSearch) {
        const q = purchaseSearch.toLowerCase();
        const matches = 
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.branch.toLowerCase().includes(q) ||
          p.date.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [settlementStats.purchasesList, selectedBranchFilter, purchaseSearch]);

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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-8 sm:p-12 print:border-none print:shadow-none print:p-2 space-y-8">
        
        {/* Official Letterhead Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 text-white rounded-xl">
                <Building2 size={26} />
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">{companyName}</h2>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  محضر جرد وتصفية وتسوية عهدة نقدية
                </h1>
                <p className="text-[11px] font-black text-emerald-700 mt-0.5">
                  Petty Cash Reconciliation, Transfers & Audit Schedule
                </p>
              </div>
            </div>
          </div>

          <div className="text-right sm:text-left bg-slate-50 sm:bg-transparent p-3.5 sm:p-0 rounded-2xl border sm:border-none border-slate-200 w-full sm:w-auto text-xs">
            <p className="font-black text-slate-600">رقم المحضر: <span className="font-mono text-slate-900 font-black">SET-{Date.now().toString().slice(-6)}</span></p>
            <p className="font-black text-slate-600 mt-0.5">تاريخ الإصدار: <span className="font-mono text-slate-900 font-bold">{new Date().toISOString().split('T')[0]}</span></p>
            <p className="font-black text-emerald-700 mt-0.5">العملة المعتمدة: دينار كويتي (KWD)</p>
          </div>
        </div>

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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={17} className="text-indigo-600" />
                <span>ثالثاً: كشف حركة تحويلات العهد النقدية تفصيلياً (تمت لمين ومن أين)</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500 font-mono no-print">
                {settlementStats.incomingTransfers.length + settlementStats.outgoingTransfers.length} تحويلات مسجلة
              </span>
            </div>

            {/* Inflow vs Outflow Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Incoming Feedings (من من استلم) */}
              <div className="border border-emerald-200 rounded-2xl overflow-hidden">
                <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center justify-between text-xs font-black text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight size={16} className="text-emerald-600" />
                    <span>تغذية العهدة (استلام من مين)</span>
                  </span>
                  <span className="font-mono text-emerald-700">{settlementStats.totalIncomingTransfers.toFixed(3)} د.ك</span>
                </div>
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-100">
                    <tr>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">المستلم منه (من مين)</th>
                      <th className="p-2.5">البيان</th>
                      <th className="p-2.5 text-left">المبلغ (د.ك)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {settlementStats.incomingTransfers.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{t.date}</td>
                        <td className="p-2.5 font-black text-emerald-950">{t.fromWhom}</td>
                        <td className="p-2.5 text-slate-600 truncate max-w-[120px] text-[11px]">{t.description}</td>
                        <td className="p-2.5 text-left font-mono font-black text-emerald-600">{t.amount.toFixed(3)}</td>
                      </tr>
                    ))}
                    {settlementStats.incomingTransfers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">لا توجد تغذيات مستلمة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Outgoing Transfers (لمن تم التحويل) */}
              <div className="border border-rose-200 rounded-2xl overflow-hidden">
                <div className="bg-rose-50 p-3 border-b border-rose-100 flex items-center justify-between text-xs font-black text-rose-900">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft size={16} className="text-rose-600" />
                    <span>تحويلات صادرة (تم التحويل لمين)</span>
                  </span>
                  <span className="font-mono text-rose-700">{settlementStats.totalOutgoingTransfers.toFixed(3)} د.ك</span>
                </div>
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-100">
                    <tr>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">المحول إليه (لمين)</th>
                      <th className="p-2.5">البيان</th>
                      <th className="p-2.5 text-left">المبلغ (د.ك)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {settlementStats.outgoingTransfers.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{t.date}</td>
                        <td className="p-2.5 font-black text-rose-950">{t.toWhom}</td>
                        <td className="p-2.5 text-slate-600 truncate max-w-[120px] text-[11px]">{t.description}</td>
                        <td className="p-2.5 text-left font-mono font-black text-rose-600">{t.amount.toFixed(3)}</td>
                      </tr>
                    ))}
                    {settlementStats.outgoingTransfers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">لا توجد تحويلات صادرة لأشخاص آخرين</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: Itemized Purchases & Invoices Schedule (تفاصيل المشتريات) */}
        {(showPurchasesSection || printMode === 'purchases' || printMode === 'all') && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShoppingBag size={17} className="text-amber-600" />
                <span>رابعاً: سجل فواتير المشتريات والمصروفات تفصيلياً ({settlementStats.purchasesList.length} فاتورة)</span>
              </h3>

              {/* In-table filters for view mode */}
              <div className="no-print flex items-center gap-2">
                <input
                  type="text"
                  placeholder="بحث في المشتريات..."
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">كافة الفروع</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto print:max-h-none">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5 w-12">م</th>
                    <th className="p-2.5 w-24">التاريخ</th>
                    <th className="p-2.5 w-28">الفرع المستفيد</th>
                    <th className="p-2.5 w-32">البند والتصنيف</th>
                    <th className="p-2.5">البيان وتفاصيل الفاتورة / المورد / المواد</th>
                    <th className="p-2.5 w-24">طريقة الصرف</th>
                    <th className="p-2.5 text-left w-28">المبلغ (د.ك)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                  {filteredPurchases.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="p-2.5 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">{p.date}</td>
                      <td className="p-2.5 font-black text-slate-900">{p.branch}</td>
                      <td className="p-2.5 font-black text-blue-900">{p.category}</td>
                      <td className="p-2.5 text-slate-700">{p.description || '—'}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          p.isAccrual ? 'bg-amber-100 text-amber-900' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {p.isAccrual ? 'آجل / مورد' : 'نقداً من العهدة'}
                        </span>
                      </td>
                      <td className="p-2.5 text-left font-mono font-black text-rose-600">
                        {p.amount.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        لا توجد مشتريات مسجلة مطابقة لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-slate-900">
                  <tr>
                    <td colSpan={6} className="p-3 font-black">إجمالي سجل فواتير المشتريات:</td>
                    <td className="p-3 text-left font-mono text-sm text-rose-600 font-black">
                      {settlementStats.totalItemizedPurchases.toFixed(3)} د.ك
                    </td>
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

        {/* Legal Signatures Box */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50/50 mt-8">
          <p className="text-center font-black text-xs text-slate-600 mb-8">
            إقرار ومصادقة: نقر نحن الموقعون أدناه بصحة بيانات الفواتير ومطابقة الفروع والتحويلات مع الجرد الفعلي للعهدة
          </p>

          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            {/* Custodian Signature */}
            <div className="space-y-8">
              <div>
                <p className="font-black text-slate-900">أمين / مستلم العهدة</p>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">{selectedEmployee}</p>
              </div>
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">
                التوقيع: ............................
              </div>
            </div>

            {/* Chief Accountant Signature */}
            <div className="space-y-8">
              <div>
                <p className="font-black text-slate-900">رئيس الحسابات / المراجع</p>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">التدقيق والمطابقة</p>
              </div>
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">
                التوقيع: ............................
              </div>
            </div>

            {/* Financial Director / General Manager Signature */}
            <div className="space-y-8">
              <div>
                <p className="font-black text-slate-900">المدير المالي / المفوض</p>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">الاعتماد النهائي والختم</p>
              </div>
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">
                الختم والاعتماد: ...................
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
