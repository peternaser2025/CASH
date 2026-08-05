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
  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;

  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Due' | 'PartiallyPaid' | 'Paid'>('Due');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Date Range Filters
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [enableDateFilter, setEnableDateFilter] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<AccrualItem[]>([]);
  const [settledHistory, setSettledHistory] = useState<Record<string, number>>({});

  // Settlement Modal State
  const [selectedItemForSettlement, setSelectedItemForSettlement] = useState<AccrualItem | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [settlementMethod, setSettlementMethod] = useState<string>('كاش (نقد)');
  const [settlementEmployee, setSettlementEmployee] = useState<string>('');
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

  // Safe helper to extract values from transaction rows whether array or object
  const getRowVal = (row: any, arrayIndex: number, objKeys: string[]) => {
    if (!row) return '';
    if (Array.isArray(row)) {
      return row[arrayIndex] !== undefined ? row[arrayIndex] : '';
    }
    if (typeof row === 'object') {
      for (const key of objKeys) {
        if (row[key] !== undefined && row[key] !== null) {
          return row[key];
        }
      }
    }
    return '';
  };

  // Safe helper to extract numeric amount safely
  const getRowAmount = (row: any, type: 'expense' | 'income' | 'amount') => {
    if (!row) return 0;
    if (Array.isArray(row)) {
      if (type === 'income') return parseFloat(String(row[5] || 0)) || 0;
      if (type === 'expense') return parseFloat(String(row[6] || 0)) || 0;
      return parseFloat(String(row[6] || row[5] || 0)) || 0;
    }
    if (typeof row === 'object') {
      if (type === 'income') {
        if (row.income !== undefined) return parseFloat(String(row.income)) || 0;
        return row.type === 'Income' ? (parseFloat(String(row.amount)) || 0) : 0;
      }
      if (type === 'expense') {
        if (row.expense !== undefined) return parseFloat(String(row.expense)) || 0;
        return (row.type === 'Expense' || row.type === 'مصروف' || !row.type) ? (parseFloat(String(row.amount)) || 0) : 0;
      }
      return parseFloat(String(row.amount !== undefined ? row.amount : (row.expense || row.income || 0))) || 0;
    }
    return 0;
  };

  // Fetch all transactions from Google Sheets and extract Accrued/Credit items
  const fetchAccruals = async () => {
    setLoading(true);
    try {
      const reportData = await gasService.getReport({
        branch: selectedBranch,
        startDate: enableDateFilter ? startDate : '2020-01-01',
        endDate: enableDateFilter ? endDate : '2030-12-31'
      });

      if (reportData && reportData.rows) {
        const accruals: AccrualItem[] = [];
        const sheetsSettlements: Record<string, number> = {};
        const keywordSettlements: { keyword: string; amount: number }[] = [];

        // Pass 1: Identify all settlement transactions in Google Sheets and map their payments
        reportData.rows.forEach((row: any) => {
          const category = String(getRowVal(row, 4, ['category'])).trim();
          const description = String(getRowVal(row, 8, ['description', 'notes', 'details']) || getRowVal(row, 6, ['description'])).trim();
          const expense = getRowAmount(row, 'expense');

          const combined = `${category} ${description}`;
          const isSettlement = /سداد|تسوية|سداد مشتريات|تسوية التزامات|تسديد|دفع|دفعت|تم دفع|تم السداد|تم تسديد|دفعة من|صافي مدفوع/i.test(combined);

          if (isSettlement && expense > 0) {
            // Extract embedded ACCRUAL_REF ID if present (supports row_*, ref_*, etc.)
            const refMatch = description.match(/ACCRUAL_REF:([^\s\]]+)/) || description.match(/REF:([^\s\]]+)/);
            if (refMatch && refMatch[1]) {
              const refId = refMatch[1];
              sheetsSettlements[refId] = (sheetsSettlements[refId] || 0) + expense;
            }

            keywordSettlements.push({
              keyword: combined.toLowerCase(),
              amount: expense
            });
          }
        });

        // Pass 2: Identify original Accrual / Deferred / Credit items (excluding settlements)
        reportData.rows.forEach((row: any, index: number) => {
          const date = String(getRowVal(row, 0, ['date']) || '').split('T')[0];
          const branch = String(getRowVal(row, 2, ['branch']) || 'عام');
          const type = String(getRowVal(row, 3, ['type']) || '');
          const category = String(getRowVal(row, 4, ['category']) || '');
          const expense = getRowAmount(row, 'expense');
          const income = getRowAmount(row, 'income');
          const employee = String(getRowVal(row, 7, ['employee']) || getRowVal(row, 4, ['employee']) || '');
          const description = String(getRowVal(row, 8, ['description', 'notes']) || getRowVal(row, 6, ['description']) || '');

          // Skip transfers
          if (isTransferType(type, category)) return;

          const combinedText = `${category} ${description}`;

          // IMPORTANT: Skip settlement rows (sadaad / taswaya / daf3) so paying a debt doesn't create a new debt!
          const isSettlementRow = /سداد|تسوية|سداد مشتريات|تسوية التزامات|تسديد|دفعة من|صافي مدفوع/i.test(combinedText) ||
                                  /^دفع\s+/i.test(description) ||
                                  /^سداد\s+/i.test(description) ||
                                  description.includes('سداد مستحقات') ||
                                  description.includes('سداد آجل');
          
          if (isSettlementRow) return;

          // Strip preposition phrases like "من اجل" or "من أجل" or "على اجل" to prevent false positive word matches
          const cleanCategory = category
            .replace(/من\s+أ?جل/gi, '')
            .replace(/على\s+أ?جل/gi, '')
            .trim();

          const cleanDescription = description
            .replace(/من\s+أ?جل/gi, '')
            .replace(/على\s+أ?جل/gi, '')
            .trim();

          // Check for explicit credit/payable category indicators
          const isAccruedCategory = 
            /مشتريات\s+آجلة|التزامات\s+مستحقة|فاتورة\s+آجل|دين\s+آجل|مستحقات\s+موردين|آجل\s+غير\s+مسدد|دفعة\s+مؤجلة|مشتريات\s+على\s+الحساب/i.test(cleanCategory) ||
            (cleanCategory.includes('مستحق') && !cleanCategory.includes('سداد')) ||
            (cleanCategory.includes('مستحقة') && !cleanCategory.includes('سداد')) ||
            (cleanCategory.includes('مستحقات') && !cleanCategory.includes('سداد')) ||
            (cleanCategory.includes('آجل') && !cleanCategory.includes('سداد'));

          // Check for explicit credit/payable description tags
          const isAccruedDesc = 
            /\[آجل\]|\[مستحق\]|غير\s+مسدد|لم\s+يسدد|غير\s+مدفوع|على\s+الحساب|دين\s+قائم|فاتورة\s+آجلة|فاتوره\s+اجل|مشتريات\s+آجلة/i.test(cleanDescription) ||
            (/\bآجل\b/.test(cleanDescription) && !cleanDescription.includes('سداد')) ||
            (/\bاجل\b/.test(cleanDescription) && !cleanDescription.includes('سداد')) ||
            (cleanDescription.includes('مستحق') && !/سداد|تسوية|تم\s+الدفع|مسدد/i.test(cleanDescription));

          const isAccrued = (isAccruedCategory || isAccruedDesc);

          if (isAccrued && (expense > 0 || income > 0)) {
            const originalAmount = expense > 0 ? expense : income;
            const itemId = `row_${index}_${date}_${originalAmount}`;
            
            // Check if description explicitly states that this row is ALREADY paid/settled
            const isExplicitlyPaid = /تم السداد|مسدد|تم الدفع|مدفوع بالكامل|نقداً بالكامل|كاش مدفوع|مسددة/i.test(combinedText);

            // Sum paid amounts from both Google Sheets settlement rows and local storage memory
            let paidFromSheets = sheetsSettlements[itemId] || 0;

            if (paidFromSheets === 0) {
              // Fallback 1: Match by ACCRUAL_REF key ending with date and amount (e.g., _2026-06-22_1210)
              Object.keys(sheetsSettlements).forEach(refKey => {
                const amtStr = String(originalAmount);
                if ((date && refKey.includes(date) && refKey.includes(amtStr)) ||
                    refKey.endsWith(`_${amtStr}`) ||
                    refKey.endsWith(`_${amtStr}.000`)) {
                  paidFromSheets += sheetsSettlements[refKey];
                }
              });
            }

            if (paidFromSheets === 0) {
              const vendorLower = (employee || '').toLowerCase();
              const descLower = description.toLowerCase();

              keywordSettlements.forEach(ks => {
                if ((vendorLower && vendorLower.length > 2 && ks.keyword.includes(vendorLower)) || 
                    (descLower && descLower.length > 5 && ks.keyword.includes(descLower.slice(0, 15)))) {
                  paidFromSheets += ks.amount;
                }
              });
            }

            const paidFromLocal = settledHistory[itemId] || 0;
            let paidAmount = Math.max(paidFromSheets, paidFromLocal);

            if (isExplicitlyPaid) {
              paidAmount = Math.max(paidAmount, originalAmount);
            }

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
  }, [selectedBranch, settledHistory, startDate, endDate, enableDateFilter]);

  // Mark single item as paid/settled directly without adding a new cash payout row
  const handleMarkAsPaid = (item: AccrualItem) => {
    const updatedSettled = {
      ...settledHistory,
      [item.id]: item.amount
    };
    setSettledHistory(updatedSettled);
    localStorage.setItem('kwd_accrual_settlements', JSON.stringify(updatedSettled));
  };

  // Bulk mark all currently visible items as settled
  const handleBulkMarkAllAsPaid = () => {
    if (!window.confirm('هل أنت متأكد من اعتبار كافة الحركات المسجلة المعروضة مسددة بالكامل؟')) return;
    const updatedSettled = { ...settledHistory };
    filteredItems.forEach(item => {
      updatedSettled[item.id] = item.amount;
    });
    setSettledHistory(updatedSettled);
    localStorage.setItem('kwd_accrual_settlements', JSON.stringify(updatedSettled));
  };

  // Handle Settlement Submission
  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSettlement) return;

    if (!settlementEmployee) {
      alert('يرجى تحديد الموظف / العهدة القائمة بالسداد لخصم المبلغ منها وتحديث رصيد الصندوق بنجاح');
      return;
    }

    const payVal = parseFloat(settlementAmount);
    if (isNaN(payVal) || payVal <= 0) return;

    setSettling(true);
    setSettlementSuccess(null);

    try {
      // 1. Record payment transaction in Google Sheets
      const originalMonth = selectedItemForSettlement.date ? selectedItemForSettlement.date.slice(0, 7) : '';
      const payingEmployee = settlementEmployee;
      const newPaymentTrans = {
        date: new Date().toISOString().split('T')[0],
        type: 'Expense',
        branch: selectedItemForSettlement.branch,
        category: 'سداد مشتريات آجلة ومستحقات (تسوية التزامات)',
        employee: payingEmployee,
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
      'التصنيف / البند',
      'البيان والتفاصيل الشاملة',
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

    // Vendor Breakdown
    const vendorMap: Record<string, { count: number; totalAmount: number; totalRemaining: number }> = {};
    filteredItems.forEach(item => {
      const v = item.vendorName || 'غير محدد';
      if (!vendorMap[v]) vendorMap[v] = { count: 0, totalAmount: 0, totalRemaining: 0 };
      vendorMap[v].count += 1;
      vendorMap[v].totalAmount += item.amount;
      vendorMap[v].totalRemaining += item.remainingAmount;
    });

    const vendorRows = Object.entries(vendorMap).map(([vendor, stat]) => [
      vendor,
      stat.count,
      stat.totalAmount,
      stat.totalRemaining,
      stat.totalRemaining === 0 ? 'مكتمل السداد' : 'يوجد مستحقات قائمة'
    ]);

    exportReportToExcel({
      fileName,
      sheetName: 'دفتر المستحقات التفصيلي',
      reportTitle: 'دفتر المشتريات الآجلة والالتزامات المستحقة التفصيلي',
      subtitle: `الفرع: ${selectedBranch} | الحالة: ${statusFilter} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')}`,
      summaryCards: [
        { label: 'إجمالي المستحقات المسجلة', value: totalAccruedLiabilities },
        { label: 'إجمالي المسدد بالفعل', value: totalPaidLiabilities },
        { label: 'الرصيد المتبقي المستحق', value: totalRemainingLiabilities },
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
      ],
      sections: [
        {
          title: 'جدول ملخص المشتريات والالتزامات حسب المورد والجهة الدائنة',
          headers: ['اسم المورد / الشركة', 'عدد الفواتير', 'إجمالي مشتريات المورد (د.ك)', 'المتبقي المستحق للمورد (د.ك)', 'موقف السداد'],
          rows: vendorRows,
          totalsRow: [
            'المجموع الكلي للموردين',
            filteredItems.length,
            totalAccruedLiabilities,
            totalRemainingLiabilities,
            '-'
          ]
        }
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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
          >
            <Printer size={16} />
            طباعة الكشف المعتمد
          </button>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative lg:col-span-2">
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

        {/* Date Filter Controls Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDateFilter}
                onChange={e => setEnableDateFilter(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span>فلتر تحديد تاريخ الكشف</span>
            </label>

            {enableDateFilter && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 px-2">
                  <Calendar size={14} className="text-slate-500" />
                  <span className="font-bold text-slate-600 text-[11px]">من:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-white px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 px-2 border-r border-slate-200">
                  <span className="font-bold text-slate-600 text-[11px]">إلى:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-white px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleBulkMarkAllAsPaid}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-1.5 text-xs border border-slate-300 cursor-pointer shadow-sm"
            title="اعتبار جميع الحركات المعروضة مسددة بالكامل كحركات قديمة"
          >
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>اعتبار المعروض مسدد بالكامل (تصفير السجلات القديمة)</span>
          </button>
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
                        <div className="flex items-center justify-center gap-1.5">
                          {item.remainingAmount > 0 && (
                            <button
                              onClick={() => {
                                setSelectedItemForSettlement(item);
                                setSettlementAmount(String(item.remainingAmount));
                                setSettlementEmployee(employees.includes(item.employee) ? item.employee : '');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                              title="تسديد المبلغ واختيار العهدة لخصم القيمة منها وتحديث الرصيد"
                            >
                              <CreditCard size={13} />
                              <span>تسديد الدفعة</span>
                            </button>
                          )}

                          {item.status !== 'Paid' ? (
                            <button
                              onClick={() => {
                                setSelectedItemForSettlement(item);
                                setSettlementAmount(String(item.remainingAmount));
                                setSettlementEmployee(employees.includes(item.employee) ? item.employee : '');
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="تسديد المبلغ واختيار العهدة لتسجيل الخصم"
                            >
                              <Check size={13} />
                              <span>مسددة</span>
                            </button>
                          ) : (
                            <span className="text-emerald-600 text-[11px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 size={13} /> مكتمل
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Printable Signature Approval Block */}
        <div className="print-signatures-block mt-8 pt-6 border-t-2 border-dashed border-slate-300">
          <div className="print-signature-box">
            <span className="block font-black text-xs text-slate-900">إعداد / مسؤول المشتريات والمستحقات</span>
            <p className="text-[10px] text-slate-500 mt-0.5">التوقيع والتاريخ</p>
            <div className="print-signature-line">اسم الموظف: ....................</div>
          </div>
          <div className="print-signature-box">
            <span className="block font-black text-xs text-slate-900">مراجعة وتدقيق الحسابات والدائنين</span>
            <p className="text-[10px] text-slate-500 mt-0.5">التوقيع والتاريخ</p>
            <div className="print-signature-line">المراجع المالي: ....................</div>
          </div>
          <div className="print-signature-box">
            <span className="block font-black text-xs text-slate-900">الاعتماد النهائي للتسديدات والالتزامات</span>
            <p className="text-[10px] text-slate-500 mt-0.5">مدير الشركة / الكفيل</p>
            <div className="print-signature-line">التوقيع والختم: ....................</div>
          </div>
        </div>
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
                    <p className="text-xs font-bold text-gray-400">سداد كلي أو جزئي مع التسجيل الفوري بصندوق الموظف</p>
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
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-gray-900">البند: {selectedItemForSettlement.category}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                        شهر {selectedItemForSettlement.date.slice(0, 7)}
                      </span>
                    </div>
                    <p className="text-gray-600 font-bold">المورد / الجهة: {selectedItemForSettlement.vendorName}</p>
                    <div className="flex justify-between items-center font-mono pt-1 border-t border-gray-200 text-gray-700 font-bold">
                      <span>إجمالي الدين: {formatKWD(selectedItemForSettlement.amount)} د.ك</span>
                      <span className="text-rose-600">المتبقي المطلوب: {formatKWD(selectedItemForSettlement.remainingAmount)} د.ك</span>
                    </div>
                  </div>

                  {/* Cash box Employee Selector */}
                  <div className="space-y-2 p-4 bg-emerald-50/80 border-2 border-emerald-200 rounded-2xl">
                    <label className="block text-xs font-black text-emerald-950 flex items-center justify-between">
                      <span>💳 خصم السداد من عهدة الموظف / الصندوق:</span>
                      <span className="text-rose-600 font-bold text-[11px]">* مطلوب للتحديث</span>
                    </label>
                    <select
                      required
                      value={settlementEmployee}
                      onChange={e => setSettlementEmployee(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-emerald-300 rounded-xl font-black text-xs text-gray-900 outline-none focus:border-emerald-600 shadow-sm cursor-pointer"
                    >
                      <option value="">-- اختر الموظف / العهدة القائمة بالسداد --</option>
                      {employees.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-emerald-800 font-bold leading-relaxed">
                      تنبيه: سيتم تسجيل حركة مصروف سداد مخصومة فوراً من عهدة <span className="underline font-black">{settlementEmployee || 'الموظف المحدد'}</span> في شيت جوجل لتحديث رصيد الصندوق الفعلي.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-gray-700">المبلغ المراد تسديده الآن (د.ك)</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      max={selectedItemForSettlement.remainingAmount}
                      value={settlementAmount}
                      onChange={e => setSettlementAmount(e.target.value)}
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-300 rounded-2xl font-mono text-xl font-black text-center text-emerald-600 outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Dynamic Math Preview for Partial Payments */}
                  {(() => {
                    const payVal = parseFloat(settlementAmount) || 0;
                    const remainingAfter = Math.max(0, selectedItemForSettlement.remainingAmount - payVal);
                    return (
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1 text-xs font-bold text-amber-900">
                        <div className="flex justify-between">
                          <span>المسدد في هذه العملية:</span>
                          <span className="font-mono font-extrabold text-emerald-700">{formatKWD(payVal)} د.ك</span>
                        </div>
                        <div className="flex justify-between border-t border-amber-200/60 pt-1">
                          <span>المتبقي في السجل بعد السداد:</span>
                          <span className="font-mono font-extrabold text-rose-700">{formatKWD(remainingAfter)} د.ك</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-gray-700">طريقة الدفع والصرف</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['كاش (نقد)', 'KNET', 'تحويل بنكي'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSettlementMethod(m)}
                          className={`py-2 rounded-xl font-black text-xs transition-all border cursor-pointer ${
                            settlementMethod === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-gray-700">ملاحظات أو رقم وصل الاستلام (اختياري)</label>
                    <input
                      type="text"
                      placeholder="رقم الفاتورة أو وصل الاستلام..."
                      value={settlementNotes}
                      onChange={e => setSettlementNotes(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Accounting Protection Rule Badge */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2 leading-tight">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>ضمان الحسابات:</strong> سيُخصم مبلغ الدفع فوراً من صندوق الموظف (<span className="font-bold">{settlementEmployee || selectedItemForSettlement.employee}</span>)، ويُستبعد أوتوماتيكياً من مصاريف P&L الشهرية لتجنب تكرار الاحتساب، ويُحدث رصيد الدين المتبقي بالسجل دون أي حذف.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={settling}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {settling ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                    تأكيد وتسجيل التسديد بالصندوق
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
