import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Save, ArrowRightLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { gasService } from '../services/gasService';
import { TransactionType } from '../types';
import { BRANCHES, CATEGORIES } from '../constants';

interface TransactionFormProps {
  onComplete: () => void;
  employees: string[];
}

export default function TransactionForm({ onComplete, employees }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('Expense');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: '',
    branch: '',
    category: '',
    amount: '',
    description: '',
    sender: '',
    receiver: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const data = {
      ...formData,
      type,
      amount: parseFloat(formData.amount)
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">تسجيل عملية جديدة</h2>
        <p className="text-gray-500 mt-1">أدخل بيانات العملية بدقة لضمان توازن الميزانية</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Type Selector */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setType('Expense')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 transition-all ${
              type === 'Expense' ? 'bg-red-50 text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <TrendingDown size={18} />
            <span className="font-bold">مصروف</span>
          </button>
          <button
            onClick={() => setType('Income')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 transition-all ${
              type === 'Income' ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <TrendingUp size={18} />
            <span className="font-bold">توريد</span>
          </button>
          <button
            onClick={() => setType('Transfer')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 transition-all ${
              type === 'Transfer' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <ArrowRightLeft size={18} />
            <span className="font-bold">تحويل</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {status && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-xl flex items-center gap-3 ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-medium">{status.message}</p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">التاريخ</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">الفرع (اختياري)</label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="">غير محدد / عام</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
            </div>

            {type === 'Transfer' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">المرسل (من عهدة)</label>
                  <select
                    required
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="">اختر المرسل</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">المستلم (إلى عهدة)</label>
                  <select
                    required
                    value={formData.receiver}
                    onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="">اختر المستلم</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">الموظف</label>
                  <select
                    required
                    value={formData.employee}
                    onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">التصنيف</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                    >
                      <option value="">اختر التصنيف</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">المبلغ (د.ك)</label>
              <input
                type="number"
                step="0.001"
                required
                placeholder="0.000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-2xl font-mono font-bold text-center"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">البيان / الوصف</label>
              <textarea
                required
                rows={3}
                placeholder="اكتب تفاصيل العملية هنا..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={20} />
                تسجيل العملية
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
