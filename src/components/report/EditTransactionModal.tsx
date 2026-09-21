import React from 'react';
import { motion } from 'motion/react';
import { 
  Building2, 
  Calendar, 
  Tag, 
  FileText, 
  CheckCircle2, 
  X, 
  Loader2 
} from 'lucide-react';
import { CITY_DEPARTMENTS } from '../../constants';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onChangeTransaction: (transaction: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  branches: string[];
  categories: string[];
  isUpdating: boolean;
}

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  onChangeTransaction,
  onSubmit,
  branches,
  categories,
  isUpdating
}: EditTransactionModalProps) {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border-2 border-gray-900"
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-lg">تعديل الحركة المالية</h3>
              <p className="text-xs text-gray-400 font-bold">تعديل تفاصيل المعاملة المسجلة في السيرفر</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">التاريخ</label>
              <input
                type="date"
                required
                value={transaction.date}
                onChange={(e) => onChangeTransaction({ ...transaction, date: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">المبلغ (د.ك)</label>
              <input
                type="number"
                step="0.001"
                required
                value={transaction.amount}
                onChange={(e) => onChangeTransaction({ ...transaction, amount: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">الفرع</label>
              <select
                value={transaction.branch}
                onChange={(e) => onChangeTransaction({ ...transaction, branch: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              >
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">التصنيف</label>
              <select
                value={transaction.category}
                onChange={(e) => onChangeTransaction({ ...transaction, category: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Department field if branch is city */}
            {transaction.branch && (transaction.branch.includes('سيتي') || transaction.branch === 'سيتي') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900 uppercase">القسم (فرع سيتي)</label>
                <select
                  value={transaction.department || ''}
                  onChange={(e) => onChangeTransaction({ ...transaction, department: e.target.value })}
                  className="w-full px-4 py-3 bg-amber-50/50 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                >
                  <option value="">غير محدد / بيانات سابقة</option>
                  {CITY_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">شهر الاستحقاق (اختياري)</label>
              <input
                type="month"
                value={transaction.targetMonth || ''}
                onChange={(e) => onChangeTransaction({ ...transaction, targetMonth: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">البيان</label>
              <textarea
                required
                rows={3}
                value={transaction.description}
                onChange={(e) => onChangeTransaction({ ...transaction, description: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold resize-none"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isUpdating}
              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              حفظ التعديلات
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
