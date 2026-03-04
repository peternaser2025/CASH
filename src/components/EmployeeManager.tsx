import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Users, CheckCircle2, AlertCircle, Loader2, ShieldCheck, UserCheck, Search, Trash2 } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBalances = balances.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setStatus(null);
    
    const result = await gasService.addEmployee(name.trim());
    
    if (result.success) {
      setStatus({ type: 'success', message: 'تم إضافة الموظف بنجاح إلى قاعدة البيانات' });
      setName('');
      onRefresh();
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ type: 'error', message: result.error || 'حدث خطأ أثناء الإضافة' });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">إدارة الموظفين والعهد</h2>
          <p className="text-gray-500 mt-2 font-medium">إضافة موظفين جدد، متابعة صلاحياتهم، ومراقبة أرصدة العهد النشطة</p>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي المسجلين</p>
            <p className="text-xl font-black text-gray-900">{balances.length} موظف</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Add Employee Form - Hero Style */}
        <div className="lg:col-span-1">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 space-y-8 sticky top-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">إضافة موظف</h3>
                <p className="text-xs font-bold text-gray-400">تسجيل عهدة جديدة</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">الاسم الكامل للموظف</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد علي..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                />
              </div>

              <AnimatePresence>
                {status && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl flex items-center gap-3 border ${
                      status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-800 border-red-100'
                    }`}
                  >
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-xs font-black">{status.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gray-900 text-white rounded-[2rem] font-black text-lg hover:bg-emerald-600 transition-all disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-3 shadow-xl shadow-gray-900/20 active:scale-95"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <UserPlus size={24} />}
                تأكيد الإضافة
              </button>
            </form>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex gap-3 items-start">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
                  تنبيه: سيتم إنشاء ورقة عمل (Sheet) جديدة لهذا الموظف تلقائياً في النظام لمتابعة حركته المالية.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Employee List - Hero Style */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-gray-50 text-gray-400 rounded-xl">
              <Search size={20} />
            </div>
            <input 
              type="text"
              placeholder="ابحث عن موظف بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-bold text-gray-900 placeholder:text-gray-300"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                <h3 className="text-xl font-black text-gray-900">قائمة الموظفين المعتمدين</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-50">
                    <th className="px-8 py-6">الموظف</th>
                    <th className="px-8 py-6">حالة الحساب</th>
                    <th className="px-8 py-6">الرصيد التراكمي</th>
                    <th className="px-8 py-6 text-left">إدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBalances.map((emp, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg group-hover:bg-emerald-500 group-hover:text-white transition-all">
                            {emp.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-gray-900 text-lg">{emp.name}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                              <UserCheck size={10} />
                              هوية مالية نشطة
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                          <CheckCircle2 size={12} />
                          حساب نشط
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className={`text-xl font-black font-mono ${emp.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {emp.balance.toFixed(3)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">د.ك</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-left">
                        <button 
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من حذف الموظف ${emp.name}؟ سيتم حذف كافة بياناته!`)) {
                              setLoading(true);
                              const res = await gasService.deleteEmployee(emp.name);
                              if (res.success) {
                                onRefresh();
                              } else {
                                alert('خطأ في الحذف: ' + res.error);
                              }
                              setLoading(false);
                            }
                          }}
                          className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredBalances.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-4">
                          <Search size={48} className="opacity-10" />
                          <p className="font-bold text-lg italic">لا توجد نتائج مطابقة للبحث</p>
                        </div>
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
