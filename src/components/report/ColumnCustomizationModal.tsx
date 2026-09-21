import React from 'react';
import { Columns, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ALL_COLUMNS, ReportColumnId } from '../ReportViewer';

interface ColumnCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: Record<ReportColumnId, boolean>;
  onToggleColumn: (colId: ReportColumnId) => void;
  onApplyPreset: (preset: 'all' | 'essential' | 'financial' | 'nodetails') => void;
}

export default function ColumnCustomizationModal({
  isOpen,
  onClose,
  visibleColumns,
  onToggleColumn,
  onApplyPreset
}: ColumnCustomizationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Columns size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base">تخصيص أعمدة التقرير المطبوع / PDF</h3>
              <p className="text-xs text-slate-400">حدد الأعمدة المطلوبة للظهور في تقرير الـ PDF المصدّر</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">نماذج جاهزة</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onApplyPreset('all')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                عرض الكل
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('essential')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                أساسي
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('financial')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                مالي فقط
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('nodetails')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                مختصر
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">الأعمدة المتاحة</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_COLUMNS.map((col) => {
                const isChecked = visibleColumns[col.id];
                return (
                  <label
                    key={col.id}
                    onClick={() => onToggleColumn(col.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-blue-50/70 border-blue-200 text-blue-900 font-bold'
                        : 'bg-slate-50 border-slate-100 text-slate-500 font-medium hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white'
                    }`}>
                      {isChecked && <CheckCircle2 size={14} />}
                    </div>
                    <span className="text-xs">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-bold text-xs hover:bg-black transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              اعتماد وتطبيق التخصيص
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
