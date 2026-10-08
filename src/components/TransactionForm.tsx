import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown, 
  CheckCheck, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  User, 
  Tag, 
  Info, 
  Coins, 
  Layers, 
  Loader2,
  FileEdit,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  Search
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { TransactionType } from '../types';
import { CITY_DEPARTMENTS } from '../constants';
import { 
  isTransferType, 
  isIncomeType, 
  isAccrualType, 
  normalizeExcelDate,
  formatKWD,
  parseReportRow 
} from '../utils/format';
import { toFils } from '../utils/money';

export type ExtendedTransactionType = 'Expense' | 'Income' | 'Transfer' | 'Settlement';

export interface TransactionFormProps {
  mode?: 'create' | 'edit';
  transaction?: any;
  onComplete: (data?: any) => Promise<any> | void;
  onCancel?: () => void;
  employees: string[];
  branches: string[];
  categories: string[];
  initialEmployee?: string;
  initialType?: TransactionType;
  isUpdating?: boolean;
}

interface PendingAccrualOption {
  id: string;
  date: string;
  branch: string;
  employee: string;
  category: string;
  description: string;
  amount: number;
  vendorName: string;
  targetMonth: string;
}

function cleanDescriptionText(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\[(?:مستحق\/آجل|آجل|اجل|التزام آجل|فاتورة آجلة|غير مدفوع|غير مسدد|شراء آجل|سداد مستحقات[^\]]*)\]/gi, '')
    .replace(/\[تخص شهر\s*[^\]]+\]/gi, '')
    .replace(/(?:-?\s*المورد:\s*|المورد\s*:\s*)([^-\]]+)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractVendorName(rawDesc: string, vendorNameProp?: string): string {
  if (vendorNameProp && vendorNameProp.trim()) return vendorNameProp.trim();
  const match = (rawDesc || '').match(/(?:-?\s*المورد:\s*|المورد\s*:\s*)([^-\]]+)/i);
  return match ? match[1].trim() : '';
}

function extractTargetMonthVal(rawDesc: string, targetMonthProp?: string): string {
  if (targetMonthProp && targetMonthProp.trim()) return targetMonthProp.trim();
  const match = (rawDesc || '').match(/\[تخص شهر\s*([^\]]+)\]/i);
  return match ? match[1].trim() : '';
}

function resolveType(tx: any, initialType?: TransactionType): ExtendedTransactionType {
  if (!tx) {
    if (initialType === 'Transfer') return 'Transfer';
    if (initialType === 'Income') return 'Income';
    return 'Expense';
  }
  const typeStr = String(tx.type || '');
  const catStr = String(tx.category || '');
  const descStr = String(tx.description || '');

  if (/سداد.*(مستحق|آجل|دين|دائن|مورد)|تسوية التزام/i.test(`${catStr} ${descStr}`) || catStr.includes('سداد مشتريات')) {
    return 'Settlement';
  }
  if (typeStr === 'Transfer' || typeStr === 'Transfer-In' || typeStr === 'Transfer-Out' || isTransferType(typeStr, catStr, descStr)) {
    return 'Transfer';
  }
  if (typeStr === 'Income' || typeStr === 'إيراد' || (Number(tx.income) > 0 && !Number(tx.expense)) || isIncomeType(typeStr, catStr, descStr)) {
    return 'Income';
  }
  return 'Expense';
}

export default function TransactionForm({
  mode = 'create',
  transaction,
  onComplete,
  onCancel,
  employees,
  branches,
  categories,
  initialEmployee,
  initialType,
  isUpdating = false
}: TransactionFormProps) {
  const isEditMode = mode === 'edit';
  const [type, setType] = useState<ExtendedTransactionType>(() => resolveType(transaction, initialType));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Advanced Options Collapsible (UX Cleanup - Hides clutter for everyday transactions)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Pending Accruals for Settlement Matching
  const [pendingAccruals, setPendingAccruals] = useState<PendingAccrualOption[]>([]);
  const [loadingAccruals, setLoadingAccruals] = useState(false);
  const [selectedAccrualId, setSelectedAccrualId] = useState<string>('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: initialEmployee || '',
    branch: '',
    department: '',
    category: '',
    amount: '',
    description: initialEmployee ? `تغذية وتزويد عهدة الموظف ${initialEmployee}` : '',
    sender: '',
    receiver: initialEmployee || '',
    hasTargetMonth: false,
    targetMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    isAccrual: false,
    vendorName: '',
    linkedAccrualId: ''
  });

  // Dynamic Lookups loaded from Centralized Settings Sheet
  const [activeBranchesList, setActiveBranchesList] = useState<string[]>(branches);
  const [activeCategoriesList, setActiveCategoriesList] = useState<{ name: string; parentCategory?: string }[]>(
    categories.map(c => ({ name: c, parentCategory: 'عام' }))
  );
  const [activeVendorsList, setActiveVendorsList] = useState<string[]>([]);
  const [activeEmployeesList, setActiveEmployeesList] = useState<string[]>(employees);

  useEffect(() => {
    gasService.getSettings()
      .then(res => {
        if (res && res.settings) {
          const s = res.settings;
          if (Array.isArray(s.branches)) {
            const b = s.branches.filter((x: any) => x.isActive).map((x: any) => x.name);
            if (b.length > 0) setActiveBranchesList(b);
          }
          if (Array.isArray(s.categories)) {
            const c = s.categories.filter((x: any) => x.isActive).map((x: any) => ({
              name: x.name,
              parentCategory: x.parentCategory || 'عام'
            }));
            if (c.length > 0) setActiveCategoriesList(c);
          }
          if (Array.isArray(s.vendors)) {
            const v = s.vendors.filter((x: any) => x.isActive).map((x: any) => x.name);
            if (v.length > 0) setActiveVendorsList(v);
          }
          if (Array.isArray(s.employees)) {
            const e = s.employees.filter((x: any) => x.isActive).map((x: any) => x.name);
            if (e.length > 0) setActiveEmployeesList(e);
          }
        } else if (res) {
          if (Array.isArray(res.branches) && res.branches.length > 0) setActiveBranchesList(res.branches);
          if (Array.isArray(res.categories) && res.categories.length > 0) {
            setActiveCategoriesList(res.categories.map((c: string) => ({ name: c, parentCategory: 'عام' })));
          }
          if (Array.isArray(res.vendors) && res.vendors.length > 0) setActiveVendorsList(res.vendors);
          if (Array.isArray(res.employees) && res.employees.length > 0) setActiveEmployeesList(res.employees);
        }
      })
      .catch(err => console.warn('Could not load dynamic settings for form dropdowns:', err));
  }, []);

  // Pre-load pending accruals when Settlement is chosen to link settlement to accrual
  useEffect(() => {
    if (type === 'Settlement') {
      setShowAdvancedOptions(true);
      setLoadingAccruals(true);
      gasService.getReport({ startDate: '', endDate: '' })
        .then(data => {
          if (data && Array.isArray(data.rows)) {
            const list: PendingAccrualOption[] = [];
            data.rows.forEach((r: any, idx: number) => {
              const p = parseReportRow(r);
              const isAccrual = isAccrualType(p.type, p.category, p.description) || (r && r.isAccrual);
              const isAlreadySettled = /سداد|تسوية/i.test(`${p.category} ${p.description}`);
              if (isAccrual && !isAlreadySettled && p.expense > 0) {
                const targetMatch = p.description.match(/\[تخص شهر\s*([^\]]+)\]/i);
                const vendorMatch = p.description.match(/(?:-?\s*المورد:\s*|المورد\s*:\s*)([^-\]]+)/i);
                list.push({
                  id: String(p.id || r.id || `acc-${idx}`),
                  date: p.date,
                  branch: p.branch,
                  employee: p.employee,
                  category: p.category,
                  description: p.description,
                  amount: p.expense,
                  vendorName: (r && r.vendorName) || (vendorMatch ? vendorMatch[1].trim() : ''),
                  targetMonth: p.targetMonth || (targetMatch ? targetMatch[1].trim() : p.date.slice(0, 7))
                });
              }
            });
            setPendingAccruals(list);
          }
        })
        .catch(err => console.warn('Could not load pending accruals:', err))
        .finally(() => setLoadingAccruals(false));
    }
  }, [type]);

  // Synchronize state when editing or switching modes
  useEffect(() => {
    if (isEditMode && transaction) {
      const txType = resolveType(transaction, initialType);
      setType(txType);
      setStatus(null);

      const rawDesc = String(transaction.description || '');
      const rawCat = String(transaction.category || '');
      const cleanDesc = cleanDescriptionText(rawDesc);
      const vendorNameVal = extractVendorName(rawDesc, transaction.vendorName);
      const targetMonthVal = extractTargetMonthVal(rawDesc, transaction.targetMonth);
      const isAccrualVal = Boolean(
        transaction.isAccrual || 
        transaction.isAccrued || 
        isAccrualType(transaction.type, rawCat, rawDesc)
      );

      let sender = transaction.sender || '';
      let receiver = transaction.receiver || '';

      if (txType === 'Transfer') {
        const transferMatch = rawDesc.match(/من\s+([^\s]+(?:\s+[^\s]+)?)\s+إلى\s+([^\s]+(?:\s+[^\s]+)?)/);
        if (transferMatch) {
          sender = sender || transferMatch[1].trim();
          receiver = receiver || transferMatch[2].trim();
        } else if (rawCat.includes('صادر إلى')) {
          const matchTo = rawCat.match(/صادر إلى\s+([^)]+)/);
          if (matchTo) receiver = receiver || matchTo[1].trim();
          sender = sender || transaction.employee;
        } else if (rawCat.includes('وارد من')) {
          const matchFrom = rawCat.match(/وارد من\s+([^)]+)/);
          if (matchFrom) sender = sender || matchFrom[1].trim();
          receiver = receiver || transaction.employee;
        } else {
          sender = sender || transaction.employee || '';
        }
      }

      let amountVal = '';
      if (transaction.amount !== undefined && transaction.amount !== null && transaction.amount !== '') {
        amountVal = String(transaction.amount);
      } else if (Number(transaction.income) > 0) {
        amountVal = String(transaction.income);
      } else if (Number(transaction.expense) > 0) {
        amountVal = String(transaction.expense);
      }

      const hasTargetMonth = Boolean(targetMonthVal);
      if (hasTargetMonth || isAccrualVal || vendorNameVal) {
        setShowAdvancedOptions(true);
      }

      setFormData({
        date: normalizeExcelDate(transaction.date) || new Date().toISOString().split('T')[0],
        employee: transaction.employee || '',
        branch: transaction.branch || '',
        department: transaction.department || '',
        category: transaction.category || '',
        amount: amountVal,
        description: cleanDesc,
        sender: sender || transaction.employee || '',
        receiver: receiver || '',
        hasTargetMonth,
        targetMonth: targetMonthVal || new Date().toISOString().slice(0, 7),
        isAccrual: isAccrualVal,
        vendorName: vendorNameVal,
        linkedAccrualId: transaction.linkedAccrualId || ''
      });
    } else if (!isEditMode && initialEmployee) {
      setFormData(prev => ({
        ...prev,
        employee: initialEmployee,
        receiver: initialEmployee,
        description: `تغذية وتزويد عهدة الموظف ${initialEmployee}`
      }));
    }
  }, [transaction, isEditMode, initialEmployee, initialType]);

  // When user selects a pending accrual in Settlement mode
  const handleSelectPendingAccrual = (accrualId: string) => {
    setSelectedAccrualId(accrualId);
    if (!accrualId) return;

    const accrual = pendingAccruals.find(a => a.id === accrualId);
    if (accrual) {
      setFormData(prev => ({
        ...prev,
        amount: String(accrual.amount),
        branch: accrual.branch || prev.branch,
        category: 'سداد مستحقات',
        vendorName: accrual.vendorName || '',
        hasTargetMonth: true,
        targetMonth: accrual.targetMonth || prev.targetMonth,
        linkedAccrualId: accrual.id,
        description: `سداد مستحقات فاتورة [${accrual.category}] للمورد ${accrual.vendorName || 'المورد'} - تخص شهر ${accrual.targetMonth || 'السابق'}`
      }));
      setShowAdvancedOptions(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const parsedAmount = parseFloat(String(formData.amount).replace(/,/g, '').trim());
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setStatus({ type: 'error', message: 'يرجى إدخال مبلغ مالي صحيح أكبر من الصفر' });
      return;
    }

    let finalCategory = formData.category.trim();
    let finalDescription = formData.description.trim();
    let finalEmployee = formData.employee.trim();
    const effectiveType = type === 'Settlement' ? 'Expense' : type;

    if (type === 'Transfer') {
      if (!formData.sender || !formData.receiver) {
        setStatus({ type: 'error', message: 'يرجى اختيار الموظف المرسل والموظف المستلم لعملية التحويل' });
        return;
      }
      if (formData.sender.trim() === formData.receiver.trim()) {
        setStatus({ type: 'error', message: 'لا يمكن تحويل العهدة لنفس الموظف' });
        return;
      }
      finalCategory = 'تحويل عهدة نقدية';
      finalEmployee = formData.sender.trim();
      if (!finalDescription || finalDescription.startsWith('تحويل عهدة نقدية')) {
        finalDescription = `تحويل عهدة نقدية من ${formData.sender.trim()} إلى ${formData.receiver.trim()}`;
      }
    } else if (type === 'Settlement') {
      if (!finalEmployee) {
        setStatus({ type: 'error', message: 'يرجى اختيار الموظف/الصندوق القائم بسداد الالتزام' });
        return;
      }
      finalCategory = 'سداد مستحقات';
      if (!finalDescription.includes('سداد')) {
        finalDescription = `سداد مستحقات ${formData.vendorName ? `للمورد ${formData.vendorName}` : ''} ${finalDescription}`.trim();
      }
    } else {
      if (!finalEmployee) {
        setStatus({ type: 'error', message: 'يرجى اختيار الموظف المسؤول عن العملية' });
        return;
      }
      if (!finalCategory) {
        setStatus({ type: 'error', message: 'يرجى اختيار تصنيف العملية' });
        return;
      }
    }

    // [ACCOUNTING FIX]: Accrual & Target Month tagging
    if (formData.isAccrual && type === 'Expense') {
      if (!finalCategory.includes('آجل') && !finalCategory.includes('مستحق')) {
        finalCategory = `${finalCategory} (آجل/مستحق)`;
      }
      const vendorTag = formData.vendorName.trim() ? `- المورد: ${formData.vendorName.trim()}` : '';
      if (!finalDescription.includes('[مستحق/آجل]')) {
        finalDescription = `[مستحق/آجل] ${finalDescription} ${vendorTag}`.trim();
      }
    } else if (type !== 'Settlement') {
      finalCategory = finalCategory.replace(/\s*\(آجل\/مستحق\)|\s*\(آجل\)|\s*\(مستحق\)/g, '').trim();
      finalDescription = finalDescription.replace(/\[(?:مستحق\/آجل|آجل|اجل|التزام آجل)\]\s*/gi, '').trim();
    }

    if (formData.hasTargetMonth && formData.targetMonth) {
      const targetTag = `[تخص شهر ${formData.targetMonth}]`;
      if (!finalDescription.includes(targetTag)) {
        finalDescription = `${targetTag} ${finalDescription}`.trim();
      }
    } else {
      finalDescription = finalDescription.replace(/\[تخص شهر\s*[^\]]+\]\s*/gi, '').trim();
    }

    // [ACCOUNTING FIX]: City branch department isolation
    const isCity = formData.branch.trim() === 'سيتي';
    const finalDepartment = isCity && formData.department ? formData.department.trim() : null;

    setLoading(true);

    const payload = {
      ...(transaction || {}),
      id: transaction?.id,
      rowId: transaction?.id,
      rowIndex: transaction?.rowIndex,
      originalRowIndex: (transaction as any)?.originalRowIndex,
      previousEmployee: transaction?.previousEmployee || transaction?.employee,
      previousDate: transaction?.previousDate || transaction?.date,
      previousAmount: transaction?.previousAmount || transaction?.amount,
      date: formData.date,
      branch: formData.branch || 'الرئيسي',
      department: finalDepartment,
      employee: finalEmployee,
      category: finalCategory,
      description: finalDescription,
      type: effectiveType,
      amount: parsedAmount,
      amountFils: toFils(parsedAmount),
      sender: formData.sender,
      receiver: formData.receiver,
      targetMonth: formData.hasTargetMonth ? formData.targetMonth : '',
      isAccrual: type === 'Settlement' ? false : formData.isAccrual,
      isSettlement: type === 'Settlement',
      vendorName: formData.vendorName.trim(),
      linkedAccrualId: formData.linkedAccrualId || selectedAccrualId
    };

    if (isEditMode) {
      try {
        if (onComplete) {
          await onComplete(payload);
          setStatus({ type: 'success', message: 'تم حفظ وتحديث العملية بنجاح' });
        } else {
          const res = await gasService.updateTransaction(transaction.id, payload);
          if (res.success) {
            setStatus({ type: 'success', message: 'تم حفظ وتحديث العملية بنجاح' });
            setTimeout(() => onCancel && onCancel(), 600);
          } else {
            setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء تعديل العملية' });
          }
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: err.message || 'حدث خطأ غير متوقع' });
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const result = await gasService.addTransaction(payload);
        if (result.success) {
          setStatus({ type: 'success', message: `تم تسجيل العملية بنجاح برقم: ${result.id}` });
          setTimeout(() => onComplete(result), 800);
        } else {
          setStatus({ type: 'error', message: result.error || 'حدث خطأ أثناء التسجيل' });
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: err.message || 'حدث خطأ غير متوقع' });
      } finally {
        setLoading(false);
      }
    }
  };

  const isBusy = loading || isUpdating;

  return (
    <div className={isEditMode ? "w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200" : "max-w-3xl mx-auto pb-12"}>
      {/* Header Area */}
      {isEditMode ? (
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shadow-xs">
              <FileEdit size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">تعديل الحركة المالية</h3>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md text-xs font-mono font-bold">
                  #{transaction?.id || transaction?.rowIndex || 'سجل'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                تعديل موضعي في سجل العمليات دون إنشاء سجلات مكررة لضمان الدقة المحاسبية
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X size={20} />
            </button>
          )}
        </div>
      ) : (
        <div className="mb-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block p-3 bg-emerald-50 text-emerald-600 rounded-2xl mb-3 shadow-xs"
          >
            <Coins size={32} />
          </motion.div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">تسجيل عملية مالية</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">تسجيل دقيق للنقدية والالتزامات والتحويلات بالدينار الكويتي</p>
        </div>
      )}

      <div className={isEditMode ? "" : "bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden"}>
        {/* [UI & ACCOUNTING FIX]: 4 Distinct Transaction Types with Zero Broken Icons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 p-2 bg-slate-50 border-b border-slate-200 gap-1.5">
          {[
            { 
              id: 'Expense', 
              label: 'مصروف نقدي', 
              icon: TrendingDown, 
              activeClasses: 'bg-white text-rose-600 shadow-xs border border-rose-200' 
            },
            { 
              id: 'Income', 
              label: 'توريد / مبيعات', 
              icon: TrendingUp, 
              activeClasses: 'bg-white text-emerald-600 shadow-xs border border-emerald-200' 
            },
            { 
              id: 'Transfer', 
              label: 'تحويل عهدة', 
              icon: ArrowRightLeft, 
              activeClasses: 'bg-white text-blue-600 shadow-xs border border-blue-200' 
            },
            { 
              id: 'Settlement', 
              label: 'سداد مستحقات', 
              icon: CheckCheck, 
              activeClasses: 'bg-white text-purple-600 shadow-xs border border-purple-200' 
            }
          ].map((item) => {
            const Icon = item.icon;
            const active = type === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setType(item.id as ExtendedTransactionType);
                  if (item.id === 'Settlement') {
                    setFormData(prev => ({ ...prev, isAccrual: false, category: 'سداد مستحقات' }));
                  }
                }}
                className={`py-3 px-2 flex items-center justify-center gap-2 rounded-xl transition-all font-black text-xs cursor-pointer ${
                  active ? item.activeClasses : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className={isEditMode ? "p-6 space-y-5" : "p-8 space-y-6"}>
          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-xl flex items-center gap-3 border ${
                  status.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-xs font-bold">{status.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* [ACCOUNTING CRITICAL]: Settlement Selector - Link Payment to Pending Accrual */}
          {type === 'Settlement' && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCheck size={18} className="text-purple-700" />
                  <label className="text-xs font-black text-purple-900">
                    ربط السداد بفاتورة / التزام آجل سابق (اختياري)
                  </label>
                </div>
                {loadingAccruals && <Loader2 size={14} className="animate-spin text-purple-600" />}
              </div>

              {pendingAccruals.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedAccrualId}
                    onChange={(e) => handleSelectPendingAccrual(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="">-- اختر فاتورة مستحقة للتحميل التلقائي للمبلغ والمورد وشهر الاستحقاق --</option>
                    {pendingAccruals.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.date} | {acc.category} {acc.vendorName ? `(${acc.vendorName})` : ''} - {formatKWD(acc.amount)} د.ك [شهر {acc.targetMonth}]
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-purple-700 font-semibold leading-relaxed">
                    ⚖️ <strong>أثر محاسبي صفري على P&L:</strong> سداد الالتزام يخصم النقدية فوراً من الخزينة، ولا يُسجل كمصروف جديد في شهر الدفع لمنع ازدواجية التكلفة.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-purple-700 font-medium">
                  لا توجد فواتير آجلة معلقة مسجلة حالياً. يمكنك إدخال بيانات السداد يدوياً أدناه.
                </p>
              )}
            </motion.div>
          )}

          {/* Date and Branch Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                <span>تاريخ العملية</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                <span>الفرع المرتبط</span>
              </label>
              <select
                value={formData.branch}
                onChange={(e) => {
                  const newBranch = e.target.value;
                  setFormData({
                    ...formData,
                    branch: newBranch,
                    department: newBranch.trim() === 'سيتي' ? formData.department : ''
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="">غير محدد / عام</option>
                {activeBranchesList.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* City Branch Department Selection */}
          {formData.branch.trim() === 'سيتي' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-xs font-bold text-emerald-800 mb-1.5 flex items-center gap-1.5">
                <Layers size={14} className="text-emerald-600" />
                <span>القسم التشغيلي (فرع سيتي فقط)</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-emerald-50/60 border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none transition-all"
              >
                <option value="">-- اختياري: حدد القسم التشغيلي --</option>
                {CITY_DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </motion.div>
          )}

          {/* Transfer vs Normal Mode Fields */}
          {type === 'Transfer' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-blue-500" />
                  <span>المرسل (من عهدة)</span>
                </label>
                <select
                  required
                  value={formData.sender}
                  onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition-all"
                >
                  <option value="">اختر الموظف المرسل</option>
                  {activeEmployeesList.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-blue-500" />
                  <span>المستلم (إلى عهدة)</span>
                </label>
                <select
                  required
                  value={formData.receiver}
                  onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition-all"
                >
                  <option value="">اختر الموظف المستلم</option>
                  {activeEmployeesList.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  <span>الموظف المسؤول / الصندوق</span>
                </label>
                <select
                  required
                  value={formData.employee}
                  onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="">اختر الموظف</option>
                  {activeEmployeesList.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Tag size={14} className="text-slate-400" />
                  <span>تصنيف العملية</span>
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="">اختر التصنيف</option>
                  {type === 'Settlement' && <option value="سداد مستحقات">سداد مستحقات</option>}
                  {activeCategoriesList.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.parentCategory && c.parentCategory !== 'عام' ? `[${c.parentCategory}] ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins size={14} className="text-amber-500" />
                <span>المبلغ الإجمالي (دينار كويتي)</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-bold">1 KWD = 1000 Fils</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                required
                placeholder="0.000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-mono font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all pl-16 text-left"
                dir="ltr"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                KWD
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              <span>البيان / الوصف التفصيلي</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="اكتب تفاصيل المعاملة هنا بدقة..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
            />
          </div>

          {/* [ACCOUNTING FIX]: Accrued / Credit Purchase Toggle (Only for Expense) */}
          {type === 'Expense' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-amber-950 block">شراء آجل / مصاريف مستحقة (دين غير مسدد)</span>
                <span className="text-[11px] text-amber-700 font-medium">
                  تسجيل الالتزام في شهر الاستحقاق دون خصم فوري من الصندوق النقدي لحين السداد
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.isAccrual}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData({ ...formData, isAccrual: checked });
                  if (checked) setShowAdvancedOptions(true);
                }}
                className="w-5 h-5 text-amber-600 rounded cursor-pointer accent-amber-600"
              />
            </div>
          )}

          {/* [UX CLEANUP]: Advanced Accounting Options Collapsible Toggle */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-black text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-500" />
                <span>خيارات محاسبية متقدمة (شهر الاستحقاق P&L، بيانات المورد)</span>
                {(formData.hasTargetMonth || formData.vendorName) && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-bold">
                    مُحدد
                  </span>
                )}
              </div>
              {showAdvancedOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <AnimatePresence>
              {showAdvancedOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 bg-white border-t border-slate-200 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Target Month Allocation (P&L Accounting Match) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">تخص شهر (استحقاق P&L)</label>
                        <input
                          type="checkbox"
                          checked={formData.hasTargetMonth}
                          onChange={(e) => setFormData({ ...formData, hasTargetMonth: e.target.checked })}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </div>
                      <input
                        type="month"
                        disabled={!formData.hasTargetMonth}
                        value={formData.targetMonth}
                        onChange={(e) => setFormData({ ...formData, targetMonth: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 disabled:opacity-40 outline-none focus:bg-white focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        تحديد الشهر الذي تتحمل فيه قائمة الأرباح والخسائر (P&L) هذا المصروف
                      </p>
                    </div>

                    {/* Vendor Name & Quick Select */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700">اسم المورد / الشركة الدائنة</label>
                        {activeVendorsList.length > 0 && (
                          <span className="text-[10px] text-purple-700 font-bold">موردون معتمدون في الإعدادات</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {activeVendorsList.length > 0 && (
                          <select
                            value={activeVendorsList.includes(formData.vendorName) ? formData.vendorName : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setFormData({ ...formData, vendorName: e.target.value });
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-purple-50/60 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 outline-none focus:border-purple-500"
                          >
                            <option value="">-- اختر من قائمة الموردين المعتمدين (أو اكتب أدناه) --</option>
                            {activeVendorsList.map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          placeholder="مثال: شركة المواد الغذائية، المؤجر، مورد الصيانة..."
                          value={formData.vendorName}
                          onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        لتتبع مديونيات الموردين في سجل الالتزامات الآجلة وشيت الإعدادات
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{isEditMode ? 'حفظ وتحديث العملية' : 'تسجيل العملية'}</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
