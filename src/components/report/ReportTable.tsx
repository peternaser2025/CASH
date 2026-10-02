import React, { useState } from 'react';
import { 
  Edit2, 
  Trash2, 
  Printer, 
  Search, 
  X,
  LayoutGrid,
  List,
  SlidersHorizontal,
  CreditCard,
  Building,
  User,
  Calendar,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatKWD, isIncomeType, isTransferType } from '../../utils/format';
import { ReportColumnId } from '../ReportViewer';

export interface ComputedReportRow {
  id?: string | number;
  date: string;
  employee: string;
  branch: string;
  department?: string;
  type: string;
  category: string;
  description: string;
  income: number;
  expense: number;
  computedBalance: number;
  targetMonth?: string;
  isAccrued: boolean;
  opType: string;
  raw?: any;
}

interface ReportTableProps {
  computedRows: ComputedReportRow[];
  openingBalance: number;
  finalBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalCashExpense?: number;
  totalAccrual?: number;
  visibleColumns: Record<ReportColumnId, boolean>;
  searchKeyword?: string;
  onSearchChange?: (val: string) => void;
  totalUnfilteredCount?: number;
  onPrintVoucher: (row: ComputedReportRow, rowIndexInSheet: number) => void;
  onEditTransaction: (row: ComputedReportRow, rowIndexInSheet: number) => void;
  onDeleteTransaction: (row: ComputedReportRow, rowIndexInSheet: number) => void;
  onOpenColumnCustomization?: () => void;
}

export type TableDensityMode = 'comfortable' | 'compact' | 'cards';

/**
 * Highlights matching tokens within cell text
 */
function HighlightMatch({ text, query }: { text: string | number | undefined | null; query?: string }) {
  if (text === undefined || text === null) return null;
  const str = String(text);
  if (!query || !query.trim()) return <>{str}</>;

  const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return <>{str}</>;

  const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

  const parts = str.split(pattern);
  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = tokens.some(t => part.toLowerCase() === t.toLowerCase());
        return isMatch ? (
          <mark key={idx} className="bg-amber-200 text-amber-950 font-black px-0.5 rounded shadow-2xs">
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        );
      })}
    </>
  );
}

export default function ReportTable({
  computedRows,
  openingBalance,
  finalBalance,
  totalIncome,
  totalExpense,
  totalCashExpense,
  totalAccrual,
  visibleColumns,
  searchKeyword,
  onSearchChange,
  totalUnfilteredCount,
  onPrintVoucher,
  onEditTransaction,
  onDeleteTransaction,
  onOpenColumnCustomization
}: ReportTableProps) {
  // Density & presentation mode (Comfortable, Compact, Smart Cards)
  const [densityMode, setDensityMode] = useState<TableDensityMode>('comfortable');

  let leadingColSpan = 1; // For the right-hand Edit/Actions column
  if (visibleColumns.date) leadingColSpan++;
  if (visibleColumns.branch) leadingColSpan++;
  if (visibleColumns.opType) leadingColSpan++;
  if (visibleColumns.category) leadingColSpan++;
  if (visibleColumns.description) leadingColSpan++;
  if (visibleColumns.paymentStatus) leadingColSpan++;

  let trailingColSpan = 0;
  if (visibleColumns.balance) trailingColSpan++;

  const totalCols = leadingColSpan + (visibleColumns.income ? 1 : 0) + (visibleColumns.expense ? 1 : 0) + trailingColSpan;

  return (
    <div className="p-4 sm:p-6 overflow-x-auto print:overflow-visible print:p-0 space-y-4">
      {/* Top Controls Bar: Search, View Mode Switcher, and Columns */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-lg">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="بحث فوري شامل (أي كلمة، موظف، فرع، بيان، مبلغ، تصنيف)..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl font-bold text-xs text-slate-900 placeholder:text-slate-400 outline-none shadow-2xs transition-all"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchKeyword && (
            <button
              onClick={() => onSearchChange?.('')}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0"
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        {/* View Density Switcher & Live Counter */}
        <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-auto">
          {/* Live Count Pill */}
          <span className="px-3 py-1.5 bg-white text-slate-800 text-xs font-black rounded-xl border border-slate-200 shadow-2xs">
            {searchKeyword ? (
              <span>
                مطابقة <strong className="text-emerald-600 font-mono text-sm">{computedRows.length}</strong> من <strong className="text-slate-900 font-mono">{totalUnfilteredCount || computedRows.length}</strong> حركة (دون حذف)
              </span>
            ) : (
              <span>
                إجمالي <strong className="text-blue-700 font-mono text-sm">{computedRows.length}</strong> حركة مسجلة كاملة
              </span>
            )}
          </span>

          {/* Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-200/90 rounded-xl border border-slate-300/70 shadow-inner">
            <button
              type="button"
              onClick={() => setDensityMode('comfortable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                densityMode === 'comfortable'
                  ? 'bg-white text-blue-900 shadow-xs scale-102'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض مريح: تباعد متوازن ووضوح عالي"
            >
              <SlidersHorizontal size={13} />
              <span>عرض مريح</span>
            </button>

            <button
              type="button"
              onClick={() => setDensityMode('compact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                densityMode === 'compact'
                  ? 'bg-white text-blue-900 shadow-xs scale-102'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض مدمج: يعرض عدداً كبيراً من الحركات بسطور مدمجة"
            >
              <List size={14} />
              <span>جدول مدمج</span>
            </button>

            <button
              type="button"
              onClick={() => setDensityMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                densityMode === 'cards'
                  ? 'bg-blue-600 text-white shadow-xs scale-102'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="بطاقات ذكية: بطاقة واضحة لكل حركة مع زر تعديل كبير وبدون أي ازدحام"
            >
              <LayoutGrid size={13} />
              <span>بطاقات ذكية</span>
            </button>
          </div>

          {onOpenColumnCustomization && (
            <button
              type="button"
              onClick={onOpenColumnCustomization}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="تخصيص الأعمدة المعروضة"
            >
              <SlidersHorizontal size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Prominent Edit Guidance Banner */}
      <div className="px-4 py-2.5 bg-gradient-to-l from-blue-50 to-indigo-50/80 border border-blue-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-blue-950 font-bold no-print shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
            <Edit2 size={13} className="stroke-[2.5]" />
          </span>
          <span>
            <strong>أيقونة التعديل متاحة مباشرة:</strong> اضغط على زر <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded-md text-[11px] font-black mx-1 shadow-2xs"><Edit2 size={10} /> تعديل</span> الأزرق على يمين كل سطر أو انقر مرتين على أي حركة لتعديلها فوراً دون حذف أو اختصار.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-white text-blue-700 rounded-lg border border-blue-200 text-[11px] font-black shadow-2xs">
            تحديث فوري للسجلات
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1 & 2: TABLE VIEW (COMFORTABLE & COMPACT)                           */}
      {/* ========================================================================= */}
      {densityMode !== 'cards' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs bg-white">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-100 text-xs">
                {/* 1. Primary Action & Edit Column on the RIGHT in RTL - NEVER SCROLLED OFF */}
                <th className="px-3.5 py-3.5 font-black text-center sticky right-0 z-20 bg-slate-900 border-l border-slate-800 min-w-[130px] shadow-[4px_0_12px_rgba(0,0,0,0.25)] no-print">
                  <span className="flex items-center justify-center gap-1.5 text-blue-300">
                    <Edit2 size={13} className="text-blue-400 stroke-[2.5]" />
                    <span>تعديل وإجراءات</span>
                  </span>
                </th>

                {visibleColumns.date && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 whitespace-nowrap">التاريخ</th>}
                {visibleColumns.branch && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800">الفرع</th>}
                {visibleColumns.opType && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 text-center whitespace-nowrap">نوع العملية</th>}
                {visibleColumns.category && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800">التصنيف / الموظف</th>}
                {visibleColumns.description && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 min-w-[220px]">البيان والتفاصيل</th>}
                {visibleColumns.paymentStatus && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 text-center whitespace-nowrap">حالة الدفع</th>}
                {visibleColumns.income && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 text-emerald-400 text-left whitespace-nowrap">وارد (+)</th>}
                {visibleColumns.expense && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 text-rose-400 text-left whitespace-nowrap">صادر (-)</th>}
                {visibleColumns.balance && <th className="px-3.5 py-3.5 font-bold border-b border-slate-800 text-left whitespace-nowrap">الرصيد التراكمي</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/90 bg-white">
              {/* Opening Balance Row - Only shown when there is an actual prior opening balance */}
              {Boolean(openingBalance && openingBalance !== 0) && (
                <tr className="bg-slate-50/80 font-bold">
                  <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-xs sticky right-0 z-10 bg-slate-100 border-l border-slate-200 no-print">
                    ---
                  </td>
                  {visibleColumns.date && <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-xs">---</td>}
                  {visibleColumns.branch && <td className="px-3.5 py-2.5 text-center text-slate-400 text-xs">---</td>}
                  {visibleColumns.opType && (
                    <td className="px-3.5 py-2.5 text-center font-bold text-xs text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[11px] font-black">
                        رصيد سابق
                      </span>
                    </td>
                  )}
                  {visibleColumns.category && (
                    <td className="px-3.5 py-2.5 font-bold text-xs text-slate-800">
                      رصيد افتتاحي
                    </td>
                  )}
                  {visibleColumns.description && (
                    <td className="px-3.5 py-2.5 text-slate-500 text-xs italic">
                      الرصيد المرحل من السجلات السابقة لما قبل بداية الفترة المحددة
                    </td>
                  )}
                  {visibleColumns.paymentStatus && <td className="px-3.5 py-2.5 text-center text-slate-400 text-xs">---</td>}
                  {visibleColumns.income && <td className="px-3.5 py-2.5 text-left font-mono text-xs text-slate-300">0.000</td>}
                  {visibleColumns.expense && <td className="px-3.5 py-2.5 text-left font-mono text-xs text-slate-300">0.000</td>}
                  {visibleColumns.balance && (
                    <td className="px-3.5 py-2.5 text-left font-mono text-sm font-black text-slate-900 bg-slate-100/60">
                      {formatKWD(openingBalance)}
                    </td>
                  )}
                </tr>
              )}

              {/* Transactions Rows */}
              {computedRows.map((row, i) => {
                const date = row.date;
                const employee = row.employee;
                const branch = row.branch;
                const type = row.type;
                const category = row.category;
                const income = row.income;
                const expense = row.expense;
                const balance = row.computedBalance;
                const description = row.description;
                const targetMonth = row.targetMonth;
                
                const rowIndexInSheet = (typeof row.raw === 'object' && row.raw?.rowIndex) ? row.raw.rowIndex : (i + 2);

                const isIncome = isIncomeType(type) || (income > 0 && !isTransferType(type));
                const isTransfer = isTransferType(type);
                const isTransactionAccrued = row.isAccrued;
                const opType = row.opType;

                const pyClass = densityMode === 'compact' ? 'py-1.5' : 'py-3';

                return (
                  <tr 
                    key={i} 
                    onDoubleClick={() => onEditTransaction(row, rowIndexInSheet)}
                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    title="انقر نقراً مزدوجاً لتعديل هذه الحركة المالية فوراً"
                  >
                    {/* 1. PRIMARY RIGHT-HAND ACTIONS & EDIT COLUMN - ULTRA VISIBLE */}
                    <td className={`px-2.5 ${pyClass} text-center no-print whitespace-nowrap sticky right-0 z-10 bg-white group-hover:bg-blue-50/80 border-l border-slate-200/90 shadow-[4px_0_8px_rgba(0,0,0,0.04)] transition-colors`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {/* UNMISSABLE EDIT BUTTON */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTransaction(row, rowIndexInSheet);
                          }}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer hover:scale-105 shrink-0"
                          title="تعديل هذه الحركة المالية"
                        >
                          <Edit2 size={13} className="shrink-0 stroke-[2.5]" />
                          <span>تعديل</span>
                        </button>

                        {/* Print Voucher */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrintVoucher(row, rowIndexInSheet);
                          }}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-slate-200"
                          title="طباعة سند مالي رسمي"
                        >
                          <Printer size={14} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTransaction(row, rowIndexInSheet);
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-rose-100"
                          title="حذف الحركة المالية"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                    {/* Date */}
                    {visibleColumns.date && (
                      <td className={`px-3.5 ${pyClass} text-xs font-mono font-bold text-slate-700 whitespace-nowrap`}>
                        <div className="flex items-center gap-1.5">
                          <HighlightMatch text={date} query={searchKeyword} />
                          {targetMonth && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200 inline-block">
                              يخص: <HighlightMatch text={targetMonth} query={searchKeyword} />
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Branch & Dept */}
                    {visibleColumns.branch && (
                      <td className={`px-3.5 ${pyClass} text-xs font-bold text-slate-800`}>
                        <div>
                          <HighlightMatch text={branch} query={searchKeyword} />
                        </div>
                        {row.department && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black">
                            <HighlightMatch text={row.department} query={searchKeyword} />
                          </span>
                        )}
                      </td>
                    )}

                    {/* Operation Type Badge */}
                    {visibleColumns.opType && (
                      <td className={`px-3.5 ${pyClass} text-center whitespace-nowrap`}>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border inline-block ${
                          opType === 'مبيعات' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' :
                          opType === 'مشتريات' ? 'bg-blue-100 text-blue-950 border-blue-300' :
                          opType === 'مصاريف' ? 'bg-red-100 text-red-950 border-red-300' :
                          opType === 'مشتريات آجلة' ? 'bg-orange-100 text-orange-950 border-orange-300 font-extrabold' :
                          opType === 'مصاريف مستحقة' ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold' :
                          opType === 'سداد مستحقات' ? 'bg-purple-100 text-purple-950 border-purple-300' :
                          opType === 'إغلاق وتصفية صندوق' ? 'bg-teal-100 text-teal-950 border-teal-300 font-black' :
                          'bg-slate-100 text-slate-800 border-slate-300'
                        }`}>
                          <HighlightMatch text={opType} query={searchKeyword} />
                        </span>
                      </td>
                    )}

                    {/* Category & Employee */}
                    {visibleColumns.category && (
                      <td className={`px-3.5 ${pyClass}`}>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${
                            isTransfer ? 'text-blue-700' : isIncome ? 'text-emerald-700' : 'text-slate-900'
                          }`}>
                            <HighlightMatch text={category || (isTransfer ? 'تحويل مالي' : 'عام')} query={searchKeyword} />
                          </span>
                          {employee && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              <HighlightMatch text={employee} query={searchKeyword} />
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Description */}
                    {visibleColumns.description && (
                      <td className={`px-3.5 ${pyClass} text-xs text-slate-800 font-medium leading-relaxed max-w-[340px]`}>
                        <HighlightMatch text={description} query={searchKeyword} />
                      </td>
                    )}

                    {/* Payment Status */}
                    {visibleColumns.paymentStatus && (
                      <td className={`px-3.5 ${pyClass} text-center whitespace-nowrap`}>
                        {isTransactionAccrued ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 rounded-md border border-amber-300 text-[11px] font-bold">
                            <span>آجل / غير مدفوع</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-900 rounded-md border border-emerald-300 text-[11px] font-bold">
                            <span>نقدي / مسدد</span>
                          </span>
                        )}
                      </td>
                    )}

                    {/* Income */}
                    {visibleColumns.income && (
                      <td className={`px-3.5 ${pyClass} font-mono font-black text-xs sm:text-sm text-emerald-600 text-left whitespace-nowrap`}>
                        <HighlightMatch text={income > 0 ? income.toFixed(3) : '0.000'} query={searchKeyword} />
                      </td>
                    )}

                    {/* Expense */}
                    {visibleColumns.expense && (
                      <td className={`px-3.5 ${pyClass} font-mono font-black text-xs sm:text-sm text-rose-600 text-left whitespace-nowrap`}>
                        <HighlightMatch text={expense > 0 ? expense.toFixed(3) : '0.000'} query={searchKeyword} />
                      </td>
                    )}

                    {/* Running Balance */}
                    {visibleColumns.balance && (
                      <td className={`px-3.5 ${pyClass} font-mono text-left font-black text-xs sm:text-sm text-slate-900 bg-slate-50/70 whitespace-nowrap`}>
                        {formatKWD(balance)}
                      </td>
                    )}
                  </tr>
                );
              })}

              {computedRows.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="text-center py-16 text-slate-500 font-bold bg-white">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Search size={24} />
                      </div>
                      <p className="text-sm font-black text-slate-800">
                        {searchKeyword ? `لا توجد حركات مسجلة تطابق كلمة البحث "${searchKeyword}"` : 'لا توجد حركات مسجلة في هذا النطاق'}
                      </p>
                      <p className="text-xs text-slate-400">
                        تأكد من كتابة الكلمة بشكل صحيح، أو أعد ضبط شروط البحث
                      </p>
                      {searchKeyword && (
                        <button
                          onClick={() => onSearchChange?.('')}
                          className="mt-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          إلغاء البحث وعرض كافة الحركات المسجلة
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-bold text-xs">
              <tr>
                <td className="px-3.5 py-3.5 text-center text-slate-400 sticky right-0 bg-slate-900 border-l border-slate-800 no-print">
                  المجاميع
                </td>
                {leadingColSpan > 1 && (
                  <td colSpan={leadingColSpan - 1} className="px-3.5 py-3.5 text-right">
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-slate-200">
                        {searchKeyword ? `إجمالي الحركات المطابقة للبحث (${computedRows.length} حركة):` : 'معادلة المطابقة المحاسبية لكشف الحساب:'}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-300 font-bold">
                        {openingBalance && openingBalance !== 0 ? `افتتاحي (${formatKWD(openingBalance)}) + ` : ''}وارد ({formatKWD(totalIncome)}) - صادر نقدي ({formatKWD(totalCashExpense !== undefined ? totalCashExpense : totalExpense)}) = رصيد ({formatKWD(finalBalance)}) د.ك
                      </span>
                      {totalAccrual && totalAccrual > 0 ? (
                        <span className="text-[10px] text-amber-300 font-normal">
                          (يوجد {formatKWD(totalAccrual)} د.ك التزامات مشتريات آجلة مثبتة دفترياً ولم تخصم من السيولة النقدية)
                        </span>
                      ) : null}
                    </div>
                  </td>
                )}
                {visibleColumns.income && (
                  <td className="px-3.5 py-3.5 font-mono text-emerald-400 font-black text-sm text-left whitespace-nowrap">
                    +{formatKWD(totalIncome)}
                  </td>
                )}
                {visibleColumns.expense && (
                  <td className="px-3.5 py-3.5 font-mono text-rose-400 font-black text-sm text-left whitespace-nowrap">
                    <div>-{formatKWD(totalCashExpense !== undefined ? totalCashExpense : totalExpense)}</div>
                    {totalAccrual && totalAccrual > 0 ? (
                      <div className="text-[9px] text-amber-300 font-normal">(+{formatKWD(totalAccrual)} آجل)</div>
                    ) : null}
                  </td>
                )}
                {trailingColSpan > 0 && (
                  <td colSpan={trailingColSpan} className="px-3.5 py-3.5 font-mono text-white font-black text-sm text-left whitespace-nowrap">
                    الرصيد: {formatKWD(finalBalance)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: SMART CARDS VIEW (NO HORIZONTAL SCROLL, ZERO CROWDEDNESS)        */}
      {/* ========================================================================= */}
      {densityMode === 'cards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {computedRows.map((row, i) => {
              const rowIndexInSheet = (typeof row.raw === 'object' && row.raw?.rowIndex) ? row.raw.rowIndex : (i + 2);
              const isIncome = isIncomeType(row.type) || (row.income > 0 && !isTransferType(row.type));
              const isTransfer = isTransferType(row.type);
              const isTransactionAccrued = row.isAccrued;
              const opType = row.opType;

              return (
                <div 
                  key={i}
                  onDoubleClick={() => onEditTransaction(row, rowIndexInSheet)}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-500/70 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  {/* Card Header: Type Badge, Date, Branch */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                          opType === 'مبيعات' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' :
                          opType === 'مشتريات' ? 'bg-blue-100 text-blue-950 border-blue-300' :
                          opType === 'مصاريف' ? 'bg-red-100 text-red-950 border-red-300' :
                          opType === 'مشتريات آجلة' ? 'bg-orange-100 text-orange-950 border-orange-300 font-extrabold' :
                          opType === 'مصاريف مستحقة' ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold' :
                          opType === 'سداد مستحقات' ? 'bg-purple-100 text-purple-950 border-purple-300' :
                          'bg-slate-100 text-slate-800 border-slate-300'
                        }`}>
                          <HighlightMatch text={opType} query={searchKeyword} />
                        </span>
                        
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold">
                          <HighlightMatch text={row.branch} query={searchKeyword} />
                        </span>

                        {row.department && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-[10px] font-black">
                            <HighlightMatch text={row.department} query={searchKeyword} />
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="font-mono font-bold text-slate-700">
                          <HighlightMatch text={row.date} query={searchKeyword} />
                        </span>
                        {row.targetMonth && (
                          <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[10px] font-black rounded border border-blue-200">
                            يخص: <HighlightMatch text={row.targetMonth} query={searchKeyword} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount & Sign */}
                    <div className="text-left font-mono shrink-0">
                      {isIncome ? (
                        <div className="text-emerald-700 font-black text-lg">
                          +{formatKWD(row.income)}
                        </div>
                      ) : (
                        <div className="text-rose-700 font-black text-lg">
                          -{formatKWD(row.expense)}
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 font-sans block text-left">
                        الرصيد: {formatKWD(row.computedBalance)} د.ك
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Category, Employee, Description */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-bold text-slate-900">
                        التصنيف: <HighlightMatch text={row.category || (isTransfer ? 'تحويل مالي' : 'عام')} query={searchKeyword} />
                      </span>
                      {row.employee && (
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <User size={12} />
                          <HighlightMatch text={row.employee} query={searchKeyword} />
                        </span>
                      )}
                    </div>

                    <p className="text-slate-800 text-xs font-medium leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 min-h-[46px]">
                      <HighlightMatch text={row.description || 'لا يوجد بيان مفصل'} query={searchKeyword} />
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isTransactionAccrued 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        {isTransactionAccrued ? 'التزام آجل (غير مدفوع)' : 'سداد نقدي مباشر'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Dedicated Large Action Buttons */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => onEditTransaction(row, rowIndexInSheet)}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
                      title="تعديل تفاصيل هذه الحركة بالكامل"
                    >
                      <Edit2 size={14} className="stroke-[2.5]" />
                      <span>تعديل الحركة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPrintVoucher(row, rowIndexInSheet)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="طباعة سند"
                    >
                      <Printer size={14} />
                      <span className="hidden sm:inline">سند</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(row, rowIndexInSheet)}
                      className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="حذف الحركة"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {computedRows.length === 0 && (
            <div className="text-center py-16 text-slate-500 font-bold bg-white rounded-2xl border border-slate-200 p-8">
              <Search size={28} className="mx-auto text-slate-400 mb-2" />
              <p className="text-base font-black text-slate-800">
                {searchKeyword ? `لا توجد حركات تطابق "${searchKeyword}"` : 'لا توجد حركات مسجلة'}
              </p>
              {searchKeyword && (
                <button
                  onClick={() => onSearchChange?.('')}
                  className="mt-3 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl cursor-pointer"
                >
                  إلغاء التصفية
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
