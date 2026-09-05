import React from 'react';
import { Stamp as StampIcon, CheckCircle2 } from 'lucide-react';
import { CompanyPrintProfile, getCompanyProfile } from '../../utils/printConfig';

interface PrintSignaturesProps {
  showStamp?: boolean;
  profile?: CompanyPrintProfile;
  preparedBy?: string;
  auditedBy?: string;
  approvedBy?: string;
  receivedBy?: string;
  customStampText?: string;
}

export default function PrintSignatures({
  showStamp = true,
  profile,
  preparedBy = 'المحاسب المسؤول',
  auditedBy = 'أمين العهدة / الصندوق',
  approvedBy = 'المدير المالي العام',
  receivedBy = 'المستلم / صاحب العلاقة',
  customStampText
}: PrintSignaturesProps) {
  const comp = profile || getCompanyProfile();
  const currentDate = new Date().toLocaleDateString('ar-KW');

  return (
    <div className="w-full pt-6 mt-6 border-t-2 border-dashed border-slate-300 page-break-inside-avoid print:mt-4 print:pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Box 1: Prepared by */}
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-between h-28 text-center print:border-slate-400">
          <div>
            <p className="text-[11px] font-black text-slate-900">{preparedBy}</p>
            <p className="text-[9px] text-slate-400 font-mono">Prepared by</p>
          </div>
          <div className="border-t border-slate-400 pt-1">
            <span className="text-[9px] text-slate-400 block font-bold">التوقيع والتاريخ</span>
          </div>
        </div>

        {/* Box 2: Audited / Cashier */}
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-between h-28 text-center print:border-slate-400">
          <div>
            <p className="text-[11px] font-black text-slate-900">{auditedBy}</p>
            <p className="text-[9px] text-slate-400 font-mono">Audited / Custodian</p>
          </div>
          <div className="border-t border-slate-400 pt-1">
            <span className="text-[9px] text-slate-400 block font-bold">التوقيع</span>
          </div>
        </div>

        {/* Box 3: Financial Approval & Official Stamp */}
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-between h-28 text-center relative overflow-hidden print:border-slate-400">
          <div>
            <p className="text-[11px] font-black text-slate-900">{approvedBy}</p>
            <p className="text-[9px] text-slate-400 font-mono">Financial Director</p>
          </div>

          {/* Official Stamp Graphic overlay if enabled */}
          {showStamp && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-85">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-700/80 p-1 flex flex-col items-center justify-center text-center transform -rotate-12 bg-white/70 shadow-xs">
                <span className="text-[7px] font-black text-emerald-900 leading-tight">
                  {comp.companyNameAr}
                </span>
                <div className="h-[1px] w-12 bg-emerald-700/60 my-0.5" />
                <span className="text-[8px] font-black text-emerald-700 tracking-wider">
                  ★ مُـعـتـمـد ★
                </span>
                <span className="text-[6px] font-mono font-bold text-emerald-800">
                  {currentDate}
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-400 pt-1 relative z-10">
            <span className="text-[9px] text-slate-400 block font-bold">الاعتماد والختم</span>
          </div>
        </div>

        {/* Box 4: Receiver / Beneficiary */}
        <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-between h-28 text-center print:border-slate-400">
          <div>
            <p className="text-[11px] font-black text-slate-900">{receivedBy}</p>
            <p className="text-[9px] text-slate-400 font-mono">Receiver / Beneficiary</p>
          </div>
          <div className="border-t border-slate-400 pt-1">
            <span className="text-[9px] text-slate-400 block font-bold">التوقيع / الرقم المدني</span>
          </div>
        </div>
      </div>

      {/* Footer Legal/Audit Notice */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400 pt-3 mt-3 border-t border-slate-200 font-mono">
        <span>
          {comp.companyNameAr} — المنظومة المحاسبية المعتمدة للعهد والمصروفات المالية
        </span>
        <span>
          وثيقة رقمية معتمدة تم إصدارها آلياً بتاريخ {currentDate}
        </span>
      </div>
    </div>
  );
}
