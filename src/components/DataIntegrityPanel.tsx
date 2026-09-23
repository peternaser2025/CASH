import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Scale, 
  History, 
  FileCode2, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  Play, 
  Database, 
  Search, 
  FileSpreadsheet, 
  UploadCloud 
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { apiService } from '../services/apiService';
import { normalizeExcelDate } from '../utils/format';
import { SafeStorage } from '../utils/dataSafety';

export default function DataIntegrityPanel() {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'audit' | 'diagnostics' | 'backups' | 'excel-import'>('reconciliation');

  // 0. Excel Upload State
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelParsedRows, setExcelParsedRows] = useState<any[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelUploadResult, setExcelUploadResult] = useState<any>(null);

  // 1. Reconciliation State
  const [reconciliationReport, setReconciliationReport] = useState<any>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconcileActionLoading, setReconcileActionLoading] = useState(false);

  // 2. Audit Trail State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // 3. Diagnostics State
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  // Status Toast/Banner
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Load Reconciliation
  const loadReconciliation = async () => {
    setReconciliationLoading(true);
    try {
      const data = await apiService.getReconciliation();
      setReconciliationReport(data);
    } catch (err) {
      console.error('Error fetching reconciliation:', err);
    } finally {
      setReconciliationLoading(false);
    }
  };

  // Run Auto-Reconciliation Action
  const handleRunAutoReconcile = async () => {
    if (!window.confirm('هل تود مطابقة أرصدة كافة الموظفين تلقائياً مع مجموع حركاتهم الفعلية وتسجيل حركة تدقيق؟')) {
      return;
    }
    setReconcileActionLoading(true);
    try {
      const res = await apiService.reconcileAll();
      if (res.success) {
        setReconciliationReport(res.report);
        showStatus('success', 'تمت المطابقة المحاسبية بنجاح وإعادة التوازن لكافة السجلات!');
        loadAuditLogs();
      } else {
        showStatus('error', res.error || 'فشلت عملية المطابقة');
      }
    } catch (err: any) {
      showStatus('error', err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setReconcileActionLoading(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const logs = await apiService.getAuditLogs({ limit: 100 });
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Run Diagnostics Tests
  const runDiagnostics = async () => {
    setDiagnosticLoading(true);
    try {
      const diag = await apiService.getTestSuiteDiagnostic();
      setDiagnosticData(diag);
      showStatus('success', 'تم تشغيل فحوصات الدقة الحسابية بنجاح!');
    } catch (err) {
      showStatus('error', 'فشل تشغيل فحص الدقة الحسابية');
    } finally {
      setDiagnosticLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
    loadAuditLogs();
    runDiagnostics();
  }, []);

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
    if (auditSearchQuery) {
      const q = auditSearchQuery.toLowerCase();
      const matchActor = log.actor?.toLowerCase().includes(q);
      const matchDesc = log.description?.toLowerCase().includes(q);
      const matchId = log.entityId?.toLowerCase().includes(q);
      return matchActor || matchDesc || matchId;
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl text-white shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-500/30">
            <ShieldCheck size={14} />
            نظام التحقق المالي والرقابة المحاسبية
          </div>
          <h1 className="text-3xl font-black tracking-tight">سلامة البيانات والمطابقة وسجل التغييرات</h1>
          <p className="text-slate-300 text-sm font-medium">
            Single Source of Truth، دقة الأرقام بالفلس، المطابقة الدورية، وتتبّع سجل التعديلات
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadReconciliation();
              loadAuditLogs();
              runDiagnostics();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-bold text-xs transition-all cursor-pointer text-white"
          >
            <RefreshCw size={16} className={reconciliationLoading || auditLoading ? 'animate-spin' : ''} />
            تحديث شامل
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl font-bold text-sm flex items-center justify-between border ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : statusMessage.type === 'error' 
            ? 'bg-rose-50 text-rose-800 border-rose-200' 
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
        {[
          { id: 'reconciliation', label: 'المطابقة المحاسبية (Reconciliation)', icon: Scale },
          { id: 'excel-import', label: 'رفع شيت الإكسيل بنفس الترتيب (Supabase)', icon: FileSpreadsheet },
          { id: 'audit', label: 'سجل تتبّع التعديلات (Audit Trail)', icon: History },
          { id: 'diagnostics', label: 'فحوصات الدقة واختبارات النظام', icon: FileCode2 },
          { id: 'backups', label: 'النسخ الاحتياطي والأمان', icon: Database }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
                isActive 
                  ? 'bg-white text-indigo-950 shadow-md border border-gray-200' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Reconciliation Check */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-xs font-black text-gray-400 block mb-1">حالة توازن النظام المالي</span>
              <div className="flex items-center gap-3">
                {reconciliationReport?.isSystemBalanced ? (
                  <>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-emerald-700">متطابق وموزون 100%</h3>
                      <p className="text-xs text-gray-500 font-bold">لا يوجد أي انحراف بالفلس</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-rose-700">يوجد فرق محاسبي</h3>
                      <p className="text-xs text-rose-600 font-bold">
                        إجمالي الفرق: {reconciliationReport?.totalDiscrepancyKWD?.toFixed(3) || '0.000'} د.ك
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-xs font-black text-gray-400 block mb-1">المعاملات التي تم تدقيقها</span>
              <h3 className="text-3xl font-black text-gray-900">{reconciliationReport?.totalTransactionsEvaluated || 0}</h3>
              <p className="text-xs text-gray-500 font-bold mt-1">حركات مالية مسجلة وموثقة في السيرفر</p>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-black text-gray-400 block mb-1">التسوية التلقائية للمنظومة</span>
                <p className="text-xs text-gray-500 font-medium">مزامنة الأرصدة المخزنة فوراً مع ناتج الحركات الحسابي الدقيق</p>
              </div>
              <button
                onClick={handleRunAutoReconcile}
                disabled={reconcileActionLoading}
                className="mt-3 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={reconcileActionLoading ? 'animate-spin' : ''} />
                إجراء تسوية ومطابقة فورية
              </button>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-lg">جدول المطابقة المحاسبية التفصيلي للعهد</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  مقارنة الرصيد المحسوب من واقع الحركات بالفلس مقابل الرصيد الدفتري المخزن
                </p>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                آخر فحص: {reconciliationReport?.timestamp ? new Date(reconciliationReport.timestamp).toLocaleTimeString('ar-KW') : 'الآن'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-black text-gray-500">
                    <th className="py-4 px-6">المسؤول / أمين العهدة</th>
                    <th className="py-4 px-6">إجمالي التوريدات (+)</th>
                    <th className="py-4 px-6">إجمالي المصروفات (-)</th>
                    <th className="py-4 px-6">الرصيد المحسوب (د.ك)</th>
                    <th className="py-4 px-6">الرصيد المخزن (د.ك)</th>
                    <th className="py-4 px-6">الفرق (Discrepancy)</th>
                    <th className="py-4 px-6">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm font-medium">
                  {reconciliationReport?.items?.map((item: any) => {
                    const isBalanced = item.status === 'balanced';
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 font-black text-gray-900">{item.name}</td>
                        <td className="py-4 px-6 text-emerald-600 font-mono">{item.totalIncomeFils ? (item.totalIncomeFils / 1000).toFixed(3) : '0.000'} د.ك</td>
                        <td className="py-4 px-6 text-rose-600 font-mono">{item.totalExpenseFils ? (item.totalExpenseFils / 1000).toFixed(3) : '0.000'} د.ك</td>
                        <td className="py-4 px-6 font-mono font-bold text-slate-900">{item.calculatedBalanceKWD.toFixed(3)} د.ك</td>
                        <td className="py-4 px-6 font-mono font-bold text-slate-700">{item.storedBalanceKWD.toFixed(3)} د.ك</td>
                        <td className={`py-4 px-6 font-mono font-bold ${item.discrepancyFils === 0 ? 'text-gray-400' : 'text-rose-600'}`}>
                          {item.discrepancyKWD.toFixed(3)} د.ك
                        </td>
                        <td className="py-4 px-6">
                          {isBalanced ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black border border-emerald-200">
                              <CheckCircle2 size={12} />
                              مطابق تماماً
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-black border border-rose-200">
                              <AlertTriangle size={12} />
                              يوجد فرق
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Filter Controls */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                placeholder="بحث في سجل التعديلات بالوصف أو الفاعل..."
                className="w-full pr-11 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <span className="text-xs font-bold text-gray-400 ml-2 whitespace-nowrap">الإجراء:</span>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'CREATE', label: 'إضافة (+)' },
                { id: 'UPDATE', label: 'تعديل (✎)' },
                { id: 'DELETE', label: 'حذف (🗑)' },
                { id: 'RECONCILE', label: 'تسوية (⚖)' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setAuditActionFilter(f.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    auditActionFilter === f.id 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Logs List */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-lg">سجل تتبّع العمليات المالية التاريخي</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  توثيق دقيق لكل عملية إضافة، تعديل، حذف، أو تسوية جرت في المنظومة
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {filteredAuditLogs.length} سجل تاريخي
              </span>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold">
                لا توجد سجلات تتبّع تطابق معايير البحث الحالية.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredAuditLogs.map(log => {
                  let badgeColor = 'bg-gray-100 text-gray-700';
                  let Icon = Edit3;

                  if (log.action === 'CREATE') {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    Icon = PlusCircle;
                  } else if (log.action === 'UPDATE') {
                    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                    Icon = Edit3;
                  } else if (log.action === 'DELETE') {
                    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                    Icon = Trash2;
                  } else if (log.action === 'RECONCILE') {
                    badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                    Icon = Scale;
                  }

                  return (
                    <div key={log.id} className="p-6 hover:bg-gray-50/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl border ${badgeColor}`}>
                          <Icon size={18} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase ${badgeColor}`}>
                              {log.action}
                            </span>
                            <span className="text-xs font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {log.entityType}
                            </span>
                            <span className="text-xs font-black text-gray-800">بواسطة: {log.actor}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{log.description}</p>
                        </div>
                      </div>

                      <div className="text-left font-mono text-xs text-gray-400">
                        {new Date(log.timestamp).toLocaleString('ar-KW')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Diagnostics & Tests */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <h3 className="font-black text-gray-900 text-xl">فحوصات الدقة الحسابية واختبارات الوحدة (Unit Tests)</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  التحقق من تفادي خطأ IEEE-754 (0.1 + 0.2)، وقواعد التحقق من الصحة عبر Zod، وتوازن السجلات
                </p>
              </div>
              <button
                onClick={runDiagnostics}
                disabled={diagnosticLoading}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play size={14} className={diagnosticLoading ? 'animate-spin' : ''} />
                إعادة تشغيل الاختبارات الآلية
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagnosticData?.tests?.map((t: any, idx: number) => (
                <div key={idx} className="p-5 bg-gray-50/70 rounded-2xl border border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${t.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {t.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-800">{t.name}</h4>
                      <p className="text-xs text-gray-500 font-medium">{t.passed ? 'النتيجة صحيحة ومطابقة للمعايير' : 'فشل الاختبار'}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-black px-3 py-1 rounded-full ${t.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {t.passed ? 'ناجح (PASS)' : 'فاشل (FAIL)'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-xs font-medium text-indigo-900 leading-relaxed">
              💡 <strong>معلومة هندسية:</strong> يتم حفظ ومحاسبة كافة المبالغ داخلياً بوحدة "الفلس" كأرقام صحيحة (Integers)، مما يحمي النظام من الفروقات الناتجة عن التقريب الثنائي، ويضمن أن كل دينار وكامل تفاصيله العشرية الثلاثية دقيقة 100%.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Backups */}
      {activeTab === 'backups' && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <h3 className="font-black text-gray-900 text-xl">النسخ الاحتياطي وتأمين البيانات</h3>
            <p className="text-xs text-gray-500 font-medium mt-1">تصدير واستيراد قواعد البيانات كملفات JSON مستقلة</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-black text-gray-800 text-sm">تصدير ملف النسخة الاحتياطية (JSON)</h4>
              <p className="text-xs text-gray-500">حفظ نسخة كاملة من بيانات النظام على جهازك المحلي فوراً بصيغة JSON.</p>
              <button
                onClick={() => {
                  SafeStorage.exportDataToFile(
                    { exportedAt: new Date().toISOString(), system: 'Financial Pro' },
                    `financial_backup_${new Date().toISOString().slice(0, 10)}.json`
                  );
                  showStatus('success', 'تم بدء تصدير النسخة الاحتياطية');
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} />
                تصدير نسخة احتياطية (JSON)
              </button>
            </div>

            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-black text-gray-800 text-sm">استيراد نسخة احتياطية</h4>
              <p className="text-xs text-gray-500">استعادة أو دمج بيانات من ملف JSON تم تصديره مسبقاً.</p>
              <label className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
                <Upload size={16} />
                اختيار ملف JSON للاستيراد
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await SafeStorage.importDataFromFile(file);
                      showStatus('success', 'تم استيراد الملف بنجاح!');
                    } catch (err: any) {
                      showStatus('error', err.message || 'فشل الاستيراد');
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: In-Order Excel Uploader to Supabase */}
      {activeTab === 'excel-import' && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg uppercase">Supabase Direct</span>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-black rounded-lg">100% In-Order Guarantee</span>
              </div>
              <h3 className="font-black text-gray-900 text-xl mt-2">رفع شيت الإكسيل في قاعدة البيانات بنفس الترتيب 1:1</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">
                يقوم هذا المعالج بقراءة شيت الإكسيل وتثبيت رقم السطر الأصلي (<code className="font-mono bg-gray-100 px-1 py-0.5 rounded">row_index</code>) وتخزينه في جدول <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">excel_raw_ledger</code> دون أي إعادة خلط أو تغيير في الترتيب.
              </p>
            </div>

            {excelParsedRows.length > 0 && (
              <button
                onClick={async () => {
                  setExcelUploading(true);
                  setExcelUploadResult(null);
                  try {
                    const res = await apiService.uploadExcelToSupabase(excelParsedRows);
                    setExcelUploadResult(res);
                    if (res.success) {
                      showStatus('success', res.message || 'تم الرفع بالترتيب بنجاح!');
                    } else {
                      showStatus('error', res.error || 'فشل الرفع إلى Supabase');
                    }
                  } catch (e: any) {
                    showStatus('error', e.message || 'حدث خطأ غير متوقع');
                  } finally {
                    setExcelUploading(false);
                  }
                }}
                disabled={excelUploading}
                className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {excelUploading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <UploadCloud size={16} />
                )}
                <span>{excelUploading ? 'جارٍ الرفع بالترتيب الدقيق...' : `تأكيد ورفع (${excelParsedRows.length}) صف للقاعدة الآن`}</span>
              </button>
            )}
          </div>

          {/* Upload Dropzone */}
          <div className="p-8 border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 rounded-3xl text-center space-y-4 transition-all">
            <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-inner">
              <FileSpreadsheet size={32} />
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-base">اختر ملف الإكسيل (.xlsx أو .xls أو .csv)</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-lg mx-auto">
                سيتم مسح الأسطر من السطر الأول حتى الأخير تلقائياً، مع الاحتفاظ بـ ID المعاملة، التاريخ، الموظف، الفرع، القسم، المبالغ، والترتيب التسلسلي.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer shadow-md transition-all">
              <Upload size={16} />
              <span>{excelFileName ? `تغيير الملف (${excelFileName})` : 'اختيار ملف الإكسيل من جهازك'}</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setExcelFileName(file.name);
                  setExcelUploadResult(null);

                  try {
                    const buffer = await file.arrayBuffer();
                    const wb = xlsx.read(buffer, { type: 'array' });
                    const sheetName = wb.SheetNames[0];
                    const ws = wb.Sheets[sheetName];

                    // Convert to JSON with row index preserved
                    const rawData: any[] = xlsx.utils.sheet_to_json(ws, { defval: '', raw: true });

                    const mapped = rawData.map((row, idx) => ({
                      rowIndex: idx + 2, // Excel row numbering starts at row 2
                      id: row.ID || row.id || row['رقم المعاملة'] || `TX-${idx + 1}`,
                      date: normalizeExcelDate(row.Date ?? row.date ?? row['التاريخ'] ?? row['تاريخ'] ?? row.time ?? row.timestamp ?? ''),
                      employee: row.Employee || row.employee || row['الموظف'] || row['اسم الموظف'] || '',
                      branch: row.Branch || row.branch || row['الفرع'] || '',
                      department: row.Department || row.department || row['القسم'] || '',
                      type: row.Type || row.type || row['النوع'] || 'Expense',
                      category: row.Category || row.category || row['البند'] || row['التصنيف'] || '',
                      amount: row.Amount || row.amount || row['المبلغ'] || row['المبلغ (د.ك)'] || 0,
                      description: row.Description || row.description || row['البيان'] || row['الملاحظات'] || '',
                      relatedId: row.Related_ID || row.related_id || row['سند مرتبط'] || '',
                      timestamp: row.Timestamp || row.timestamp || row['الوقت'] || '',
                      computerNumber: row['رقم الكمبيوتر'] || row.computerNumber || ''
                    }));

                    setExcelParsedRows(mapped);
                    showStatus('success', `تمت قراءة ${mapped.length} صف من الشيت بالترتيب الأصلي بنجاح`);
                  } catch (err: any) {
                    console.error('Failed to parse excel:', err);
                    showStatus('error', 'فشل قراءة ملف الإكسيل: ' + err.message);
                  }
                }}
              />
            </label>
          </div>

          {/* Success Banner */}
          {excelUploadResult && (
            <div className={`p-5 rounded-2xl border font-bold text-xs flex items-center justify-between ${
              excelUploadResult.success 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              <div className="flex items-center gap-3">
                {excelUploadResult.success ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertTriangle size={20} className="text-rose-600" />}
                <div>
                  <h4 className="font-black text-sm">{excelUploadResult.message || (excelUploadResult.success ? 'تم الرفع بنجاح' : 'فشل الرفع')}</h4>
                  {excelUploadResult.totalInserted && (
                    <p className="text-[11px] opacity-80 mt-0.5">عدد السجلات المدرجة بجدول excel_raw_ledger: {excelUploadResult.totalInserted}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Preview of Rows in Exact Order */}
          {excelParsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-gray-800 text-sm flex items-center gap-2">
                  <span>معاينة البيانات بالترتيب التسلسلي الفعلي</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-mono">{excelParsedRows.length} صف</span>
                </h4>
                <span className="text-[11px] text-gray-500">الترتيب من السطر رقم 2 تصاعدياً</span>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-black sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="p-3 w-16 text-center font-mono"># السطر</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">الفرع</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">البند</th>
                      <th className="p-3 text-left">المبلغ (د.ك)</th>
                      <th className="p-3">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {excelParsedRows.slice(0, 50).map((row) => (
                      <tr key={row.rowIndex} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-gray-500 bg-gray-50/50">{row.rowIndex}</td>
                        <td className="p-3 text-gray-700 whitespace-nowrap">{row.date}</td>
                        <td className="p-3 font-bold text-gray-900">{row.employee}</td>
                        <td className="p-3 text-gray-700">
                          <span>{row.branch}</span>
                          {row.department && (
                            <span className="mr-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-black">{row.department}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            row.type === 'Income' || row.type === 'إيراد'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{row.category}</td>
                        <td className="p-3 text-left font-mono font-black text-gray-900" dir="ltr">
                          {Number(row.amount).toFixed(3)}
                        </td>
                        <td className="p-3 text-gray-500 truncate max-w-xs">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelParsedRows.length > 50 && (
                <p className="text-center text-[11px] text-gray-400 font-medium">يتم عرض أول 50 صف للمعاينة السريعة، وسيتم رفع كافة الـ {excelParsedRows.length} صف بالكامل للقاعدة.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
