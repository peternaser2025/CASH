import React from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  CheckCircle2 
} from 'lucide-react';
import { formatKWD } from '../../utils/format';

interface ReportMetricCardsProps {
  openingBalance: number;
  filteredIn: number;
  filteredCashOut: number;
  filteredUnpaidAccruals: number;
  cashEndingBalance: number;
}

export default function ReportMetricCards({
  openingBalance,
  filteredIn,
  filteredCashOut,
  filteredUnpaidAccruals,
  cashEndingBalance
}: ReportMetricCardsProps) {
  const cards = [
    { label: 'الرصيد الافتتاحي', value: openingBalance, icon: Wallet, color: 'slate' },
    { 
      label: 'المقبوضات (+)', 
      value: filteredIn, 
      icon: TrendingUp, 
      color: 'emerald',
      sub: 'توريدات نقدية' 
    },
    { 
      label: 'المدفوعات النقدية (-)', 
      value: filteredCashOut, 
      icon: TrendingDown, 
      color: 'rose',
      sub: 'صرف نقدي مثبت'
    },
    { 
      label: 'مشتريات وآجل مستحق', 
      value: filteredUnpaidAccruals, 
      icon: Info, 
      color: 'amber',
      sub: 'آجل غير مخصوم'
    },
    { 
      label: 'رصيد السيولة بالصندوق', 
      value: cashEndingBalance, 
      icon: CheckCircle2, 
      color: cashEndingBalance >= 0 ? 'emerald' : 'rose', 
      highlight: true,
      sub: 'الصافي في الصندوق'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200 border-b border-slate-200 bg-slate-50/50 no-print">
      {cards.map((card, idx) => (
        <div 
          key={idx}
          className={`p-5 flex flex-col justify-between relative ${
            card.highlight ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold ${card.highlight ? 'text-emerald-400' : 'text-slate-500'}`}>
                {card.label}
              </p>
              <card.icon size={16} className={card.highlight ? 'text-emerald-400' : card.color === 'amber' ? 'text-amber-500' : 'text-slate-400'} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-extrabold font-mono tracking-tight ${
                card.highlight ? 'text-white' : card.color === 'emerald' ? 'text-emerald-600' : card.color === 'rose' ? 'text-rose-600' : card.color === 'amber' ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {formatKWD(card.value)}
              </span>
              <span className={`text-xs font-bold ${card.highlight ? 'text-white/60' : 'text-slate-400'}`}>د.ك</span>
            </div>
            {card.sub && (
              <p className={`text-[10px] font-semibold ${card.highlight ? 'text-emerald-300/80' : 'text-slate-400'}`}>
                {card.sub}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
