import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Save, 
  X, 
  Printer, 
  RotateCcw, 
  ShieldCheck, 
  Check, 
  FileText,
  Phone,
  Mail,
  MapPin,
  Stamp
} from 'lucide-react';
import { 
  CompanyPrintProfile, 
  getCompanyProfile, 
  saveCompanyProfile, 
  DEFAULT_COMPANY_PROFILE,
  PrintDisplayOptions,
  getPrintDisplayOptions,
  savePrintDisplayOptions
} from '../utils/printConfig';
import PrintHeader from './print/PrintHeader';
import PrintSignatures from './print/PrintSignatures';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (profile: CompanyPrintProfile) => void;
}

export default function PrintSettingsModal({
  isOpen,
  onClose,
  onSaved
}: PrintSettingsModalProps) {
  const [profile, setProfile] = useState<CompanyPrintProfile>(getCompanyProfile());
  const [options, setOptions] = useState<PrintDisplayOptions>(getPrintDisplayOptions());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'options' | 'preview'>('profile');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCompanyProfile(profile);
    savePrintDisplayOptions(options);
    setSavedSuccess(true);
    if (onSaved) onSaved(profile);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل تريد استعادة بيانات الهوية والترويسة الافتراضية لمصنع دار السلام؟')) {
      setProfile(DEFAULT_COMPANY_PROFILE);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Printer size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-white">إعدادات هوية الطباعة والترويسة الرسمية</h2>
                <p className="text-xs text-slate-400 font-bold">
                  تخصيص بيانات الترويسة والختم المعتمد لكافة السندات والتقارير المالية
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-2 p-3 bg-slate-100 border-b border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              بيانات المنشأة والترويسة
            </button>
            <button
              onClick={() => setActiveTab('options')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'options'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              خيارات وهوامش الطباعة
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              معاينة حية للمستند المطبوع
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {activeTab === 'profile' && (
              <form id="print-settings-form" onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      اسم المنشأة بالعربية (Company Name AR)
                    </label>
                    <input
                      type="text"
                      value={profile.companyNameAr}
                      onChange={(e) => setProfile({ ...profile, companyNameAr: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      اسم المنشأة بالإنجليزية (Company Name EN)
                    </label>
                    <input
                      type="text"
                      value={profile.companyNameEn}
                      onChange={(e) => setProfile({ ...profile, companyNameEn: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      الإدارة / القسم بالعربية
                    </label>
                    <input
                      type="text"
                      value={profile.subTitleAr}
                      onChange={(e) => setProfile({ ...profile, subTitleAr: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      Department / Subtitle (EN)
                    </label>
                    <input
                      type="text"
                      value={profile.subTitleEn}
                      onChange={(e) => setProfile({ ...profile, subTitleEn: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      السجل التجاري / الترخيص
                    </label>
                    <input
                      type="text"
                      value={profile.commercialRegistration}
                      onChange={(e) => setProfile({ ...profile, commercialRegistration: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      رقم المنشأة / الرقم الضريبي
                    </label>
                    <input
                      type="text"
                      value={profile.taxNumber}
                      onChange={(e) => setProfile({ ...profile, taxNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      أرقام الهواتف والتواصل
                    </label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      البريد الإلكتروني الرسمي
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      العنوان الرسمي وموقع المصنع
                    </label>
                    <input
                      type="text"
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-black text-slate-800 block mb-1.5">
                      نص الختم المعتمد (Stamp Text)
                    </label>
                    <input
                      type="text"
                      value={profile.stampText}
                      onChange={(e) => setProfile({ ...profile, stampText: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'options' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="text-xs font-black text-slate-900 block">
                      حجم ولغة صفحة الطباعة الافتراضية
                    </label>
                    <select
                      value={options.paperSize}
                      onChange={(e) => setOptions({ ...options, paperSize: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="A4-portrait">A4 طولي (تقارير وكشوف حساب وسندات كاملة)</option>
                      <option value="A4-landscape">A4 عرضي (كشوفات مجدولة وجداول واسعة)</option>
                      <option value="A5-portrait">A5 نصفي (سندات مدمجة)</option>
                      <option value="thermal-80mm">حراري 80mm (إيصالات طابعات الكاشير والفرع)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="text-xs font-black text-slate-900 block">
                      حجم الخطوط أثناء الطباعة
                    </label>
                    <select
                      value={options.fontSize}
                      onChange={(e) => setOptions({ ...options, fontSize: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="compact">مدمج (يناسب التقارير الطويلة والجداول الكبيرة)</option>
                      <option value="standard">قياسي (متوازن وواضح لجميع السندات)</option>
                      <option value="large">كبير (مريح للقراءة)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <h4 className="text-xs font-black text-slate-900">عناصر الترويسة والتحقق</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={options.showLetterhead}
                        onChange={(e) => setOptions({ ...options, showLetterhead: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span>إظهار الترويسة الرسمية (أو ترك مساحة للورق المروس مسبقاً)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={options.showSignatures}
                        onChange={(e) => setOptions({ ...options, showSignatures: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span>إظهار خانات التوقيعات والاعتمادات المحاسبية الرباعية</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={options.showStamp}
                        onChange={(e) => setOptions({ ...options, showStamp: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span>إظهار الختم الدائري المعتمد</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={options.showQRCode}
                        onChange={(e) => setOptions({ ...options, showQRCode: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span>إظهار رمز الاستجابة السريعة (QR Code) للتحقق الإلكتروني</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="p-6 bg-slate-100 rounded-2xl border border-slate-300 overflow-x-auto">
                <div className="bg-white p-8 rounded-xl shadow-md max-w-2xl mx-auto space-y-6">
                  <PrintHeader
                    documentTitleAr="سند صرف نقدي معتمد"
                    documentTitleEn="PAYMENT VOUCHER"
                    documentNumber="VCH-20260905-001"
                    profile={profile}
                    showQRCode={options.showQRCode}
                    showLetterhead={options.showLetterhead}
                    extraMeta={[
                      { label: 'المستفيد', value: 'شركة التوريدات الصناعية' },
                      { label: 'الفرع', value: 'مصنع صبحان' },
                      { label: 'طريقة الدفع', value: 'نقداً من الصندوق' },
                      { label: 'المبلغ', value: '145.500 د.ك' }
                    ]}
                  />

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold">محتوى تجريبي للتقرير المالي المعتمد</span>
                    <p className="text-xs text-slate-700 font-semibold">
                      سيظهر هذا المحتوى بدقة عالية على ورق A4 أو A5 أو الطابعات الحرارية كما تم ضبطه أعلاه.
                    </p>
                  </div>

                  {options.showSignatures && (
                    <PrintSignatures
                      showStamp={options.showStamp}
                      profile={profile}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>استعادة الافتراضي</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                {savedSuccess ? <Check size={16} /> : <Save size={16} />}
                <span>{savedSuccess ? 'تم الحفظ بنجاح!' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
