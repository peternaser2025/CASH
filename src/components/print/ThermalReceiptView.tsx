import React from 'react';
import QRCodeBadge from './QRCodeBadge';
import { formatKWD } from '../../utils/format';
import { tafqeetKWD } from '../../utils/tafqeet';
import { CompanyPrintProfile, getCompanyProfile } from '../../utils/printConfig';
import { Building2 } from 'lucide-react';

interface ThermalReceiptViewProps {
  title: string;
  receiptNumber: string;
  date: string;
  amount: number;
  beneficiary?: string;
  payer?: string;
  employee?: string;
  branch?: string;
  category?: string;
  description: string;
  profile?: CompanyPrintProfile;
}

export default function ThermalReceiptView({
  title,
  receiptNumber,
  date,
  amount,
  beneficiary,
  payer,
  employee,
  branch,
  category,
  description,
  profile
}: ThermalReceiptViewProps) {
  const comp = profile || getCompanyProfile();
  const timeStr = new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });

  const qrPayload = JSON.stringify({
    co: comp.companyNameAr,
    rc: receiptNumber,
    amt: amount,
    dt: date
  });

  return (
    <div className="w-[78mm] mx-auto p-2 text-slate-950 font-sans text-xs bg-white border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:p-0">
      {/* Header */}
      <div className="text-center space-y-1 pb-2 border-b-2 border-dashed border-slate-800">
        <h2 className="text-sm font-black tracking-tight">{comp.companyNameAr}</h2>
        <p className="text-[10px] text-slate-600 font-bold">{comp.subTitleAr}</p>
        <p className="text-[9px] font-mono text-slate-500">{comp.phone} • {comp.address}</p>
        
        <div className="pt-1">
          <span className="inline-block px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-black">
            {title}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px] font-mono">
        <div className="flex justify-between">
          <span className="font-bold">رقم الإيصال:</span>
          <span className="font-black">{receiptNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ:</span>
          <span>{date} {timeStr}</span>
        </div>
        {branch && (
          <div className="flex justify-between">
            <span>الفرع:</span>
            <span className="font-bold">{branch}</span>
          </div>
        )}
        {employee && (
          <div className="flex justify-between">
            <span>أمين العهدة:</span>
            <span className="font-bold">{employee}</span>
          </div>
        )}
      </div>

      {/* Amount Box */}
      <div className="py-3 text-center bg-slate-50 my-2 rounded-lg border border-slate-300">
        <span className="text-[10px] text-slate-500 font-bold block">المبلغ الإجمالي المعتمد</span>
        <div className="text-xl font-black font-mono text-slate-950 mt-0.5">
          {formatKWD(amount)} <span className="text-xs">د.ك</span>
        </div>
        <div className="text-[10px] font-bold text-slate-800 mt-1 px-2 leading-tight">
          {tafqeetKWD(amount)}
        </div>
      </div>

      {/* Details */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-[11px]">
        {(beneficiary || payer) && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-slate-500 font-bold shrink-0">الطرف المعني:</span>
            <span className="font-black text-right">{beneficiary || payer}</span>
          </div>
        )}
        {category && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-bold">بند الحساب:</span>
            <span className="font-bold">{category}</span>
          </div>
        )}
        <div className="pt-1">
          <span className="text-slate-500 font-bold block mb-0.5">البيان:</span>
          <p className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px] font-medium leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Signatures for Thermal */}
      <div className="py-3 grid grid-cols-2 gap-3 text-center text-[10px] border-b border-dashed border-slate-400">
        <div className="space-y-4">
          <span className="font-bold block">توقيع المسؤول</span>
          <div className="border-t border-slate-400 pt-1 text-[8px] text-slate-400">المحاسب / الصندوق</div>
        </div>
        <div className="space-y-4">
          <span className="font-bold block">توقيع المستلم</span>
          <div className="border-t border-slate-400 pt-1 text-[8px] text-slate-400">الاسم / التوقيع</div>
        </div>
      </div>

      {/* QR Code & Footer */}
      <div className="pt-3 flex flex-col items-center gap-1 text-center">
        <QRCodeBadge value={qrPayload} size={55} label="" />
        <span className="text-[8px] text-slate-500 font-mono">
          تم الإصدار عبر منظومة مصنع دار السلام المالية
        </span>
        <span className="text-[8px] text-slate-400">
          *** شكراً لتعاملكم معنا ***
        </span>
      </div>
    </div>
  );
}
