import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  CheckCircle2, 
  FileCode, 
  HardDrive
} from 'lucide-react';
import { 
  SafeStorage, 
  safeMergeItems, 
  confirmHardDelete, 
  BackupSnapshot 
} from '../utils/dataSafety';

export default function DataIntegrityPanel() {
  const BACKUP_KEY = 'cash_app_data_backup';

  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(() => 
    SafeStorage.getBackupsList(BACKUP_KEY)
  );

  const [itemsList, setItemsList] = useState<any[]>(() => 
    SafeStorage.getItem<any[]>('cash_app_items', [
      { id: '101', name: 'خدمات طباعة مستندات', price: 2.500, category: 'خدمات', updatedAt: new Date().toISOString() },
      { id: '102', name: 'توريد ورق A4 قياسي', price: 12.000, category: 'مشتريات', updatedAt: new Date().toISOString() },
      { id: '103', name: 'صيانة ماكينة تصوير الكاشير', price: 15.000, category: 'مصاريف', updatedAt: new Date().toISOString() },
    ])
  );

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 1. إنشاء نسخة احتياطية يدوية
  const handleCreateManualBackup = () => {
    const success = SafeStorage.createAutoBackup(BACKUP_KEY, itemsList, 10);
    if (success) {
      setSnapshots(SafeStorage.getBackupsList(BACKUP_KEY));
      showStatus('success', 'تم إنشاء نسخة احتياطية جديدة بنجاح في التخزين المحلي!');
    } else {
      showStatus('error', 'فشل إنشاء النسخة الاحتياطية. يرجى التحقق من المساحة المتاحة.');
    }
  };

  // 2. تصدير ملف JSON
  const handleExportJSON = () => {
    const exportData = {
      app: 'KWD Cashier & Accounts Pro',
      exportedAt: new Date().toISOString(),
      items: itemsList
    };
    const ok = SafeStorage.exportDataToFile(exportData, `kwd_cashier_backup_${new Date().toISOString().slice(0, 10)}.json`);
    if (ok) {
      showStatus('success', 'تم تصدير ملف النسخة الاحتياطية (JSON) بنجاح إلى جهازك.');
    }
  };

  // 3. استيراد ملف JSON ودمجه بأمان
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedData = await SafeStorage.importDataFromFile<any>(file);
      const incomingItems = importedData.items || importedData;

      if (!Array.isArray(incomingItems)) {
        throw new Error('الملف لا يحتوي على مصفوفة بنود صالحة.');
      }

      // تطبيق الدمج الآمن Safe Merge
      const merged = safeMergeItems(itemsList, incomingItems, 'merge');
      setItemsList(merged);
      SafeStorage.setItem('cash_app_items', merged);
      showStatus('success', `تم دمج البيانات بنجاح! إجمالي البنود الحالي: ${merged.length}`);
    } catch (err: any) {
      showStatus('error', err.message || 'فشل استيراد الملف.');
    }
  };

  // 4. حذف عنصر معين مع الحماية والتأكيد الثنائي
  const handleDeleteItem = async (itemId: string, itemName: string) => {
    const confirmed = await confirmHardDelete({
      title: 'تأكيد الحذف النهائي للبند',
      itemName: itemName,
      requireTypedWord: true,
      wordToType: 'حذف'
    });

    if (confirmed) {
      const updated = itemsList.filter(item => item.id !== itemId);
      setItemsList(updated);
      SafeStorage.setItem('cash_app_items', updated);
      showStatus('success', `تم حذف البند (${itemName}) نهائياً بعد التأكيد الثنائي.`);
    }
  };

  // 5. استعادة نسخة احتياطية سابقة
  const handleRestoreSnapshot = async (snapshot: BackupSnapshot) => {
    const confirmed = await window.confirm(`هل أنت متأكد من استعادة النسخة الاحتياطية المؤرخة في:\n${new Date(snapshot.timestamp).toLocaleString('ar-KW')}؟`);
    if (confirmed) {
      setItemsList(snapshot.data);
      SafeStorage.setItem('cash_app_items', snapshot.data);
      showStatus('success', 'تمت استعادة البيانات بنجاح من النسخة الاحتياطية.');
    }
  };

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  return (
    <div className="space-y-8 text-right font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30">
              <ShieldCheck size={16} />
              <span>نظام حماية وسير البيانات المتكامل (Data Integrity Protocol)</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">إدارة النسخ الاحتياطي والدمج الآمن للبنود</h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              يوفر هذا النظام آليات الأمان المتقدمة للحفاظ على سلامة بيانات الكاشير والحسابات عبر التخزين المحلي الآمن، التأكيد الثنائي للحذف، والدمج الذكي بدون فقدان أي بيانات.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCreateManualBackup}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Database size={16} />
              <span>حفظ نسخة احتياطية فورية</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
            >
              <Download size={16} />
              <span>تصدير JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
          statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          statusMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Live Item Merging & Backup Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Safe Item Merging & CRUD Demo */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">سجل البنود القائمة والدمج الذكي (Safe Merging)</h3>
                <p className="text-xs text-slate-500">البنود المخزنة محلياً بكتلة بيانات محمية ضد التلف</p>
              </div>
            </div>

            {/* Import Button */}
            <label className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors">
              <Upload size={14} />
              <span>استيراد وتسوية (Safe Merge)</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-100 font-bold">
                <tr>
                  <th className="p-3">المعرف (ID)</th>
                  <th className="p-3">اسم البند / الخدمة</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">السعر (د.ك)</th>
                  <th className="p-3 text-center">الإجراء الحساس (تأكيد ثنائي)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {itemsList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-slate-500 font-bold">{item.id}</td>
                    <td className="p-3 font-bold text-slate-900">{item.name}</td>
                    <td className="p-3 text-slate-600">{item.category}</td>
                    <td className="p-3 font-mono font-bold text-emerald-600">{(item.price || 0).toFixed(3)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                        title="حذف نهائي بتأكيد ثنائي"
                      >
                        <Trash2 size={13} />
                        <span>حذف آمن</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {itemsList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      لا توجد بنود حالياً في التخزين المحلي.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Local Auto-Backup Snapshots */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">سجل النسخ الاحتياطية (Auto-Backups)</h3>
              <p className="text-xs text-slate-500">القطاعات الزمانية التلقائية المخزنة</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pl-1">
            {snapshots.map((snap) => (
              <div key={snap.id} className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl space-y-3 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">{snap.id}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-extrabold">
                    {snap.itemCount} بند
                  </span>
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">
                    {new Date(snap.timestamp).toLocaleString('ar-KW')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{snap.note || 'نسخة احتياطية آلية'}</p>
                </div>
                <button
                  onClick={() => handleRestoreSnapshot(snap)}
                  className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>استعادة هذه النسخة</span>
                </button>
              </div>
            ))}

            {snapshots.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                لم يتم إنشاء نسخ احتياطية محلياً بعد.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
