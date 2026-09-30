import React from 'react';
import { CompanyPrintProfile } from '../../utils/printConfig';
import PrintSignatures from '../print/PrintSignatures';
import { formatKWD, isTransferType, parseReportRow, getEffectiveDueMonth } from '../../utils/format';
import { toFils, toKWD } from '../../utils/money';
import { ComputedReportRow } from './ReportTable';

interface ReportPrintFooterProps {
  rows?: any[][];
  computedRows?: ComputedReportRow[];
  finalBalance: number;
  totalIncome?: number;
  totalExpense?: number;
  totalCashExpense?: number;
  companyProfile: CompanyPrintProfile;
  showSignatures: boolean;
  showStamp: boolean;
  employeeName?: string;
}

export default function ReportPrintFooter({
  rows = [],
  computedRows,
  finalBalance,
  totalIncome,
  totalExpense,
  totalCashExpense,
  companyProfile,
  showSignatures,
  showStamp,
  employeeName
}: ReportPrintFooterProps) {
  // Use computedRows if provided, otherwise parse raw rows
  const activeRows = computedRows || rows.map(parseReportRow);

  const totalIn = totalIncome !== undefined 
    ? totalIncome 
    : toKWD(activeRows.reduce((acc, row) => acc + toFils(row.income || 0), 0));

  const totalOut = totalExpense !== undefined 
    ? totalExpense 
    : toKWD(activeRows.reduce((acc, row) => acc + toFils(row.expense || 0), 0));

  const totalTransfers = toKWD(activeRows.reduce((acc, row) => {
    if (isTransferType(row.type, row.category)) {
      return acc + toFils((row.income > 0 ? row.income : row.expense) || 0);
    }
    return acc;
  }, 0));

  const branchSummary = Object.entries(
    activeRows.reduce((acc: Record<string, number>, row) => {
      const branch = String(row.branch || 'عام');
      const expFils = toFils(row.expense || 0);
      if (expFils > 0) acc[branch] = (acc[branch] || 0) + expFils;
      return acc;
    }, {} as Record<string, number>)
  ).map(([b, fils]) => [b, toKWD(fils)]) as [string, number][];

  const targetMonthSummary = (Object.entries(
    activeRows.reduce((acc: Record<string, number>, row) => {
      const expFils = toFils(row.expense || 0);
      if (expFils > 0) {
        const effectiveMonth = getEffectiveDueMonth(row);
        acc[effectiveMonth] = (acc[effectiveMonth] || 0) + expFils;
      }
      return acc;
    }, {} as Record<string, number>)
  ).map(([m, fils]) => [m, toKWD(fils)]) as [string, number][]).sort((a, b) => b[0].localeCompare(a[0]));

  const totalDueMonthExpenses = toKWD(
    targetMonthSummary.reduce((acc, [, val]) => acc + toFils(val), 0)
  );

  return (
    <div className="p-4 print:p-3 hidden print:block border-t-2 border-slate-900 bg-white break-inside-avoid">
      <div className="space-y-4 mb-4">
        {/* Compact 3-column summary for official accounting records */}
        <div className="grid grid-cols-3 gap-3 border border-slate-300 rounded-xl p-3 bg-slate-50/50 break-inside-avoid">
          {/* Column 1: Financial Balance Totals */}
          <div className="space-y-2 border-l border-slate-200 pl-3">
            <h3 className="text-[11px] font-black border-b border-slate-900 pb-1 text-slate-900">ملخص الحساب الإجمالي</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold">
                <span className="text-slate-600">إجمالي المدين (وارد):</span>
                <span className="font-mono text-emerald-700">{formatKWD(totalIn)}</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold">
                <span className="text-slate-600">إجمالي الدائن (صادر):</span>
                <span className="font-mono text-rose-700">{formatKWD(totalOut)}</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold text-blue-700">
                <span>إجمالي التحويلات:</span>
                <span className="font-mono">{formatKWD(totalTransfers)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-900 flex justify-between text-[11px] font-black text-slate-950">
                <span>الرصيد النهائي:</span>
                <span className="font-mono">{formatKWD(finalBalance)} د.ك</span>
              </div>
            </div>
          </div>

          {/* Column 2: Branches */}
          <div className="space-y-2 border-l border-slate-200 pl-3">
            <h3 className="text-[11px] font-black border-b border-slate-900 pb-1 text-slate-900">المصروفات حسب الفرع</h3>
            <div className="space-y-1">
              {branchSummary.map(([branch, total]) => (
                <div key={branch} className="flex justify-between text-[9px] border-b border-slate-200/50 py-0.5">
                  <span className="font-bold text-slate-700">{branch}:</span>
                  <span className="font-mono font-black">{formatKWD(total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Target Months - Complete without omission or truncation */}
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-slate-900 pb-1">
              <h3 className="text-[11px] font-black text-slate-900">المصاريف حسب شهور الاستحقاق</h3>
              <span className="text-[8px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded">
                شامل 100%
              </span>
            </div>
            <div className="space-y-1">
              {targetMonthSummary.map(([month, total]) => (
                <div key={month} className="flex justify-between text-[9px] border-b border-slate-200/50 py-0.5">
                  <span className="font-bold text-slate-700">{month}:</span>
                  <span className="font-mono font-black">{formatKWD(total)}</span>
                </div>
              ))}
              {targetMonthSummary.length === 0 && (
                <span className="text-[9px] text-slate-400">لا توجد مصروفات</span>
              )}
              {targetMonthSummary.length > 0 && (
                <div className="pt-1 border-t border-slate-900 flex justify-between text-[9px] font-black text-slate-900">
                  <span>إجمالي الشهور:</span>
                  <span className="font-mono">{formatKWD(totalDueMonthExpenses)} د.ك</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Official Multi-Box Signatures & Corporate Seal */}
        {showSignatures && (
          <div className="pt-2 break-inside-avoid">
            <PrintSignatures
              profile={companyProfile}
              showStamp={showStamp}
              preparedBy="المحاسب المسؤول / مدخل البيانات"
              auditedBy="رئيس الحسابات والتدقيق الداخلي"
              approvedBy="اعتماد المدير المالي العام"
              receivedBy={`أمين ومستلم العهدة (${employeeName || 'المسؤول'})`}
            />
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-end pt-3 border-t border-slate-200">
        <div className="space-y-0.5">
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{companyProfile.companyNameEn} | SECURE REPORTING ENGINE</p>
          <p className="text-[6px] font-bold text-slate-400 italic">هذا المستند تم استخراجه وتدقيقه إلكترونياً ويخضع لمعايير الرقابة والمطابقة المحاسبية الرسمية.</p>
        </div>
        <div className="text-left">
          <p className="text-[8px] font-black text-slate-700">صفحة 1 من 1</p>
        </div>
      </div>
    </div>
  );
}
