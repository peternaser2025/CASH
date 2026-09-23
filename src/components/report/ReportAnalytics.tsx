import React from 'react';
import { 
  PieChart as PieChartIcon, 
  BarChart3, 
  Building2, 
  ArrowRightLeft, 
  CalendarClock 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { formatKWD, isTransferType } from '../../utils/format';
import { ComputedReportRow } from './ReportTable';

interface ReportAnalyticsProps {
  rows?: any[][];
  computedRows: ComputedReportRow[];
}

export default function ReportAnalytics({ computedRows }: ReportAnalyticsProps) {
  return (
    <>
      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-b-2 border-gray-900 no-print">
        <div className="p-8 border-l border-gray-900 bg-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <PieChartIcon size={20} />
            </div>
            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em]">توزيع المصروفات حسب التصنيف</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(
                    computedRows.reduce((acc: Record<string, number>, row) => {
                      const cat = String(row.category || 'غير مصنف');
                      const type = String(row.type || '');
                      if (isTransferType(type, cat)) return acc;
                      const expense = row.expense || 0;
                      if (expense > 0) acc[cat] = (acc[cat] || 0) + expense;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([name, value]) => ({ name, value }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatKWD(value)}
                  contentStyle={{ borderRadius: '16px', border: '2px solid #111827', fontWeight: 'bold', fontSize: '10px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 bg-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em]">المصروفات حسب الفرع</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(
                computedRows.reduce((acc: Record<string, number>, row) => {
                  const branch = String(row.branch || 'عام');
                  const type = String(row.type || '');
                  const cat = String(row.category || '');
                  if (isTransferType(type, cat)) return acc;
                  const expense = row.expense || 0;
                  if (expense > 0) acc[branch] = (acc[branch] || 0) + expense;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                <Tooltip 
                  formatter={(value: number) => formatKWD(value)}
                  contentStyle={{ borderRadius: '16px', border: '2px solid #111827', fontWeight: 'bold', fontSize: '10px' }}
                />
                <Bar dataKey="value" fill="#111827" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Financial Analysis Cards Section */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        {/* Branch Analysis */}
        <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Building2 size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900">تحليل الفروع (نقدي vs آجل)</h3>
          </div>
          <div className="space-y-3">
            {(Object.entries(
              computedRows.reduce((acc: Record<string, { current: number; accruals: number }>, row) => {
                const branch = String(row.branch || 'عام');
                if (isTransferType(row.type, row.category)) return acc;
                
                const expense = row.expense || 0;
                if (expense === 0) return acc;

                if (!acc[branch]) acc[branch] = { current: 0, accruals: 0 };
                
                if (row.isAccrued) {
                  acc[branch].accruals += expense;
                } else {
                  acc[branch].current += expense;
                }
                
                return acc;
              }, {} as Record<string, { current: number; accruals: number }>)
            ) as [string, { current: number; accruals: number }][]).map(([branch, data]) => (
              <div key={branch} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">{branch}</span>
                  <span className="font-mono font-extrabold text-slate-900 text-xs">{formatKWD(data.current + data.accruals)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 block">فعلي:</span>
                    <span className="font-mono font-bold text-emerald-600">{formatKWD(data.current)}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-slate-400 block">استحقاق:</span>
                    <span className="font-mono font-bold text-rose-600">{formatKWD(data.accruals)}</span>
                  </div>
                </div>
              </div>
            ))}
            {computedRows.filter(r => r.expense > 0 && !isTransferType(r.type, r.category)).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">لا توجد مصروفات مسجلة</p>
            )}
          </div>
        </div>

        {/* Transfer Analysis */}
        <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <ArrowRightLeft size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900">حركة التحويلات النقدية</h3>
          </div>
          <div className="space-y-2.5">
            {(Object.entries(
              computedRows.reduce((acc: Record<string, number>, row) => {
                if (!isTransferType(row.type, row.category)) return acc;
                const employee = String(row.employee || 'غير محدد');
                const amount = (row.income > 0 ? row.income : row.expense) || 0;
                acc[employee] = (acc[employee] || 0) + amount;
                return acc;
              }, {} as Record<string, number>)
            ) as [string, number][]).map(([emp, total]) => (
              <div key={emp} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-xs font-bold text-slate-700">{emp}</span>
                <span className="font-mono font-extrabold text-blue-700 text-xs">{formatKWD(total)}</span>
              </div>
            ))}
            {computedRows.filter(row => isTransferType(row.type, row.category)).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">لا توجد تحويلات مسجلة</p>
            )}
          </div>
        </div>

        {/* Target Month Analysis */}
        <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <CalendarClock size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-900">المصاريف حسب شهور الاستحقاق</h3>
          </div>
          <div className="space-y-2.5">
            {(Object.entries(
              computedRows.reduce((acc: Record<string, { in: number; out: number }>, row) => {
                const targetMonth = row.targetMonth || '';
                if (!targetMonth) return acc;
                if (!acc[targetMonth]) acc[targetMonth] = { in: 0, out: 0 };
                acc[targetMonth].in += row.income || 0;
                acc[targetMonth].out += row.expense || 0;
                return acc;
              }, {} as Record<string, { in: number; out: number }>)
            ) as [string, { in: number; out: number }][]).sort((a, b) => b[0].localeCompare(a[0])).map(([month, totals]) => (
              <div key={month} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-xs font-black text-slate-900 block">{month}</span>
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-emerald-600">وارد: {formatKWD(totals.in)}</span>
                  <span className="text-rose-600">صادر: {formatKWD(totals.out)}</span>
                </div>
              </div>
            ))}
            {computedRows.filter(row => !!row.targetMonth).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">لا توجد عمليات مخصصة لشهور محددة</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
