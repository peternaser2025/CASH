import React, { useState, useEffect } from 'react';
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
  Stamp,
  Receipt
} from 'lucide-react';
import { formatKWD } from '../utils/format';
import { tafqeetKWD } from '../utils/tafqeet';
import { exportElementToPDF } from '../utils/pdfExport';
import { 
  getCompanyProfile, 
  getPrintDisplayOptions, 
  PrintDisplayOptions,
  CompanyPrintProfile
} from '../utils/printConfig';
import PrintHeader from './print/PrintHeader';
import PrintSignatures from './print/PrintSignatures';
import PrintWatermark from './print/PrintWatermark';
import PrintToolbar from './print/PrintToolbar';
import ThermalReceiptView from './print/ThermalReceiptView';
import PrintSettingsModal from './PrintSettingsModal';

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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [printOptions, setPrintOptions] = useState<PrintDisplayOptions>(getPrintDisplayOptions());

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('voucher-modal-active');
      return () => {
        document.body.classList.remove('voucher-modal-active');
        document.body.classList.remove('thermal-mode');
      };
    }
  }, [isOpen]);

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    if (printOptions.paperSize === 'thermal-80mm') {
      document.body.classList.add('thermal-mode');
    } else {
      document.body.classList.remove('thermal-mode');
    }
    document.body.classList.add('voucher-modal-active');

    // Small timeout to allow DOM and classes to apply cleanly
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (printOptions.paperSize === 'thermal-80mm') {
          document.body.classList.remove('thermal-mode');
        }
      }, 1000);
    }, 150);
  };

  const handleExportPDF = async () => {
    const el = document.getElementById('printable-voucher');
    if (!el) return;

    setPdfLoading(true);
    try {
      const vNo = voucher.voucherNo || `VCH-${voucher.date.replace(/-/g, '')}`;
      await exportElementToPDF(el, {
        filename: `سند_${vNo}_${voucher.date}.pdf`,
        orientation: printOptions.paperSize === 'A4-landscape' ? 'landscape' : 'portrait',
        margins: printOptions.paperSize === 'thermal-80mm' ? 'narrow' : 'normal',
        scale: 100
      });
    } catch (err) {
      console.error('Failed to export voucher PDF:', err);
      alert('حدث خطأ أثناء تصدير السند، سيتم فتح نافذة الطباعة للحفظ كـ PDF.');
      handlePrint();
    } finally {
      setPdfLoading(false);
    }
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
        return { ar: 'سند صرف نقدية', en: 'PAYMENT VOUCHER' };
      case 'Receipt':
        return { ar: 'سند قبض وتوريد', en: 'RECEIPT VOUCHER' };
      case 'Transfer':
        return { ar: 'سند تحويل عهدة نقدية', en: 'CUSTODY TRANSFER VOUCHER' };
      case 'Journal':
        return { ar: 'سند قيد يومية', en: 'JOURNAL VOUCHER' };
      default:
        return { ar: 'سند مالي معتمد', en: 'FINANCIAL VOUCHER' };
    }
  };

  const titleInfo = getVoucherTitle();
  const voucherNum = voucher.voucherNo || `VCH-${voucher.date.replace(/-/g, '')}-${voucher.referenceNo ? voucher.referenceNo.replace(/\D/g, '') : Math.floor(1000 + Math.random() * 9000)}`;

  const isThermal = printOptions.paperSize === 'thermal-80mm';
  const isA5 = printOptions.paperSize === 'A5-portrait';

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 overflow-y-auto print:p-0 print:bg-white print:static voucher-modal-wrapper printable-modal-wrapper printable-voucher">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className={`bg-white w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 print:border-none print:shadow-none print:my-0 voucher-modal-card ${
              isThermal ? 'max-w-[420px]' : isA5 ? 'max-w-2xl' : 'max-w-3xl'
            }`}
          >
            {/* Action & Print Settings Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black">{titleInfo.ar}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{voucherNum}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyDetails}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="نسخ بيانات السند"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Print Toolbar for Voucher */}
            <div className="p-3 bg-slate-800 border-b border-slate-700 no-print">
              <PrintToolbar
                options={printOptions}
                onChangeOptions={setPrintOptions}
                onPrint={handlePrint}
                onExportPDF={handleExportPDF}
                pdfLoading={pdfLoading}
                onOpenSettings={() => setIsSettingsOpen(true)}
                allowThermal={true}
              />
            </div>

            {/* Printable Area */}
            <div 
              id="printable-voucher" 
              className={`bg-white relative ${
                isThermal 
                  ? 'p-4 print:p-0 w-full' 
                  : isA5 
                    ? 'p-6 sm:p-8 space-y-4 text-xs' 
                    : 'p-8 sm:p-10 space-y-6 text-sm'
              }`}
            >
              {/* Subtle Watermark */}
              <PrintWatermark type={printOptions.watermark} />

              {/* Thermal 80mm Mode */}
              {isThermal ? (
                <ThermalReceiptView
                  title={titleInfo.ar}
                  receiptNumber={voucherNum}
                  date={voucher.date}
                  amount={voucher.amount}
                  beneficiary={voucher.beneficiary}
                  payer={voucher.payer}
                  employee={voucher.employee}
                  branch={voucher.branch}
                  category={voucher.category}
                  description={voucher.description}
                  profile={companyProfile}
                />
              ) : (
                /* Standard A4 / A5 Voucher Layout */
                <>
                  {/* Official Corporate Header */}
                  <PrintHeader
                    documentTitleAr={titleInfo.ar}
                    documentTitleEn={titleInfo.en}
                    documentNumber={voucherNum}
                    date={voucher.date}
                    profile={companyProfile}
                    showQRCode={printOptions.showQRCode}
                    showLetterhead={printOptions.showLetterhead}
                    qrPayload={JSON.stringify({
                      org: companyProfile.companyNameAr,
                      vch: voucherNum,
                      type: titleInfo.ar,
                      amount: voucher.amount,
                      dt: voucher.date
                    })}
                  />

                  {/* Currency & Amount Highlight Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-300 shadow-2xs">
                    <div className="sm:col-span-1 bg-slate-950 text-white p-3.5 rounded-xl flex items-center justify-between print:border print:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">
                          المبلغ بالأرقام | Amount
                        </span>
                        <span className="text-2xl font-black font-mono text-emerald-400">
                          {formatKWD(voucher.amount)}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-200 bg-white/10 px-2 py-1 rounded-lg">
                        د.ك (KWD)
                      </span>
                    </div>

                    <div className="sm:col-span-2 flex flex-col justify-center bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        المبلغ كتابة | Amount in Words:
                      </span>
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
                        {voucher.voucherType === 'Payment' 
                          ? 'يصرف للسيد / الجهة:' 
                          : voucher.voucherType === 'Receipt' 
                            ? 'استلمنا من السيد / الجهة:' 
                            : 'الطرف المستفيد:'}
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
                          {voucher.paymentMethod === 'Bank' 
                            ? 'تحويل بنكي' 
                            : voucher.paymentMethod === 'Accrual' 
                              ? 'آجل / مستحق' 
                              : 'نقداً من الصندوق'}
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
                  {printOptions.showStamp && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-950 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span className="font-black">
                          سند محاسبي معتمد وموثق رقمياً بنظام التدقيق الداخلي — {companyProfile.companyNameAr}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold">
                        VERIFIED & AUDITED
                      </span>
                    </div>
                  )}

                  {/* Official 4-Box Signatures Section */}
                  {printOptions.showSignatures && (
                    <PrintSignatures
                      showStamp={printOptions.showStamp}
                      profile={companyProfile}
                      auditedBy={voucher.employee ? `أمين العهدة (${voucher.employee})` : 'أمين العهدة / الصندوق'}
                      receivedBy={voucher.beneficiary ? `المستلم (${voucher.beneficiary})` : 'المستلم / صاحب العلاقة'}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Print Branding & Settings Modal */}
      <PrintSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(newProfile) => setCompanyProfile(newProfile)}
      />
    </>
  );
}
