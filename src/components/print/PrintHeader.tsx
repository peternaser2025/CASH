import React from 'react';
import { Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import QRCodeBadge from './QRCodeBadge';
import { CompanyPrintProfile, getCompanyProfile } from '../../utils/printConfig';

interface PrintHeaderProps {
  documentTitleAr: string;
  documentTitleEn?: string;
  documentNumber?: string;
  date?: string;
  profile?: CompanyPrintProfile;
  showQRCode?: boolean;
  qrPayload?: string;
  showLetterhead?: boolean;
  extraMeta?: Array<{ label: string; value: string }>;
  variant?: 'formal' | 'compact' | 'minimal';
}

export default function PrintHeader({
  documentTitleAr,
  documentTitleEn = '',
  documentNumber,
  date,
  profile,
  showQRCode = true,
  qrPayload,
  showLetterhead = true,
  extraMeta = [],
  variant = 'formal'
}: PrintHeaderProps) {
  const comp = profile || getCompanyProfile();
  const currentDate = date || new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });

  // Default QR payload if not provided
  const qrString = qrPayload || JSON.stringify({
    org: comp.companyNameAr,
    doc: documentTitleAr,
    no: documentNumber || 'N/A',
    dt: currentDate,
    reg: comp.commercialRegistration
  });

  if (!showLetterhead) {
    // If the user chooses to print on pre-printed stationery, leave proper blank header spacing
    return (
      <div className="h-28 w-full border-b border-dashed border-slate-300 mb-6 flex items-end justify-between pb-2 text-[10px] text-slate-400 font-mono">
        <span>مساحة مخصصة لترويسة الورق الرسمي المسبق الطباعة</span>
        <span>الرقم: {documentNumber || '-'} | التاريخ: {currentDate}</span>
      </div>
    );
  }

  return (
    <div className="w-full border-b-2 border-slate-900 pb-4 mb-6 text-slate-900">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Right side: Arabic Organization Info */}
        <div className="text-right space-y-1 max-w-[34%]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-sm shadow-xs shrink-0 print:border print:border-slate-900">
              {comp.logoUrl ? (
                <img src={comp.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl" />
              ) : (
                <Building2 size={20} />
              )}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-950 tracking-tight leading-tight">
                {comp.companyNameAr}
              </h1>
              <span className="text-[10px] font-bold text-slate-600 block leading-tight">
                {comp.subTitleAr}
              </span>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 pt-0.5 space-y-0.5">
            <p>{comp.commercialRegistration} • {comp.taxNumber}</p>
            <p>{comp.address}</p>
          </div>
        </div>

        {/* Center: Document Title & Badge */}
        <div className="text-center flex-1 px-2 pt-1">
          <div className="inline-block px-5 py-2 bg-slate-100 rounded-2xl border-2 border-slate-900 shadow-2xs">
            <h2 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
              {documentTitleAr}
            </h2>
            {documentTitleEn && (
              <span className="text-[10px] font-black font-mono text-slate-600 tracking-wider uppercase block mt-0.5">
                {documentTitleEn}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 mt-2 text-[10px] font-bold text-slate-600">
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck size={12} />
              مستند مالي معتمد
            </span>
            <span>العملة: {comp.currency}</span>
          </div>
        </div>

        {/* Left side: English Organization & Meta Data & QR */}
        <div className="text-left flex items-start gap-3 max-w-[34%]">
          {showQRCode && (
            <div className="shrink-0 hidden sm:block">
              <QRCodeBadge value={qrString} size={58} label="تحقق إلكتروني" />
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-xs font-black text-slate-950 tracking-tight uppercase">
              {comp.companyNameEn}
            </h2>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
              {comp.subTitleEn}
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-[10px] space-y-0.5 font-mono">
              {documentNumber && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400 font-sans">الرقم:</span>
                  <span className="font-black text-slate-900">{documentNumber}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 font-sans">التاريخ:</span>
                <span className="font-bold text-slate-800">{currentDate}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 font-sans">الوقت:</span>
                <span className="font-medium text-slate-600">{currentTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Document Metadata row if provided */}
      {extraMeta.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-slate-200 text-[11px] bg-slate-50/70 p-2.5 rounded-xl">
          {extraMeta.map((item, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-slate-400 text-[9px] font-bold">{item.label}:</span>
              <span className="text-slate-900 font-black truncate">{item.value || '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
