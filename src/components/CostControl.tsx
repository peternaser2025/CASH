import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  ShieldAlert, 
  TrendingDown, 
  DollarSign, 
  Sliders, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  RefreshCw, 
  Printer, 
  Plus, 
  Trash2, 
  Save, 
  Building, 
  Search, 
  ArrowUpRight, 
  BarChart2, 
  Percent,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { formatKWD } from '../utils/format';

interface CostControlProps {
  branches: string[];
  categories: string[];
  onRefresh: () => void;
}

interface CategoryBudget {
  category: string;
  monthlyLimit: number;
  isFixedCost: boolean; // Fixed vs Variable
}

interface CostAnomaly {
  id: string;
  category: string;
  amount: number;
  limit: number;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
}

interface OptimizationTask {
  id: string;
  title: string;
  category: string;
  estimatedSavingKWD: number;
  completed: boolean;
  priority: 'عالية' | 'متوسطة' | 'عادية';
}

export default function CostControl({ branches, categories, onRefresh }: CostControlProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>(branches[0] || 'المكتب الرئيسي');
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // Category Budgets state (stored in localStorage)
  const [budgets, setBudgets] = useState<Record<string, CategoryBudget>>(() => {
    const saved = localStorage.getItem('kwd_cost_budgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error reading budgets', e);
      }
    }
    // Default initial budgets
    const defaults: Record<string, CategoryBudget> = {
      'إيجارات': { category: 'إيجارات', monthlyLimit: 1500, isFixedCost: true },
      'رواتب وأجور': { category: 'رواتب وأجور', monthlyLimit: 2500, isFixedCost: true },
      'كهرباء ومياه': { category: 'كهرباء ومياه', monthlyLimit: 200, isFixedCost: false },
      'صيانة وتصليح': { category: 'صيانة وتصليح', monthlyLimit: 300, isFixedCost: false },
      'نثريات وضيافة': { category: 'نثريات وضيافة', monthlyLimit: 150, isFixedCost: false },
      'مشتريات وبضاعة': { category: 'مشتريات وبضاعة', monthlyLimit: 3000, isFixedCost: false },
      'تسويق وإعلانات': { category: 'تسويق وإعلانات', monthlyLimit: 400, isFixedCost: false },
      'عقود واشتراكات': { category: 'عقود واشتراكات', monthlyLimit: 250, isFixedCost: true },
    };
    return defaults;
  });

  // Actual monthly expenses per category pulled from gasService / report
  const [actualExpenses, setActualExpenses] = useState<Record<string, number>>({});
  const [totalSales, setTotalSales] = useState<number>(0);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Custom budget edit form inputs
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [newLimitInput, setNewLimitInput] = useState<string>('');
  const [newIsFixed, setNewIsFixed] = useState<boolean>(false);

  // Cost Optimization Action Tasks
  const [optimizationTasks, setOptimizationTasks] = useState<OptimizationTask[]>(() => {
    const saved = localStorage.getItem('kwd_cost_tasks');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: '1', title: 'مراجعة عقود الموردين للمواد الأساسية لخصم 5%', category: 'مشتريات وبضاعة', estimatedSavingKWD: 150, completed: false, priority: 'عالية' },
      { id: '2', title: 'ترشيد استهلاك التكييف والإضاءة خارج أوقات العمل', category: 'كهرباء ومياه', estimatedSavingKWD: 45, completed: false, priority: 'متوسطة' },
      { id: '3', title: 'تحديد سقف يومي مقيد لعهد النثريات والضيافة لكل فرع', category: 'نثريات وضيافة', estimatedSavingKWD: 60, completed: false, priority: 'عالية' },
      { id: '4', title: 'جدولة الصيانة الوقائية للمعدات لتفادي الأعطال المفاجئة المكلفة', category: 'صيانة وتصليح', estimatedSavingKWD: 100, completed: false, priority: 'متوسطة' },
    ];
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSaving, setNewTaskSaving] = useState('');
  const [newTaskCat, setNewTaskCat] = useState('');

  // Save budgets to local storage
  const saveBudgetsToStorage = (updatedBudgets: Record<string, CategoryBudget>) => {
    setBudgets(updatedBudgets);
    localStorage.setItem('kwd_cost_budgets', JSON.stringify(updatedBudgets));
  };

  // Save tasks to local storage
  const saveTasksToStorage = (updatedTasks: OptimizationTask[]) => {
    setOptimizationTasks(updatedTasks);
    localStorage.setItem('kwd_cost_tasks', JSON.stringify(updatedTasks));
  };

  // Safe row parser helper
  const getRowValue = (row: any, index: number, key: string) => {
    if (Array.isArray(row)) return row[index];
    if (row && typeof row === 'object') return row[key];
    return undefined;
  };

  // Pull actual expenses for selected month & branch
  const fetchCostData = async () => {
    setLoadingData(true);
    setErrorMessage(null);
    try {
      const [year, monthStr] = selectedMonth.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(monthStr) - 1;
      const startDate = `${year}-${monthStr}-01`;
      const lastDay = new Date(yearNum, monthNum + 1, 0).getDate();
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // Fetch report data
      const reportData = await gasService.getReport({
        branch: selectedBranch,
        startDate,
        endDate
      });

      const catTotals: Record<string, number> = {};
      let totalBranchSales = 0;

      if (reportData && reportData.rows) {
        reportData.rows.forEach((row: any) => {
          const type = String(getRowValue(row, 3, 'type') || '').trim();
          const category = String(getRowValue(row, 4, 'category') || 'عام').trim();
          const income = parseFloat(String(getRowValue(row, 5, 'income') || 0)) || 0;
          const expense = parseFloat(String(getRowValue(row, 6, 'expense') || 0)) || 0;

          if (type.includes('إيراد') || type.toLowerCase().includes('income') || income > 0) {
            totalBranchSales += income;
          }

          if (expense > 0) {
            catTotals[category] = (catTotals[category] || 0) + expense;
          }
        });
      }

      setActualExpenses(catTotals);
      setTotalSales(totalBranchSales);

    } catch (err) {
      console.error('Error pulling cost control data:', err);
      setErrorMessage('تعذر جلب بيانات المصاريف أوتوماتيكياً من السيرفر.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchCostData();
  }, [selectedBranch, selectedMonth]);

  // Handle Budget Limit Save
  const handleUpdateBudget = (catName: string) => {
    const val = parseFloat(newLimitInput);
    if (isNaN(val) || val < 0) return;

    const updated = {
      ...budgets,
      [catName]: {
        category: catName,
        monthlyLimit: val,
        isFixedCost: newIsFixed
      }
    };
    saveBudgetsToStorage(updated);
    setEditingCategory('');
    setNewLimitInput('');
  };

  // Add custom budget category
  const handleAddCustomCategoryBudget = () => {
    if (!editingCategory || !newLimitInput) return;
    const val = parseFloat(newLimitInput) || 0;
    const updated = {
      ...budgets,
      [editingCategory]: {
        category: editingCategory,
        monthlyLimit: val,
        isFixedCost: newIsFixed
      }
    };
    saveBudgetsToStorage(updated);
    setEditingCategory('');
    setNewLimitInput('');
  };

  // Add Optimization Task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    const newTask: OptimizationTask = {
      id: String(Date.now()),
      title: newTaskTitle,
      category: newTaskCat || 'عام',
      estimatedSavingKWD: parseFloat(newTaskSaving) || 0,
      completed: false,
      priority: 'متوسطة'
    };
    const updated = [newTask, ...optimizationTasks];
    saveTasksToStorage(updated);
    setNewTaskTitle('');
    setNewTaskSaving('');
    setNewTaskCat('');
  };

  const toggleTaskCompletion = (id: string) => {
    const updated = optimizationTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasksToStorage(updated);
  };

  const deleteTask = (id: string) => {
    const updated = optimizationTasks.filter(t => t.id !== id);
    saveTasksToStorage(updated);
  };

  // Analytics Calculations
  const allCategories = Array.from(new Set([...categories, ...Object.keys(budgets), ...Object.keys(actualExpenses)]));

  let totalActualExpenses = 0;
  let totalBudgetCeiling = 0;
  let totalFixedExpenses = 0;
  let totalVariableExpenses = 0;

  const anomalies: CostAnomaly[] = [];

  allCategories.forEach(cat => {
    const actual = actualExpenses[cat] || 0;
    const budgetConf = budgets[cat] || { category: cat, monthlyLimit: 0, isFixedCost: false };
    
    totalActualExpenses += actual;
    totalBudgetCeiling += budgetConf.monthlyLimit;

    if (budgetConf.isFixedCost) {
      totalFixedExpenses += actual;
    } else {
      totalVariableExpenses += actual;
    }

    // Detect Anomalies & Over-budgets
    if (budgetConf.monthlyLimit > 0 && actual > budgetConf.monthlyLimit) {
      const overAmount = actual - budgetConf.monthlyLimit;
      const overPercentage = Math.round((overAmount / budgetConf.monthlyLimit) * 100);

      let severity: 'high' | 'medium' | 'low' = 'low';
      if (overPercentage > 30 || overAmount > 200) severity = 'high';
      else if (overPercentage > 10) severity = 'medium';

      anomalies.push({
        id: cat,
        category: cat,
        amount: actual,
        limit: budgetConf.monthlyLimit,
        severity,
        title: `تجاوز الميزانية في بند "${cat}" بنسبة ${overPercentage}%`,
        description: `بلغت المصاريف الحقيقية ${formatKWD(actual)} KWD بينما السقف المعتمد هو ${formatKWD(budgetConf.monthlyLimit)} KWD (زيادة ${formatKWD(overAmount)} KWD).`,
        recommendation: `يوصى بمراجعة الفواتير الفردية لهذا البند وتقييم أسباب الارتفاع المفاجئ خلال شهر ${selectedMonth}.`
      });
    }
  });

  const costToSalesRatio = totalSales > 0 ? ((totalActualExpenses / totalSales) * 100).toFixed(1) : '0';
  const achievedSavings = optimizationTasks.filter(t => t.completed).reduce((sum, t) => sum + t.estimatedSavingKWD, 0);

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200 pb-8 no-print">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-[2px] bg-emerald-500"></div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Smart Cost Control Radar</span>
          </div>
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter">
            رادار التكاليف <span className="text-emerald-600 italic font-serif font-light">والذكاء المالي</span>
          </h2>
          <p className="text-gray-500 max-w-xl font-medium text-base leading-relaxed">
            محرك مبتكر لضبط المصاريف أوتوماتيكياً، تحديد أسقف الميزانيات، كشف الهدر المالي، وتقسيم التكاليف الثابتة والمتغيرة بدقة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCostData}
            disabled={loadingData}
            className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-black text-xs transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
            تحديث البيانات
          </button>

          <button
            onClick={printReport}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-black text-xs transition-all shadow-md cursor-pointer"
          >
            <Printer size={14} />
            طباعة تقرير ضبط التكاليف
          </button>
        </div>
      </div>

      {/* Control Toolbar: Branch & Month */}
      <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm no-print flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-200 w-full sm:w-auto">
            <Building size={16} className="text-emerald-600" />
            <span className="text-xs font-black text-gray-400">الفرع:</span>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="bg-transparent font-black text-sm text-gray-900 outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-200 w-full sm:w-auto">
            <Sliders size={16} className="text-emerald-600" />
            <span className="text-xs font-black text-gray-400">الشهر:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent font-black text-sm text-gray-900 outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-3 text-xs font-bold text-gray-500 bg-emerald-50/60 px-4 py-2 rounded-2xl border border-emerald-100">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span>محرك الرادار نشط ويتتبع التكاليف الحية من Google Sheets</span>
        </div>
      </div>

      {/* Top Smart Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Expenses vs Budget */}
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي المصاريف المجرودة</span>
            <div className="w-9 h-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black">
              <TrendingDown size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black font-mono tracking-tight text-gray-900">
                {formatKWD(totalActualExpenses)}
              </span>
              <span className="text-xs font-black text-gray-400">KWD</span>
            </div>
            <p className="text-[11px] font-bold text-gray-500 mt-2">
              سقف الميزانية الكلي: <span className="font-mono text-gray-800">{formatKWD(totalBudgetCeiling)} KWD</span>
            </p>
          </div>
        </div>

        {/* Cost to Sales Ratio */}
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">نسبة المصاريف للمبيعات</span>
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black">
              <Percent size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono tracking-tight ${
                parseFloat(costToSalesRatio) > 35 ? 'text-rose-600' : parseFloat(costToSalesRatio) > 20 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                %{costToSalesRatio}
              </span>
            </div>
            <p className="text-[11px] font-bold text-gray-500 mt-2">
              المبيعات الإجمالية للفرع: <span className="font-mono text-gray-800">{formatKWD(totalSales)} KWD</span>
            </p>
          </div>
        </div>

        {/* Fixed vs Variable Split */}
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">تكاليف ثابتة vs متغيرة</span>
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
              <Layers size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-black">
              <span className="text-blue-700">ثابتة: {formatKWD(totalFixedExpenses)} KWD</span>
              <span className="text-amber-700">متغيرة: {formatKWD(totalVariableExpenses)} KWD</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${totalActualExpenses > 0 ? (totalFixedExpenses / totalActualExpenses) * 100 : 50}%` }}
              />
              <div 
                className="bg-amber-400 h-full transition-all"
                style={{ width: `${totalActualExpenses > 0 ? (totalVariableExpenses / totalActualExpenses) * 100 : 50}%` }}
              />
            </div>
          </div>
        </div>

        {/* Leakage Anomalies Count */}
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">نقاط الشذوذ والهدر</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
              anomalies.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-gray-900">
                {anomalies.length}
              </span>
              <span className="text-xs font-bold text-gray-400">تنبيه ميزانية</span>
            </div>
            <p className="text-[11px] font-bold text-gray-500 mt-2">
              {anomalies.length > 0 ? 'يوجد بنود تتجاوز السقف المحدد!' : 'جميع البنود ضمن النطاق الآمن ✅'}
            </p>
          </div>
        </div>

      </div>

      {/* Smart Leakage & Anomaly Radar Section */}
      {anomalies.length > 0 && (
        <div className="bg-rose-50/50 border-2 border-rose-500 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-sm">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-rose-950">تنبيهات كاشف الشذوذ والهدر المالي (Radar Alerts)</h3>
              <p className="text-xs font-bold text-rose-700">تم رصد تجاوزات غير اعتيادية في البنود التالية لهذا الشهر:</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.map(anom => (
              <div key={anom.id} className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black rounded-lg">
                    {anom.category}
                  </span>
                  <span className="font-mono text-xs font-black text-rose-600">
                    +{formatKWD(anom.amount - anom.limit)} KWD زيادات
                  </span>
                </div>
                <h4 className="font-black text-sm text-gray-900">{anom.title}</h4>
                <p className="text-xs text-gray-600 leading-relaxed font-semibold">{anom.description}</p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] font-bold text-amber-900 flex items-start gap-2">
                  <Zap size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>التوصية:</strong> {anom.recommendation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Budget vs Actual Matrix */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900">مصفوفة الرقابة المالية والميزانيات (Cost Allocation Matrix)</h3>
            <p className="text-xs font-bold text-gray-400 mt-1">مقارنة التكاليف الفعلية المجرودة بالسقف المحدد لكل بند مع التحكم المباشر</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse border-2 border-gray-900">
            <thead>
              <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="px-6 py-4 border-l border-white/10">بند التكلفة</th>
                <th className="px-6 py-4 border-l border-white/10 text-center">نوع التكلفة</th>
                <th className="px-6 py-4 border-l border-white/10 text-center">السقف المعتمد (KWD)</th>
                <th className="px-6 py-4 border-l border-white/10 text-center">الفعلي المجرود (KWD)</th>
                <th className="px-6 py-4 border-l border-white/10 text-center">نسبة الاستهلاك</th>
                <th className="px-6 py-4 border-l border-white/10 text-center">الفارق والزيادة</th>
                <th className="px-6 py-4 text-center no-print">تعديل السقف</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-900 font-bold text-xs text-gray-800">
              {allCategories.map(cat => {
                const actual = actualExpenses[cat] || 0;
                const budgetConf = budgets[cat] || { category: cat, monthlyLimit: 0, isFixedCost: false };
                const limit = budgetConf.monthlyLimit;
                const usagePercent = limit > 0 ? Math.round((actual / limit) * 100) : 0;
                const variance = actual - limit;

                const isEditingThis = editingCategory === cat;

                return (
                  <tr key={cat} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 border-l border-gray-900 font-black text-sm">
                      {cat}
                    </td>

                    <td className="px-6 py-4 border-l border-gray-900 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        budgetConf.isFixedCost ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {budgetConf.isFixedCost ? 'ثابتة (Fixed)' : 'متغيرة (Variable)'}
                      </span>
                    </td>

                    <td className="px-6 py-4 border-l border-gray-900 text-center font-mono">
                      {isEditingThis ? (
                        <input
                          type="number"
                          value={newLimitInput}
                          onChange={e => setNewLimitInput(e.target.value)}
                          placeholder={String(limit)}
                          className="w-24 px-2 py-1 bg-white border border-gray-400 rounded text-center text-xs font-mono font-bold"
                        />
                      ) : (
                        <span className="text-gray-700">{limit > 0 ? formatKWD(limit) : 'غير محدد'}</span>
                      )}
                    </td>

                    <td className="px-6 py-4 border-l border-gray-900 text-center font-mono font-black text-gray-900">
                      {formatKWD(actual)}
                    </td>

                    <td className="px-6 py-4 border-l border-gray-900 text-center">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono font-black">
                          <span>%{usagePercent}</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              usagePercent > 100 ? 'bg-rose-500' : usagePercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className={`px-6 py-4 border-l border-gray-900 text-center font-mono font-black ${
                      limit === 0 ? 'text-gray-400' : variance > 0 ? 'text-rose-600 bg-rose-50/20' : 'text-emerald-600'
                    }`}>
                      {limit === 0 ? '---' : variance > 0 ? `+${formatKWD(variance)}` : `${formatKWD(variance)}`}
                    </td>

                    <td className="px-6 py-4 text-center no-print">
                      {isEditingThis ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleUpdateBudget(cat)}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs"
                            title="حفظ السقف"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingCategory('')}
                            className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setNewLimitInput(String(limit));
                            setNewIsFixed(budgetConf.isFixedCost);
                          }}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          ضبط السقف
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Optimization Action Checklist (خطة ضغط التكاليف الفعالة) */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm no-print">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">خطة ضغط وتخفيض التكاليف الموجهة (Actionable Savings Plan)</h3>
              <p className="text-xs font-bold text-gray-400">مهام وتوجيهات عملية لتقليل المصاريف وتوفير السيولة النقدية للفرع</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200">
            <span className="text-xs font-black text-emerald-800">إجمالي التوفير المحقق:</span>
            <span className="font-mono font-black text-emerald-600 text-base">+{formatKWD(achievedSavings)} KWD</span>
          </div>
        </div>

        {/* Add Task Form */}
        <form onSubmit={handleAddTask} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row gap-3 items-center">
          <input
            type="text"
            placeholder="اكتب مهمة جديدة لضغط المصاريف (مثال: إلغاء الاشتراك الخارجي غير المستغل)..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="البند المالي..."
            value={newTaskCat}
            onChange={e => setNewTaskCat(e.target.value)}
            className="w-full md:w-36 px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="الوفر المتوقع (KWD)"
            value={newTaskSaving}
            onChange={e => setNewTaskSaving(e.target.value)}
            className="w-full md:w-36 px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono font-bold outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="w-full md:w-auto px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            إضافة للمهمات
          </button>
        </form>

        {/* Tasks List */}
        <div className="space-y-3">
          {optimizationTasks.map(task => (
            <div 
              key={task.id} 
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                task.completed ? 'bg-emerald-50/50 border-emerald-200 text-gray-400 line-through' : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTaskCompletion(task.id)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                    task.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-400 bg-white'
                  }`}
                >
                  {task.completed && <CheckCircle2 size={16} />}
                </button>
                <div>
                  <p className="font-black text-xs text-gray-900">{task.title}</p>
                  <span className="text-[10px] font-bold text-gray-400">البند: {task.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono font-black text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100">
                  +{formatKWD(task.estimatedSavingKWD)} KWD
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
