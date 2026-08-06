import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, ArrowRightLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Calendar, Building2, User, Tag, Info, Coins, CalendarClock } from 'lucide-react';
import { gasService } from '../services/gasService';
import { TransactionType } from '../types';

interface TransactionFormProps {
  onComplete: () => void;
  employees: string[];
  branches: string[];
  categories: string[];
  initialEmployee?: string;
  initialType?: TransactionType;
}

export default function TransactionForm({ onComplete, employees, branches, categories, initialEmployee, initialType }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initialType || 'Expense');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: initialEmployee || '',
    branch: '',
    category: '',
    amount: '',
    description: initialEmployee ? `تغذية وتزويد عهدة الموظف ${initialEmployee}` : '',
    sender: '',
    receiver: initialEmployee || '',
    hasTargetMonth: false,
    targetMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    isAccrual: false,
    vendorName: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    let finalCategory = formData.category;
    let finalDescription = formData.description;
    let finalEmployee = formData.employee;

    if (type === 'Transfer') {
      if (!formData.sender || !formData.receiver) {
        setStatus({ type: 'error', message: 'يرجى اختيار الموظف المرسل والموظف المستلم لعملية التحويل' });
        setLoading(false);
        return;
      }
      if (formData.sender === formData.receiver) {
        setStatus({ type: 'error', message: 'لا يمكن تحويل العهدة لنفس الموظف' });
        setLoading(false);
        return;
      }
      finalCategory = 'تحويل عهدة نقدية';
      finalEmployee = formData.sender;
      if (!finalDescription) {
        finalDescription = `تحويل عهدة نقدية من ${formData.sender} إلى ${formData.receiver}`;
      }
    }

    if (formData.isAccrual) {
      if (!finalCategory.includes('آجل') && !finalCategory.includes('مستحق')) {
        finalCategory = `${finalCategory} (آجل/مستحق)`;
      }
      finalDescription = `[مستحق/آجل] ${finalDescription} ${formData.vendorName ? '- المورد: ' + formData.vendorName : ''}`;
    }

    if (formData.hasTargetMonth && formData.targetMonth) {
      const targetTag = `[تخص شهر ${formData.targetMonth}]`;
      if (!finalDescription.includes(targetTag) && !finalDescription.includes(`تخص شهر ${formData.targetMonth}`)) {
        finalDescription = `${targetTag} ${finalDescription}`;
      }
    }

    const data = {
      ...formData,
      employee: finalEmployee,
      category: finalCategory,
      description: finalDescription,
      type,
      amount: parseFloat(formData.amount),
      targetMonth: formData.hasTargetMonth ? formData.targetMonth : undefined
    };

    const result = await gasService.addTransaction(data);

    if (result.success) {
      setStatus({ type: 'success', message: `تم تسجيل العملية بنجاح برقم: ${result.id}` });
      setTimeout(() => onComplete(), 2000);
    } else {
      setStatus({ type: 'error', message: result.error || 'حدث خطأ أثناء التسجيل' });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-10 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block p-3 bg-emerald-50 text-emerald-600 rounded-2xl mb-4"
        >
          <Coins size={32} />
        </motion.div>
        <h2 className="text-4xl font-black text-gray-900 tracking-tight">تسجيل عملية مالية</h2>
        <p className="text-gray-500 mt-2 font-medium">أدخل بيانات العملية بدقة لضمان توازن الميزانية والتقارير</p>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
        {/* Type Selector - Professional Hero Style */}
        <div className="flex p-2 bg-gray-50/50 border-b border-gray-100">
          {[
            { id: 'Expense', label: 'مصروف', icon: TrendingDown, color: 'red' },
            { id: 'Income', label: 'توريد / مبيعات 💰', icon: TrendingUp, color: 'emerald' },
            { id: 'Transfer', label: 'تحويل عهدة', icon: ArrowRightLeft, color: 'blue' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setType(item.id as TransactionType)}
              className={`flex-1 py-4 flex items-center justify-center gap-3 rounded-2xl transition-all duration-300 font-black text-sm uppercase tracking-wider cursor-pointer ${
                type === item.id 
                  ? `bg-white text-${item.color}-600 shadow-lg shadow-${item.color}-500/10 border border-${item.color}-100` 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className={`p-4 rounded-2xl flex items-center gap-4 border ${
                  status.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                    : 'bg-red-50 text-red-800 border-red-100'
                }`}
              >
                <div className={`p-2 rounded-xl ${status.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                  {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <p className="text-sm font-black">{status.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                <Calendar size={14} />
                تاريخ العملية
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-bold text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                <Building2 size={14} />
                الفرع المرتبط
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-bold text-gray-900"
              >
                <option value="">غير محدد / عام</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {type === 'Transfer' ? (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <User size={14} />
                    المرسل (من عهدة)
                  </label>
                  <select
                    required
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-900"
                  >
                    <option value="">اختر الموظف المرسل</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <User size={14} />
                    المستلم (إلى عهدة)
                  </label>
                  <select
                    required
                    value={formData.receiver}
                    onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-900"
                  >
                    <option value="">اختر الموظف المستلم</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <User size={14} />
                    الموظف المسؤول
                  </label>
                  <select
                    required
                    value={formData.employee}
                    onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900"
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <Tag size={14} />
                    تصنيف العملية
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-bold text-gray-900"
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

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                <Coins size={14} />
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
                  className={`w-full px-6 py-6 bg-gray-50 border border-gray-100 rounded-[2rem] focus:ring-8 transition-all outline-none text-4xl font-black font-mono text-center ${
                    type === 'Expense' ? 'focus:ring-red-500/10 focus:border-red-500 text-red-600' : 
                    type === 'Income' ? 'focus:ring-emerald-500/10 focus:border-emerald-500 text-emerald-600' :
                    'focus:ring-blue-500/10 focus:border-blue-500 text-blue-600'
                  }`}
                />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300 pointer-events-none">KWD</div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                <Info size={14} />
                البيان / الوصف التفصيلي
              </label>
              <textarea
                required
                rows={4}
                placeholder="اكتب تفاصيل العملية هنا بشكل واضح..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none resize-none font-medium text-gray-900"
              />
            </div>

            {/* Accrued / Credit Purchase Toggle Card - The Golden Key */}
            <div className="md:col-span-2 p-6 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-300/80 rounded-3xl space-y-4 shadow-sm shadow-amber-500/10 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-amber-400 to-yellow-600 text-white rounded-2xl shadow-md shadow-amber-500/20 font-black text-xl flex items-center justify-center">
                    🔑
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-black text-amber-950">المفتاح الذهبي: عملية آجلة / مشتريات بالدين / مصاريف مستحقة</h4>
                      <span className="px-2.5 py-0.5 text-[10px] font-black bg-amber-200/80 text-amber-900 rounded-full border border-amber-300">
                        آجل / مستحق
                      </span>
                    </div>
                    <p className="text-xs font-bold text-amber-800/80 mt-0.5">
                      تفعيل هذا المفتاح يحول العملية تلقائياً لدفتر المشتريات الآجلة والالتزامات لمتابعة السداد دون تأخير
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isAccrual: !formData.isAccrual })}
                  className={`px-5 py-3 rounded-2xl transition-all duration-300 font-black text-xs flex items-center gap-2.5 shrink-0 border shadow-sm ${
                    formData.isAccrual 
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-amber-400 shadow-amber-500/30 scale-105 ring-4 ring-amber-400/20' 
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
                    className="overflow-hidden pt-4 border-t border-amber-200/80 space-y-3"
                  >
                    <div className="p-3 bg-amber-100/90 border border-amber-300 rounded-2xl text-amber-950 text-xs font-bold flex items-start gap-2.5 shadow-sm">
                      <span className="text-lg leading-none">🛡️</span>
                      <div>
                        <p className="font-black text-amber-950 mb-0.5">تأكيد محاسبي لسلامة الصندوق والخزنة:</p>
                        <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                          هذه المشتريات الآجلة تُسجل كالتزام بدفتر الديون والأرباح والخسائر (أساس الاستحقاق)، <strong>وتم ضبط النظام تماماً لعدم خصمها إطلاقاً من الصندوق أو السيولة النقدية</strong>، ولن يتم خصم نقدية من الخزنة إلا في تاريخ سداد المورد لاحقاً.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-black text-amber-950">
                      <span>✨ البيانات الخاصة بالعملية الآجلة</span>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-amber-900 mb-1.5">اسم المورد / الجهة الدائنة (اختياري)</label>
                      <input
                        type="text"
                        placeholder="مثال: شركة التوريدات الكويتية / مصنع السلام..."
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        className="w-full px-5 py-3 bg-white border border-amber-300 rounded-2xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-bold text-gray-900 text-xs shadow-inner"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Target Month Feature */}
            <div className="md:col-span-2 p-6 bg-gray-50/50 border border-gray-100 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-blue-600">
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">تخصيص لشهر محدد</h4>
                    <p className="text-[10px] font-bold text-gray-400">فعل هذا الخيار إذا كان المصروف يخص شهراً سابقاً (مصروف مستحق)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasTargetMonth: !formData.hasTargetMonth })}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    formData.hasTargetMonth ? 'bg-emerald-500' : 'bg-gray-200'
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
                    <div className="pt-4 border-t border-gray-100">
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">اختر الشهر والسنة</label>
                      <input
                        type="month"
                        value={formData.targetMonth}
                        onChange={(e) => setFormData({ ...formData, targetMonth: e.target.value })}
                        className="w-full px-5 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-900"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-[2rem] font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
              loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 
              type === 'Expense' ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30' :
              type === 'Income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30' :
              'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
            }`}
          >
            {loading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <Save size={24} />
                تأكيد وتسجيل العملية
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const Loader2 = ({ size, className }: { size: number, className: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
