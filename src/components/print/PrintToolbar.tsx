import React from 'react';
import { 
  Printer, 
  FileDown, 
  Settings, 
  FileText, 
  Receipt, 
  Check, 
  Eye, 
  SlidersHorizontal,
  Stamp
} from 'lucide-react';
import { PrintDisplayOptions } from '../../utils/printConfig';

interface PrintToolbarProps {
  options: PrintDisplayOptions;
  onChangeOptions: (options: PrintDisplayOptions) => void;
  onPrint: () => void;
  onExportPDF?: () => void;
  pdfLoading?: boolean;
  onOpenSettings?: () => void;
  allowThermal?: boolean;
  className?: string;
}

export default function PrintToolbar({
  options,
  onChangeOptions,
  onPrint,
  onExportPDF,
  pdfLoading = false,
  onOpenSettings,
  allowThermal = true,
  className = ''
}: PrintToolbarProps) {
  return (
    <div className={`no-print bg-slate-900 text-white p-3 rounded-2xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      {/* Left: Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrint}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm cursor-pointer active:scale-95"
          title="بدء الطباعة الفورية عبر الطابعة"
        >
          <Printer size={16} />
          <span>طباعة فورية</span>
        </button>

        {onExportPDF && (
          <button
            onClick={onExportPDF}
            disabled={pdfLoading}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 active:scale-95"
            title="تصدير كملف PDF عالي الجودة"
          >
            <FileDown size={16} />
            <span>{pdfLoading ? 'جاري الإنشاء...' : 'حفظ PDF'}</span>
          </button>
        )}
      </div>

      {/* Center: Print Options & Format Toggles */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Paper Size selector */}
        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeOptions({ ...options, paperSize: 'A4-portrait' })}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              options.paperSize === 'A4-portrait'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            A4 طولي
          </button>

          <button
            type="button"
            onClick={() => onChangeOptions({ ...options, paperSize: 'A4-landscape' })}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              options.paperSize === 'A4-landscape'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            A4 عرضي
          </button>

          <button
            type="button"
            onClick={() => onChangeOptions({ ...options, paperSize: 'A5-portrait' })}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              options.paperSize === 'A5-portrait'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            A5 نصفي
          </button>

          {allowThermal && (
            <button
              type="button"
              onClick={() => onChangeOptions({ ...options, paperSize: 'thermal-80mm' })}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                options.paperSize === 'thermal-80mm'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt size={12} />
              حراري 80mm
            </button>
          )}
        </div>

        {/* Letterhead toggle */}
        <button
          type="button"
          onClick={() => onChangeOptions({ ...options, showLetterhead: !options.showLetterhead })}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            options.showLetterhead
              ? 'bg-slate-800 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-800/40 border-slate-700 text-slate-400'
          }`}
          title="تبديل إظهار الترويسة أو ترك مساحة فارغة للورق الرسمي الجاهز"
        >
          <FileText size={13} />
          <span>{options.showLetterhead ? 'ترويسة مروّسة' : 'ورق مروّس مسبقاً'}</span>
        </button>

        {/* Stamp toggle */}
        <button
          type="button"
          onClick={() => onChangeOptions({ ...options, showStamp: !options.showStamp })}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            options.showStamp
              ? 'bg-slate-800 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-800/40 border-slate-700 text-slate-400'
          }`}
          title="إظهار أو إخفاء الختم الرسمي"
        >
          <Stamp size={13} />
          <span>{options.showStamp ? 'الختم ظاهر' : 'بدون ختم'}</span>
        </button>

        {/* Watermark Selector */}
        <select
          value={options.watermark}
          onChange={(e) => onChangeOptions({ ...options, watermark: e.target.value as any })}
          aria-label="العلامة المائية للطباعة"
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-2 py-1.5 text-[11px] font-bold cursor-pointer hover:border-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        >
          <option value="none">بدون علامة مائية</option>
          <option value="approved">علامة: معتمد رسمياً</option>
          <option value="original">علامة: نسخة أصلية</option>
          <option value="draft">علامة: مسودة غير نهائية</option>
          <option value="confidential">علامة: سري وخاص</option>
        </select>
      </div>

      {/* Right: Settings modal button */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          title="تخصيص بيانات المنشأة والشعار والترويسة"
        >
          <Settings size={14} />
          <span className="hidden md:inline">هوية الطباعة</span>
        </button>
      )}
    </div>
  );
}
