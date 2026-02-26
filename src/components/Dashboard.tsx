import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { EmployeeBalance } from '../types';

interface DashboardProps {
  balances: EmployeeBalance[];
  loading: boolean;
  onRefresh: () => void;
}

export default function Dashboard({ balances, loading, onRefresh }: DashboardProps) {
  const totalBalance = balances.reduce((acc, curr) => acc + curr.balance, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">المركز المالي</h2>
          <p className="text-gray-500 mt-1">متابعة أرصدة العهد والصناديق الحالية</p>
        </div>
        <button 
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          تحديث البيانات
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي السيولة</p>
              <p className="text-2xl font-bold text-gray-900">{totalBalance.toFixed(3)} د.ك</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">عدد العهد النشطة</p>
              <p className="text-2xl font-bold text-gray-900">{balances.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">آخر تحديث</p>
              <p className="text-lg font-bold text-gray-900">{new Date().toLocaleTimeString('ar-KW')}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Balances Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-bottom border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">تفاصيل أرصدة الموظفين</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">الموظف / العهدة</th>
                <th className="px-6 py-4 font-medium">الحالة</th>
                <th className="px-6 py-4 font-medium">الرصيد الحالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
                  </tr>
                ))
              ) : balances.length > 0 ? (
                balances.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                          {item.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        item.balance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.balance >= 0 ? 'إيجابي' : 'مدين'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono font-bold ${item.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.balance.toFixed(3)} د.ك
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    لا توجد بيانات متاحة حالياً. يرجى إضافة عمليات أولاً.
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
