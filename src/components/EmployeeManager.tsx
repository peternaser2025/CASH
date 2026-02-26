import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';

interface EmployeeManagerProps {
  balances: EmployeeBalance[];
  onRefresh: () => void;
}

export default function EmployeeManager({ balances, onRefresh }: EmployeeManagerProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setStatus(null);
    
    const result = await gasService.addEmployee(name.trim());
    
    if (result.success) {
      setStatus({ type: 'success', message: 'تم إضافة الموظف بنجاح' });
      setName('');
      onRefresh();
    } else {
      setStatus({ type: 'error', message: result.error || 'حدث خطأ أثناء الإضافة' });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">إدارة الموظفين والعهد</h2>
        <p className="text-gray-500 mt-1">إضافة موظفين جدد ومتابعة حالتهم في النظام</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Add Employee Form */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-emerald-600">
              <UserPlus size={20} />
              <h3 className="font-bold">إضافة موظف جديد</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">اسم الموظف</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل الاسم الكامل..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              {status && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all disabled:bg-gray-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                إضافة للنظام
              </button>
            </form>
          </div>
        </div>

        {/* Employee List */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <Users size={20} className="text-gray-400" />
              <h3 className="font-bold text-gray-900">قائمة الموظفين المسجلين</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold">الاسم</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold">الرصيد الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {balances.map((emp, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">نشط</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-gray-600">{emp.balance.toFixed(3)} د.ك</td>
                    </tr>
                  ))}
                  {balances.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm italic">
                        لا يوجد موظفين مسجلين حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
