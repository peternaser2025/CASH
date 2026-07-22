import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Building, 
  Calculator, 
  Save, 
  History, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  Trash2, 
  FileSpreadsheet, 
  ArrowLeftRight,
  PlusCircle,
  HelpCircle,
  FileText
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';
import { formatKWD, isTransferType } from '../utils/format';

interface ProfitLossProps {
  branches: string[];
  categories: string[];
  balances: EmployeeBalance[];
  onRefresh: () => void;
}

interface SavedPLRecord {
  id: string;
  date: string;
  month: string;
  branch: string;
  sales: number;
  expenses: number;
  purchases: number;
  openingBalance: number;
  closingBalance: number;
  netProfit: number;
  variance: number;
  notes?: string;
}

export default function ProfitLoss({ branches, categories, balances, onRefresh }: ProfitLossProps) {
  // Selections
  const [selectedBranch, setSelectedBranch] = useState<string>(branches[0] || 'المكتب الرئيسي');
  
  // Current month in YYYY-MM format
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // Inputs
  const [salesInput, setSalesInput] = useState<string>('');
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('');
  const [closingBalanceInput, setClosingBalanceInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Autopulled calculations from transactions
  const [pulledExpenses, setPulledExpenses] = useState<number>(0);
  const [pulledPurchases, setPulledPurchases] = useState<number>(0);
  const [loadingPulled, setLoadingPulled] = useState<boolean>(false);
  const [pullError, setPullError] = useState<string | null>(null);

  // History list from localStorage and fallback
  const [history, setHistory] = useState<SavedPLRecord[]>([]);
  const [savingRecord, setSavingRecord] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('kwd_pl_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing PL history', e);
      }
    }
  }, []);

  // Safe helper to extract values from transaction rows
  const getRowValue = (row: any, index: number, key: string) => {
    if (Array.isArray(row)) {
      return row[index];
    } else if (row && typeof row === 'object') {
      return row[key];
    }
    return undefined;
  };

  // Pull transactions for the selected branch and month
  const handlePullBranchData = async () => {
    if (!selectedBranch || !selectedMonth) return;
    setLoadingPulled(true);
    setPullError(null);

    try {
      // Determine start and end date of the selected month
      const [year, monthStr] = selectedMonth.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(monthStr) - 1; // 0-indexed
      
      const startDate = `${year}-${monthStr}-01`;
      const lastDay = new Date(yearNum, monthNum + 1, 0).getDate();
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // Call generateReport for this branch
      const reportData = await gasService.getReport({
        branch: selectedBranch,
        startDate,
        endDate,
        type: 'Expense' // only expenses
      });

      if (!reportData || !reportData.rows) {
        setPulledExpenses(0);
        setPulledPurchases(0);
        return;
      }

      let totalExpenses = 0;
      let totalPurchases = 0;

      // Classify expenses and purchases (excluding transfers / employee custody movements)
      reportData.rows.forEach((row: any) => {
        const type = String(getRowValue(row, 3, 'type') || '').trim();
        const category = String(getRowValue(row, 4, 'category') || '').trim();
        const expenseAmount = parseFloat(String(getRowValue(row, 6, 'expense') || 0)) || 0;

        if (isTransferType(type, category)) {
          return;
        }

        if (expenseAmount > 0) {
          // If category contains "مشتريات" or "شراء", count as Purchase, otherwise as general Branch Expense
          if (category.includes('مشتريات') || category.includes('شراء') || category.toLowerCase().includes('purchase')) {
            totalPurchases += expenseAmount;
          } else {
            totalExpenses += expenseAmount;
          }
        }
      });

      setPulledExpenses(totalExpenses);
      setPulledPurchases(totalPurchases);

    } catch (err) {
      console.error('Error pulling branch P&L data:', err);
      setPullError('فشل جلب الحركات المالية التلقائية من السيرفر.');
    } finally {
      setLoadingPulled(false);
    }
  };

  // Trigger pull on branch or month change
  useEffect(() => {
    handlePullBranchData();
  }, [selectedBranch, selectedMonth]);

  // Calculations
  const sales = parseFloat(salesInput) || 0;
  const openingBalance = parseFloat(openingBalanceInput) || 0;
  const closingBalance = parseFloat(closingBalanceInput) || 0;
  const totalCosts = pulledExpenses + pulledPurchases;
  
  // صافي الأرباح والخسائر = المبيعات - (المصاريف + المشتريات)
  const netProfit = sales - totalCosts;

  // رصيد الخزنة الدفتري المحتسب = رصيد أول الشهر + المبيعات - المصاريف - المشتريات
  const calculatedEnding = openingBalance + sales - totalCosts;

  // الفارق الفعلي والمطابقة = رصيد آخر الشهر الفعلي - رصيد الخزنة الدفتري المحتسب
  const variance = closingBalance - calculatedEnding;

  // Save the record
  const handleSavePL = async () => {
    if (!salesInput || !openingBalanceInput || !closingBalanceInput) {
      alert('يرجى تعبئة الحقول الأساسية (المبيعات، رصيد أول الشهر، ورصيد آخر الشهر)');
      return;
    }

    setSavingRecord(true);
    setSuccessMsg(null);

    const newRecord: SavedPLRecord = {
      id: String(new Date().getTime()),
      date: new Date().toLocaleDateString('ar-KW'),
      month: selectedMonth,
      branch: selectedBranch,
      sales,
      expenses: pulledExpenses,
      purchases: pulledPurchases,
      openingBalance,
      closingBalance,
      netProfit,
      variance,
      notes: notes || undefined
    };

    try {
      // 1. Save to Google Sheets as a transaction inside a special "الأرباح والخسائر" sheet
      // To ensure that this tab is automatically created on Google Sheet, we use employee name "الأرباح والخسائر"
      const plTransaction = {
        employee: 'الأرباح والخسائر',
        date: new Date().toISOString().split('T')[0],
        branch: selectedBranch,
        category: 'سجل أرباح وخسائر',
        type: netProfit >= 0 ? 'Income' : 'Expense',
        amount: Math.abs(netProfit),
        targetMonth: selectedMonth,
        description: `أرباح الشهر: مبيعات (${sales.toFixed(3)}) | مصاريف (${pulledExpenses.toFixed(3)}) | مشتريات (${pulledPurchases.toFixed(3)}) | رصيد أول (${openingBalance.toFixed(3)}) | رصيد آخر (${closingBalance.toFixed(3)}) | الفارق (${variance.toFixed(3)})`
      };

      const res = await gasService.addTransaction(plTransaction);

      // 2. Add to local history list
      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('kwd_pl_history', JSON.stringify(updatedHistory));

      // Trigger a parent refresh
      onRefresh();

      // Reset fields
      setSalesInput('');
      setOpeningBalanceInput('');
      setClosingBalanceInput('');
      setNotes('');
      setSuccessMsg(`تم حفظ تقرير الأرباح والخسائر لشهر ${selectedMonth} للفرع ${selectedBranch} بنجاح ومزامنته مع Google Sheets! ✅`);
      
      setTimeout(() => setSuccessMsg(null), 8000);

    } catch (err) {
      console.error('Error saving PL record:', err);
      alert('حدث خطأ أثناء الاتصال ومزامنة البيانات مع Google Sheets.');
    } finally {
      setSavingRecord(false);
    }
  };

  // Delete a record from local history
  const handleDeleteRecord = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل من الذاكرة المحلية؟')) {
      const updated = history.filter(item => item.id !== id);
      setHistory(updated);
      localStorage.setItem('kwd_pl_history', JSON.stringify(updated));
    }
  };

  const printPl = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200 pb-8 no-print">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-[2px] bg-emerald-500"></div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Financial Analytics</span>
          </div>
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter">
            الأرباح <span className="text-emerald-600 italic font-serif font-light">والخسائر</span>
          </h2>
          <p className="text-gray-500 max-w-lg font-medium text-base leading-relaxed">
            احتساب أرباح وخسائر الفروع شهرياً، وتدقيق ومطابقة رصيد النقدية والسيولة بين الدفتري والفعلي.
          </p>
        </div>
        <button
          onClick={printPl}
          className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-900 hover:bg-gray-900 hover:text-white rounded-full font-black text-sm transition-all"
        >
          <Printer size={16} />
          طباعة التقرير الحالي
        </button>
      </div>

      {/* Main Grid for calculation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Calculation Form - Left Side */}
        <div className="lg:col-span-5 bg-white border-2 border-gray-900 rounded-[2rem] shadow-sm p-8 space-y-6 no-print">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <Calculator className="text-emerald-600" size={24} />
            <h3 className="text-lg font-black text-gray-900">حاسبة الأرباح والمطابقة</h3>
          </div>

          {/* Form Selections */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-400">الفرع المستهدف</label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-500 font-bold text-sm outline-none transition-all"
              >
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-400">شهر التقرير</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-500 font-bold text-sm outline-none transition-all"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Automatic Pull Indicator */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-800">بيانات الحركات التلقائية للفرع</p>
              <p className="text-[10px] font-bold text-slate-500">تم جرد المصروفات والمشتريات للشهر المختار</p>
            </div>
            {loadingPulled ? (
              <RefreshCw size={16} className="text-emerald-600 animate-spin" />
            ) : (
              <button 
                type="button"
                onClick={handlePullBranchData}
                className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                title="إعادة تحديث البيانات التلقائية"
              >
                <RefreshCw size={16} />
              </button>
            )}
          </div>

          {/* Financial Fields */}
          <div className="space-y-4">
            {/* Sales */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-gray-700">مبيعات الشهر الكلية (KWD)</label>
                <span className="text-[10px] font-bold text-slate-400">إيرادات المبيعات</span>
              </div>
              <input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={salesInput}
                onChange={e => setSalesInput(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl font-mono font-bold text-base outline-none focus:border-emerald-500 focus:bg-white transition-all text-left"
              />
            </div>

            {/* Pulled Expenses (Read Only but highlighted) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-gray-500">مصاريف الفرع (مسحوبة)</label>
                <div className="px-4 py-3 bg-red-50/50 border-2 border-red-100 rounded-2xl font-mono font-bold text-sm text-red-600 flex justify-between items-center">
                  <span>{formatKWD(pulledExpenses)}</span>
                  <span className="text-[10px] text-red-400">KWD</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-gray-500">مشتريات الفرع (مسحوبة)</label>
                <div className="px-4 py-3 bg-amber-50/50 border-2 border-amber-100 rounded-2xl font-mono font-bold text-sm text-amber-700 flex justify-between items-center">
                  <span>{formatKWD(pulledPurchases)}</span>
                  <span className="text-[10px] text-amber-400">KWD</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Opening Balance */}
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-700">رصيد أول الشهر الفعلي</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={openingBalanceInput}
                  onChange={e => setOpeningBalanceInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl font-mono font-bold text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all text-left"
                />
              </div>

              {/* Closing Balance */}
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-700">رصيد آخر الشهر الفعلي</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={closingBalanceInput}
                  onChange={e => setClosingBalanceInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl font-mono font-bold text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all text-left"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-700">ملاحظات إضافية (اختياري)</label>
              <textarea
                rows={2}
                placeholder="أية تفاصيل تخص جرد الشهر أو أسباب الفروقات..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-2xl text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleSavePL}
            disabled={savingRecord || loadingPulled}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {savingRecord ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                جاري المزامنة والحفظ مع Google Sheets...
              </>
            ) : (
              <>
                <Save size={16} />
                حفظ وإغلاق الحساب لهذا الشهر
              </>
            )}
          </button>
        </div>

        {/* Calculation Summary Sheet - Right Side (Always Visible and Print Optimized) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Success Dialog */}
          <AnimatePresence>
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-800 text-xs font-black flex items-center gap-3 shadow-sm"
              >
                <CheckCircle size={18} className="shrink-0 text-emerald-600" />
                <p>{successMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Financial Report Sheet (Aesthetic Print Card) */}
          <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] shadow-sm overflow-hidden relative print:border-none print:shadow-none">
            
            {/* Elegant Header */}
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 print:bg-white print:pb-6">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-gray-950 rounded-2xl flex items-center justify-center text-white font-black text-xl">
                  PL
                </div>
                <div>
                  <h4 className="text-xl font-black text-gray-900">تقرير الأرباح والمطابقة المالية</h4>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                    {selectedBranch} — شهر {selectedMonth}
                  </p>
                </div>
              </div>
              <div className="text-left font-mono text-[10px] text-gray-400 font-bold hidden sm:block">
                {new Date().toLocaleDateString('ar-KW')}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-8 space-y-8">
              {/* Three Pillars Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Sales Pillar */}
                <div className="p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">إجمالي المبيعات</span>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black font-mono tracking-tight text-emerald-600">
                      {formatKWD(sales)}
                    </span>
                    <span className="text-[10px] font-black text-emerald-500">KWD</span>
                  </div>
                </div>

                {/* Costs Pillar */}
                <div className="p-6 bg-red-50/30 rounded-2xl border border-red-100 flex flex-col justify-between">
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">إجمالي التكاليف (المصروفات + المشتريات)</span>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black font-mono tracking-tight text-red-600">
                      {formatKWD(totalCosts)}
                    </span>
                    <span className="text-[10px] font-black text-red-500">KWD</span>
                  </div>
                </div>

                {/* Net Profit Pillar */}
                <div className={`p-6 rounded-2xl border flex flex-col justify-between ${
                  netProfit >= 0 ? 'bg-blue-50/30 border-blue-100' : 'bg-rose-50/30 border-rose-100'
                }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    netProfit >= 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}>
                    صافي الأرباح التشغيلية
                  </span>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {formatKWD(netProfit)}
                    </span>
                    <span className="text-[10px] font-black text-gray-500">KWD</span>
                  </div>
                </div>

              </div>

              {/* Detailed Breakdown Table */}
              <div className="border-2 border-gray-900 rounded-2xl overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                      <th className="px-6 py-4 border-l border-white/10">البند المالي</th>
                      <th className="px-6 py-4 text-center">القيمة بالدينار الكويتي (KWD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-xs text-gray-800">
                    <tr>
                      <td className="px-6 py-4 bg-gray-50/50 border-l border-gray-100 font-black">إيرادات مبيعات الشهر (+)</td>
                      <td className="px-6 py-4 text-center font-mono text-emerald-600 font-black">{formatKWD(sales)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 bg-gray-50/50 border-l border-gray-100">مصاريف التشغيل والفرع (-)</td>
                      <td className="px-6 py-4 text-center font-mono text-red-600">{formatKWD(pulledExpenses)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 bg-gray-50/50 border-l border-gray-100">مشتريات الفرع والمخزون (-)</td>
                      <td className="px-6 py-4 text-center font-mono text-amber-700">{formatKWD(pulledPurchases)}</td>
                    </tr>
                    <tr className="bg-gray-50 font-black text-gray-900 border-t-2 border-gray-200">
                      <td className="px-6 py-4 border-l border-gray-100">رصيد الصندوق الدفتري المحتسب</td>
                      <td className="px-6 py-4 text-center font-mono text-gray-900">{formatKWD(calculatedEnding)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 bg-gray-50/50 border-l border-gray-100">رصيد أول الشهر الفعلي</td>
                      <td className="px-6 py-4 text-center font-mono text-slate-700">{formatKWD(openingBalance)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 bg-gray-50/50 border-l border-gray-100">رصيد آخر الشهر الفعلي (المجرود)</td>
                      <td className="px-6 py-4 text-center font-mono text-slate-700">{formatKWD(closingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Match Verification Box (Cash Reconciliation) */}
              <div className={`p-6 rounded-[2rem] border-2 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                variance === 0 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                  : Math.abs(variance) < 0.005 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                  : variance > 0 
                  ? 'bg-blue-50 border-blue-500 text-blue-900' 
                  : 'bg-rose-50 border-rose-500 text-rose-900'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {variance === 0 || Math.abs(variance) < 0.005 ? (
                      <CheckCircle className="text-emerald-600" size={20} />
                    ) : (
                      <AlertTriangle className={variance > 0 ? 'text-blue-600' : 'text-rose-600'} size={20} />
                    )}
                    <h5 className="font-black text-sm">حالة مطابقة صندوق النقدية والعهد</h5>
                  </div>
                  <p className="text-[11px] font-bold opacity-85 leading-relaxed mt-1">
                    {variance === 0 || Math.abs(variance) < 0.005
                      ? 'تمت المطابقة بنجاح! الرصيد الفعلي المجرود يطابق تماماً الرصيد الدفتري المسجل للحركات.'
                      : variance > 0
                      ? 'يوجد زيادة غير مبررة في الصندوق الفعلي مقارنة بالدفتري (زيادة نقدية).'
                      : 'تحذير: يوجد عجز مالي مكتشف بالصندوق الفعلي مقارنة بالدفتري المسجل!'}
                  </p>
                </div>
                
                <div className="text-left font-mono shrink-0">
                  <p className="text-[9px] font-black uppercase opacity-75">الفارق والمطابقة</p>
                  <p className="text-2xl font-black mt-1">
                    {variance > 0 ? '+' : ''}{formatKWD(variance)} <span className="text-xs">KWD</span>
                  </p>
                </div>
              </div>

              {notes && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700">
                  <span className="text-gray-400 block mb-1">ملاحظات التدقيق المرفقة:</span>
                  {notes}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* History List of Saved Months */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] shadow-sm p-8 space-y-6 no-print">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <History className="text-slate-700" size={22} />
            <h3 className="text-lg font-black text-gray-900">سجل الإغلاقات والأرباح التاريخية</h3>
          </div>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg uppercase">
            {history.length} إغلاق مسجل
          </span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-400 space-y-2">
            <FileSpreadsheet size={40} className="mx-auto text-gray-300" />
            <p className="font-black text-sm">لا توجد سجلات أرباح وخسائر مغلقة ومحفوظة حتى الآن.</p>
            <p className="text-xs text-gray-400">سيتم حفظ سجلاتك محلياً ومزامنتها مع شيت "الأرباح والخسائر" لتسهيل مراجعتها.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border-2 border-gray-900">
              <thead>
                <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4 border-l border-white/10">الشهر</th>
                  <th className="px-6 py-4 border-l border-white/10">الفرع</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المبيعات</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المصاريف + المشتريات</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">صافي الأرباح</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">رصيد آخر الشهر</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">الفارق والتدقيق</th>
                  <th className="px-6 py-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-900 font-bold text-xs text-gray-800">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 border-l border-gray-900 font-mono font-black">{record.month}</td>
                    <td className="px-6 py-4 border-l border-gray-900 font-black">{record.branch}</td>
                    <td className="px-6 py-4 border-l border-gray-900 text-center font-mono text-emerald-600">{formatKWD(record.sales)}</td>
                    <td className="px-6 py-4 border-l border-gray-900 text-center font-mono text-red-600">
                      {formatKWD(record.expenses + record.purchases)}
                    </td>
                    <td className={`px-6 py-4 border-l border-gray-900 text-center font-mono font-black ${
                      record.netProfit >= 0 ? 'text-blue-600 bg-blue-50/20' : 'text-rose-600 bg-rose-50/20'
                    }`}>
                      {formatKWD(record.netProfit)}
                    </td>
                    <td className="px-6 py-4 border-l border-gray-900 text-center font-mono">{formatKWD(record.closingBalance)}</td>
                    <td className={`px-6 py-4 border-l border-gray-900 text-center font-mono ${
                      record.variance === 0 || Math.abs(record.variance) < 0.005
                        ? 'text-emerald-600'
                        : record.variance > 0 
                        ? 'text-blue-600'
                        : 'text-rose-600 bg-rose-50/30'
                    }`}>
                      {record.variance > 0 ? '+' : ''}{formatKWD(record.variance)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteRecord(record.id)}
                        className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                        title="حذف من السجل المحلي"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
