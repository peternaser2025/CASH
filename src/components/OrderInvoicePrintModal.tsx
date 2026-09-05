import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  X, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Building2, 
  User, 
  Truck, 
  Package, 
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
import { Order } from '../types';

interface OrderInvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export default function OrderInvoicePrintModal({
  isOpen,
  onClose,
  order
}: OrderInvoicePrintModalProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [printOptions, setPrintOptions] = useState<PrintDisplayOptions>(getPrintDisplayOptions());

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('order-invoice-active');
      return () => {
        document.body.classList.remove('order-invoice-active');
        document.body.classList.remove('thermal-mode');
      };
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    if (printOptions.paperSize === 'thermal-80mm') {
      document.body.classList.add('thermal-mode');
    } else {
      document.body.classList.remove('thermal-mode');
    }
    document.body.classList.add('order-invoice-active');

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
    const el = document.getElementById('printable-order-invoice');
    if (!el) return;

    setPdfLoading(true);
    try {
      await exportElementToPDF(el, {
        filename: `أمر_شراء_توريد_${order.orderNumber}_${order.orderDate}.pdf`,
        orientation: printOptions.paperSize === 'A4-landscape' ? 'landscape' : 'portrait',
        margins: printOptions.paperSize === 'thermal-80mm' ? 'narrow' : 'normal',
        scale: 100
      });
    } catch (err) {
      console.error('Failed to export order PDF:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF، سيتم فتح نافذة الطباعة.');
      handlePrint();
    } finally {
      setPdfLoading(false);
    }
  };

  const isThermal = printOptions.paperSize === 'thermal-80mm';
  const isA5 = printOptions.paperSize === 'A5-portrait';

  const docTitleAr = order.type === 'purchase' ? 'أمر شراء وتوريد معتمد' : 'فاتورة استلام وتسليم بضاعة';
  const docTitleEn = order.type === 'purchase' ? 'PURCHASE & SUPPLY ORDER' : 'DELIVERY INVOICE';

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 overflow-y-auto print:p-0 print:bg-white print:static order-modal-wrapper printable-modal-wrapper">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className={`bg-white w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 print:border-none print:shadow-none print:my-0 order-modal-card ${
              isThermal ? 'max-w-[420px]' : isA5 ? 'max-w-2xl' : 'max-w-4xl'
            }`}
          >
            {/* Top Modal Header */}
            <div className="p-3 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Receipt size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black">{docTitleAr}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{order.orderNumber}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Toolbar */}
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

            {/* Printable Body */}
            <div 
              id="printable-order-invoice"
              className={`bg-white relative ${
                isThermal 
                  ? 'p-3 print:p-0 w-full' 
                  : isA5 
                    ? 'p-6 sm:p-8 space-y-4 text-xs' 
                    : 'p-8 sm:p-10 space-y-6 text-sm'
              }`}
            >
              <PrintWatermark type={printOptions.watermark} />

              {isThermal ? (
                <ThermalReceiptView
                  title={docTitleAr}
                  receiptNumber={order.orderNumber}
                  date={order.orderDate}
                  amount={order.amount}
                  beneficiary={order.supplierOrCustomer}
                  employee={order.assignedEmployee}
                  branch={order.branch}
                  category={order.type === 'purchase' ? 'مشتريات وتوريدات' : 'تسليم بضائع'}
                  description={`${order.title} — ${order.items?.length || 0} بنود`}
                  profile={companyProfile}
                />
              ) : (
                <>
                  {/* Formal Print Header */}
                  <PrintHeader
                    documentTitleAr={docTitleAr}
                    documentTitleEn={docTitleEn}
                    documentNumber={order.orderNumber}
                    date={order.orderDate}
                    profile={companyProfile}
                    showQRCode={printOptions.showQRCode}
                    showLetterhead={printOptions.showLetterhead}
                    qrPayload={JSON.stringify({
                      co: companyProfile.companyNameAr,
                      ord: order.orderNumber,
                      sup: order.supplierOrCustomer,
                      amt: order.amount,
                      dt: order.orderDate
                    })}
                    extraMeta={[
                      { label: 'الطرف الآخر (المورد/العميل)', value: order.supplierOrCustomer },
                      { label: 'الفرع المستفيد', value: order.branch },
                      { label: 'المسؤول المتابع', value: order.assignedEmployee || 'إدارة التوريدات' },
                      { label: 'موعد التسليم والاستحقاق', value: order.deliveryDueDate }
                    ]}
                  />

                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-300">
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between print:border print:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">
                          إجمالي قيمة الطلبية
                        </span>
                        <span className="text-2xl font-black font-mono text-emerald-400">
                          {formatKWD(order.amount)}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-200 bg-white/10 px-2 py-1 rounded-lg">
                        د.ك
                      </span>
                    </div>

                    <div className="flex flex-col justify-center bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">المدفوع والمسدد:</span>
                      <p className="text-sm font-black font-mono text-emerald-700 mt-0.5">
                        {formatKWD(order.paidAmount)} د.ك
                      </p>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">المتبقي الآجل:</span>
                      <p className="text-sm font-black font-mono text-rose-700">
                        {formatKWD(order.amount - order.paidAmount)} د.ك
                      </p>
                    </div>

                    <div className="flex flex-col justify-center bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">المبلغ الإجمالي كتابة:</span>
                      <p className="text-xs font-black text-slate-900 mt-1 leading-relaxed">
                        {tafqeetKWD(order.amount)}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-900">جدول بنود وأصناف التوريد:</h4>
                    <table className="w-full text-right text-xs border border-slate-300 rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-black text-[11px] border-b border-slate-300">
                          <th className="p-2.5 text-center w-12">م</th>
                          <th className="p-2.5">بيان الصنف والمواصفات</th>
                          <th className="p-2.5 text-center w-24">الكمية</th>
                          <th className="p-2.5 text-left w-28">سعر الوحدة</th>
                          <th className="p-2.5 text-left w-32">الإجمالي (د.ك)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(order.items && order.items.length > 0) ? (
                          order.items.map((it, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-slate-900">{it.name}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="p-2.5 text-left font-mono font-bold text-slate-700">
                                {it.unitPrice.toFixed(3)}
                              </td>
                              <td className="p-2.5 text-left font-mono font-black text-slate-900">
                                {it.totalPrice.toFixed(3)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400 italic font-bold">
                              لم يتم تسجيل بنود مفصلة للطلبية ({order.title})
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-black text-xs border-t-2 border-slate-400">
                          <td colSpan={4} className="p-2.5 text-left font-sans">
                            إجمالي أمر التوريد:
                          </td>
                          <td className="p-2.5 text-left font-mono font-black text-sm text-slate-950">
                            {formatKWD(order.amount)} د.ك
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Notes & Terms */}
                  {order.notes && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase">الشروط والملاحظات:</span>
                      <p className="text-xs text-slate-800 font-bold leading-relaxed">{order.notes}</p>
                    </div>
                  )}

                  {/* Stamp & Verification */}
                  {printOptions.showStamp && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-950 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span className="font-black">
                          أمر شراء معتمد وموثق رقمياً بنظام التدقيق الداخلي — {companyProfile.companyNameAr}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold">
                        OFFICIAL ORDER
                      </span>
                    </div>
                  )}

                  {/* 4-Box Signatures */}
                  {printOptions.showSignatures && (
                    <PrintSignatures
                      showStamp={printOptions.showStamp}
                      profile={companyProfile}
                      preparedBy="مسؤول المشتريات والتوريدات"
                      auditedBy="إدارة التكاليف والمخازن"
                      approvedBy="اعتماد المدير المالي / العام"
                      receivedBy="توقيع مندوب المورد / المستلم"
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <PrintSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(p) => setCompanyProfile(p)}
      />
    </>
  );
}
