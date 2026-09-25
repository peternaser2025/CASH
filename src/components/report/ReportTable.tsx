import React from 'react';
import { 
  Edit2, 
  Trash2, 
  Printer 
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
  onPrintVoucher: (row: ComputedReportRow, rowIndexInSheet: number) => void;
  onEditTransaction: (row: ComputedReportRow, rowIndexInSheet: number) => void;
  onDeleteTransaction: (row: ComputedReportRow, rowIndexInSheet: number) => void;
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
  onPrintVoucher,
  onEditTransaction,
  onDeleteTransaction
}: ReportTableProps) {
  let leadingColSpan = 0;
  if (visibleColumns.date) leadingColSpan++;
  if (visibleColumns.branch) leadingColSpan++;
  if (visibleColumns.opType) leadingColSpan++;
  if (visibleColumns.category) leadingColSpan++;
  if (visibleColumns.description) leadingColSpan++;
  if (visibleColumns.paymentStatus) leadingColSpan++;

  let trailingColSpan = 0;
  if (visibleColumns.balance) trailingColSpan++;

  return (
    <div className="p-6 overflow-x-auto print:overflow-visible print:p-0">
      <table className="w-full text-right border-collapse border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <thead>
          <tr className="bg-slate-900 text-slate-100">
            {visibleColumns.date && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">التاريخ</th>}
            {visibleColumns.branch && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">الفرع</th>}
            {visibleColumns.opType && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center">نوع العملية</th>}
            {visibleColumns.category && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">التصنيف / الموظف</th>}
            {visibleColumns.description && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">البيان والتفاصيل</th>}
            {visibleColumns.paymentStatus && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center">حالة الدفع</th>}
            {visibleColumns.income && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-emerald-400">وارد (+)</th>}
            {visibleColumns.expense && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-rose-400">صادر (-)</th>}
            {visibleColumns.balance && <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800">الرصيد التراكمي</th>}
            <th className="px-4 py-3.5 font-bold text-xs border-b border-slate-800 text-center no-print">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/80 bg-white">
          {/* Opening Balance Row */}
          <tr className="bg-slate-50/70">
            {visibleColumns.date && <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">---</td>}
            {visibleColumns.branch && <td className="px-4 py-3 text-center text-slate-400 text-xs">---</td>}
            {visibleColumns.opType && (
              <td className="px-4 py-3 text-center font-bold text-xs text-slate-500 bg-slate-100/60 rounded">
                رصيد دفتري
              </td>
            )}
            {visibleColumns.category && (
              <td className="px-4 py-3 font-bold text-xs text-slate-700">
                رصيد افتتاحي
              </td>
            )}
            {visibleColumns.description && (
              <td className="px-4 py-3 text-slate-500 text-xs italic">
                الرصيد المرحل من السجلات السابقة
              </td>
            )}
            {visibleColumns.paymentStatus && <td className="px-4 py-3 text-center text-slate-400 text-xs">---</td>}
            {visibleColumns.income && <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">0.000</td>}
            {visibleColumns.expense && <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">0.000</td>}
            {visibleColumns.balance && (
              <td className="px-4 py-3 font-mono text-sm font-extrabold text-slate-900">
                {formatKWD(openingBalance)}
              </td>
            )}
            <td className="px-4 py-3 text-center no-print text-slate-300">---</td>
          </tr>

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

            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {visibleColumns.date && (
                  <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-600">
                    {date}
                    {targetMonth && (
                      <span className="mr-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200/60 inline-block">
                        يخص: {targetMonth}
                      </span>
                    )}
                  </td>
                )}
                {visibleColumns.branch && (
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">
                    <div>{branch}</div>
                    {row.department && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-black tracking-tight">
                        {row.department}
                      </span>
                    )}
                  </td>
                )}
                {visibleColumns.opType && (
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black border inline-block ${
                      opType === 'مبيعات' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                      opType === 'مشتريات' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                      opType === 'مصاريف' ? 'bg-red-100 text-red-900 border-red-300' :
                      opType === 'مشتريات آجلة' ? 'bg-orange-100 text-orange-950 border-orange-300 font-extrabold' :
                      opType === 'مصاريف مستحقة' ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold' :
                      opType === 'سداد مستحقات' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                      opType === 'إغلاق وتصفية صندوق' ? 'bg-teal-100 text-teal-900 border-teal-300 font-black' :
                      'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      {opType}
                    </span>
                  </td>
                )}
                {visibleColumns.category && (
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${
                        isTransfer ? 'text-blue-700' : isIncome ? 'text-emerald-700' : 'text-slate-900'
                      }`}>
                        {category || (isTransfer ? 'تحويل مالي' : 'عام')}
                      </span>
                      {employee && <span className="text-[10px] font-medium text-slate-400">{employee}</span>}
                    </div>
                  </td>
                )}
                {visibleColumns.description && (
                  <td className="px-4 py-3 text-xs text-slate-800 font-medium leading-relaxed max-w-[300px]">
                    {description}
                  </td>
                )}
                {visibleColumns.paymentStatus && (
                  <td className="px-4 py-3 text-center">
                    {isTransactionAccrued ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200/80 text-xs font-bold">
                        <span>آجل / غير مدفوع</span>
                        <span className="text-[10px] text-amber-600">(لم يُخصم)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200/80 text-xs font-bold">
                        <span>نقدي / مسدد</span>
                      </span>
                    )}
                  </td>
                )}
                {visibleColumns.income && (
                  <td className="px-4 py-3 font-mono font-bold text-sm text-emerald-600">
                    {income > 0 ? income.toFixed(3) : '0.000'}
                  </td>
                )}
                {visibleColumns.expense && (
                  <td className="px-4 py-3 font-mono font-bold text-sm text-rose-600">
                    {expense > 0 ? expense.toFixed(3) : '0.000'}
                  </td>
                )}
                {visibleColumns.balance && (
                  <td className="px-4 py-3 font-mono text-extrabold text-sm text-slate-900 bg-slate-50/50">
                    {formatKWD(balance)}
                  </td>
                )}
                <td className="px-4 py-3 text-center no-print">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onPrintVoucher(row, rowIndexInSheet)}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="طباعة سند مالي معتمد (صرف / قبض / تحويل)"
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      onClick={() => onEditTransaction(row, rowIndexInSheet)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => onDeleteTransaction(row, rowIndexInSheet)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-900 text-white font-bold text-xs">
          <tr>
            {leadingColSpan > 0 && (
              <td colSpan={leadingColSpan} className="px-4 py-3 text-left">
                <span>إجمالي الكشف التدقيقي:</span>
                {totalAccrual && totalAccrual > 0 ? (
                  <span className="block text-[10px] text-amber-300 font-normal">
                    (يشمل {formatKWD(totalCashExpense || 0)} د.ك نقدي مسدد + {formatKWD(totalAccrual)} د.ك التزامات آجلة)
                  </span>
                ) : null}
              </td>
            )}
            {visibleColumns.income && (
              <td className="px-4 py-3 font-mono text-emerald-400 font-extrabold text-sm whitespace-nowrap">
                +{formatKWD(totalIncome)}
              </td>
            )}
            {visibleColumns.expense && (
              <td className="px-4 py-3 font-mono text-rose-400 font-extrabold text-sm whitespace-nowrap">
                -{formatKWD(totalExpense)}
              </td>
            )}
            {trailingColSpan > 0 && (
              <td colSpan={trailingColSpan} className="px-4 py-3 font-mono text-white font-black text-sm whitespace-nowrap">
                الرصيد: {formatKWD(finalBalance)}
              </td>
            )}
            <td className="px-4 py-3 no-print"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
