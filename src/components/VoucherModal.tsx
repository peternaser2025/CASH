import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  FileText, 
  Building, 
  User, 
  Calendar, 
  CreditCard, 
  Copy, 
  Check, 
  ArrowRightLeft, 
  Share2,
  Stamp
} from 'lucide-react';
import { formatKWD } from '../utils/format';
import { tafqeetKWD } from '../utils/tafqeet';

export interface VoucherData {
  voucherNo?: string;
  voucherType: 'Payment' | 'Receipt' | 'Transfer' | 'Journal';
  date: string;
  amount: number;
  beneficiary?: string; // يصرف للسيد / المستلم
  payer?: string;       // استلمنا من / المودع
  employee?: string;    // أمين العهدة
  branch?: string;      // الفرع / مركز التكلفة
  category?: string;    // بند المصروف / الحساب
  description: string;  // البيان والتفاصيل
  paymentMethod?: 'Cash' | 'Bank' | 'Cheque' | 'Accrual';
  referenceNo?: string; // رقم الفاتورة أو المرجع
  civilId?: string;
  targetMonth?: string;
  accountDebit?: string;
  accountCredit?: string;
}

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherData | null;
}

export default function VoucherModal({ isOpen, onClose, voucher }: VoucherModalProps) {
  const [copied, setCopied] = useState(false);
  const [stampVisible, setStampVisible] = useState(true);

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const copyDetails = () => {
    const text = `
سند ${voucher.voucherType === 'Payment' ? 'صرف نقدية' : voucher.voucherType === 'Receipt' ? 'قبض وتوريد' : voucher.voucherType === 'Transfer' ? 'تحويل عهدة' : 'قيد يومية'}
رقم السند: ${voucher.voucherNo || 'V-' + Date.now()}
التاريخ: ${voucher.date}
المبلغ: ${formatKWD(voucher.amount)} د.ك
المبلغ كتابة: ${tafqeetKWD(voucher.amount)}
البيان: ${voucher.description}
الفرع: ${voucher.branch || 'المركز الرئيسي'}
الموظف/العهدة: ${voucher.employee || '-'}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVoucherTitle = () => {
    switch (voucher.voucherType) {
      case 'Payment':
        return { ar: 'سند صرف نقدية', en: 'PAYMENT VOUCHER', color: 'emerald' };
      case 'Receipt':
        return { ar: 'سند قبض وتوريد', en: 'RECEIPT VOUCHER', color: 'blue' };
      case 'Transfer':
        return { ar: 'سند تحويل عهدة نقدية', en: 'CUSTODY TRANSFER VOUCHER', color: 'purple' };
      case 'Journal':
        return { ar: 'سند قيد يومية', en: 'JOURNAL VOUCHER', color: 'indigo' };
      default:
        return { ar: 'سند مالي معتمد', en: 'FINANCIAL VOUCHER', color: 'slate' };
    }
  };

  const titleInfo = getVoucherTitle();
  const voucherNum = voucher.voucherNo || `VCH-${voucher.date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:border-none print:shadow-none print:my-0 print:max-w-full"
        >
          {/* Action Bar - Hidden on print */}
          <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black">{titleInfo.ar}</h3>
                <p className="text-[11px] text-slate-400 font-mono">{voucherNum}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStampVisible(!stampVisible)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  stampVisible ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="إظهار/إخفاء ختم الاعتماد الرسمي"
              >
                <Stamp size={14} />
                <span>الختم الرسمي</span>
              </button>

              <button
                onClick={copyDetails}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
              >
                <Printer size={15} />
                <span>طباعة السند (A4/A5)</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Voucher Body */}
          <div className="p-8 sm:p-10 space-y-6 text-slate-900 bg-white" id="printable-voucher">
            {/* Header / Letterhead */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex items-start justify-between">
                {/* Right side: Arabic Corporate info */}
                <div className="text-right space-y-1">
                  <h1 className="text-lg font-black text-slate-950 tracking-tight">نظام إدارة العهد والمصروفات المالية</h1>
                  <p className="text-xs font-bold text-slate-600">الإدارة المالية والمحاسبية — دولة الكويت</p>
                  <p className="text-[11px] text-slate-500 font-mono">KWD PETTY CASH & FINANCIAL SYSTEM</p>
                </div>

                {/* Center: Voucher Title Badge */}
                <div className="text-center px-4 py-2 bg-slate-100 rounded-2xl border-2 border-slate-900 shadow-xs">
                  <h2 className="text-base font-black text-slate-900">{titleInfo.ar}</h2>
                  <span className="text-[10px] font-mono font-bold text-slate-600 tracking-wider uppercase block">
                    {titleInfo.en}
                  </span>
                </div>

                {/* Left side: Voucher Meta (Serial & Date) */}
                <div className="text-left space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold">No. الرقم:</span>
                    <span className="font-mono font-black text-slate-900">{voucherNum}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 font-bold">Date التاريخ:</span>
                    <span className="font-mono font-black text-slate-900">{voucher.date}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Currency & Amount Highlight Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-300">
              <div className="sm:col-span-1 bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">المبلغ بالأرقام | Amount</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">{formatKWD(voucher.amount)}</span>
                </div>
                <span className="text-sm font-bold text-slate-200 bg-white/10 px-2 py-1 rounded-lg">د.ك (KWD)</span>
              </div>

              <div className="sm:col-span-2 flex flex-col justify-center bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">المبلغ كتابة | Amount in Words:</span>
                <p className="text-xs sm:text-sm font-black text-slate-900 mt-1 leading-relaxed">
                  {tafqeetKWD(voucher.amount)}
                </p>
              </div>
            </div>

            {/* Detailed Voucher Fields */}
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-200 text-xs">
              {/* Payee / Beneficiary / Payer */}
              <div className="grid grid-cols-1 sm:grid-cols-4 p-3.5 items-center gap-2">
                <span className="text-slate-500 font-black sm:col-span-1">
                  {voucher.voucherType === 'Payment' ? 'يصرف للسيد / الجهة:' : voucher.voucherType === 'Receipt' ? 'استلمنا من السيد / الجهة:' : 'الطرف المستفيد:'}
                </span>
                <span className="text-slate-900 font-black text-sm sm:col-span-3">
                  {voucher.beneficiary || voucher.payer || voucher.employee || 'الموظف المسؤول / الصندوق'}
                </span>
              </div>

              {/* Custodian & Branch / Cost Center */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">أمين العهدة / الصندوق:</span>
                  <span className="text-slate-900 font-black">{voucher.employee || 'عام'}</span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">الفرع / مركز التكلفة:</span>
                  <span className="text-slate-900 font-black">{voucher.branch || 'المركز الرئيسي'}</span>
                </div>
              </div>

              {/* Category & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">بند الحساب / التصنيف:</span>
                  <span className="text-slate-900 font-black">{voucher.category || 'مصروفات عامة'}</span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-bold">طريقة الدفع:</span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-black rounded-lg text-[11px]">
                    {voucher.paymentMethod === 'Bank' ? 'تحويل بنكي' : voucher.paymentMethod === 'Accrual' ? 'آجل / مستحق' : 'نقداً من الصندوق'}
                  </span>
                </div>
              </div>

              {/* Statement / Description */}
              <div className="p-4 space-y-1">
                <span className="text-slate-500 font-black block">وذلك لقاء / البيان والشرح المحاسبي:</span>
                <p className="text-slate-900 font-bold text-xs sm:text-sm bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                  {voucher.description || 'صرف وتوريد عهدة نقدية حسب الأصول'}
                </p>
              </div>

              {/* Double-Entry Debit / Credit Line (if Journal voucher) */}
              {(voucher.accountDebit || voucher.accountCredit) && (
                <div className="p-3.5 bg-slate-50 grid grid-cols-2 gap-4 font-mono text-xs">
                  <div>
                    <span className="text-blue-700 font-bold block">من حـ/ المدين (Dr.):</span>
                    <span className="font-black text-slate-900">{voucher.accountDebit}</span>
                  </div>
                  <div>
                    <span className="text-indigo-700 font-bold block">إلى حـ/ الدائن (Cr.):</span>
                    <span className="font-black text-slate-900">{voucher.accountCredit}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Stamp & Verification Banner */}
            {stampVisible && (
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-950 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="font-black">سند محاسبي معتمد وموثق رقمياً بنظام التدقيق الداخلي</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-700 font-bold">VERIFIED & AUDITED</span>
              </div>
            )}

            {/* Official 4-Box Signatures Section */}
            <div className="pt-4 border-t-2 border-dashed border-slate-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {/* Box 1: Prepared by */}
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 space-y-6">
                  <div>
                    <p className="text-[11px] font-black text-slate-800">إعداد المحاسب</p>
                    <p className="text-[9px] text-slate-500 font-mono">Prepared by</p>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="text-[10px] text-slate-400">التوقيع</span>
                  </div>
                </div>

                {/* Box 2: Audited / Cashier */}
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 space-y-6">
                  <div>
                    <p className="text-[11px] font-black text-slate-800">أمين الصندوق / العهدة</p>
                    <p className="text-[9px] text-slate-500 font-mono">Cashier / Custodian</p>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="text-[10px] text-slate-400">التوقيع</span>
                  </div>
                </div>

                {/* Box 3: Financial Manager Approval */}
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 space-y-6">
                  <div>
                    <p className="text-[11px] font-black text-slate-800">اعتماد المدير المالي</p>
                    <p className="text-[9px] text-slate-500 font-mono">Financial Approval</p>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="text-[10px] text-slate-400">الختم والتوقيع</span>
                  </div>
                </div>

                {/* Box 4: Receiver / Beneficiary */}
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 space-y-6">
                  <div>
                    <p className="text-[11px] font-black text-slate-800">توقيع المستلم</p>
                    <p className="text-[9px] text-slate-500 font-mono">Receiver Signature</p>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="text-[10px] text-slate-400">الرقم المدني: ...........</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
              تم استخراج هذا السند عبر المنظومة المحاسبية المعتمدة للعهد والمصروفات المالية — دولة الكويت • صادر بتاريخ {voucher.date}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
