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
  FileSpreadsheet,
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
import { exportReportToExcel } from '../utils/excelExport';

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
        const sheetsSettlements: Record<string, number> = {};

        // Pass 1: Identify all settlement transactions in Google Sheets and map their payments
        reportData.rows.forEach((row: any) => {
          const category = String(row[4] || '');
          const expense = parseFloat(String(row[6])) || 0;
          const description = row.length > 8 ? String(row[8] || '') : '';

          const isSettlement = /سداد|تسوية/i.test(`${category} ${description}`);
          if (isSettlement && expense > 0) {
            // Extract embedded ACCRUAL_REF ID if present
            const refMatch = description.match(/ACCRUAL_REF:(row_[^\s\]]+)/) || description.match(/REF:(row_[^\s\]]+)/);
            if (refMatch && refMatch[1]) {
              const refId = refMatch[1];
              sheetsSettlements[refId] = (sheetsSettlements[refId] || 0) + expense;
            }
          }
        });

        // Pass 2: Identify original Accrual / Deferred / Credit items (excluding settlements)
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

          // IMPORTANT: Skip settlement rows (sadaad / taswaya) so paying a debt doesn't create a new debt!
          const isSettlement = /سداد|تسوية/i.test(`${category} ${description}`);
          if (isSettlement) return;

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
            
            // Sum paid amounts from both Google Sheets settlement rows and local storage memory
            const paidFromSheets = sheetsSettlements[itemId] || 0;
            const paidFromLocal = settledHistory[itemId] || 0;
            const paidAmount = Math.max(paidFromSheets, paidFromLocal);
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
        description: `[سداد مستحقات/آجل - ACCRUAL_REF:${selectedItemForSettlement.id}] [تخص شهر ${originalMonth}] سداد ${settlementMethod} للبند: [${selectedItemForSettlement.category}] - ${selectedItemForSettlement.description}. ${settlementNotes ? 'ملاحظة: ' + settlementNotes : ''}`
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

  const handleExportAccrualsExcel = () => {
    const fileName = `دفتر_المشتريات_والالتزامات_الآجلة_${selectedBranch}_${statusFilter}`;

    const headers = [
      'التاريخ',
      'الفرع',
      'اسم المورد / الجهة الدائنة',
      'التصنيف',
      'البيان والتفاصيل',
      'المبلغ الأصلي (د.ك)',
      'المسدد بالفعل (د.ك)',
      'الرصيد المتبقي (د.ك)',
      'حالة السداد'
    ];

    const rows = filteredItems.map(item => [
      item.date,
      item.branch,
      item.vendorName,
      item.category,
      item.description,
      item.amount,
      item.paidAmount,
      item.remainingAmount,
      item.status === 'Paid' ? 'مسدد بالكامل' : item.status === 'PartiallyPaid' ? 'مسدد جزئياً' : 'غير مسدد (مستحق)'
    ]);

    exportReportToExcel({
      fileName,
      sheetName: 'دفتر المستحقات',
      reportTitle: 'دفتر المشتريات الآجلة والالتزامات المستحقة',
      subtitle: `الفرع: ${selectedBranch} | الحالة: ${statusFilter} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')}`,
      summaryCards: [
        { label: 'إجمالي المستحقات المسجلة', value: formatKWD(totalAccruedLiabilities) },
        { label: 'إجمالي المسدد بالفعل', value: formatKWD(totalPaidLiabilities) },
        { label: 'الرصيد المتبقي المستحق', value: formatKWD(totalRemainingLiabilities) },
        { label: 'عدد الفواتير المعلقة', value: `${dueItemsCount} فاتورة` },
      ],
      headers,
      rows,
      totalsRow: [
        'المجموع الإجمالي',
        '-',
        '-',
        '-',
        '-',
        totalAccruedLiabilities,
        totalPaidLiabilities,
        totalRemainingLiabilities,
        '-'
      ]
    });
  };

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6 no-print">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 text-xs font-bold rounded-md border border-amber-200">
              Accounts Payable & Accruals
            </span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            دفتر المشتريات الآجلة والالتزامات المستحقة
          </h2>
          <p className="text-slate-500 font-medium text-xs leading-relaxed max-w-2xl">
            سجل مالي متكامل لربط فواتير الشراء والخدمات الآجلة، متابعة المستحقات للدائنين والموردين، وتوثيق التسديدات بشكل دقيق.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportAccrualsExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            تصدير إلى إكسيل (Excel)
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            إضافة مشتريات/مصاريف آجلة
          </button>

          <button
            onClick={fetchAccruals}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer border border-slate-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500">إجمالي المستحقات المسجلة</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono text-slate-900">
              {formatKWD(totalAccruedLiabilities)} <span className="text-xs text-slate-400 font-sans">د.ك</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">كافة الفواتير والمستحقات الآجلة</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500">إجمالي المسدد بالفعل</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600">
              {formatKWD(totalPaidLiabilities)} <span className="text-xs text-emerald-500/70 font-sans">د.ك</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">دفوعات التسديد المسجلة بالصندوق</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500">الرصيد المتبقي المستحق</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono text-rose-600">
              {formatKWD(totalRemainingLiabilities)} <span className="text-xs text-rose-400 font-sans">د.ك</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">المبلغ القائم والمطلوب سداده</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500">الفواتير القائمة المعلقة</span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono text-slate-900">
              {dueItemsCount} <span className="text-xs text-slate-400 font-sans">فاتورة</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">تحتاج متابعة وتسديد</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم المورد، البيان، رقم الفاتورة، أو الموظف المسؤول..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
            />
          </div>

          {/* Branch filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <Building size={15} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-500 shrink-0">الفرع:</span>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full bg-transparent font-bold text-xs text-slate-900 outline-none cursor-pointer"
            >
              <option value="All">كافة الفروع</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <Filter size={15} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-500 shrink-0">الحالة:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-transparent font-bold text-xs text-slate-900 outline-none cursor-pointer"
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">سجل الفواتير والمستحقات المكتشفة ({filteredItems.length})</h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">كشف تفصيلي بكافة المشتريات والمصاريف ذات الصبغة الآجلة والمستحقة</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handleExportAccrualsExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              تصدير إكسيل
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Printer size={14} />
              طباعة الكشف
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-amber-500 mx-auto" />
            <p className="font-bold text-xs text-slate-500">جاري جلب وتدقيق السجلات من Google Sheets...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <BadgeAlert size={36} className="text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">لا توجد فواتير مستحقة أو مشتريات آجلة مطابقة للبحث</p>
            <p className="text-xs font-medium text-slate-400">يمكنك تسليم فاتورة آجل جديدة من زر الإضافة بالأعلى.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-100 text-xs font-bold">
                  <th className="px-4 py-3 border-b border-slate-800">التاريخ</th>
                  <th className="px-4 py-3 border-b border-slate-800">الفرع</th>
                  <th className="px-4 py-3 border-b border-slate-800">المورد / الجهة الدائنة</th>
                  <th className="px-4 py-3 border-b border-slate-800">التصنيف والبيان</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-center">المبلغ الأصلي</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-center">المسدد</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-center">المتبقي</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-center">حالة السداد</th>
                  <th className="px-4 py-3 text-center no-print border-b border-slate-800">إجراء التسديد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-semibold text-xs text-slate-800 bg-white">
                {filteredItems.map(item => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {item.date}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">
                        {item.branch}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-amber-600 shrink-0" />
                          <span className="font-bold text-slate-900">{item.vendorName}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 space-y-1">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-bold inline-block border border-amber-200/60">
                          {item.category}
                        </span>
                        <p className="text-xs font-medium text-slate-700 leading-snug">{item.description}</p>
                      </td>

                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                        {formatKWD(item.amount)}
                      </td>

                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">
                        {formatKWD(item.paidAmount)}
                      </td>

                      <td className="px-4 py-3 text-center font-mono font-extrabold text-rose-600 bg-rose-50/20">
                        {formatKWD(item.remainingAmount)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {item.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md text-[11px] font-bold">
                            <CheckCircle2 size={12} /> مسدد بالكامل
                          </span>
                        ) : item.status === 'PartiallyPaid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md text-[11px] font-bold">
                            <Clock size={12} /> مسدد جزئياً
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-md text-[11px] font-bold">
                            <AlertTriangle size={12} /> غير مسدد
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center no-print">
                        {item.remainingAmount > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedItemForSettlement(item);
                              setSettlementAmount(String(item.remainingAmount));
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                          >
                            <CreditCard size={13} />
                            تسديد الدفعة
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-bold">مكتمل ✅</span>
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
