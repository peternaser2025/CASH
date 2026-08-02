import { useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Users, Activity, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Search, Filter, ShieldCheck, Scale } from 'lucide-react';
import { EmployeeBalance } from '../types';
import { formatKWD } from '../utils/format';
import { exportReportToExcel } from '../utils/excelExport';

interface DashboardProps {
  balances: EmployeeBalance[];
  loading: boolean;
  onRefresh: () => void;
}

export default function Dashboard({ balances, loading, onRefresh }: DashboardProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'positive' | 'negative'>('all');

  const totalBalance = balances.reduce((acc, curr) => acc + curr.balance, 0);
  const positiveBalances = balances.filter(b => b.balance > 0).length;
  const negativeBalances = balances.filter(b => b.balance < 0).length;

  const filteredBalances = balances.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'positive') return item.balance >= 0;
    if (statusFilter === 'negative') return item.balance < 0;
    return true;
  });

  const handleExportDashboardExcel = () => {
    const fileName = `المركز_المالي_الشامل_${new Date().toISOString().split('T')[0]}`;
    
    const headers = [
      'اسم الموظف / المسؤول',
      'السيولة والعهدة (د.ك)',
      'الحالة المالية للعهدة',
      'تاريخ التحديث'
    ];

    const rows = balances.map(emp => {
      let statusText = 'عهدة متوازنة (صفر)';
      if (emp.balance > 0) statusText = 'رصيد سيولة متبقي بصندوق الموظف';
      else if (emp.balance < 0) statusText = 'مستحق للموظف (عجز تغذية / صرف شخصي)';

      return [
        emp.name,
        emp.balance,
        statusText,
        new Date().toLocaleDateString('ar-KW')
      ];
    });

    exportReportToExcel({
      fileName,
      sheetName: 'المركز المالي',
      reportTitle: 'تقرير المركز المالي الشامل وأرصدة السيولة النقدية',
      subtitle: `إجمالي السيولة النقدية المتاحة بالعهد: ${formatKWD(totalBalance)} د.ك | تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')}`,
      summaryCards: [
        { label: 'إجمالي السيولة النقدية المتاحة بالعهد', value: formatKWD(totalBalance) },
        { label: 'عهدة بها سيولة متبقية', value: `${positiveBalances} عهدة` },
        { label: 'عهدة بها عجز / مستحق للموظف', value: `${negativeBalances} عهدة` },
        { label: 'إجمالي المسؤولين والمعتمدين', value: `${balances.length} موظف` },
      ],
      headers,
      rows,
      totalsRow: [
        'الإجمالي الكلي للسيولة النقدية',
        totalBalance,
        totalBalance > 0 ? 'فائض سيولة بالعهد' : totalBalance < 0 ? 'إجمالي عجز التغذية المستحق' : 'متوازن',
        '-'
      ]
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">المركز المالي</h2>
          <p className="text-gray-500 mt-1 font-medium">نظرة شاملة على السيولة النقدية وأرصدة العهد</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportDashboardExcel}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={18} />
            تصدير المركز المالي (Excel)
          </button>
          <button 
            onClick={onRefresh}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md text-sm font-bold text-gray-700 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            تحديث البيانات
          </button>
        </div>
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
            <div>
              <h3 className="text-xl font-black text-gray-900">تفاصيل أرصدة العهد والمسؤولين</h3>
              <p className="text-xs text-gray-400 font-bold">تتبع فوري ومباشر لأرصدة الصناديق الفردية</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="بحث باسم الموظف..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pr-10 pl-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48 transition-all"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-900'}`}
              >
                الكل ({balances.length})
              </button>
              <button
                onClick={() => setStatusFilter('positive')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'positive' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-gray-500 hover:text-emerald-700'}`}
              >
                موجب ({positiveBalances})
              </button>
              <button
                onClick={() => setStatusFilter('negative')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'negative' ? 'bg-rose-600 text-white shadow-sm font-black' : 'text-gray-500 hover:text-rose-700'}`}
              >
                مدين ({negativeBalances})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-50 bg-slate-50/50">
                <th className="px-8 py-5">الموظف / العهدة</th>
                <th className="px-8 py-5 text-center">الحالة المالية</th>
                <th className="px-8 py-5 text-center">نسبة الحصة من السيولة</th>
                <th className="px-8 py-5">الرصيد الحالي</th>
                <th className="px-8 py-5 text-left">التوثيق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-48"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-24"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-32"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-32"></div></td>
                    <td className="px-8 py-6"><div className="h-6 bg-gray-100 rounded-xl w-16"></div></td>
                  </tr>
                ))
              ) : filteredBalances.length > 0 ? (
                filteredBalances.map((item, index) => {
                  const sharePct = totalBalance > 0 && item.balance > 0 ? ((item.balance / totalBalance) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={index} className="hover:bg-gray-50/70 transition-all group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center font-black text-base group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                            {item.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-gray-900 text-base">{item.name}</span>
                            <span className="text-[11px] text-gray-400 font-bold">مسؤول عهدة معتمد</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                          item.balance > 0 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : item.balance < 0 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {item.balance > 0 ? <ArrowUpRight size={14} /> : item.balance < 0 ? <ArrowDownRight size={14} /> : <Scale size={14} />}
                          {item.balance > 0 ? 'رصيد متوفر بالصندوق' : item.balance < 0 ? 'مستحق للموظف (عجز تغذية)' : 'عهدة متوازنة (صفر)'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="w-32 mx-auto space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-gray-500">
                            <span>حصة السيولة:</span>
                            <span className="font-mono font-black">{sharePct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${Math.min(100, Math.max(0, parseFloat(sharePct)))}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className={`text-xl font-black font-mono ${item.balance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                            {formatKWD(item.balance)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">دينار كويتي</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-left">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                          <ShieldCheck size={14} className="text-emerald-600" />
                          <span>موثق</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <Users size={32} className="opacity-30" />
                      </div>
                      <p className="font-bold text-base text-gray-700">لا توجد نتائج مطابقة للبحث أو التصفية المختارة</p>
                      <p className="text-xs text-gray-400">جرب البحث باسم آخر أو تغيير فلتر التصفية</p>
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
