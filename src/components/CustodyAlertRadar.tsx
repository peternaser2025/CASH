import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BellRing, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Coins, 
  ArrowUpRight, 
  Sliders, 
  Volume2, 
  VolumeX, 
  PlusCircle, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Settings, 
  X, 
  Info,
  Clock,
  Sparkles,
  RefreshCw,
  Scale
} from 'lucide-react';
import { EmployeeBalance } from '../types';
import { formatKWD } from '../utils/format';

export interface CustodyAlertRadarProps {
  balances: EmployeeBalance[];
  onFeedCustody?: (employeeName: string) => void;
  onViewReport?: (employeeName: string) => void;
}

export type AlertSeverity = 'critical_deficit' | 'depleted' | 'low_warning' | 'safe';

export interface AlertedEmployee {
  name: string;
  balance: number;
  severity: AlertSeverity;
  threshold: number;
  percentageRemaining: number;
  deficitAmount: number;
}

const DEFAULT_THRESHOLD = 50; // 50 KWD default early warning threshold

export default function CustodyAlertRadar({ balances, onFeedCustody, onViewReport }: CustodyAlertRadarProps) {
  // Load saved threshold settings from localStorage
  const [lowThreshold, setLowThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('custody_alert_threshold');
      return saved ? parseFloat(saved) : DEFAULT_THRESHOLD;
    } catch {
      return DEFAULT_THRESHOLD;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('custody_alert_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'depleted' | 'warning'>('all');
  const [dismissedEmployees, setDismissedEmployees] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [customThresholdInput, setCustomThresholdInput] = useState<string>(String(lowThreshold));

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('custody_alert_threshold', String(lowThreshold));
  }, [lowThreshold]);

  useEffect(() => {
    localStorage.setItem('custody_alert_sound', String(soundEnabled));
  }, [soundEnabled]);

  // Audio Beeper using Web Audio API for clean chime
  const playAlertChime = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // A4
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  // Categorize balances into alert statuses
  const { alertedList, criticalCount, depletedCount, warningCount, safeCount } = useMemo(() => {
    let crit = 0;
    let dep = 0;
    let warn = 0;
    let safe = 0;

    const list: AlertedEmployee[] = [];

    balances.forEach(emp => {
      const bal = emp.balance;
      let severity: AlertSeverity = 'safe';
      let pct = 100;
      let deficit = 0;

      if (bal < 0) {
        severity = 'critical_deficit';
        deficit = Math.abs(bal);
        pct = 0;
        crit++;
      } else if (bal === 0) {
        severity = 'depleted';
        pct = 0;
        dep++;
      } else if (bal <= lowThreshold) {
        severity = 'low_warning';
        pct = Math.round((bal / lowThreshold) * 100);
        warn++;
      } else {
        severity = 'safe';
        safe++;
      }

      if (severity !== 'safe') {
        list.push({
          name: emp.name,
          balance: bal,
          severity,
          threshold: lowThreshold,
          percentageRemaining: pct,
          deficitAmount: deficit
        });
      }
    });

    // Sort by urgency: critical_deficit first, then depleted, then low_warning ascending balance
    list.sort((a, b) => {
      const rank = { critical_deficit: 0, depleted: 1, low_warning: 2, safe: 3 };
      if (rank[a.severity] !== rank[b.severity]) {
        return rank[a.severity] - rank[b.severity];
      }
      return a.balance - b.balance;
    });

    return {
      alertedList: list,
      criticalCount: crit,
      depletedCount: dep,
      warningCount: warn,
      safeCount: safe
    };
  }, [balances, lowThreshold]);

  // Filter list based on selected tab and dismissed status
  const visibleAlerts = useMemo(() => {
    return alertedList.filter(item => {
      if (dismissedEmployees.includes(item.name)) return false;

      if (activeFilter === 'critical') return item.severity === 'critical_deficit';
      if (activeFilter === 'depleted') return item.severity === 'depleted';
      if (activeFilter === 'warning') return item.severity === 'low_warning';
      return true;
    });
  }, [alertedList, activeFilter, dismissedEmployees]);

  const handleDismiss = (name: string) => {
    setDismissedEmployees(prev => [...prev, name]);
  };

  const handleRestoreAll = () => {
    setDismissedEmployees([]);
  };

  const handleUpdateThreshold = (val: number) => {
    setLowThreshold(val);
    setCustomThresholdInput(String(val));
  };

  const totalActiveAlerts = criticalCount + depletedCount + warningCount;

  return (
    <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden mb-8 no-print">
      {/* Top Banner Header */}
      <div className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
        criticalCount > 0 
          ? 'bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white' 
          : depletedCount > 0 || warningCount > 0
          ? 'bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 text-white'
          : 'bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl relative shadow-lg ${
            totalActiveAlerts > 0 ? 'bg-amber-500 text-slate-950 animate-bounce' : 'bg-emerald-500 text-slate-950'
          }`}>
            <BellRing size={26} />
            {totalActiveAlerts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                {totalActiveAlerts}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black tracking-tight">رادار تنبيهات العهد والإشعار المسبق</h3>
              <span className="px-2.5 py-0.5 bg-white/10 text-white rounded-full text-[10px] font-bold border border-white/20">
                ذكاء اصطناعي للرقابة المالية ⚡
              </span>
            </div>
            <p className="text-xs text-slate-300 font-bold mt-0.5">
              مراقبة فورية لمستويات سيولة الصناديق والتنبيه عند اقتراب النفاذ أو التجاوز
            </p>
          </div>
        </div>

        {/* Quick Summary Badges & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Critical Count */}
          <button
            onClick={() => { setActiveFilter('critical'); setIsExpanded(true); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeFilter === 'critical' 
                ? 'bg-rose-600 text-white border-white' 
                : 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30'
            }`}
          >
            <ShieldAlert size={15} />
            <span>عجز / تجاوز: {criticalCount}</span>
          </button>

          {/* Depleted Count */}
          <button
            onClick={() => { setActiveFilter('depleted'); setIsExpanded(true); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeFilter === 'depleted' 
                ? 'bg-amber-600 text-white border-white' 
                : 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <AlertTriangle size={15} />
            <span>نفاذ تام (0.00): {depletedCount}</span>
          </button>

          {/* Warning Count */}
          <button
            onClick={() => { setActiveFilter('warning'); setIsExpanded(true); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeFilter === 'warning' 
                ? 'bg-yellow-500 text-slate-950 border-white' 
                : 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40 hover:bg-yellow-500/30'
            }`}
          >
            <Clock size={15} />
            <span>اقتراب النفاذ: {warningCount}</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
            title="إعدادات حدود التنبيه"
          >
            <Settings size={18} />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playAlertChime();
            }}
            className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              soundEnabled ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-white/10 text-slate-400 border-white/20'
            }`}
            title={soundEnabled ? 'التنبيه الصوتي مفعّل' : 'التنبيه الصوتي مكتوم'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Content Section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-6 space-y-6 bg-slate-50/70 border-t border-slate-100"
          >
            {/* Quick Threshold Adjuster Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Sliders size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">حد الأمان المسبق (Early Warning Threshold)</h4>
                  <p className="text-[11px] font-bold text-slate-500">
                    يتم إطلاق تنبيه مسبق عندما ينخفض رصيد عهدة الموظف عن: <strong className="text-amber-700 font-mono font-black">{formatKWD(lowThreshold)} د.ك</strong>
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">تغيير السريع:</span>
                {[20, 50, 100, 200].map(amt => (
                  <button
                    key={amt}
                    onClick={() => handleUpdateThreshold(amt)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      lowThreshold === amt 
                        ? 'bg-amber-600 text-white shadow-sm font-black' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {amt} د.ك
                  </button>
                ))}

                {dismissedEmployees.length > 0 && (
                  <button
                    onClick={handleRestoreAll}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer mr-2 flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>إعادة إظهار المكتومة ({dismissedEmployees.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Alert Cards Grid */}
            {visibleAlerts.length === 0 ? (
              <div className="py-10 text-center space-y-2 bg-white rounded-2xl border border-dashed border-slate-200">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
                <h4 className="font-black text-slate-800 text-base">كافة العهد في النطاق الآمن والسليم ✅</h4>
                <p className="text-xs font-bold text-slate-400">
                  {totalActiveAlerts > 0 && dismissedEmployees.length > 0 
                    ? `توجد (${dismissedEmployees.length}) تنبيهات تم إخفاؤها مؤقتاً`
                    : `جميع أرقام العهد تعلو حد الأمان المعتمد (${formatKWD(lowThreshold)} د.ك)`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleAlerts.map(alert => {
                  const isCritical = alert.severity === 'critical_deficit';
                  const isDepleted = alert.severity === 'depleted';
                  const isWarning = alert.severity === 'low_warning';

                  return (
                    <motion.div
                      key={alert.name}
                      layout
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between shadow-sm hover:shadow-md bg-white relative overflow-hidden group ${
                        isCritical 
                          ? 'border-rose-300 bg-rose-50/30 hover:border-rose-500' 
                          : isDepleted 
                          ? 'border-amber-300 bg-amber-50/30 hover:border-amber-500' 
                          : 'border-yellow-300 bg-yellow-50/20 hover:border-yellow-500'
                      }`}
                    >
                      {/* Accent Strip */}
                      <div className={`absolute top-0 right-0 left-0 h-1.5 ${
                        isCritical ? 'bg-rose-600' : isDepleted ? 'bg-amber-600' : 'bg-yellow-500'
                      }`} />

                      <div>
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2 mb-3 pt-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow-sm ${
                              isCritical ? 'bg-rose-600' : isDepleted ? 'bg-amber-600' : 'bg-yellow-500'
                            }`}>
                              {alert.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 text-sm">{alert.name}</h4>
                              <p className="text-[11px] font-bold text-slate-400">مسؤول عهدة معتمد</p>
                            </div>
                          </div>

                          {/* Snooze / Dismiss Button */}
                          <button
                            onClick={() => handleDismiss(alert.name)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="إخفاء التنبيه مؤقتاً"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        {/* Status Badge */}
                        <div className="mb-4">
                          {isCritical && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-black border border-rose-200">
                              <ShieldAlert size={14} className="text-rose-600" />
                              <span>تجاوز الحد / عجز (-{formatKWD(alert.deficitAmount)} د.ك)</span>
                            </div>
                          )}

                          {isDepleted && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black border border-amber-200">
                              <AlertTriangle size={14} className="text-amber-600" />
                              <span>نفاذ تام للسيولة (0.000 د.ك)</span>
                            </div>
                          )}

                          {isWarning && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-900 rounded-lg text-xs font-black border border-yellow-200">
                              <Clock size={14} className="text-yellow-700" />
                              <span>اقتراب من النفاذ (تنبيه مسبق)</span>
                            </div>
                          )}
                        </div>

                        {/* Balance display */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">الرصيد المتبقي:</span>
                          <span className={`text-lg font-black font-mono ${
                            isCritical ? 'text-rose-600' : isDepleted ? 'text-amber-600' : 'text-slate-900'
                          }`}>
                            {formatKWD(alert.balance)} د.ك
                          </span>
                        </div>

                        {/* Gauge Progress Bar */}
                        {!isCritical && (
                          <div className="space-y-1 mb-4">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>نسبة الأمان مقارنة بالحد ({lowThreshold} د.ك):</span>
                              <span className="font-mono">{alert.percentageRemaining}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isDepleted ? 'bg-amber-600' : alert.percentageRemaining < 30 ? 'bg-amber-500' : 'bg-yellow-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, alert.percentageRemaining))}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                        {onFeedCustody && (
                          <button
                            onClick={() => onFeedCustody(alert.name)}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                          >
                            <PlusCircle size={14} />
                            <span>تغذية العهدة</span>
                          </button>
                        )}

                        {onViewReport && (
                          <button
                            onClick={() => onViewReport(alert.name)}
                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                            title="عرض كشف حساب الموظف"
                          >
                            <FileText size={14} />
                            <span>كشف</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
                  <Settings className="text-amber-600" size={22} />
                  <span>إعدادات حدود تنبيهات العهد</span>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs font-bold text-slate-700">
                <div>
                  <label className="block text-slate-800 font-black mb-1">
                    حد الأمان العام للتنبيه المسبق (د.ك):
                  </label>
                  <input
                    type="number"
                    value={customThresholdInput}
                    onChange={e => setCustomThresholdInput(e.target.value)}
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all"
                  />
                  <p className="text-[11px] font-bold text-slate-400 mt-1">
                    سيقوم النظام بإطلاق إشعار تحذيري فور وصول عهدة أي موظف إلى هذا المبلغ أو أقل.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>تشغيل التنبيه الصوتي (Chime):</span>
                  <button
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                      if (!soundEnabled) playAlertChime();
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      soundEnabled ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {soundEnabled ? 'مفعل 🔔' : 'معطل 🔕'}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    const parsed = parseFloat(customThresholdInput);
                    if (!isNaN(parsed) && parsed >= 0) {
                      setLowThreshold(parsed);
                    }
                    setShowSettingsModal(false);
                  }}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer"
                >
                  حفظ التغييرات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
