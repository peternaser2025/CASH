import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeBadgeProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

export default function QRCodeBadge({
  value,
  size = 72,
  label = 'رمز التحقق الرقمي',
  className = ''
}: QRCodeBadgeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      value,
      {
        width: size * 2,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      },
      (err, url) => {
        if (!err && url && isMounted) {
          setDataUrl(url);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`bg-slate-100 rounded-lg flex items-center justify-center border border-slate-300 ${className}`}
      >
        <span className="text-[9px] font-mono text-slate-400">QR</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <img
        src={dataUrl}
        alt={label}
        style={{ width: size, height: size }}
        className="rounded-md border border-slate-300 p-0.5 bg-white shadow-xs"
      />
      {label && (
        <span className="text-[8px] font-bold text-slate-500 font-mono tracking-tight text-center block">
          {label}
        </span>
      )}
    </div>
  );
}
