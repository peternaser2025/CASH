import React from 'react';
import { 
  Building2, 
  User, 
  Filter, 
  ArrowRightLeft, 
  Calendar, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Layers,
  CalendarClock,
  X
} from 'lucide-react';
import { CITY_DEPARTMENTS } from '../../constants';
import { ReportFilter } from '../../types';
import { formatMonthLabelAr } from '../../utils/format';

interface ReportFilterSectionProps {
  filters: ReportFilter;
  onChangeFilters: (filters: ReportFilter) => void;
  employees: string[];
  branches: string[];
  availableTargetMonths?: string[];
  accrualFilter: 'All' | 'Due' | 'Paid';
  onChangeAccrualFilter: (status: 'All' | 'Due' | 'Paid') => void;
  onGenerate: () => void;
  loading: boolean;
  totalRecordsCount?: number;
}

export default function ReportFilterSection({
  filters,
  onChangeFilters,
  employees,
  branches,
  availableTargetMonths = [],
  accrualFilter,
  onChangeAccrualFilter,
  onGenerate,
  loading,
  totalRecordsCount
}: ReportFilterSectionProps) {
  const isCitySelected = filters.branch && (filters.branch.includes('سيتي') || filters.branch === 'سيتي');

  return (
    <div className="relative no-print">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold">
              <Filter size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">تصفية واستخراج كشف الحساب</h3>
              <p className="text-xs font-medium text-slate-500">حدد الموظف أو الفرع والفترة الزمنية لعرض كشف الحساب المالي التدقيقي</p>
            </div>
          </div>
          {typeof totalRecordsCount === 'number' && (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200/60 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              تم استخراج {totalRecordsCount} حركة مالية
            </span>
          )}
        </div>

        {/* Real-time Search Any Word in Recorded Transactions */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.searchKeyword || ''}
              onChange={(e) => onChangeFilters({ ...filters, searchKeyword: e.target.value })}
              placeholder="البحث الفوري عن أي كلمة في الحركات المسجلة (البيان، التصنيف، الموظف، الفرع، رقم الحركة، أو المبلغ)..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 hover:border-slate-400 focus:border-slate-900 rounded-xl font-bold text-xs text-slate-900 placeholder:text-slate-400 outline-none shadow-2xs transition-colors"
            />
            {filters.searchKeyword && (
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, searchKeyword: '' })}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {filters.searchKeyword && (
            <span className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-2 shrink-0 shadow-2xs">
              <span>تصفية بالكلمة: "{filters.searchKeyword}"</span>
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, searchKeyword: '' })}
                className="text-amber-700 hover:text-amber-950 font-black cursor-pointer"
              >
                ×
              </button>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200/70 p-2">
          {/* Employee */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <User size={14} className="text-emerald-600" />
              الموظف المسؤول
            </label>
            <select
              value={filters.employee}
              onChange={(e) => onChangeFilters({ ...filters, employee: e.target.value })}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="">كافة الموظفين</option>
              {employees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Building2 size={14} className="text-emerald-600" />
              الفرع / الموقع
            </label>
            <select
              value={filters.branch}
              onChange={(e) => {
                const newBranch = e.target.value;
                onChangeFilters({ 
                  ...filters, 
                  branch: newBranch,
                  department: (newBranch.includes('سيتي') || newBranch === 'سيتي') ? filters.department : ''
                });
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="">كافة الفروع</option>
              {branches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>

          {/* City Department */}
          {isCitySelected && (
            <div className="p-4 space-y-2 bg-amber-50/30 rounded-xl border border-amber-200/50">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Layers size={14} className="text-amber-600" />
                تصفية حسب القسم (فرع سيتي)
              </label>
              <select
                value={filters.department || ''}
                onChange={(e) => onChangeFilters({ ...filters, department: e.target.value })}
                className="w-full bg-white hover:bg-amber-50/50 font-bold text-xs text-amber-950 p-2.5 rounded-xl border border-amber-300 outline-none transition-colors cursor-pointer"
              >
                <option value="">كافة الأقسام</option>
                {CITY_DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>قسم {dept}</option>
                ))}
                <option value="unassigned">غير محدد / بيانات سابقة</option>
              </select>
            </div>
          )}

          {/* Operation Type */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <ArrowRightLeft size={14} className="text-emerald-600" />
              نوع العملية
            </label>
            <select
              value={filters.type}
              onChange={(e) => onChangeFilters({ ...filters, type: e.target.value })}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="All">كافة العمليات</option>
              <option value="Expense">مصروفات</option>
              <option value="Income">توريدات</option>
              <option value="Transfer">تحويلات</option>
            </select>
          </div>

          {/* Accrual status */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Filter size={14} className="text-emerald-600" />
              حالة الاستحقاق
            </label>
            <select
              value={accrualFilter}
              onChange={(e) => onChangeAccrualFilter(e.target.value as any)}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="All">الكل (نقدي ومستحق)</option>
              <option value="Due">آجل / مستحق فقط</option>
              <option value="Paid">نقدي / مسدد فقط</option>
            </select>
          </div>

          {/* Target Due Month Filter */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <CalendarClock size={14} className="text-emerald-600" />
              شهر الاستحقاق
            </label>
            <select
              value={filters.targetMonth || ''}
              onChange={(e) => onChangeFilters({ ...filters, targetMonth: e.target.value })}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2.5 rounded-xl border border-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="">كافة شهور الاستحقاق</option>
              {availableTargetMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabelAr(m)}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Calendar size={14} className="text-emerald-600" />
              من تاريخ
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChangeFilters({ ...filters, startDate: e.target.value })}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2 rounded-xl border border-slate-200 outline-none"
            />
          </div>

          {/* End Date */}
          <div className="p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Calendar size={14} className="text-emerald-600" />
              إلى تاريخ
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onChangeFilters({ ...filters, endDate: e.target.value })}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-900 p-2 rounded-xl border border-slate-200 outline-none"
            />
          </div>
        </div>
        
        <div className="border-t border-slate-200 p-4 bg-slate-50/80 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">اختر اسم الموظف أو الفرع لمعاينة حركة عهدته وحسابه المالي بالتفصيل</p>
          
          <button
            onClick={onGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl font-extrabold text-xs transition-all shadow-sm active:scale-95 disabled:bg-slate-300 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            عرض وتوليد التقرير
          </button>
        </div>
      </div>
    </div>
  );
}
