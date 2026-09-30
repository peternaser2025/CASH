import React, { useState, useMemo } from 'react';
import { 
  PieChart as PieChartIcon, 
  BarChart3, 
  Building2, 
  ArrowRightLeft, 
  CalendarClock,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  DollarSign,
  CreditCard,
  Layers,
  ArrowUpDown,
  Tag
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
import { 
  formatKWD, 
  isTransferType, 
  getEffectiveDueMonth, 
  formatMonthLabelAr 
} from '../../utils/format';
import { toFils, toKWD } from '../../utils/money';
import { exportReportToExcel } from '../../utils/excelExport';
import { ComputedReportRow } from './ReportTable';

interface ReportAnalyticsProps {
  rows?: any[][];
  computedRows: ComputedReportRow[];
}

interface DueMonthGroup {
  monthKey: string;
  labelAr: string;
  totalFils: number;
  cashFils: number;
  accrualFils: number;
  rows: (ComputedReportRow & { effectiveDueMonth: string; hasExplicitTag: boolean })[];
}

export default function ReportAnalytics({ computedRows }: ReportAnalyticsProps) {
  // State for detailed due month section
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cash' | 'accrual' | 'explicit'>('all');
  const [sortBy, setSortBy] = useState<'month_desc' | 'month_asc' | 'amount_desc'>('month_desc');

  // Filtered expense rows (excluding custody transfers which are internal funds movement)
  const expenseRows = useMemo(() => {
    return computedRows.filter(r => r.expense > 0 && !isTransferType(r.type, r.category));
  }, [computedRows]);

  // Total expense in report
  const totalReportExpenseFils = useMemo(() => {
    return expenseRows.reduce((acc, r) => acc + toFils(r.expense), 0);
  }, [expenseRows]);
  const totalReportExpense = toKWD(totalReportExpenseFils);

  // Group ALL expenses by effective due month - Guaranteed zero data loss ("دون حذف")
  const dueMonthGroups = useMemo<Record<string, DueMonthGroup>>(() => {
    const map: Record<string, DueMonthGroup> = {};

    expenseRows.forEach(row => {
      const effectiveMonth = getEffectiveDueMonth(row);
      const isAccrued = !!row.isAccrued;
      const expFils = toFils(row.expense);
      const hasExplicitTag = !!(row.targetMonth && row.targetMonth.trim() !== '');

      if (!map[effectiveMonth]) {
        map[effectiveMonth] = {
          monthKey: effectiveMonth,
          labelAr: formatMonthLabelAr(effectiveMonth),
          totalFils: 0,
          cashFils: 0,
          accrualFils: 0,
          rows: []
        };
      }

      map[effectiveMonth].totalFils += expFils;
      if (isAccrued) {
        map[effectiveMonth].accrualFils += expFils;
      } else {
        map[effectiveMonth].cashFils += expFils;
      }

      map[effectiveMonth].rows.push({
        ...row,
        effectiveDueMonth: effectiveMonth,
        hasExplicitTag
      });
    });

    return map;
  }, [expenseRows]);

  // Sorted list of months
  const sortedMonthList = useMemo<DueMonthGroup[]>(() => {
    const list = Object.values(dueMonthGroups) as DueMonthGroup[];
    if (sortBy === 'month_desc') {
      return list.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    } else if (sortBy === 'month_asc') {
      return list.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    } else {
      return list.sort((a, b) => b.totalFils - a.totalFils);
    }
  }, [dueMonthGroups, sortBy]);

  // Filtered month list based on search and type filter
  const filteredMonthList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return sortedMonthList.map(group => {
      const filteredRows = group.rows.filter(r => {
        // Type filter
        if (typeFilter === 'cash' && r.isAccrued) return false;
        if (typeFilter === 'accrual' && !r.isAccrued) return false;
        if (typeFilter === 'explicit' && !r.hasExplicitTag) return false;

        // Search query
        if (!q) return true;
        const text = `${r.description || ''} ${r.category || ''} ${r.branch || ''} ${r.employee || ''} ${group.monthKey} ${group.labelAr}`.toLowerCase();
        return text.includes(q);
      });

      const filteredTotalFils = filteredRows.reduce((acc, r) => acc + toFils(r.expense), 0);
      const filteredCashFils = filteredRows.filter(r => !r.isAccrued).reduce((acc, r) => acc + toFils(r.expense), 0);
      const filteredAccrualFils = filteredRows.filter(r => r.isAccrued).reduce((acc, r) => acc + toFils(r.expense), 0);

      return {
        ...group,
        totalFils: filteredTotalFils,
        cashFils: filteredCashFils,
        accrualFils: filteredAccrualFils,
        rows: filteredRows
      };
    }).filter(group => group.rows.length > 0);
  }, [sortedMonthList, searchQuery, typeFilter]);

  // Overall totals across all due months
  const totalAllocatedExpenseFils = useMemo(() => {
    return sortedMonthList.reduce((acc, m) => acc + m.totalFils, 0);
  }, [sortedMonthList]);

  const totalAllocatedCashFils = useMemo(() => {
    return sortedMonthList.reduce((acc, m) => acc + m.cashFils, 0);
  }, [sortedMonthList]);

  const totalAllocatedAccrualFils = useMemo(() => {
    return sortedMonthList.reduce((acc, m) => acc + m.accrualFils, 0);
  }, [sortedMonthList]);

  // Check 100% strict mathematical equality
  const isStrictlyBalanced = totalReportExpenseFils === totalAllocatedExpenseFils;

  // Toggle month expansion
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    sortedMonthList.forEach(m => { all[m.monthKey] = true; });
    setExpandedMonths(all);
  };

  const collapseAll = () => {
    setExpandedMonths({});
  };

  // Export to Excel for Due Months
  const handleExportExcel = () => {
    const headers = [
      'شهر الاستحقاق',
      'التاريخ',
      'الموظف المسؤول',
      'الفرع',
      'التصنيف / البند',
      'البيان والتفاصيل',
      'حالة الدفع',
      'تخصيص صريح',
      'المبلغ (د.ك)'
    ];

    const rows: (string | number)[][] = [];

    sortedMonthList.forEach(group => {
      group.rows.forEach(r => {
        rows.push([
          group.monthKey,
          r.date,
          r.employee,
          r.branch,
          r.category,
          r.description,
          r.isAccrued ? 'آجل / مستحق' : 'نقدي مباشر',
          r.hasExplicitTag ? `نعم (${r.targetMonth})` : 'لا (تاريخ الحركة)',
          r.expense
        ]);
      });
    });

    const totalsRow = [
      'الإجمالي الشامل لكافة شهور الاستحقاق',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      toKWD(totalAllocatedExpenseFils)
    ];

    exportReportToExcel({
      fileName: `كشف_المصاريف_حسب_شهور_الاستحقاق_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'شهور الاستحقاق',
      reportTitle: 'كشف تحليلي شامل: المصاريف حسب شهور الاستحقاق (دون حذف أو اختصار)',
      subtitle: `تاريخ التصدير: ${new Date().toLocaleDateString('ar-KW')} - عدد الحركات: ${expenseRows.length} - التطابق المحاسبي: 100%`,
      summaryCards: [
        { label: 'إجمالي المصاريف الموزعة', value: `${formatKWD(toKWD(totalAllocatedExpenseFils))} د.ك` },
        { label: 'المصاريف النقدية المسددة', value: `${formatKWD(toKWD(totalAllocatedCashFils))} د.ك` },
        { label: 'الالتزامات الآجلة والمستحقة', value: `${formatKWD(toKWD(totalAllocatedAccrualFils))} د.ك` },
        { label: 'عدد شهور الاستحقاق', value: sortedMonthList.length }
      ],
      headers,
      rows,
      totalsRow
    });
  };

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

      {/* Detailed Financial Overview Cards Section */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
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

        {/* Due Months Summary Card - Complete 100% Without Omission */}
        <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500 text-white rounded-lg">
                <CalendarClock size={16} />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">المصاريف حسب شهور الاستحقاق</h3>
                <span className="text-[10px] font-bold text-emerald-600">شامل 100% دون حذف</span>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-black rounded-md">
              {sortedMonthList.length} شهور
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {sortedMonthList.map(group => {
              const totalAmount = toKWD(group.totalFils);
              const cashAmount = toKWD(group.cashFils);
              const accrualAmount = toKWD(group.accrualFils);
              const percent = totalAllocatedExpenseFils > 0 
                ? ((group.totalFils / totalAllocatedExpenseFils) * 100).toFixed(1)
                : '0';

              return (
                <div 
                  key={group.monthKey} 
                  onClick={() => toggleMonth(group.monthKey)}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50/50 border border-slate-200/80 rounded-xl space-y-1.5 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900">{group.labelAr}</span>
                    <span className="font-mono font-black text-slate-950 text-xs">{formatKWD(totalAmount)} د.ك</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex gap-2">
                      <span className="text-emerald-700 font-bold">نقدي: {formatKWD(cashAmount)}</span>
                      {group.accrualFils > 0 && (
                        <span className="text-amber-700 font-bold">آجل: {formatKWD(accrualAmount)}</span>
                      )}
                    </div>
                    <span className="text-slate-400 font-bold">{percent}% ({group.rows.length} حركة)</span>
                  </div>
                </div>
              );
            })}

            {sortedMonthList.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">لا توجد مصروفات مسجلة</p>
            )}
          </div>

          {sortedMonthList.length > 0 && (
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-black">
              <span className="text-slate-700">إجمالي شهور الاستحقاق:</span>
              <span className="font-mono text-emerald-700">{formatKWD(toKWD(totalAllocatedExpenseFils))} د.ك</span>
            </div>
          )}
        </div>
      </div>

      {/* COMPREHENSIVE DEDICATED SECTION: EXPENSES BY DUE MONTHS WITHOUT DELETION OR TRUNCATION */}
      <div className="p-6 border-t-2 border-slate-900 bg-slate-50/50 space-y-6 no-print">
        {/* Section Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 text-amber-400 rounded-2xl flex items-center justify-center font-black shadow-sm">
                <CalendarClock size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    كشف وتفاصيل المصاريف حسب شهور الاستحقاق
                  </h2>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300">
                    تطابق محاسبي 100% دون حذف أو اختصار
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  توزيع استحقاق كافة بنود المصروفات والالتزامات مع تفاصيل الحركات بالكامل دون استبعاد أو اختصار لأي مبلغ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={sortedMonthList.length === 0}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير كشف الاستحقاق (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Audit Verification Strip */}
          <div className="mt-4 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-950 font-black">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                التدقيق المالي: إجمالي المصاريف الموزعة على شهور الاستحقاق يطابق تماماً إجمالي مصروفات التقرير
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono font-black text-xs">
              <span className="text-slate-600">مصروفات الكشف: {formatKWD(totalReportExpense)} د.ك</span>
              <span className="text-slate-400">=</span>
              <span className="text-emerald-700">مجموع شهور الاستحقاق: {formatKWD(toKWD(totalAllocatedExpenseFils))} د.ك</span>
              {isStrictlyBalanced && (
                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px]">
                  مطابق 100%
                </span>
              )}
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المصروفات الدفترية</span>
              <span className="text-base font-black font-mono text-slate-950 block">{formatKWD(toKWD(totalAllocatedExpenseFils))} د.ك</span>
              <span className="text-[10px] text-slate-400 block">{expenseRows.length} بند ومصروف شامل</span>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 block">المصروفات النقدية المسددة</span>
              <span className="text-base font-black font-mono text-emerald-700 block">{formatKWD(toKWD(totalAllocatedCashFils))} د.ك</span>
              <span className="text-[10px] text-emerald-600 block">مدفوعة نقداً من الخزينة/العهدة</span>
            </div>

            <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-amber-900 block">الالتزامات الآجلة والمستحقة</span>
              <span className="text-base font-black font-mono text-amber-700 block">{formatKWD(toKWD(totalAllocatedAccrualFils))} د.ك</span>
              <span className="text-[10px] text-amber-600 block">استحقاق دائن ومؤجل السداد</span>
            </div>

            <div className="p-4 bg-blue-50/50 border border-blue-200/60 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-blue-900 block">عدد شهور الاستحقاق المسجلة</span>
              <span className="text-base font-black font-mono text-blue-700 block">{sortedMonthList.length} شهور</span>
              <span className="text-[10px] text-blue-600 block">موزعة حسب تواريخ استحقاقها</span>
            </div>
          </div>

          {/* Interactive Filters Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في البيان، الشهر، الفرع، التصنيف..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 transition-colors"
                />
              </div>

              {/* Type filter buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    typeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({expenseRows.length})
                </button>
                <button
                  onClick={() => setTypeFilter('cash')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    typeFilter === 'cash' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نقدي فقط
                </button>
                <button
                  onClick={() => setTypeFilter('accrual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    typeFilter === 'accrual' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  آجل/مستحق
                </button>
                <button
                  onClick={() => setTypeFilter('explicit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    typeFilter === 'explicit' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مخصص صراحة
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="month_desc">الأحدث استحقاقاً أولاً</option>
                <option value="month_asc">الأقدم استحقاقاً أولاً</option>
                <option value="amount_desc">الأعلى مصروفات أولاً</option>
              </select>

              <button
                onClick={expandAll}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                توسيع الكل
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                طي الكل
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Itemized Month Accordions - Every single transaction is fully displayed */}
        <div className="space-y-4">
          {filteredMonthList.map(group => {
            const isExpanded = !!expandedMonths[group.monthKey];
            const groupTotal = toKWD(group.totalFils);
            const groupCash = toKWD(group.cashFils);
            const groupAccrual = toKWD(group.accrualFils);
            const percentOfTotal = totalAllocatedExpenseFils > 0
              ? ((group.totalFils / totalAllocatedExpenseFils) * 100).toFixed(1)
              : '0';

            const explicitCount = group.rows.filter(r => r.hasExplicitTag).length;

            return (
              <div 
                key={group.monthKey}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all hover:border-slate-300"
              >
                {/* Month Summary Bar */}
                <div 
                  onClick={() => toggleMonth(group.monthKey)}
                  className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      {group.monthKey.slice(-2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{group.labelAr}</h3>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-[10px] font-black rounded-md">
                          {group.rows.length} حركة
                        </span>
                        {explicitCount > 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-md flex items-center gap-1">
                            <Tag size={10} />
                            {explicitCount} مخصص صراحة
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 mt-1">
                        <span className="text-emerald-700">نقدي مسدد: {formatKWD(groupCash)} د.ك</span>
                        {group.accrualFils > 0 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-amber-700">آجل ومستحق: {formatKWD(groupAccrual)} د.ك</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-400 block">إجمالي مصروفات الشهر</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-base font-black text-slate-950">{formatKWD(groupTotal)}</span>
                        <span className="text-xs font-bold text-slate-600">د.ك</span>
                        <span className="text-[10px] font-black text-slate-400">({percentOfTotal}%)</span>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center transition-transform">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Itemized Table - Full details without omission or abbreviation */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 text-[11px] font-black border-b border-slate-200">
                            <th className="py-3 px-4 w-12 text-center">#</th>
                            <th className="py-3 px-4">التاريخ</th>
                            <th className="py-3 px-4">الموظف المسؤول</th>
                            <th className="py-3 px-4">الفرع</th>
                            <th className="py-3 px-4">البند / التصنيف</th>
                            <th className="py-3 px-4 min-w-[260px]">البيان والتفاصيل الشاملة</th>
                            <th className="py-3 px-4 text-center">حالة الدفع</th>
                            <th className="py-3 px-4 text-left">المبلغ (د.ك)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {group.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                              <td className="py-3 px-4 font-mono text-slate-400 text-center font-bold">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                                {row.date}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-800">
                                {row.employee || 'عام'}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-700">
                                <div>{row.branch || 'المركز الرئيسي'}</div>
                                {row.department && (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-[9px] font-black">
                                    {row.department}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[11px]">
                                  {row.category || 'عام'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-800">
                                <div>{row.description}</div>
                                {row.hasExplicitTag && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/80 rounded text-[10px] font-black">
                                      <Tag size={10} />
                                      مخصص صراحة لشهر: {row.targetMonth}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {row.isAccrued ? (
                                  <span className="px-2.5 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black">
                                    آجل / مستحق
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-lg text-[10px] font-black">
                                    نقدي مباشر
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-left font-mono font-black text-rose-700 whitespace-nowrap">
                                {formatKWD(row.expense)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 text-xs font-black border-t-2 border-slate-900">
                            <td colSpan={6} className="py-3.5 px-4 text-slate-900">
                              إجمالي مصروفات شهر {group.labelAr} ({group.rows.length} حركة دون اختصار)
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-500 font-bold">
                              نقدي: {formatKWD(groupCash)} | آجل: {formatKWD(groupAccrual)}
                            </td>
                            <td className="py-3.5 px-4 text-left font-mono text-slate-950 text-sm">
                              {formatKWD(groupTotal)} د.ك
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredMonthList.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Search size={20} />
              </div>
              <h4 className="text-sm font-black text-slate-800">لا توجد مصاريف مطابقة لشروط البحث والتصفية</h4>
              <p className="text-xs text-slate-500 font-medium">جرّب تغيير كلمات البحث أو إعادة تعيين خيارات التصفية</p>
              <button
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إعادة ضبط البحث
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
