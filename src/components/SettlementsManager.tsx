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
  Sparkles
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

  // Calculate detailed settlement metrics
  const settlementStats = useMemo(() => {
    let totalFeeding = 0; // Inflows / Transfers in
    let totalExpenses = 0; // Regular expenses
    let expenseByCategory: { [cat: string]: number } = {};

    reportRows.forEach(row => {
      const inc = parseFloat(String(row.income !== undefined ? row.income : (row[5] || 0))) || 0;
      const exp = parseFloat(String(row.expense !== undefined ? row.expense : (row[6] || 0))) || 0;
      const cat = String(row.category || row[3] || 'عام');
      
      totalFeeding += inc;
      totalExpenses += exp;

      if (exp > 0) {
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp;
      }
    });

    const calculatedBookBalance = currentEmployeeBalance;
    const actualCash = parseFloat(actualCashCount) || 0;
    const variance = actualCashCount !== '' ? actualCash - calculatedBookBalance : 0;

    return {
      totalFeeding,
      totalExpenses,
      expenseByCategory,
      calculatedBookBalance,
      actualCash,
      variance,
      hasCount: actualCashCount !== '',
      expenseCount: reportRows.filter(r => (parseFloat(String(r.expense !== undefined ? r.expense : (r[6] || 0))) || 0) > 0).length
    };
  }, [reportRows, currentEmployeeBalance, actualCashCount]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header Banner - Hidden on print */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
            <FileCheck2 size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                قسم الرقابة والتدقيق المالي
              </span>
              <span className="text-xs text-slate-400 font-bold">• KWD 0.000</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">محاضر جرد وتصفية وتسوية العهدة النقدية</h1>
            <p className="text-xs text-slate-300 font-bold mt-1">
              إصدار تقرير جرد رسمي، مطابقة المصروفات والفواتير المرفقة، واحتساب فروق العهدة النقدية بدقة الفلس
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              loadEmployeeData();
              onRefresh();
            }}
            disabled={loading}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl border border-slate-600 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : ''} />
            <span>تحديث البيانات</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>طباعة المحضر الرسمي</span>
          </button>
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

        {/* Additional Notes for the Settlement */}
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1.5">ملاحظات وقرار رئيس الحسابات بخصوص التسوية</label>
          <input
            type="text"
            placeholder="مثال: تم تدقيق كافة الفواتير ومطابقتها مع السندات الأصلية وإبراء ذمة الموظف عن الفترة المذكورة."
            value={settlementNotes}
            onChange={(e) => setSettlementNotes(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Summary KPI Cards - High Level Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">إجمالي الفواتير والمصروفات</p>
            <p className="text-xl font-black text-rose-600 mt-1 font-mono">
              {settlementStats.totalExpenses.toFixed(3)} <span className="text-xs">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{settlementStats.expenseCount} فواتير مسجلة</p>
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
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">خلال الفترة المحددة</p>
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

      {/* Official Settlement Form (Document Preview & Printable Layout) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-8 sm:p-12 print:border-none print:shadow-none print:p-2">
        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 text-white rounded-xl">
                <Building size={24} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  محضر جرد وتصفية عهدة نقدية رسمية
                </h2>
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-0.5">
                  Petty Cash Reconciliation & Audit Sheet
                </p>
              </div>
            </div>
          </div>

          <div className="text-right sm:text-left bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-none border-slate-200 w-full sm:w-auto">
            <p className="text-[11px] font-black text-slate-500">رقم المحضر: <span className="font-mono text-slate-900 font-black">SET-{Date.now().toString().slice(-6)}</span></p>
            <p className="text-[11px] font-black text-slate-500 mt-0.5">تاريخ الإصدار: <span className="font-mono text-slate-900 font-bold">{new Date().toISOString().split('T')[0]}</span></p>
            <p className="text-[11px] font-black text-emerald-700 mt-0.5">العملة: دينار كويتي (KWD)</p>
          </div>
        </div>

        {/* Basic Settlement Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-8 text-xs">
          <div>
            <span className="block text-slate-400 font-black">اسم أمين العهدة:</span>
            <span className="font-black text-slate-900 text-sm">{selectedEmployee || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-black">فترة التسوية والجرد:</span>
            <span className="font-bold text-slate-900 font-mono">{startDate} إلى {endDate}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-black">حالة الاعتماد:</span>
            <span className="font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md inline-block mt-0.5">
              جاهز للاعتماد والمراجعة
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-black">الجهة / الإدارة:</span>
            <span className="font-black text-slate-900">إدارة الحسابات العامة والمالية</span>
          </div>
        </div>

        {/* Breakdown by Category */}
        <div className="mb-8">
          <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
            <Layers size={16} className="text-emerald-600" />
            <span>أولاً: ملخص المصروفات والفواتير حسب التصنيف المحاسبي</span>
          </h3>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">بند / تصنيف المصروف</th>
                  <th className="p-3 text-left">المبلغ المصروف (د.ك)</th>
                  <th className="p-3 text-left">النسبة المئوية</th>
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

        {/* Detailed Itemized Transactions Table */}
        <div className="mb-8">
          <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
            <ClipboardList size={16} className="text-emerald-600" />
            <span>ثانياً: بيان الفواتير والمستندات المقدمة تفصيلياً ({reportRows.length} حركة)</span>
          </h3>
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto print:max-h-none">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">النوع</th>
                  <th className="p-2.5">التصنيف</th>
                  <th className="p-2.5">البيان والتفاصيل</th>
                  <th className="p-2.5 text-left">المبلغ (د.ك)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                {reportRows.map((r, i) => {
                  const date = String(r.date || r[1] || '').split('T')[0];
                  const type = String(r.type || r[2] || '');
                  const cat = String(r.category || r[3] || '');
                  const desc = String(r.description || r[4] || '');
                  const inc = parseFloat(String(r.income !== undefined ? r.income : (r[5] || 0))) || 0;
                  const exp = parseFloat(String(r.expense !== undefined ? r.expense : (r[6] || 0))) || 0;
                  const isExp = exp > 0 || type.includes('مصروف');

                  return (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">{date}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          isExp ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {isExp ? 'مصروف' : 'تغذية/إيراد'}
                        </span>
                      </td>
                      <td className="p-2.5 font-black text-slate-900">{cat}</td>
                      <td className="p-2.5 text-slate-600 truncate max-w-xs">{desc || '—'}</td>
                      <td className={`p-2.5 text-left font-mono font-black ${isExp ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {(isExp ? exp : inc).toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
                {reportRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      لا توجد حركات مسجلة للموظف في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reconciliation Calculation Table */}
        <div className="mb-8 p-6 bg-slate-900 text-white rounded-3xl">
          <h3 className="text-sm font-black text-emerald-400 mb-4 flex items-center gap-2">
            <ShieldCheck size={18} />
            <span>ثالثاً: جدول مطابقة وتصفية الرصيد النهائي</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs border-b border-slate-800 pb-5 mb-5">
            <div>
              <span className="text-slate-400 font-bold block mb-1">1. الرصيد الدفتري المستحق:</span>
              <span className="font-mono text-xl font-black text-white">
                {settlementStats.calculatedBookBalance.toFixed(3)} <span className="text-xs font-normal">د.ك</span>
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block mb-1">2. النقد الفعلي الموجود بالخزينة:</span>
              <span className="font-mono text-xl font-black text-emerald-400">
                {settlementStats.hasCount ? `${settlementStats.actualCash.toFixed(3)} د.ك` : 'غير محدد'}
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
              <span className="font-black text-white block mb-1">ملاحظة وقرار الإدارة المالية:</span>
              <p>{settlementNotes}</p>
            </div>
          )}
        </div>

        {/* Official Legal Signatures Box */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50/50 mt-10">
          <p className="text-center font-black text-xs text-slate-600 mb-8">
            إقرار ومصادقة: نقر نحن الموقعون أدناه بصحة البيانات ومطابقة الفواتير المرفقة مع الجرد الفعلي للعهدة
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
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">الاعتماد النهائي</p>
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
