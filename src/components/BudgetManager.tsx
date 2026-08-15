import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Building, 
  Layers, 
  Save, 
  DollarSign,
  PieChart as PieIcon,
  Percent,
  Sliders
} from 'lucide-react';
import { gasService } from '../services/gasService';

interface BudgetManagerProps {
  branches: string[];
  categories: string[];
  onRefresh: () => void;
}

interface BudgetSetting {
  [key: string]: number; // key can be branch name or category name, value is budget limit in KWD
}

const DEFAULT_CATEGORY_BUDGETS: BudgetSetting = {
  'بترول': 350,
  'صيانة سيارات': 250,
  'مشتريات خامات': 1200,
  'سلف موظفين': 400,
  'إيجار': 800,
  'نثريات وضيافة': 150,
  'مصاريف حكومية': 200,
  'أدوات ومهمات': 180,
  'كهرباء وماء': 150,
  'رواتب وأجور': 2500
};

const DEFAULT_BRANCH_BUDGETS: BudgetSetting = {
  'فرع حولي': 1500,
  'فرع السالمية': 1800,
  'فرع الشويخ': 2500,
  'فرع الفروانية': 1400,
  'فرع الأحمدي': 1200,
  'فرع الجهراء': 1100,
  'الإدارة العامة': 2000
};

export default function BudgetManager({
  branches,
  categories,
  onRefresh
}: BudgetManagerProps) {
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [budgetType, setBudgetType] = useState<'categories' | 'branches'>('categories');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Local state for editable budgets
  const [categoryBudgets, setCategoryBudgets] = useState<BudgetSetting>(() => {
    try {
      const saved = localStorage.getItem('kwd_category_budgets');
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_BUDGETS;
    } catch {
      return DEFAULT_CATEGORY_BUDGETS;
    }
  });

  const [branchBudgets, setBranchBudgets] = useState<BudgetSetting>(() => {
    try {
      const saved = localStorage.getItem('kwd_branch_budgets');
      return saved ? JSON.parse(saved) : DEFAULT_BRANCH_BUDGETS;
    } catch {
      return DEFAULT_BRANCH_BUDGETS;
    }
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await gasService.getReport({}, true);
      setReportRows(data.rows || []);
    } catch (e) {
      console.error('Failed to load budget transactions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveBudgets = () => {
    localStorage.setItem('kwd_category_budgets', JSON.stringify(categoryBudgets));
    localStorage.setItem('kwd_branch_budgets', JSON.stringify(branchBudgets));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Calculate actual spending vs budget for current selected month
  const budgetAnalytics = useMemo(() => {
    const actualSpending: { [key: string]: number } = {};

    reportRows.forEach(r => {
      const dateStr = String(r.date || r[1] || '').split('T')[0];
      if (!dateStr.startsWith(selectedMonth)) return;

      const cat = String(r.category || r[3] || 'عام');
      const branch = String(r.branch || r[8] || 'المركز الرئيسي');
      const exp = parseFloat(String(r.expense !== undefined ? r.expense : (r[6] || 0))) || 0;

      if (exp > 0) {
        if (budgetType === 'categories') {
          actualSpending[cat] = (actualSpending[cat] || 0) + exp;
        } else {
          actualSpending[branch] = (actualSpending[branch] || 0) + exp;
        }
      }
    });

    const activeList = budgetType === 'categories' ? categories : branches;
    const currentBudgets = budgetType === 'categories' ? categoryBudgets : branchBudgets;

    let totalBudget = 0;
    let totalActual = 0;
    let overBudgetCount = 0;
    let warningCount = 0;

    const items = activeList.map(item => {
      const budget = currentBudgets[item] || (budgetType === 'categories' ? DEFAULT_CATEGORY_BUDGETS[item] || 300 : DEFAULT_BRANCH_BUDGETS[item] || 1500);
      const actual = actualSpending[item] || 0;
      const variance = budget - actual; // Positive = Remaining / Saving, Negative = Over budget
      const percentage = budget > 0 ? (actual / budget) * 100 : 0;

      totalBudget += budget;
      totalActual += actual;

      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (percentage >= 100) {
        status = 'danger';
        overBudgetCount++;
      } else if (percentage >= 80) {
        status = 'warning';
        warningCount++;
      }

      return {
        name: item,
        budget,
        actual,
        variance,
        percentage,
        status
      };
    }).sort((a, b) => b.percentage - a.percentage);

    const overallPercentage = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
    const overallVariance = totalBudget - totalActual;

    return {
      items,
      totalBudget,
      totalActual,
      overallVariance,
      overallPercentage,
      overBudgetCount,
      warningCount
    };
  }, [reportRows, budgetType, selectedMonth, categories, branches, categoryBudgets, branchBudgets]);

  return (
    <div className="space-y-8" dir="rtl">
      {/* Banner */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
            <Target size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                التخطيط والرقابة المالية (Budgeting & Variance)
              </span>
              <span className="text-xs text-slate-400 font-bold">• الموازنة الشهرية</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">سقف الموازنات التقديرية وضبط الانحرافات</h1>
            <p className="text-xs text-slate-300 font-bold mt-1">
              مقارنة الإنفاق الفعلي بالسقف المعتمد لكل بند وفرع واكتشاف تجاوزات الموازنة فور حدوثها
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => {
              loadData();
              onRefresh();
            }}
            disabled={loading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl border border-slate-600 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleSaveBudgets}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {savedSuccess ? <CheckCircle2 size={14} /> : <Save size={14} />}
            <span>{savedSuccess ? 'تم حفظ التعديلات' : 'حفظ سقف الموازنات'}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">إجمالي الموازنة التقديرية</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">
              {budgetAnalytics.totalBudget.toFixed(3)} <span className="text-xs font-normal">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">سقف الإنفاق الشهري</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Actual Spent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">الإنفاق الفعلي المسجل</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">
              {budgetAnalytics.totalActual.toFixed(3)} <span className="text-xs font-normal">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
              نسبة الاستهلاك: {budgetAnalytics.overallPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <PieIcon size={22} />
          </div>
        </div>

        {/* Total Variance / Remaining */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-400">
              {budgetAnalytics.overallVariance >= 0 ? 'الوفر المتبقي في الموازنة' : 'تجاوز الموازنة الإجمالية'}
            </p>
            <p className={`text-xl font-black mt-1 font-mono ${
              budgetAnalytics.overallVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {Math.abs(budgetAnalytics.overallVariance).toFixed(3)} <span className="text-xs font-normal">د.ك</span>
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {budgetAnalytics.overallVariance >= 0 ? 'ضمن الحدود الآمنة' : 'يوجد تجاوز مالي'}
            </p>
          </div>
          <div className={`p-3 rounded-2xl ${budgetAnalytics.overallVariance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {budgetAnalytics.overallVariance >= 0 ? <TrendingDown size={22} /> : <TrendingUp size={22} />}
          </div>
        </div>

        {/* Alert Summary */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
          budgetAnalytics.overBudgetCount > 0 
            ? 'bg-rose-50/80 border-rose-200' 
            : budgetAnalytics.warningCount > 0 
              ? 'bg-amber-50/80 border-amber-200' 
              : 'bg-emerald-50/80 border-emerald-200'
        }`}>
          <div>
            <p className="text-[11px] font-black text-slate-600">رادار التجاوز والانحراف</p>
            <p className="text-lg font-black mt-1">
              {budgetAnalytics.overBudgetCount > 0 
                ? `${budgetAnalytics.overBudgetCount} بنود تجاوزت السقف 🚨` 
                : budgetAnalytics.warningCount > 0 
                  ? `${budgetAnalytics.warningCount} بنود اقتربت من السقف ⚠️` 
                  : 'كافة البنود آمنة ✅'}
            </p>
            <p className="text-[10px] text-slate-600 font-bold mt-0.5">تنبيهات رئيس الحسابات</p>
          </div>
          <div className="p-3 bg-white/80 rounded-2xl shadow-sm">
            <ShieldAlert size={22} className={budgetAnalytics.overBudgetCount > 0 ? 'text-rose-600' : 'text-emerald-600'} />
          </div>
        </div>
      </div>

      {/* Control Switch & Month Selector */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Toggle Categories vs Branches */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setBudgetType('categories')}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              budgetType === 'categories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>حسب بنود وتصنيفات المصروفات</span>
          </button>
          <button
            onClick={() => setBudgetType('branches')}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              budgetType === 'branches' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building size={14} />
            <span>حسب الفروع ومراكز التكلفة</span>
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-black text-slate-600 shrink-0">الشهر المالي:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Budget Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-black text-slate-900">
              جدول موازنات {budgetType === 'categories' ? 'بنود المصروفات' : 'الفروع ومراكز التكلفة'}
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              يمكنك تعديل سقف أي بند مباشرة بالضغط على حقل الموازنة التقديرية ثم الضغط على "حفظ"
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">البند / المركز</th>
                <th className="p-3.5 w-40 text-left">الموازنة المعتمدة (د.ك)</th>
                <th className="p-3.5 w-32 text-left">الإنفاق الفعلي (د.ك)</th>
                <th className="p-3.5 w-32 text-left">الانحراف / المتبقي</th>
                <th className="p-3.5 w-48">مؤشر الاستهلاك (%)</th>
                <th className="p-3.5 w-28 text-center">الحالة الرقابية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold">
              {budgetAnalytics.items.map((item) => {
                const isOver = item.percentage >= 100;
                const isWarn = item.percentage >= 80 && !isOver;

                return (
                  <tr key={item.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-black text-slate-900">
                      {item.name}
                    </td>

                    {/* Editable Budget Input */}
                    <td className="p-2.5 text-left">
                      <div className="relative inline-block w-32">
                        <input
                          type="number"
                          step="10"
                          value={item.budget}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (budgetType === 'categories') {
                              setCategoryBudgets(prev => ({ ...prev, [item.name]: val }));
                            } else {
                              setBranchBudgets(prev => ({ ...prev, [item.name]: val }));
                            }
                          }}
                          className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-left font-mono font-black text-slate-900 focus:outline-none transition-all"
                        />
                      </div>
                    </td>

                    {/* Actual Spending */}
                    <td className="p-3.5 text-left font-mono font-black text-slate-900">
                      {item.actual.toFixed(3)}
                    </td>

                    {/* Variance */}
                    <td className={`p-3.5 text-left font-mono font-black ${
                      item.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {item.variance >= 0 ? `+${item.variance.toFixed(3)}` : item.variance.toFixed(3)}
                    </td>

                    {/* Progress Bar */}
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{item.percentage.toFixed(1)}%</span>
                          <span>{item.budget > 0 ? `${(item.budget - item.actual).toFixed(0)} د.ك متبقي` : '—'}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOver ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                        isOver 
                          ? 'bg-rose-100 text-rose-800' 
                          : isWarn 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isOver ? 'تجاوز السقف 🚨' : isWarn ? 'تحذير (80%) ⚠️' : 'آمن ومطابق ✅'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-black">
              <tr>
                <td className="p-4 text-xs font-black">إجمالي الخطة المالية:</td>
                <td className="p-4 text-left font-mono text-sm text-emerald-400 font-black">
                  {budgetAnalytics.totalBudget.toFixed(3)} د.ك
                </td>
                <td className="p-4 text-left font-mono text-sm text-white font-black">
                  {budgetAnalytics.totalActual.toFixed(3)} د.ك
                </td>
                <td className="p-4 text-left font-mono text-sm text-emerald-400 font-black">
                  {budgetAnalytics.overallVariance >= 0 ? `+${budgetAnalytics.overallVariance.toFixed(3)}` : budgetAnalytics.overallVariance.toFixed(3)} د.ك
                </td>
                <td colSpan={2} className="p-4 text-left text-xs text-slate-300">
                  متوسط الاستهلاك العام: {budgetAnalytics.overallPercentage.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
