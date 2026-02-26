import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Users, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { EmployeeBalance } from '../types';
import { formatKWD } from '../utils/format';

interface DashboardProps {
  balances: EmployeeBalance[];
  loading: boolean;
  onRefresh: () => void;
}

export default function Dashboard({ balances, loading, onRefresh }: DashboardProps) {
  const totalBalance = balances.reduce((acc, curr) => acc + curr.balance, 0);
  const positiveBalances = balances.filter(b => b.balance > 0).length;
  const negativeBalances = balances.filter(b => b.balance < 0).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">المركز المالي</h2>
          <p className="text-gray-500 mt-1 font-medium">نظرة شاملة على السيولة النقدية وأرصدة العهد</p>
        </div>
        <button 
          onClick={onRefresh}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md text-sm font-bold text-gray-700 active:scale-95"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          تحديث البيانات
        </button>
      </div>

      {/* Hero Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:col-span-2 bg-emerald-600 p-8 rounded-[2rem] text-white shadow-2xl shadow-emerald-500/30 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-12 bg-white/10 rounded-full -mr-12 -mt-12 blur-3xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <Wallet size={28} />
              </div>
              <span className="text-sm font-black uppercase tracking-widest opacity-80">إجمالي السيولة المتاحة</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-5xl font-black tracking-tighter">{formatKWD(totalBalance)}</h3>
              <span className="text-xl font-medium opacity-70">د.ك</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                <TrendingUp size={16} className="text-emerald-300" />
                <span className="text-xs font-bold">{positiveBalances} عهد إيجابية</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                <TrendingDown size={16} className="text-red-300" />
                <span className="text-xs font-bold">{negativeBalances} عهد مدينة</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between group hover:border-emerald-200 transition-all"
        >
          <div className="flex justify-between items-start">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Users size={24} />
            </div>
            <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg">
              <ArrowUpRight size={12} />
              <span>نشط</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold text-gray-400 uppercase mb-1">إجمالي الموظفين</p>
            <h4 className="text-3xl font-black text-gray-900">{balances.length}</h4>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between group hover:border-amber-200 transition-all"
        >
          <div className="flex justify-between items-start">
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all">
              <Activity size={24} />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase">Live Update</p>
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold text-gray-400 uppercase mb-1">آخر تحديث</p>
            <h4 className="text-xl font-black text-gray-900">{new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}</h4>
          </div>
        </motion.div>
      </div>

      {/* Balances Grid - Bento Style */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
            <h3 className="text-xl font-black text-gray-900">تفاصيل أرصدة العهد</h3>
          </div>
          <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100 w-fit">
            {balances.length} سجل مالي
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-50">
                <th className="px-8 py-6">الموظف / العهدة</th>
                <th className="px-8 py-6">الحالة المالية</th>
                <th className="px-8 py-6">الرصيد الحالي</th>
                <th className="px-8 py-6 text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-48"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-24"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-32"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-16"></div></td>
                  </tr>
                ))
              ) : balances.length > 0 ? (
                balances.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-900 font-black text-lg group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                          {item.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-lg">{item.name}</span>
                          <span className="text-xs text-gray-400 font-medium">موظف معتمد</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                        item.balance >= 0 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-red-50 text-red-600 border border-red-100'
                      }`}>
                        {item.balance >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {item.balance >= 0 ? 'رصيد إيجابي' : 'رصيد مدين'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className={`text-2xl font-black font-mono ${item.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatKWD(item.balance)}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">دينار كويتي</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-left">
                      <button className="p-2 hover:bg-emerald-50 text-gray-300 hover:text-emerald-600 rounded-xl transition-all">
                        <Activity size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                        <Users size={40} className="opacity-20" />
                      </div>
                      <p className="font-bold text-lg">لا توجد بيانات متاحة حالياً</p>
                      <p className="text-sm">ابدأ بإضافة موظفين وتسجيل عمليات مالية لتظهر هنا</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
