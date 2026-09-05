import React from 'react';

interface PrintWatermarkProps {
  type?: 'none' | 'approved' | 'original' | 'draft' | 'confidential';
  customText?: string;
}

export default function PrintWatermark({ type = 'none', customText }: PrintWatermarkProps) {
  if (type === 'none' && !customText) return null;

  const getWatermarkText = () => {
    if (customText) return { ar: customText, en: '' };
    switch (type) {
      case 'approved':
        return { ar: 'معتمد رسمياً', en: 'OFFICIALLY APPROVED' };
      case 'original':
        return { ar: 'نسخة أصلية', en: 'ORIGINAL DOCUMENT' };
      case 'draft':
        return { ar: 'مسودة غير نهائية', en: 'DRAFT - NOT FINAL' };
      case 'confidential':
        return { ar: 'سري وخاص', en: 'STRICTLY CONFIDENTIAL' };
      default:
        return null;
    }
  };

  const info = getWatermarkText();
  if (!info) return null;

  return (
    <div 
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-[0.05] select-none overflow-hidden print:opacity-[0.08]"
    >
      <div className="transform -rotate-45 text-center border-8 border-dashed border-slate-900 rounded-3xl p-12">
        <span className="text-6xl sm:text-7xl md:text-8xl font-black font-sans tracking-widest text-slate-950 block whitespace-nowrap">
          {info.ar}
        </span>
        {info.en && (
          <span className="text-2xl sm:text-3xl font-black font-mono tracking-[0.3em] text-slate-800 mt-2 block whitespace-nowrap">
            {info.en}
          </span>
        )}
      </div>
    </div>
  );
}
