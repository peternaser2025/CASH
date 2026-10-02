import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  User, 
  Tag, 
  Info, 
  Coins, 
  CalendarClock, 
  Layers, 
  X, 
  Loader2,
  FileEdit
} from 'lucide-react';
import { TransactionType } from '../../types';
import { CITY_DEPARTMENTS } from '../../constants';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onChangeTransaction?: (transaction: any) => void;
  onSubmit: (e: React.FormEvent, updatedData?: any) => void;
  employees: string[];
  branches: string[];
  categories: string[];
  isUpdating: boolean;
}

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  onSubmit,
  employees,
  branches,
  categories,
  isUpdating
}: EditTransactionModalProps) {
  const [type, setType] = useState<TransactionType>('Expense');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: '',
    employee: '',
    branch: '',
    department: '',
    category: '',
    amount: '',
    description: '',
    sender: '',
    receiver: '',
    hasTargetMonth: false,
    targetMonth: '',
    isAccrual: false,
    vendorName: ''
  });

  // Synchronize state whenever transaction or modal opens
  useEffect(() => {
    if (transaction) {
      const txType: TransactionType = 
        transaction.type === 'Transfer' || transaction.type === 'Transfer-In' || transaction.type === 'Transfer-Out'
          ? 'Transfer'
          : (transaction.type === 'Income' || (transaction.income > 0 && !transaction.expense) ? 'Income' : 'Expense');
      
      setType(txType);
      setErrorStatus(null);

      // Clean description from bracketed tags for seamless editing
      let cleanDesc = String(transaction.description || '');
      
      const hasTargetTag = /\[تخص شهر\s*([^\]]+)\]/i.test(cleanDesc);
      const targetMonthVal = transaction.targetMonth || (cleanDesc.match(/\[تخص شهر\s*([^\]]+)\]/i)?.[1] || '');
      
      const isAccrualVal = Boolean(
        transaction.isAccrual || 
        transaction.isAccrued || 
        /\[مستحق\/آجل\]|آجل\/مستحق/i.test(cleanDesc + ' ' + (transaction.category || ''))
      );

      const vendorMatch = cleanDesc.match(/(?:-?\s*المورد:\s*|المورد\s*:\s*)([^-\]]+)/);
      const vendorNameVal = transaction.vendorName || (vendorMatch ? vendorMatch[1].trim() : '');

      setFormData({
        date: transaction.date || new Date().toISOString().split('T')[0],
        employee: transaction.employee || '',
        branch: transaction.branch || '',
        department: transaction.department || '',
        category: transaction.category || '',
        amount: String(transaction.amount !== undefined ? transaction.amount : (transaction.income > 0 ? transaction.income : transaction.expense || '')),
        description: cleanDesc,
        sender: transaction.sender || transaction.employee || '',
        receiver: transaction.receiver || '',
        hasTargetMonth: Boolean(targetMonthVal || hasTargetTag),
        targetMonth: targetMonthVal || new Date().toISOString().slice(0, 7),
        isAccrual: isAccrualVal,
        vendorName: vendorNameVal
      });
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);

    let finalCategory = formData.category;
    let finalDescription = formData.description;
    let finalEmployee = formData.employee;

    if (type === 'Transfer') {
      if (!formData.sender || !formData.receiver) {
        setErrorStatus('يرجى اختيار الموظف المرسل والموظف المستلم لعملية التحويل');
        return;
      }
      if (formData.sender === formData.receiver) {
        setErrorStatus('لا يمكن تحويل العهدة لنفس الموظف');
        return;
      }
      finalCategory = 'تحويل عهدة نقدية';
      finalEmployee = formData.sender;
      if (!finalDescription || finalDescription.startsWith('تحويل عهدة نقدية')) {
        finalDescription = `تحويل عهدة نقدية من ${formData.sender} إلى ${formData.receiver}`;
      }
    }

    if (formData.isAccrual) {
      if (!finalCategory.includes('آجل') && !finalCategory.includes('مستحق')) {
        finalCategory = `${finalCategory} (آجل/مستحق)`;
      }
      if (!finalDescription.includes('[مستحق/آجل]')) {
        finalDescription = `[مستحق/آجل] ${finalDescription} ${formData.vendorName ? '- المورد: ' + formData.vendorName : ''}`.trim();
      }
    }

    if (formData.hasTargetMonth && formData.targetMonth) {
      const targetTag = `[تخص شهر ${formData.targetMonth}]`;
      if (!finalDescription.includes(targetTag)) {
        finalDescription = `${targetTag} ${finalDescription}`.trim();
      }
    }

    const isCity = formData.branch.trim() === 'سيتي';
    const finalDepartment = isCity && formData.department ? formData.department.trim() : null;

    const parsedAmount = parseFloat(String(formData.amount).replace(/,/g, '').trim()) || 0;

    const updatedData = {
      ...transaction,
      id: transaction.id,
      rowIndex: transaction.rowIndex,
      date: formData.date,
      branch: formData.branch || 'الرئيسي',
      department: finalDepartment,
      category: finalCategory,
      description: finalDescription,
      amount: parsedAmount,
      type,
      employee: finalEmployee,
      sender: formData.sender,
      receiver: formData.receiver,
      targetMonth: formData.hasTargetMonth ? formData.targetMonth : '',
      isAccrual: formData.isAccrual,
      vendorName: formData.vendorName
    };

    onSubmit(e, updatedData);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md no-print overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 my-auto"
      >
        {/* Header - Identical to Transaction Entry Hero with Edit Context */}
        <div className="p-6 sm:p-8 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs">
              <FileEdit size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">تعديل العملية المالية</h3>
                <span className="px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded-lg text-xs font-mono font-black">
                  #{transaction.id || transaction.rowIndex || 'سجل'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                تعديل البيانات بنفس واجهة الإدخال المعتمدة لضمان توازن الحسابات والتقارير
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Selector - Exactly Identical to TransactionForm */}
        <div className="flex p-2 bg-slate-100/70 border-b border-slate-200">
          {[
            { 
              id: 'Expense', 
              label: 'مصروف', 
              icon: TrendingDown, 
              activeClasses: 'bg-white text-rose-600 shadow-md shadow-rose-500/10 border border-rose-100' 
            },
            { 
              id: 'Income', 
              label: 'توريد / مبيعات 💰', 
              icon: TrendingUp, 
              activeClasses: 'bg-white text-emerald-600 shadow-md shadow-emerald-500/10 border border-emerald-100' 
            },
            { 
              id: 'Transfer', 
              label: 'تحويل عهدة', 
              icon: ArrowRightLeft, 
              activeClasses: 'bg-white text-blue-600 shadow-md shadow-blue-500/10 border border-blue-100' 
            }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setType(item.id as TransactionType)}
              className={`flex-1 py-3.5 flex items-center justify-center gap-2.5 rounded-2xl transition-all duration-300 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer ${
                type === item.id 
                  ? item.activeClasses 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Form Body - Exactly Identical to TransactionForm */}
        <form onSubmit={handleFormSubmit} className="p-6 sm:p-9 space-y-6 max-h-[75vh] overflow-y-auto">
          <AnimatePresence>
            {errorStatus && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-4 rounded-2xl flex items-center gap-3 bg-red-50 text-red-800 border border-red-200"
              >
                <div className="p-1.5 rounded-xl bg-red-500 text-white shrink-0">
                  <AlertCircle size={18} />
                </div>
                <p className="text-xs font-black">{errorStatus}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Transaction Date */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                <Calendar size={14} className="text-emerald-600" />
                تاريخ العملية
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-bold text-slate-900 text-xs sm:text-sm"
              />
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                <Building2 size={14} className="text-emerald-600" />
                الفرع المرتبط
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-bold text-slate-900 text-xs sm:text-sm cursor-pointer"
              >
                <option value="">غير محدد / عام</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* City Department */}
            {formData.branch.trim() === 'سيتي' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2 md:col-span-2 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80"
              >
                <label className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider">
                  <Layers size={14} className="text-amber-600" />
                  القسم التشغيلي (فرع "سيتي" فقط)
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-amber-300 rounded-2xl focus:ring-4 focus:ring-amber-500/15 focus:border-amber-500 transition-all outline-none font-bold text-amber-950 text-xs sm:text-sm cursor-pointer"
                >
                  <option value="">-- اختياري: حدد القسم الداخلي --</option>
                  {CITY_DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <p className="text-[11px] font-semibold text-amber-800">
                  خاص بفرع سيتي فقط: بهارات / غذائي / استهلاكي (الحركات السابقة تبقى بدون قسم)
                </p>
              </motion.div>
            )}

            {/* Transfer parties vs Standard Employee/Category */}
            {type === 'Transfer' ? (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <User size={14} className="text-blue-600" />
                    المرسل (من عهدة)
                  </label>
                  <select
                    required
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900 text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="">اختر الموظف المرسل</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <User size={14} className="text-blue-600" />
                    المستلم (إلى عهدة)
                  </label>
                  <select
                    required
                    value={formData.receiver}
                    onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900 text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="">اختر الموظف المستلم</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <User size={14} className="text-emerald-600" />
                    الموظف المسؤول
                  </label>
                  <select
                    required
                    value={formData.employee}
                    onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-900 text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <Tag size={14} className="text-emerald-600" />
                    تصنيف العملية
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-bold text-slate-900 text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="">اختر التصنيف</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/سداد|تسوية/i.test(formData.category) && (
                  <div className="md:col-span-2 p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl text-purple-950 text-xs font-bold space-y-1">
                    <div className="flex items-center gap-2 font-black text-purple-900">
                      <span>💳 إشعار المعالجة المحاسبية لسداد المستحقات:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-purple-800">
                      سيتم <strong>خصم المبلغ نقدياً فوراً من صندوق/عهدة الموظف</strong> ({formData.employee || 'المحدد'})، <strong>ولن يُحسب إطلاقاً كمصروف جديد في أرباح وخسائر (P&L) الشهر المدفوع فيه</strong> لمنع الازدواجية، كون التكلفة قد حُسبت سابقاً في شهر الاستحقاق الأصلي.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Total Amount - Exactly Identical to TransactionForm */}
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                <Coins size={14} className="text-amber-500" />
                المبلغ الإجمالي (د.ك)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={`w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:ring-8 transition-all outline-none text-3xl sm:text-4xl font-black font-mono text-center ${
                    type === 'Expense' ? 'focus:ring-red-500/10 focus:border-red-500 text-red-600' : 
                    type === 'Income' ? 'focus:ring-emerald-500/10 focus:border-emerald-500 text-emerald-600' :
                    'focus:ring-blue-500/10 focus:border-blue-500 text-blue-600'
                  }`}
                />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400 pointer-events-none text-sm">
                  KWD
                </div>
              </div>
            </div>

            {/* Description / Statement */}
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                <Info size={14} className="text-emerald-600" />
                البيان / الوصف التفصيلي
              </label>
              <textarea
                required
                rows={3}
                placeholder="اكتب تفاصيل العملية هنا بشكل واضح..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none resize-none font-medium text-slate-900 text-xs sm:text-sm"
              />
            </div>

            {/* Accrued / Credit Purchase Toggle Card - The Golden Key */}
            <div className="md:col-span-2 p-5 sm:p-6 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-300/80 rounded-3xl space-y-4 shadow-xs relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-amber-400 to-yellow-600 text-white rounded-2xl shadow-xs font-black text-lg flex items-center justify-center">
                    🔑
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-black text-amber-950">المفتاح الذهبي: عملية آجلة / مشتريات بالدين / مصاريف مستحقة</h4>
                      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-200 text-amber-900 rounded-full border border-amber-300">
                        آجل / مستحق
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-amber-800/80 mt-0.5">
                      تفعيل هذا المفتاح يحول العملية تلقائياً لدفتر المشتريات الآجلة والالتزامات لمتابعة السداد دون خصم نقدية
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isAccrual: !formData.isAccrual })}
                  className={`px-4 py-2.5 rounded-2xl transition-all duration-300 font-black text-xs flex items-center gap-2 shrink-0 border cursor-pointer ${
                    formData.isAccrual 
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-amber-400 shadow-md shadow-amber-500/30 scale-105 ring-4 ring-amber-400/20' 
                      : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100/60'
                  }`}
                >
                  <span className="text-base">{formData.isAccrual ? '⚡' : '🔒'}</span>
                  <span>{formData.isAccrual ? 'مُفعّل: عملية آجلة (دين)' : 'تفعيل المفتاح الذهبي (آجل)'}</span>
                </button>
              </div>

              <AnimatePresence>
                {formData.isAccrual && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-3 border-t border-amber-200/80 space-y-3"
                  >
                    <div className="p-3 bg-amber-100/90 border border-amber-300 rounded-2xl text-amber-950 text-xs font-bold flex items-start gap-2.5 shadow-2xs">
                      <span className="text-base leading-none">🛡️</span>
                      <div>
                        <p className="font-black text-amber-950 mb-0.5">تأكيد محاسبي لسلامة الصندوق والخزنة:</p>
                        <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                          هذه المشتريات الآجلة تُسجل كالتزام بدفتر الديون والأرباح والخسائر (أساس الاستحقاق)، <strong>ولن تُخصم إطلاقاً من الصندوق أو رصيد العهدة</strong> إلا في تاريخ سداد المورد لاحقاً.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-amber-900 mb-1.5">اسم المورد / الجهة الدائنة (اختياري)</label>
                      <input
                        type="text"
                        placeholder="مثال: شركة التوريدات الكويتية / مصنع السلام..."
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-amber-300 rounded-2xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-bold text-slate-900 text-xs shadow-inner"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Target Month Feature */}
            <div className="md:col-span-2 p-5 sm:p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 text-blue-600">
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">تخصيص لشهر محدد (استحقاق)</h4>
                    <p className="text-[10px] font-bold text-slate-400">فعل هذا الخيار إذا كان المصروف يخص شهراً سابقاً أو مستقبلياً</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasTargetMonth: !formData.hasTargetMonth })}
                  className={`w-12 h-6 rounded-full transition-all relative cursor-pointer ${
                    formData.hasTargetMonth ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    formData.hasTargetMonth ? 'right-7' : 'right-1'
                  }`} />
                </button>
              </div>

              <AnimatePresence>
                {formData.hasTargetMonth && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 border-t border-slate-200">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">اختر الشهر والسنة</label>
                      <input
                        type="month"
                        value={formData.targetMonth}
                        onChange={(e) => setFormData({ ...formData, targetMonth: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900 text-xs"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isUpdating}
              className={`w-full sm:flex-1 py-4 rounded-[1.8rem] font-black text-base sm:text-lg shadow-xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                isUpdating ? 'bg-slate-300 text-slate-500 cursor-not-allowed' :
                type === 'Expense' ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25' :
                type === 'Income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25' :
                'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
              }`}
            >
              {isUpdating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جاري حفظ وتحديث المعاملة...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>تأكيد وحفظ التعديلات</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className="w-full sm:w-auto px-7 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[1.8rem] font-black text-sm transition-all cursor-pointer border border-slate-200"
            >
              إلغاء الأمر
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
