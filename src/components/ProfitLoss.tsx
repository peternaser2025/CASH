import React, { useState, useEffect, useMemo } from 'react';
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
  Eye,
  X,
  Search,
  FileText,
  HelpCircle,
  Tag
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';
import { formatKWD, isTransferType } from '../utils/format';
import { exportReportToExcel } from '../utils/excelExport';

interface ProfitLossProps {
  branches: string[];
  categories: string[];
  balances: EmployeeBalance[];
  onRefresh: () => void;
}

export type PLOperationType = 
  | 'مبيعات'
  | 'مصاريف نقدية'
  | 'مصاريف مستحقة (آجلة)'
  | 'مشتريات نقدية'
  | 'مشتريات آجلة (دين / موردين)'
  | 'سداد مستحقات ديون سابقة';

export interface PLDetailItem {
  id: string;
  date: string;
  employee: string;
  branch: string;
  category: string;
  description: string;
  amount: number;
  operationType: PLOperationType;
}

interface SavedPLRecord {
  id: string;
  date: string;
  month: string;
  branch: string;
  sales: number;
  expenses: number;
  purchases: number;
  unpaidExpenses: number;
  unpaidPurchases: number;
  netProfit: number;
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
  const [notes, setNotes] = useState<string>('');

  // Autopulled calculations and detailed transaction list
  const [allTransactions, setAllTransactions] = useState<PLDetailItem[]>([]);
  const [pulledExpenses, setPulledExpenses] = useState<number>(0);
  const [pulledPurchases, setPulledPurchases] = useState<number>(0);
  const [pulledUnpaidExpenses, setPulledUnpaidExpenses] = useState<number>(0);
  const [pulledUnpaidPurchases, setPulledUnpaidPurchases] = useState<number>(0);
  const [loadingPulled, setLoadingPulled] = useState<boolean>(false);
  const [pullError, setPullError] = useState<string | null>(null);

  // Drilldown Modal state
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    filterKey: string;
    subtitle: string;
  }>({
    isOpen: false,
    title: '',
    filterKey: '',
    subtitle: ''
  });
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');

  // History list from localStorage and fallback
  const [history, setHistory] = useState<SavedPLRecord[]>([]);
  const [savingRecord, setSavingRecord] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('kwd_pl_history_v2');
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
      const [year, monthStr] = selectedMonth.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(monthStr) - 1;
      
      const startDate = `${year}-${monthStr}-01`;
      const lastDay = new Date(yearNum, monthNum + 1, 0).getDate();
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const reportData = await gasService.getReport({
        branch: selectedBranch,
        startDate,
        endDate
      });

      if (!reportData || !reportData.rows) {
        setAllTransactions([]);
        setPulledExpenses(0);
        setPulledPurchases(0);
        setPulledUnpaidExpenses(0);
        setPulledUnpaidPurchases(0);
        return;
      }

      const items: PLDetailItem[] = [];
      let totalSalesFromRows = 0;
      let totalExpenses = 0;
      let totalPurchases = 0;
      let unpaidExpenses = 0;
      let unpaidPurchases = 0;

      reportData.rows.forEach((row: any, idx: number) => {
        const date = String(getRowValue(row, 0, 'date') || startDate);
        const employee = String(getRowValue(row, 1, 'employee') || 'عام');
        const branch = String(getRowValue(row, 2, 'branch') || selectedBranch);
        const type = String(getRowValue(row, 3, 'type') || '').trim();
        const category = String(getRowValue(row, 4, 'category') || '').trim();
        const incomeAmount = parseFloat(String(getRowValue(row, 5, 'income') || 0)) || 0;
        const expenseAmount = parseFloat(String(getRowValue(row, 6, 'expense') || 0)) || 0;
        const description = String(getRowValue(row, 8, 'description') || getRowValue(row, 7, 'description') || '-').trim();

        // Skip internal transfers / custody movements
        if (isTransferType(type, category)) {
          return;
        }

        // 1. Income / Sales Transaction
        if (incomeAmount > 0 || type === 'إيراد' || type.toLowerCase() === 'income' || type.includes('مبيعات')) {
          totalSalesFromRows += incomeAmount;
          items.push({
            id: `sale-${idx}`,
            date,
            employee,
            branch,
            category: category || 'إيراد مبيعات',
            description: description !== '-' ? description : 'مبيعات شهرية',
            amount: incomeAmount,
            operationType: 'مبيعات'
          });
          return;
        }

        // 2. Expense / Purchase Transaction
        if (expenseAmount > 0) {
          const isSettlement = /سداد.*(مستحق|آجل|اجل|دين|دائن|مورد|التزام)|سداد مشتريات|تسوية التزامات/i.test(`${category} ${description}`) ||
                              description.includes('سداد مستحقات') || 
                              description.includes('سداد آجل') ||
                              category.includes('سداد مشتريات');

          if (isSettlement) {
            items.push({
              id: `settle-${idx}`,
              date,
              employee,
              branch,
              category: category || 'تسوية ديون',
              description,
              amount: expenseAmount,
              operationType: 'سداد مستحقات ديون سابقة'
            });
            return;
          }

          const isAccrual = /آجل|اجل|مستحق|مستحقة|مستحقه|رواتب مستحقة|دين|دائن|مورد|مؤجل|غير مسدد|لم يسدد|deferred|accrual|credit|due/i.test(`${category} ${description}`);
          const isPurchase = category.includes('مشتريات') || category.includes('شراء') || category.toLowerCase().includes('purchase') || description.includes('شراء');

          let opType: PLOperationType = 'مصاريف نقدية';

          if (isPurchase) {
            totalPurchases += expenseAmount;
            if (isAccrual) {
              unpaidPurchases += expenseAmount;
              opType = 'مشتريات آجلة (دين / موردين)';
            } else {
              opType = 'مشتريات نقدية';
            }
          } else {
            totalExpenses += expenseAmount;
            if (isAccrual) {
              unpaidExpenses += expenseAmount;
              opType = 'مصاريف مستحقة (آجلة)';
            } else {
              opType = 'مصاريف نقدية';
            }
          }

          items.push({
            id: `exp-${idx}`,
            date,
            employee,
            branch,
            category: category || (isPurchase ? 'مشتريات' : 'مصاريف'),
            description,
            amount: expenseAmount,
            operationType: opType
          });
        }
      });

      setAllTransactions(items);
      setPulledExpenses(totalExpenses);
      setPulledPurchases(totalPurchases);
      setPulledUnpaidExpenses(unpaidExpenses);
      setPulledUnpaidPurchases(unpaidPurchases);

      // Auto-fill sales input if empty and we found sales from report
      if (!salesInput && totalSalesFromRows > 0) {
        setSalesInput(totalSalesFromRows.toString());
      }

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
  const totalCosts = pulledExpenses + pulledPurchases;
  const netProfit = sales - totalCosts;

  const cashExpenses = Math.max(0, pulledExpenses - pulledUnpaidExpenses);
  const cashPurchases = Math.max(0, pulledPurchases - pulledUnpaidPurchases);
  const pulledSettlements = allTransactions.filter(i => i.operationType === 'سداد مستحقات ديون سابقة').reduce((acc, i) => acc + i.amount, 0);

  // Save the record
  const handleSavePL = async () => {
    if (!salesInput) {
      alert('يرجى إدخال مبلغ مبيعات الشهر الكلية.');
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
      unpaidExpenses: pulledUnpaidExpenses,
      unpaidPurchases: pulledUnpaidPurchases,
      netProfit,
      notes: notes || undefined
    };

    try {
      const plTransaction = {
        employee: 'الأرباح والخسائر',
        date: new Date().toISOString().split('T')[0],
        branch: selectedBranch,
        category: 'سجل أرباح وخسائر',
        type: netProfit >= 0 ? 'Income' : 'Expense',
        amount: Math.abs(netProfit),
        targetMonth: selectedMonth,
        description: `إغلاق شهر ${selectedMonth}: مبيعات (${sales.toFixed(3)}) | مصاريف (${pulledExpenses.toFixed(3)}) | مشتريات (${pulledPurchases.toFixed(3)}) | صافي الربح (${netProfit.toFixed(3)})`
      };

      await gasService.addTransaction(plTransaction);

      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('kwd_pl_history_v2', JSON.stringify(updatedHistory));

      onRefresh();
      setNotes('');
      setSuccessMsg(`تم حفظ إغلاق الأرباح والخسائر لشهر ${selectedMonth} للفرع ${selectedBranch} بنجاح ومزامنته! ✅`);
      
      setTimeout(() => setSuccessMsg(null), 8000);

    } catch (err) {
      console.error('Error saving PL record:', err);
      alert('حدث خطأ أثناء الاتصال ومزامنة البيانات مع Google Sheets.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل من الذاكرة المحلية؟')) {
      const updated = history.filter(item => item.id !== id);
      setHistory(updated);
      localStorage.setItem('kwd_pl_history_v2', JSON.stringify(updated));
    }
  };

  // Open detail modal for a specific P&L item key
  const openDetailModal = (filterKey: string, title: string, subtitle: string) => {
    setModalSearchQuery('');
    setDetailModal({
      isOpen: true,
      filterKey,
      title,
      subtitle
    });
  };

  // Filter items for the active modal
  const modalItems = useMemo(() => {
    if (!detailModal.isOpen) return [];

    let filtered = allTransactions;

    switch (detailModal.filterKey) {
      case 'sales':
        filtered = allTransactions.filter(i => i.operationType === 'مبيعات');
        break;
      case 'expenses_all':
        filtered = allTransactions.filter(i => i.operationType === 'مصاريف نقدية' || i.operationType === 'مصاريف مستحقة (آجلة)');
        break;
      case 'expenses_cash':
        filtered = allTransactions.filter(i => i.operationType === 'مصاريف نقدية');
        break;
      case 'expenses_accrued':
        filtered = allTransactions.filter(i => i.operationType === 'مصاريف مستحقة (آجلة)');
        break;
      case 'purchases_all':
        filtered = allTransactions.filter(i => i.operationType === 'مشتريات نقدية' || i.operationType === 'مشتريات آجلة (دين / موردين)');
        break;
      case 'purchases_cash':
        filtered = allTransactions.filter(i => i.operationType === 'مشتريات نقدية');
        break;
      case 'purchases_accrued':
        filtered = allTransactions.filter(i => i.operationType === 'مشتريات آجلة (دين / موردين)');
        break;
      case 'settlements':
        filtered = allTransactions.filter(i => i.operationType === 'سداد مستحقات ديون سابقة');
        break;
      case 'net_profit':
      default:
        filtered = allTransactions;
        break;
    }

    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        i.category.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.employee.toLowerCase().includes(q) ||
        i.operationType.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allTransactions, detailModal, modalSearchQuery]);

  const modalTotalSum = useMemo(() => {
    return modalItems.reduce((acc, item) => {
      if (item.operationType === 'مبيعات') return acc + item.amount;
      return acc + item.amount;
    }, 0);
  }, [modalItems]);

  // Excel Export for current P&L overview
  const handleExportCurrentPL = () => {
    const fileName = `تقرير_الأرباح_والخسائر_${selectedBranch}_${selectedMonth}`;
    
    const headers = [
      'البند المالي / البيان',
      'القيمة بالدينار الكويتي (د.ك)',
      'توضيح ونوع الالتزام'
    ];

    const rows = [
      ['إيرادات مبيعات الشهر (+)', sales, 'إيرادات مبيعات النشاط بالشهر'],
      ['إجمالي مصاريف التشغيل والفرع (-)', pulledExpenses, 'مصاريف تشغيلية (نقدية + مستحقة)'],
      ['  └─ مصاريف تشغيلية مدفوعة نقداً', cashExpenses, 'مدفوعة نقداً'],
      ['  └─ مصاريف مستحقة (آجلة)', pulledUnpaidExpenses, 'التزام آجل لم يُدفع'],
      ['إجمالي مشتريات الفرع والمخزون (-)', pulledPurchases, 'مشتريات بضاعة ومخزون (كاش + آجل)'],
      ['  └─ مشتريات نقدية (من الخزنة)', cashPurchases, 'مشتريات نقدية مسددة'],
      ['  └─ مشتريات بالدين وآجلة (موردين)', pulledUnpaidPurchases, 'مشتريات آجلة للذمم والدائنين'],
      ['إجمالي التكاليف والمصاريف الكلية (-)', totalCosts, 'مصاريف + مشتريات'],
      ['صافي ربح / خسارة النشاط بالشهر (أساس الاستحقاق)', netProfit, netProfit >= 0 ? 'ربح تشغيلي صافي' : 'خسارة تشغيلية']
    ];

    // Build sections for detailed breakdowns
    const purchaseAndExpenseItems = allTransactions.map(i => [
      i.date,
      i.employee,
      i.operationType,
      i.category,
      i.description,
      i.amount
    ]);

    exportReportToExcel({
      fileName,
      sheetName: 'الأرباح والخسائر',
      reportTitle: `تقرير الأرباح والخسائر - فرع ${selectedBranch}`,
      subtitle: `شهر التقرير: ${selectedMonth} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')}`,
      summaryCards: [
        { label: 'إجمالي المبيعات (+)', value: sales },
        { label: 'إجمالي التكاليف والمصاريف (-)', value: totalCosts },
        { label: 'صافي الربح / الخسارة', value: netProfit },
        { label: 'عدد الحركات المسجلة', value: `${allTransactions.length} حركة` },
      ],
      headers,
      rows,
      totalsRow: [
        'صافي النتيجة النهائية',
        netProfit,
        netProfit >= 0 ? 'ربح صافي' : 'خسارة'
      ],
      sections: [
        {
          title: 'جدول الحركات والعمليات التفصيلية بالبند ونوع العملية',
          headers: ['التاريخ', 'الموظف', 'نوع العملية', 'التصنيف / البند', 'البيان والتفاصيل', 'المبلغ (د.ك)'],
          rows: purchaseAndExpenseItems,
          totalsRow: [
            'المجموع الكلي للحركات',
            '-',
            '-',
            '-',
            '-',
            totalCosts
          ]
        }
      ]
    });
  };

  // Excel Export for Modal Breakdown
  const handleExportModalExcel = () => {
    const fileName = `تفاصيل_${detailModal.title.replace(/\s+/g, '_')}_${selectedBranch}_${selectedMonth}`;
    
    const headers = [
      'التاريخ',
      'الموظف المسؤول',
      'نوع العملية',
      'التصنيف / البند',
      'البيان والتفاصيل الشاملة',
      'المبلغ بالدينار (د.ك)'
    ];

    const rows = modalItems.map(item => [
      item.date,
      item.employee,
      item.operationType,
      item.category,
      item.description,
      item.amount
    ]);

    exportReportToExcel({
      fileName,
      sheetName: 'تفاصيل البند',
      reportTitle: `تفاصيل بند: ${detailModal.title}`,
      subtitle: `الفرع: ${selectedBranch} | الشهر: ${selectedMonth} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')}`,
      summaryCards: [
        { label: 'اسم البند المالي', value: detailModal.title },
        { label: 'عدد العمليات والحركات', value: `${modalItems.length} حركة` },
        { label: 'إجمالي القيمة الكلية للبند', value: modalTotalSum },
      ],
      headers,
      rows,
      totalsRow: [
        'الإجمالي الكلي للبند المالي',
        '-',
        '-',
        '-',
        '-',
        modalTotalSum
      ]
    });
  };

  const getOpBadgeStyle = (opType: PLOperationType) => {
    switch (opType) {
      case 'مبيعات':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'مصاريف نقدية':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'مصاريف مستحقة (آجلة)':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      case 'مشتريات نقدية':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'مشتريات آجلة (دين / موردين)':
        return 'bg-orange-100 text-orange-950 border-orange-300 font-black';
      case 'سداد مستحقات ديون سابقة':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200 pb-8 no-print">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-[2px] bg-emerald-500"></div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Financial Profit & Loss</span>
          </div>
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter">
            الأرباح <span className="text-emerald-600 italic font-serif font-light">والخسائر</span>
          </h2>
          <p className="text-gray-500 max-w-lg font-medium text-base leading-relaxed">
            قائمة أرباح وخسائر النشاط شهرياً (أساس الاستحقاق المحاسبي)، مع إمكانية النقر على أي بند لعرض كافة تفاصيل حركاته.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCurrentPL}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm transition-all shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            تصدير تقرير الأرباح (Excel)
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-900 hover:bg-gray-900 hover:text-white rounded-full font-black text-sm transition-all cursor-pointer"
          >
            <Printer size={16} />
            طباعة التقرير الحالي
          </button>
        </div>
      </div>

      {/* Main Grid for calculation and report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Calculation Form - Left Side */}
        <div className="lg:col-span-5 bg-white border-2 border-gray-900 rounded-[2rem] shadow-sm p-8 space-y-6 no-print">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <Calculator className="text-emerald-600" size={24} />
            <h3 className="text-lg font-black text-gray-900">تحديد الفرع ومبيعات الشهر</h3>
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
              <p className="text-xs font-black text-slate-800">بيانات الحركات المسحوبة للفرع</p>
              <p className="text-[10px] font-bold text-slate-500">تم جرد المصروفات والمشتريات ({allTransactions.length} حركة)</p>
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
            {/* Sales Input */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-gray-700">مبيعات الشهر الكلية (KWD)</label>
                <span className="text-[10px] font-bold text-emerald-600">إيرادات النشاط (+)</span>
              </div>
              <input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={salesInput}
                onChange={e => setSalesInput(e.target.value)}
                className="w-full px-4 py-3 bg-emerald-50/40 border-2 border-emerald-200 rounded-2xl font-mono font-bold text-base outline-none focus:border-emerald-600 focus:bg-white transition-all text-left text-emerald-900"
              />
            </div>

            {/* Pulled Expenses & Purchases Summary Box */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-gray-500">مصاريف التشغيل</label>
                  {pulledUnpaidExpenses > 0 && (
                    <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                      منها {formatKWD(pulledUnpaidExpenses)} آجل
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 bg-red-50/50 border-2 border-red-100 rounded-2xl font-mono font-bold text-sm text-red-600 flex justify-between items-center">
                  <span>{formatKWD(pulledExpenses)}</span>
                  <span className="text-[10px] text-red-400">KWD</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-gray-500">مشتريات الفرع</label>
                  {pulledUnpaidPurchases > 0 && (
                    <span className="text-[9px] font-black text-orange-900 bg-orange-100 px-1.5 py-0.5 rounded-md border border-orange-200">
                      منها {formatKWD(pulledUnpaidPurchases)} آجل
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 bg-amber-50/50 border-2 border-amber-100 rounded-2xl font-mono font-bold text-sm text-amber-700 flex justify-between items-center">
                  <span>{formatKWD(pulledPurchases)}</span>
                  <span className="text-[10px] text-amber-400">KWD</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-700">ملاحظات الإغلاق (اختياري)</label>
              <textarea
                rows={2}
                placeholder="أية ملاحظات خاصة بأرباح هذا الشهر..."
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
                جاري المزامنة والحفظ...
              </>
            ) : (
              <>
                <Save size={16} />
                حفظ وإغلاق تقرير هذا الشهر
              </>
            )}
          </button>
        </div>

        {/* Profit & Loss Report Sheet - Right Side */}
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
                  P&L
                </div>
                <div>
                  <h4 className="text-xl font-black text-gray-900">تقرير الأرباح والخسائر التشغيلية</h4>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                    {selectedBranch} — شهر {selectedMonth}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-black text-[10px]">
                  💡 اضغط على أي بند بالجدول لعرض التفاصيل
                </span>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-8 space-y-8">
              {/* Three Pillars Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Sales Pillar */}
                <div 
                  onClick={() => openDetailModal('sales', 'إيرادات مبيعات الشهر', 'كافة حركات الإيرادات والمبيعات المقيدة')}
                  className="p-6 bg-emerald-50/40 rounded-2xl border-2 border-emerald-200 flex flex-col justify-between hover:border-emerald-500 transition-all cursor-pointer group shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">إجمالي المبيعات (+)</span>
                    <Eye size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black font-mono tracking-tight text-emerald-600">
                      {formatKWD(sales)}
                    </span>
                    <span className="text-[10px] font-black text-emerald-500">KWD</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 mt-2 opacity-80">انقر لعرض الحركات 🔍</span>
                </div>

                {/* Costs Pillar */}
                <div 
                  onClick={() => openDetailModal('net_profit', 'إجمالي المصاريف والمشتريات الكلية', 'كافة حركات المصاريف والمشتريات المسجلة')}
                  className="p-6 bg-red-50/40 rounded-2xl border-2 border-red-200 flex flex-col justify-between hover:border-red-500 transition-all cursor-pointer group shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">إجمالي التكاليف (-)</span>
                    <Eye size={16} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-3xl font-black font-mono tracking-tight text-red-600">
                      {formatKWD(totalCosts)}
                    </span>
                    <span className="text-[10px] font-black text-red-500">KWD</span>
                  </div>
                  <span className="text-[9px] font-bold text-red-600 mt-2 opacity-80">انقر لعرض الحركات 🔍</span>
                </div>

                {/* Net Profit Pillar */}
                <div 
                  onClick={() => openDetailModal('net_profit', 'صافي ربح / خسارة النشاط', 'كافة حركات الإيرادات والتكاليف المحتسبة')}
                  className={`p-6 rounded-2xl border-2 flex flex-col justify-between transition-all cursor-pointer group shadow-xs ${
                    netProfit >= 0 ? 'bg-blue-50/40 border-blue-200 hover:border-blue-500' : 'bg-rose-50/40 border-rose-200 hover:border-rose-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      netProfit >= 0 ? 'text-blue-700' : 'text-rose-700'
                    }`}>
                      صافي الأرباح التشغيلية
                    </span>
                    <Eye size={16} className={`opacity-0 group-hover:opacity-100 transition-opacity ${netProfit >= 0 ? 'text-blue-500' : 'text-rose-500'}`} />
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {formatKWD(netProfit)}
                    </span>
                    <span className="text-[10px] font-black text-gray-500">KWD</span>
                  </div>
                  <span className={`text-[9px] font-bold mt-2 opacity-80 ${netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    انقر لعرض الحركات 🔍
                  </span>
                </div>

              </div>

              {/* Interactive Detailed Breakdown Table */}
              <div className="border-2 border-gray-900 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                      <th className="px-6 py-4 border-l border-white/10">البند المالي (انقر على أي بند للتفاصيل)</th>
                      <th className="px-6 py-4 text-center border-l border-white/10">نوع التكلفة والالتزام</th>
                      <th className="px-6 py-4 text-center">المبلغ (KWD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-bold text-xs text-gray-800">
                    
                    {/* Sales Row */}
                    <tr 
                      onClick={() => openDetailModal('sales', 'إيرادات مبيعات الشهر', 'جميع الفواتير وإيرادات المبيعات المقيدة لهذا الفرع')}
                      className="bg-emerald-50/30 hover:bg-emerald-100/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 border-l border-gray-200 font-black text-emerald-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold">🟢</span>
                          <span>إيرادات مبيعات الشهر (+)</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-100">
                          عرض التفاصيل 🔍
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center border-l border-gray-200 text-emerald-800 text-[11px]">إيرادات نشاط</td>
                      <td className="px-6 py-4 text-center font-mono text-emerald-700 font-black text-sm">{formatKWD(sales)}</td>
                    </tr>

                    {/* Total Expenses Row */}
                    <tr 
                      onClick={() => openDetailModal('expenses_all', 'إجمالي مصاريف التشغيل والفرع', 'كافة مصاريف التشغيل سواء المدفوعة نقداً أو المستحقة')}
                      className="bg-red-50/40 hover:bg-red-100/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-3.5 border-l border-gray-200 font-black text-red-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600 font-bold">🔴</span>
                          <span>إجمالي مصاريف التشغيل والفرع (-)</span>
                        </div>
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-100">
                          عرض التفاصيل 🔍
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center border-l border-gray-200 text-red-700 text-[11px]">تشمل النقدية والمستحقة</td>
                      <td className="px-6 py-3.5 text-center font-mono text-red-600 font-black text-sm">{formatKWD(pulledExpenses)}</td>
                    </tr>

                    {/* Cash Expenses Sub-row */}
                    <tr 
                      onClick={() => openDetailModal('expenses_cash', 'مصاريف تشغيلية مدفوعة نقداً', 'المصاريف التشغيلية التي تم سدادها نقداً من الخزنة')}
                      className="text-[11px] text-gray-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer group"
                    >
                      <td className="px-10 py-2.5 border-l border-gray-200 font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>💵 مصاريف تشغيلية مدفوعة نقداً</span>
                        </div>
                        <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100">عرض التفاصيل 🔍</span>
                      </td>
                      <td className="px-6 py-2.5 text-center border-l border-gray-200 font-mono text-slate-500">مدفوع نقداً</td>
                      <td className="px-6 py-2.5 text-center font-mono text-gray-800">{formatKWD(cashExpenses)}</td>
                    </tr>

                    {/* Accrued Expenses Sub-row */}
                    <tr 
                      onClick={() => openDetailModal('expenses_accrued', 'مصاريف مستحقة (آجلة لم تُدفع)', 'المصاريف والالتزامات المستحقة على الفرع ولم تُدفع بعد')}
                      className="text-[11px] text-amber-950 bg-amber-50/40 hover:bg-amber-100/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-10 py-2.5 border-l border-gray-200 font-black flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>🧾 مصاريف مستحقة (آجلة لم تُدفع)</span>
                        </div>
                        <span className="text-[9px] text-amber-800 opacity-80 group-hover:opacity-100">عرض التفاصيل 🔍</span>
                      </td>
                      <td className="px-6 py-2.5 text-center border-l border-gray-200 font-mono text-amber-800 font-bold">مصاريف مستحقة</td>
                      <td className="px-6 py-2.5 text-center font-mono font-black text-amber-800">{formatKWD(pulledUnpaidExpenses)}</td>
                    </tr>

                    {/* Total Purchases Row */}
                    <tr 
                      onClick={() => openDetailModal('purchases_all', 'إجمالي مشتريات الفرع والمخزون', 'كافة مشتريات البضائع والمستلزمات (كاش وآجل)')}
                      className="bg-amber-50/60 hover:bg-amber-100/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-3.5 border-l border-gray-200 font-black text-amber-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-600 font-bold">📦</span>
                          <span>إجمالي مشتريات الفرع والمخزون (-)</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-100">
                          عرض التفاصيل 🔍
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center border-l border-gray-200 text-amber-800 text-[11px]">تشمل الكاش والآجل</td>
                      <td className="px-6 py-3.5 text-center font-mono text-amber-800 font-black text-sm">{formatKWD(pulledPurchases)}</td>
                    </tr>

                    {/* Cash Purchases Sub-row */}
                    <tr 
                      onClick={() => openDetailModal('purchases_cash', 'مشتريات نقدية (مدفوعة من الخزنة)', 'المشتريات التي تم سدادها فوراً من النقدية والسيولة')}
                      className="text-[11px] text-gray-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer group"
                    >
                      <td className="px-10 py-2.5 border-l border-gray-200 font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>💳 مشتريات نقدية (مدفوعة من الخزنة)</span>
                        </div>
                        <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100">عرض التفاصيل 🔍</span>
                      </td>
                      <td className="px-6 py-2.5 text-center border-l border-gray-200 font-mono text-slate-500">مشتريات كاش</td>
                      <td className="px-6 py-2.5 text-center font-mono text-gray-800">{formatKWD(cashPurchases)}</td>
                    </tr>

                    {/* Credit Purchases Sub-row */}
                    <tr 
                      onClick={() => openDetailModal('purchases_accrued', 'مشتريات بالدين وآجلة (دائنون / موردين)', 'فواتير المشتريات الآجلة المترتبة للموردين والدائنين')}
                      className="text-[11px] text-orange-950 bg-orange-50/50 hover:bg-orange-100/70 transition-colors cursor-pointer group"
                    >
                      <td className="px-10 py-2.5 border-l border-gray-200 font-black flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>🚚 مشتريات بالدين وآجلة (دائنون / موردين)</span>
                        </div>
                        <span className="text-[9px] text-orange-800 opacity-80 group-hover:opacity-100">عرض التفاصيل 🔍</span>
                      </td>
                      <td className="px-6 py-2.5 text-center border-l border-gray-200 font-mono text-orange-800 font-bold">مشتريات آجلة</td>
                      <td className="px-6 py-2.5 text-center font-mono font-black text-orange-900">{formatKWD(pulledUnpaidPurchases)}</td>
                    </tr>

                    {/* Settlements Row (Pure Cash Flow / Liability Settlement - Excluded from P&L Expenses) */}
                    <tr 
                      onClick={() => openDetailModal('settlements', 'سداد مستحقات وديون سابقة (تسوية التزامات)', 'حركات السداد النقدي للآجل والمستحقات، تم خصمها من الصندوق ومستبعدة من مصاريف P&L هذا الشهر لمنع التكرار')}
                      className="text-[11px] text-purple-950 bg-purple-50/60 hover:bg-purple-100/80 transition-colors cursor-pointer group border-t border-purple-100"
                    >
                      <td className="px-6 py-3 border-l border-gray-200 font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600 text-sm">💳</span>
                          <div>
                            <span className="font-black text-purple-950">سداد مستحقات وآجل ديون سابقة (تسوية التزامات)</span>
                            <span className="block text-[10px] text-purple-700 font-bold">
                              خصم نقدي مباشر من الصندوق | مستبعد تماماً من تكاليف P&L لهذا الشهر
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-purple-800 bg-purple-200/80 px-2.5 py-0.5 rounded-full opacity-80 group-hover:opacity-100">
                          عرض التفاصيل 🔍
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center border-l border-gray-200 font-mono text-purple-800 font-black">خصم صندوق فقط</td>
                      <td className="px-6 py-3 text-center font-mono font-black text-purple-950 text-sm">{formatKWD(pulledSettlements)}</td>
                    </tr>

                    {/* Net Profit Summary Row */}
                    <tr 
                      onClick={() => openDetailModal('net_profit', 'صافي ربح / خسارة النشاط بالشهر', 'ملخص كافة الحركات المؤثرة على صافي أرباح الشهر')}
                      className="bg-blue-50/80 font-black text-blue-950 border-t-2 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 border-l border-blue-200 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📈</span>
                            <div>
                              <span className="font-black text-blue-950 text-sm">صافي ربح / خسارة النشاط بالشهر (أساس الاستحقاق):</span>
                              <span className="block text-[10px] font-bold text-blue-800 mt-0.5">
                                المبيعات ({formatKWD(sales)}) - إجمالي المصاريف والمشتريات ({formatKWD(totalCosts)})
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-100">
                            عرض كافة الحركات 🔍
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center border-l border-blue-200 text-blue-800 text-[11px] font-bold">
                        نتيجة صافية
                      </td>
                      <td className={`px-6 py-4 text-center font-mono font-black text-lg ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatKWD(netProfit)}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>

              {notes && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700">
                  <span className="text-gray-400 block mb-1">ملاحظات الإغلاق المرفقة:</span>
                  {notes}
                </div>
              )}

              {/* Official Printable Signature Block for Financial Statements */}
              <div className="print-signatures-block mt-8 pt-6 border-t-2 border-dashed border-gray-300">
                <div className="print-signature-box">
                  <span className="block font-black text-xs text-gray-900">إعداد / قسم المحاسبة</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">التوقيع والتاريخ</p>
                  <div className="print-signature-line">اسم المحاسب: ....................</div>
                </div>
                <div className="print-signature-box">
                  <span className="block font-black text-xs text-gray-900">مراجعة وتدقيق الإدارة المالية</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">التوقيع والتاريخ</p>
                  <div className="print-signature-line">اسم المدقق: ....................</div>
                </div>
                <div className="print-signature-box">
                  <span className="block font-black text-xs text-gray-900">الاعتماد والختم الرسمي</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">مدير الشركة / المالك</p>
                  <div className="print-signature-line">التوقيع والختم: ....................</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* History List of Saved Months */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] shadow-sm p-8 space-y-6 no-print">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <History className="text-slate-700" size={22} />
            <h3 className="text-lg font-black text-gray-900">سجل إغلاقات الأرباح والخسائر التاريخي</h3>
          </div>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg uppercase">
            {history.length} إغلاق مسجل
          </span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-400 space-y-2">
            <FileSpreadsheet size={40} className="mx-auto text-gray-300" />
            <p className="font-black text-sm">لا توجد سجلات أرباح وخسائر مغلقة ومحفوظة حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border-2 border-gray-900">
              <thead>
                <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4 border-l border-white/10">الشهر</th>
                  <th className="px-6 py-4 border-l border-white/10">الفرع</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المبيعات (+)</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المصاريف والمشتريات (-)</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">صافي الأرباح</th>
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

      {/* Itemization Detail Modal */}
      <AnimatePresence>
        {detailModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border-2 border-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden dir-rtl"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gray-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 text-gray-950 rounded-xl font-black">
                    <Tag size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{detailModal.title}</h3>
                    <p className="text-xs text-gray-300 font-medium mt-0.5">
                      {detailModal.subtitle} — فرع: {selectedBranch} ({selectedMonth})
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm no-print"
                  >
                    <Printer size={14} />
                    طباعة كشف البند
                  </button>
                  <button
                    onClick={handleExportModalExcel}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm no-print"
                  >
                    <FileSpreadsheet size={14} />
                    تصدير البند (Excel)
                  </button>
                  <button
                    onClick={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
                    className="p-2 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer no-print"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Toolbar & Search */}
              <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                <div className="relative w-full sm:w-80">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="بحث في التفاصيل أو البند أو الموظف..."
                    value={modalSearchQuery}
                    onChange={e => setModalSearchQuery(e.target.value)}
                    className="w-full pr-9 pl-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="text-gray-500">عدد العمليات: <strong className="text-gray-900 font-mono">{modalItems.length}</strong></span>
                  <span className="w-[1px] h-4 bg-gray-300"></span>
                  <span className="text-gray-500">إجمالي المبلغ: <strong className="text-emerald-700 font-mono text-sm">{formatKWD(modalTotalSum)} KWD</strong></span>
                </div>
              </div>

              {/* Modal Body Table */}
              <div className="overflow-y-auto p-6 flex-1">
                {modalItems.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 space-y-2">
                    <FileText size={48} className="mx-auto text-gray-300" />
                    <p className="font-black text-base">لا توجد حركات مسجلة تنطبق على هذا البند والمحددات.</p>
                  </div>
                ) : (
                  <div className="border-2 border-gray-900 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-gray-900 text-white text-[11px] font-black uppercase tracking-wider">
                          <th className="px-4 py-3 border-l border-white/10">التاريخ</th>
                          <th className="px-4 py-3 border-l border-white/10">الموظف</th>
                          <th className="px-4 py-3 border-l border-white/10 text-center">نوع العملية</th>
                          <th className="px-4 py-3 border-l border-white/10">التصنيف / البند</th>
                          <th className="px-4 py-3 border-l border-white/10">البيان والتفاصيل</th>
                          <th className="px-4 py-3 text-center">المبلغ (KWD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-bold text-xs text-gray-800">
                        {modalItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 border-l border-gray-200 font-mono text-[11px] shrink-0 whitespace-nowrap">{item.date}</td>
                            <td className="px-4 py-3 border-l border-gray-200 text-gray-900">{item.employee}</td>
                            <td className="px-4 py-3 border-l border-gray-200 text-center shrink-0 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getOpBadgeStyle(item.operationType)}`}>
                                {item.operationType}
                              </span>
                            </td>
                            <td className="px-4 py-3 border-l border-gray-200 text-emerald-950 font-black">{item.category}</td>
                            <td className="px-4 py-3 border-l border-gray-200 text-gray-600 font-medium text-[11px] max-w-xs">{item.description}</td>
                            <td className="px-4 py-3 text-center font-mono font-black text-sm text-gray-900 whitespace-nowrap">
                              {formatKWD(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-900 text-white font-black text-xs">
                          <td colSpan={5} className="px-4 py-3 text-left border-l border-white/20">
                            الإجمالي الكلي للبند
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-emerald-400 font-black text-base">
                            {formatKWD(modalTotalSum)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Print Signature Block for Itemized Schedule */}
                <div className="print-signatures-block mt-6 pt-4 border-t border-slate-300">
                  <div className="print-signature-box">
                    <span className="block font-black text-xs text-gray-900">إعداد كشف البند</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">التوقيع والتاريخ</p>
                    <div className="print-signature-line">اسم الموظف: ....................</div>
                  </div>
                  <div className="print-signature-box">
                    <span className="block font-black text-xs text-gray-900">تدقيق الحركات والتصنيف</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">التوقيع والتاريخ</p>
                    <div className="print-signature-line">المراجع المالي: ....................</div>
                  </div>
                  <div className="print-signature-box">
                    <span className="block font-black text-xs text-gray-900">اعتماد الكشف التفصيلي</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">مدير الإدارة المالية</p>
                    <div className="print-signature-line">التوقيع والختم: ....................</div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
                <button
                  onClick={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
