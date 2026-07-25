import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  DollarSign, 
  CreditCard, 
  Building, 
  User, 
  Calendar, 
  Plus, 
  RefreshCw, 
  Printer, 
  ArrowUpRight, 
  ChevronDown, 
  AlertTriangle, 
  Send, 
  BadgeAlert,
  Wallet,
  Tag,
  Info,
  Check
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { formatKWD, isTransferType } from '../utils/format';

interface AccrualItem {
  id: string;
  rowIndex: number;
  date: string;
  branch: string;
  employee: string;
  category: string;
  description: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'Due' | 'PartiallyPaid' | 'Paid';
  vendorName: string;
  dueDate: string;
  type: string;
  rawRow: any;
}

interface AccrualLedgerProps {
  branches: string[];
  categories: string[];
  employees: string[];
  onRefresh: () => void;
}

export default function AccrualLedger({ branches, categories, employees, onRefresh }: AccrualLedgerProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Due' | 'PartiallyPaid' | 'Paid'>('Due');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<AccrualItem[]>([]);
  const [settledHistory, setSettledHistory] = useState<Record<string, number>>({});

  // Settlement Modal State
  const [selectedItemForSettlement, setSelectedItemForSettlement] = useState<AccrualItem | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [settlementMethod, setSettlementMethod] = useState<string>('KNET');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [settling, setSettling] = useState<boolean>(false);
  const [settlementSuccess, setSettlementSuccess] = useState<string | null>(null);

  // New Credit Purchase Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newItemData, setNewItemData] = useState({
    branch: branches[0] || 'المكتب الرئيسي',
    employee: employees[0] || 'إدارة',
    category: 'مشتريات',
    vendorName: '',
    amount: '',
    description: '',
    dueDate: '',
    type: 'Expense'
  });
  const [submittingNewItem, setSubmittingNewItem] = useState<boolean>(false);

  // Load saved local settlements
  useEffect(() => {
    const savedSettlements = localStorage.getItem('kwd_accrual_settlements');
    if (savedSettlements) {
      try {
        setSettledHistory(JSON.parse(savedSettlements));
      } catch (e) {}
    }
  }, []);

  // Fetch all transactions from Google Sheets and extract Accrued/Credit items
  const fetchAccruals = async () => {
    setLoading(true);
    try {
      const reportData = await gasService.getReport({
        branch: selectedBranch,
        startDate: '2020-01-01',
        endDate: '2030-12-31'
      });

      if (reportData && reportData.rows) {
        const accruals: AccrualItem[] = [];

        reportData.rows.forEach((row: any, index: number) => {
          const date = String(row[0] || '');
          const branch = String(row[2] || 'عام');
          const type = String(row[3] || '');
          const category = String(row[4] || '');
          const expense = parseFloat(String(row[6])) || 0;
          const income = parseFloat(String(row[5])) || 0;
          const employee = String(row[7] || '');
          const description = row.length > 8 ? String(row[8] || '') : '';

          // Skip transfers
          if (isTransferType(type, category)) return;

          // Check if this row represents an Accrual or Credit Purchase (آجل / مستحق)
          const isAccrued = 
            category.includes('مستحق') || 
            category.includes('مستحقة') || 
            category.includes('آجل') || 
            category.includes('مؤجل') || 
            description.includes('مستحق') || 
            description.includes('مستحقة') || 
            description.includes('آجل') || 
            description.includes('مؤجل') || 
            description.includes('غير مسدد') || 
            description.includes('لم يسدد') || 
            description.includes('دين') ||
            category.toLowerCase().includes('due') ||
            category.toLowerCase().includes('accrued') ||
            description.toLowerCase().includes('due') ||
            description.toLowerCase().includes('accrued');

          if (isAccrued && (expense > 0 || income > 0)) {
            const originalAmount = expense > 0 ? expense : income;
            const itemId = `row_${index}_${date}_${originalAmount}`;
            
            // Check if user previously settled part or full amount locally or via linked payments
            const paidAmount = settledHistory[itemId] || 0;
            const remainingAmount = Math.max(0, originalAmount - paidAmount);

            let status: 'Due' | 'PartiallyPaid' | 'Paid' = 'Due';
            if (remainingAmount <= 0.001) {
              status = 'Paid';
            } else if (paidAmount > 0) {
              status = 'PartiallyPaid';
            }

            // Extract vendor/creditor name if mentioned
            let vendorName = employee || 'مورد / دائن غير مسمى';
            const vendorMatch = description.match(/(?:المورد|الشركة|الدائن|اسم المورد):\s*([^\n,]+)/);
            if (vendorMatch && vendorMatch[1]) {
              vendorName = vendorMatch[1].trim();
            }

            accruals.push({
              id: itemId,
              rowIndex: index,
              date,
              branch,
              employee,
              category: category || 'آجل ومستحق',
              description,
              amount: originalAmount,
              paidAmount,
              remainingAmount,
              status,
              vendorName,
              dueDate: date, // Default due date
              type,
              rawRow: row
            });
          }
        });

        setItems(accruals);
      }
    } catch (err) {
      console.error('Error fetching accruals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccruals();
  }, [selectedBranch, settledHistory]);

  // Handle Settlement Submission
  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSettlement) return;

    const payVal = parseFloat(settlementAmount);
    if (isNaN(payVal) || payVal <= 0) return;

    setSettling(true);
    setSettlementSuccess(null);

    try {
      // 1. Record payment transaction in Google Sheets
      const originalMonth = selectedItemForSettlement.date ? selectedItemForSettlement.date.slice(0, 7) : '';
      const newPaymentTrans = {
        date: new Date().toISOString().split('T')[0],
        type: 'Expense',
        branch: selectedItemForSettlement.branch,
        category: 'سداد مشتريات آجلة ومستحقات (تسوية التزامات)',
        employee: selectedItemForSettlement.employee,
        amount: payVal,
        description: `[سداد مستحقات/آجل سابق - تخص شهر ${originalMonth}] سداد ${settlementMethod} للبند: [${selectedItemForSettlement.category}] - ${selectedItemForSettlement.description}. ${settlementNotes ? 'ملاحظة: ' + settlementNotes : ''}`
      };

      const res = await gasService.addTransaction(newPaymentTrans);

      if (res && res.success) {
        // Update local settlement memory
        const newPaidAmount = (selectedItemForSettlement.paidAmount || 0) + payVal;
        const updatedSettled = {
          ...settledHistory,
          [selectedItemForSettlement.id]: newPaidAmount
        };

        setSettledHistory(updatedSettled);
        localStorage.setItem('kwd_accrual_settlements', JSON.stringify(updatedSettled));

        setSettlementSuccess(`تم تسديد مبلغ ${formatKWD(payVal)} KWD بنجاح وتسجيل عملية الصرف بالمستندات!`);
        setTimeout(() => {
          setSelectedItemForSettlement(null);
          setSettlementSuccess(null);
          setSettlementAmount('');
          setSettlementNotes('');
          onRefresh();
        }, 1500);
      } else {
        alert('حدث خطأ أثناء حفظ عملية السداد: ' + (res.error || 'يرجى المحاولة لاحقاً'));
      }
    } catch (err) {
      console.error('Error settling accrual:', err);
      alert('خطأ أثناء عملية السداد');
    } finally {
      setSettling(false);
    }
  };

  // Add new Credit Purchase
  const handleAddNewCreditPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.amount || parseFloat(newItemData.amount) <= 0) return;

    setSubmittingNewItem(true);
    try {
      const fullDescription = `[مستحق/آجل] ${newItemData.description} ${newItemData.vendorName ? '- المورد/الدائن: ' + newItemData.vendorName : ''} ${newItemData.dueDate ? '- تاريخ الاستحقاق: ' + newItemData.dueDate : ''}`;

      const res = await gasService.addTransaction({
        date: new Date().toISOString().split('T')[0],
        type: newItemData.type,
        branch: newItemData.branch,
        category: `${newItemData.category} (آجل/مستحق)`,
        employee: newItemData.employee,
        amount: parseFloat(newItemData.amount),
        description: fullDescription
      });

      if (res && res.success) {
        setIsAddModalOpen(false);
        setNewItemData({
          branch: branches[0] || 'المكتب الرئيسي',
          employee: employees[0] || 'إدارة',
          category: 'مشتريات',
          vendorName: '',
          amount: '',
          description: '',
          dueDate: '',
          type: 'Expense'
        });
        fetchAccruals();
        onRefresh();
      } else {
        alert('فشل إضافة المشتريات الآجلة: ' + (res?.error || 'خطأ غير معروف'));
      }
    } catch (e) {
      console.error('Error adding credit purchase:', e);
    } finally {
      setSubmittingNewItem(false);
    }
  };

  // Filter items with memoization
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedCategory !== 'All' && !item.category.includes(selectedCategory)) return false;
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchCat = item.category.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchVendor = item.vendorName.toLowerCase().includes(q);
        const matchEmp = item.employee.toLowerCase().includes(q);
        const matchBranch = item.branch.toLowerCase().includes(q);
        const matchAmount = item.amount.toString().includes(q);
        return matchCat || matchDesc || matchVendor || matchEmp || matchBranch || matchAmount;
      }

      return true;
    });
  }, [items, selectedCategory, statusFilter, searchQuery]);

  // Calculate totals with memoization
  const { totalAccruedLiabilities, totalPaidLiabilities, totalRemainingLiabilities, dueItemsCount } = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const paid = items.reduce((sum, item) => sum + item.paidAmount, 0);
    const remaining = items.reduce((sum, item) => sum + item.remainingAmount, 0);
    const dueCount = items.filter(i => i.status !== 'Paid').length;

    return {
      totalAccruedLiabilities: total,
      totalPaidLiabilities: paid,
      totalRemainingLiabilities: remaining,
      dueItemsCount: dueCount
    };
  }, [items]);

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200 pb-8 no-print">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-[2px] bg-amber-500"></div>
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Accounts Payable & Accrued Liabilities</span>
          </div>
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter">
            دفتر المشتريات الآجلة <span className="text-amber-600 italic font-serif font-light">والالتزامات المستحقة</span>
          </h2>
          <p className="text-gray-500 max-w-2xl font-medium text-base leading-relaxed">
            منظومة مالية متكاملة لربط كافة الفواتير والمشتريات الآجلة، متابعة المستحقات للشركات والموردين، وإجراء تسديدات مخصصة مع التزامن التلقائي بالسجلات.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-black text-xs transition-all shadow-md cursor-pointer"
          >
            <Plus size={16} />
            إضافة مشتريات/مصاريف جديدة بالآجل
          </button>

          <button
            onClick={fetchAccruals}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-black text-xs transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي الالتزامات والمستحقات</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black font-mono text-gray-900">
              {formatKWD(totalAccruedLiabilities)} <span className="text-xs text-gray-400 font-sans">KWD</span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 mt-1">كافة الفواتير الآجلة المسجلة بالسجلات</p>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي المسدد بالفعل</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black font-mono text-emerald-600">
              {formatKWD(totalPaidLiabilities)} <span className="text-xs text-emerald-400 font-sans">KWD</span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 mt-1">دفعات التسديد المثبتة بالصرف</p>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">الرصيد المتبقي الواجب سداده</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Wallet size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black font-mono text-rose-600">
              {formatKWD(totalRemainingLiabilities)} <span className="text-xs text-rose-400 font-sans">KWD</span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 mt-1">المبلغ القائم والمطلوب من الفروع</p>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">عدد الفواتير المعلقة</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black font-mono text-gray-900">
              {dueItemsCount} <span className="text-xs text-gray-400 font-sans">فاتورة</span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 mt-1">تحتاج متابعة وتسديد مع الموردين</p>
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm space-y-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث باسم المورد، البيان، رقم الفاتورة، أو الموظف المسؤول..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-11 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-xs text-gray-900 outline-none focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>

          {/* Branch filter */}
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-200">
            <Building size={16} className="text-amber-600" />
            <span className="text-xs font-black text-gray-400 shrink-0">الفرع:</span>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full bg-transparent font-black text-xs text-gray-900 outline-none cursor-pointer"
            >
              <option value="All">كافة الفروع</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-200">
            <Filter size={16} className="text-amber-600" />
            <span className="text-xs font-black text-gray-400 shrink-0">الحالة:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-transparent font-black text-xs text-gray-900 outline-none cursor-pointer"
            >
              <option value="All">كافة الحالات</option>
              <option value="Due">غير مسددة (مستحقة ⚠️)</option>
              <option value="PartiallyPaid">مسددة جزئياً (⏳)</option>
              <option value="Paid">مسددة بالكامل (✅)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Accrual Ledger Table */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900">سجل الفواتير والمستحقات المكتشفة ({filteredItems.length})</h3>
            <p className="text-xs font-bold text-gray-400 mt-1">كشف تفصيلي بكافة المشتريات والمصاريف ذات الصبغة الآجلة والمستحقة</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black flex items-center gap-2 no-print cursor-pointer"
          >
            <Printer size={14} />
            طباعة الكشف
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw size={32} className="animate-spin text-amber-500 mx-auto" />
            <p className="font-black text-sm text-gray-500">جاري جلب وتدقيق السجلات من Google Sheets...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <BadgeAlert size={40} className="text-gray-300 mx-auto" />
            <p className="font-black text-gray-600 text-base">لا يوجد فواتير مستحقة أو مشتريات آجلة مطابقة للبحث حالياً</p>
            <p className="text-xs font-bold text-gray-400">يمكنك تسليم فاتورة آجل جديدة من زر الإضافة بالأعلى.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border-2 border-gray-900">
              <thead>
                <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4 border-l border-white/10">التاريخ</th>
                  <th className="px-6 py-4 border-l border-white/10">الفرع</th>
                  <th className="px-6 py-4 border-l border-white/10">المورد / الجهة الدائنة</th>
                  <th className="px-6 py-4 border-l border-white/10">التصنيف والبيان</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المبلغ الأصلي (KWD)</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المسدد (KWD)</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">المتبقي (KWD)</th>
                  <th className="px-6 py-4 border-l border-white/10 text-center">حالة السداد</th>
                  <th className="px-6 py-4 text-center no-print">إجراء التسديد</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-900 font-bold text-xs text-gray-800">
                {filteredItems.map(item => {
                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-4 border-l border-gray-900 font-mono text-gray-600">
                        {item.date}
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900 font-black">
                        {item.branch}
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-amber-600 shrink-0" />
                          <span className="font-black text-gray-900">{item.vendorName}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900 space-y-1">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-black inline-block">
                          {item.category}
                        </span>
                        <p className="text-xs font-semibold text-gray-700 leading-snug">{item.description}</p>
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900 text-center font-mono font-black text-gray-900">
                        {formatKWD(item.amount)}
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900 text-center font-mono font-black text-emerald-600">
                        {formatKWD(item.paidAmount)}
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900 text-center font-mono font-black text-rose-600 bg-rose-50/20">
                        {formatKWD(item.remainingAmount)}
                      </td>

                      <td className="px-6 py-4 border-l border-gray-900 text-center">
                        {item.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">
                            <CheckCircle2 size={12} /> مسدد بالكامل ✅
                          </span>
                        ) : item.status === 'PartiallyPaid' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-black">
                            <Clock size={12} /> مسدد جزئياً ⏳
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-black animate-pulse">
                            <AlertTriangle size={12} /> غير مسدد ⚠️
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center no-print">
                        {item.remainingAmount > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedItemForSettlement(item);
                              setSettlementAmount(String(item.remainingAmount));
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                          >
                            <CreditCard size={14} />
                            تسديد الدفعة
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[10px] font-bold">مكتمل ✅</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement Modal */}
      <AnimatePresence>
        {selectedItemForSettlement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-gray-900 rounded-[2.5rem] max-w-lg w-full p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                    <CreditCard size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">تسديد مستحقات / فاتورة آجل</h3>
                    <p className="text-xs font-bold text-gray-400">إثبات سداد مالي وتسجيله بالسجلات أوتوماتيكياً</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItemForSettlement(null)}
                  className="text-gray-400 hover:text-gray-600 font-black text-lg"
                >
                  ✕
                </button>
              </div>

              {settlementSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                  <CheckCircle2 size={40} className="text-emerald-600 mx-auto" />
                  <p className="font-black text-emerald-900 text-base">{settlementSuccess}</p>
                </div>
              ) : (
                <form onSubmit={handleSettle} className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1 text-xs">
                    <p className="font-black text-gray-900">البند: {selectedItemForSettlement.category}</p>
                    <p className="text-gray-600">المورد: {selectedItemForSettlement.vendorName}</p>
                    <p className="font-mono text-rose-600 font-bold">
                      الرصيد المتبقي الواجب سداده: {formatKWD(selectedItemForSettlement.remainingAmount)} KWD
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-700">المبلغ المراد تسديده (د.ك)</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      max={selectedItemForSettlement.remainingAmount}
                      value={settlementAmount}
                      onChange={e => setSettlementAmount(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-mono text-xl font-black text-center text-emerald-600 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-700">طريقة الدفع والصرف</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['KNET', 'كاش (نقد)', 'تحويل بنكي'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSettlementMethod(m)}
                          className={`py-2.5 rounded-xl font-black text-xs transition-all border ${
                            settlementMethod === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-700">ملاحظات أو رقم السند (اختياري)</label>
                    <input
                      type="text"
                      placeholder="رقم الفاتورة أو وصل الاستلام..."
                      value={settlementNotes}
                      onChange={e => setSettlementNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={settling}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {settling ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                    تأكيد وتسجيل التسديد
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Credit Purchase Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-gray-900 rounded-[2.5rem] max-w-xl w-full p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl">
                    <Plus size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">تسجيل مشتريات / مصروف آجل جديد</h3>
                    <p className="text-xs font-bold text-gray-400">إضافة فاتورة بالدين أو الالتزامات المالية للشركة</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-black text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddNewCreditPurchase} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-700">الفرع</label>
                    <select
                      value={newItemData.branch}
                      onChange={e => setNewItemData({ ...newItemData, branch: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
                    >
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-700">الموظف المسؤول</label>
                    <select
                      value={newItemData.employee}
                      onChange={e => setNewItemData({ ...newItemData, employee: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
                    >
                      {employees.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-700">التصنيف الرئيسي</label>
                    <select
                      value={newItemData.category}
                      onChange={e => setNewItemData({ ...newItemData, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-700">اسم المورد / الجهة الدائنة</label>
                    <input
                      type="text"
                      required
                      placeholder="شركة..."
                      value={newItemData.vendorName}
                      onChange={e => setNewItemData({ ...newItemData, vendorName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-700">المبلغ الإجمالي بالدين (د.ك)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.000"
                    value={newItemData.amount}
                    onChange={e => setNewItemData({ ...newItemData, amount: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-300 rounded-2xl font-mono text-xl font-black text-amber-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-700">البيان والتفاصيل</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="رقم الفاتورة، التفاصيل، وشروط الدفع..."
                    value={newItemData.description}
                    onChange={e => setNewItemData({ ...newItemData, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingNewItem}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingNewItem ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                  حفظ الفاتورة بالآجل
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
