import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  FolderGit, 
  FileText, 
  CheckSquare, 
  MessageSquare, 
  RefreshCw, 
  Plus, 
  Send, 
  ExternalLink, 
  CheckCircle, 
  Trash2, 
  UploadCloud, 
  FileDown, 
  AlertCircle,
  Calendar,
  CloudLightning,
  Check
} from 'lucide-react';
import { auth } from '../firebase';
import { workspaceService } from '../services/workspaceService';
import { EmployeeBalance } from '../types';

interface GoogleToolsProps {
  balances: EmployeeBalance[];
  onRefresh: () => void;
}

export default function GoogleTools({ balances, onRefresh }: GoogleToolsProps) {
  const [isConnected, setIsConnected] = useState(workspaceService.hasActiveToken());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'sheets' | 'drive' | 'docs' | 'tasks' | 'chat'>('sheets');

  // Google Sheets states
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('تقرير العهد والسيولة KWD - ' + new Date().toLocaleDateString('ar-KW'));

  // Google Drive states
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);

  // Google Docs states
  const [docTitle, setDocTitle] = useState('تقرير تصفية عهدة رسمي - ' + new Date().toLocaleDateString('ar-KW'));
  const [selectedEmployeeForDoc, setSelectedEmployeeForDoc] = useState<string>('');
  const [docText, setDocText] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [createdDocUrl, setCreatedDocUrl] = useState<string>('');

  // Google Tasks states
  const [taskLists, setTaskLists] = useState<any[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');

  // Google Chat states
  const [chatSpaces, setChatSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSuccessMessage, setChatSuccessMessage] = useState('');

  // Set default employee for Doc Report
  useEffect(() => {
    if (balances.length > 0 && !selectedEmployeeForDoc) {
      setSelectedEmployeeForDoc(balances[0].name);
    }
  }, [balances, selectedEmployeeForDoc]);

  // Handle Google OAuth Connection
  const handleConnect = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await workspaceService.connectGoogle(auth);
      setIsConnected(true);
      setStatus({ type: 'success', message: 'تم الاتصال بحساب Google بنجاح وتفعيل جميع الخدمات السحابية!' });
      loadAllServicesData();
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'فشل الاتصال بـ Google. يرجى مراجعة إعدادات نافذة المتصفح.' });
    } finally {
      setLoading(false);
    }
  };

  // Load relevant data for connected APIs
  const loadAllServicesData = async () => {
    if (!workspaceService.hasActiveToken()) return;
    
    // Sheets
    setSheetLoading(true);
    try {
      const sheets = await workspaceService.listSpreadsheets();
      setSpreadsheets(sheets);
      if (sheets.length > 0) {
        setSelectedSheetId(sheets[0].id);
      }
    } catch (e) {
      console.error('Sheets load failed', e);
    } finally {
      setSheetLoading(false);
    }

    // Drive
    setDriveLoading(true);
    try {
      const files = await workspaceService.listDriveFiles();
      setDriveFiles(files);
    } catch (e) {
      console.error('Drive load failed', e);
    } finally {
      setDriveLoading(false);
    }

    // Tasks
    setTasksLoading(true);
    try {
      const lists = await workspaceService.listTaskLists();
      setTaskLists(lists);
      if (lists.length > 0) {
        setSelectedTaskListId(lists[0].id);
        const taskItems = await workspaceService.listTasks(lists[0].id);
        setTasks(taskItems);
      }
    } catch (e) {
      console.error('Tasks load failed', e);
    } finally {
      setTasksLoading(false);
    }

    // Chat
    try {
      const spaces = await workspaceService.listChatSpaces();
      setChatSpaces(spaces);
      if (spaces.length > 0) {
        setSelectedSpace(spaces[0].name);
      }
    } catch (e) {
      console.error('Chat load failed', e);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadAllServicesData();
    }
  }, [isConnected]);

  // Load tasks when task list changes
  const handleTaskListChange = async (listId: string) => {
    setSelectedTaskListId(listId);
    setTasksLoading(true);
    try {
      const taskItems = await workspaceService.listTasks(listId);
      setTasks(taskItems);
    } catch (e) {
      console.error('Tasks fetch failed', e);
    } finally {
      setTasksLoading(false);
    }
  };

  // SHEETS: Create new sheet
  const handleCreateSheet = async () => {
    if (!newSheetTitle.trim()) return;
    setSheetLoading(true);
    setStatus(null);
    try {
      const newSheet = await workspaceService.createSpreadsheet(newSheetTitle);
      setStatus({ type: 'success', message: `تم إنشاء جدول البيانات الجديد بنجاح: ${newSheet.properties.title}` });
      setNewSheetTitle('تقرير العهد والسيولة KWD - ' + new Date().toLocaleDateString('ar-KW'));
      
      // Refresh list
      const sheets = await workspaceService.listSpreadsheets();
      setSpreadsheets(sheets);
      setSelectedSheetId(newSheet.spreadsheetId);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل إنشاء جدول البيانات' });
    } finally {
      setSheetLoading(false);
    }
  };

  // SHEETS: Export balances to selected sheet
  const handleExportToSheet = async () => {
    if (!selectedSheetId) {
      setStatus({ type: 'error', message: 'يرجى تحديد جدول بيانات أولاً' });
      return;
    }

    const confirmed = window.confirm('هل تريد تصدير بيانات العهد الحالية إلى جدول بيانات Google المحدد؟ سيتم إضافة صفوف جديدة ببيانات الموظفين والسيولة.');
    if (!confirmed) return;

    setSheetLoading(true);
    setStatus(null);
    try {
      const dateStr = new Date().toLocaleString('ar-KW');
      // Format headers and rows
      const headers = ['تاريخ التصدير', 'اسم الموظف', 'الرصيد المتبقي (KWD)', 'آخر تحديث'];
      const rows = balances.map(b => [
        dateStr,
        b.name,
        b.balance,
        new Date().toLocaleDateString('ar-KW')
      ]);

      // Check if we need to write headers first
      const existingValues = await workspaceService.getSheetValues(selectedSheetId, 'Sheet1!A1:D1');
      const dataToAppend: any[][] = [];
      if (existingValues.length === 0) {
        dataToAppend.push(headers);
      }
      dataToAppend.push(...rows);

      await workspaceService.appendRowToSheet(selectedSheetId, 'Sheet1', dataToAppend);
      setStatus({ type: 'success', message: 'تم تصدير وتحويل بيانات العهد بنجاح لجدول البيانات وجوجل شيت!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل تصدير البيانات إلى شيت' });
    } finally {
      setSheetLoading(false);
    }
  };

  // DRIVE: Upload JSON Report
  const handleUploadDriveReport = async () => {
    setDriveLoading(true);
    setStatus(null);
    try {
      const fileName = `KWD_Finance_Export_${Date.now()}.json`;
      const content = JSON.stringify({
        exportedAt: new Date().toISOString(),
        total_employees: balances.length,
        total_balance: balances.reduce((acc, b) => acc + b.balance, 0),
        employees: balances
      }, null, 2);

      await workspaceService.uploadFileToDrive(fileName, content, 'application/json');
      setStatus({ type: 'success', message: `تم رفع ملف تقرير البيانات بنجاح لـ Google Drive باسم: ${fileName}` });
      
      // Refresh files
      const files = await workspaceService.listDriveFiles();
      setDriveFiles(files);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل رفع الملف لـ Drive' });
    } finally {
      setDriveLoading(false);
    }
  };

  // DRIVE: Delete File
  const handleDeleteFile = async (id: string, name: string) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف الملف "${name}" من Google Drive نهائياً؟`);
    if (!confirmed) return;

    setDriveLoading(true);
    setStatus(null);
    try {
      await workspaceService.deleteDriveFile(id);
      setStatus({ type: 'success', message: 'تم حذف الملف بنجاح من حساب Google Drive الخاص بك' });
      
      // Refresh list
      const files = await workspaceService.listDriveFiles();
      setDriveFiles(files);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل حذف الملف' });
    } finally {
      setDriveLoading(false);
    }
  };

  // DOCS: Create Official Doc Report
  const handleCreateDocReport = async () => {
    if (!docTitle.trim()) return;
    setDocLoading(true);
    setStatus(null);
    setCreatedDocUrl('');
    try {
      const employee = balances.find(b => b.name === selectedEmployeeForDoc);
      const summaryText = employee 
        ? `كشف تصفية العهد المالية الرسمي للموظف: ${employee.name}\n` +
          `==========================================\n` +
          `تاريخ التقرير: ${new Date().toLocaleDateString('ar-KW')}\n\n` +
          `تفاصيل العهد والسيولة بالدينار الكويتي (KWD):\n` +
          `- الرصيد الحالي المتبقي: ${employee.balance} KWD\n\n` +
          `ملاحظة التدقيق المالي:\n` +
          `${docText || 'تمت مطابقة الكشوفات والفواتير المرفقة وتبين صحة الأرصدة والسيولة المتبقية.'}\n\n` +
          `توقيع الإدارة المالية:\n` +
          `---------------------\n\n` +
          `توقيع الموظف المستلم للعهدة:\n` +
          `---------------------\n`
        : `تقرير عهد جميع الموظفين بالتطبيق\n` +
          `==========================================\n` +
          `إجمالي عدد الموظفين: ${balances.length}\n` +
          `إجمالي الأرصدة الكلية: ${balances.reduce((acc, b) => acc + b.balance, 0)} KWD\n` +
          `ملاحظات: ${docText || 'تم إنشاء هذا الملف تلقائياً بواسطة نظام KWD Finance Pro.'}`;

      const doc = await workspaceService.createDocReport(docTitle, summaryText);
      const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`;
      setCreatedDocUrl(docUrl);
      setStatus({ type: 'success', message: 'تم إنشاء مستند تصفية العهد والمطابقة المالية بنجاح في Google Docs!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل إنشاء مستند Docs' });
    } finally {
      setDocLoading(false);
    }
  };

  // TASKS: Create Google Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedTaskListId) return;

    setTasksLoading(true);
    setStatus(null);
    try {
      await workspaceService.createGoogleTask(
        selectedTaskListId,
        newTaskTitle,
        newTaskNotes,
        newTaskDue || undefined
      );
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskDue('');
      setStatus({ type: 'success', message: 'تمت إضافة وإرسال المهمة الجديدة إلى Google Tasks بنجاح!' });
      
      // Refresh tasks
      const taskItems = await workspaceService.listTasks(selectedTaskListId);
      setTasks(taskItems);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل إرسال المهمة لـ Google Tasks' });
    } finally {
      setTasksLoading(false);
    }
  };

  // TASKS: Complete Task
  const handleCompleteTask = async (taskId: string) => {
    if (!selectedTaskListId) return;
    setTasksLoading(true);
    setStatus(null);
    try {
      await workspaceService.completeGoogleTask(selectedTaskListId, taskId);
      setStatus({ type: 'success', message: 'تم تحديث حالة المهمة وإنجازها على Google Tasks' });
      
      // Refresh tasks
      const taskItems = await workspaceService.listTasks(selectedTaskListId);
      setTasks(taskItems);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل تصفية المهمة' });
    } finally {
      setTasksLoading(false);
    }
  };

  // CHAT: Send Alerts to Space
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !selectedSpace) return;

    setChatLoading(true);
    setChatSuccessMessage('');
    try {
      const response = await workspaceService.postMessageToChatSpace(selectedSpace, chatMessage);
      setChatMessage('');
      if (response.simulated) {
        setChatSuccessMessage('تمت محاكاة إرسال التنبيه المالي بنجاح! (نظراً لقيود صلاحيات مساحات الشركة الداخلية)');
      } else {
        setChatSuccessMessage('تم إرسال إشعار التنبيه المالي لمساحة Google Chat بنجاح!');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل إرسال التنبيه لمساحة المحادثة' });
    } finally {
      setChatLoading(false);
    }
  };

  const fillQuickAlert = (type: string) => {
    const totalBalance = balances.reduce((a, b) => a + b.balance, 0);

    if (type === 'general') {
      setChatMessage(
        `🚨 *إشعار مالي عاجل - KWD Finance Pro*\n` +
        `تحديث المركز المالي اليومي للعهد والسيولة بالشركة:\n` +
        `• السيولة الحالية المتبقية في الصناديق: *${totalBalance} KWD*\n` +
        `تمت المطابقة الآلية لجميع الأرصدة بنجاح.`
      );
    } else if (type === 'warning') {
      const lowBalances = balances.filter(b => b.balance < 50);
      if (lowBalances.length > 0) {
        setChatMessage(
          `⚠️ *تنبيه انخفاض السيولة في عهد الموظفين*\n` +
          `يوجد موظفين شارف رصيد عهدتهم المتبقي على النفاد (< 50 KWD):\n` +
          lowBalances.map(b => `- *${b.name}*: الرصيد الحالي *${b.balance} KWD*`).join('\n') +
          `\n\nيرجى التعجيل بتغذية العهد لعدم توقف الأعمال الميدانية.`
        );
      } else {
        setChatMessage(
          `⚠️ *تقرير عهد الموظفين المالي*\n` +
          `جميع عهد الموظفين حالياً في النطاق الآمن (> 50 KWD).\n` +
          `أعلى عهدة متبقية هي لـ: *${balances.reduce((prev, current) => (prev.balance > current.balance) ? prev : current).name}*`
        );
      }
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -translate-x-20 -translate-y-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-right">
            <span className="bg-emerald-500/30 text-emerald-200 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-block">
              تكامل Google Workspace السحابي
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">بوابة Google Workspace الموحدة</h1>
            <p className="text-emerald-100 text-sm font-medium max-w-xl">
              قم بربط حسابك لحفظ وتصدير العهد المالية وصرفياتها مباشرة إلى جداول Sheets، ملفات Drive، مستندات Docs، مهام Tasks، وتنبيهات Chat في 1-click وبشكل فوري.
            </p>
          </div>
          <div>
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-8 py-4 bg-white hover:bg-slate-50 text-emerald-800 font-black rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-3 text-base shrink-0 border border-transparent hover:border-emerald-100"
              >
                {loading ? (
                  <RefreshCw size={20} className="animate-spin text-emerald-700" />
                ) : (
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                )}
                الاتصال وتفعيل خدمات Google
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-800/40 px-5 py-3 rounded-2xl border border-emerald-500/20 backdrop-blur-sm">
                <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-xs font-black text-emerald-200">أنت متصل الآن بحساب Google</span>
                <button
                  onClick={() => {
                    workspaceService.setAccessToken(null);
                    setIsConnected(false);
                  }}
                  className="text-[10px] text-white/60 hover:text-white underline font-bold"
                >
                  فصل الاتصال
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Status Banner */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-5 rounded-2xl flex items-start gap-4 border text-sm font-bold leading-relaxed ${
              status.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle className="shrink-0 text-emerald-600 mt-0.5" size={20} />
            ) : (
              <AlertCircle className="shrink-0 text-red-600 mt-0.5" size={20} />
            )}
            <p>{status.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnected ? (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-12 text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <CloudLightning size={40} />
          </div>
          <div className="max-w-md mx-auto space-y-3">
            <h3 className="text-2xl font-black text-gray-900">الربط السحابي معطل حالياً</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              لتتمكن من إنشاء وتصدير التقارير، مهام التدقيق، وأوراق العمل وتنبيهات الموظفين لخدمات Google Workspace، يرجى تفعيل اتصال Google الآمن بالضغط على الزر بالأعلى.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all inline-flex items-center gap-2 text-sm shadow-md"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
            بدء الاتصال السحابي الآمن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sub Navigation */}
          <div className="lg:col-span-1 space-y-2 col-span-1">
            <button
              onClick={() => setActiveSubTab('sheets')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'sheets'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} />
                <span>Google Sheets</span>
              </div>
              <span className="text-[10px] opacity-80 bg-black/10 px-2 py-0.5 rounded-full">جداول</span>
            </button>

            <button
              onClick={() => setActiveSubTab('drive')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'drive'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderGit size={20} />
                <span>Google Drive</span>
              </div>
              <span className="text-[10px] opacity-80 bg-black/10 px-2 py-0.5 rounded-full">ملفات</span>
            </button>

            <button
              onClick={() => setActiveSubTab('docs')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'docs'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText size={20} />
                <span>Google Docs</span>
              </div>
              <span className="text-[10px] opacity-80 bg-black/10 px-2 py-0.5 rounded-full">مستندات</span>
            </button>

            <button
              onClick={() => setActiveSubTab('tasks')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'tasks'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckSquare size={20} />
                <span>Google Tasks</span>
              </div>
              <span className="text-[10px] opacity-80 bg-black/10 px-2 py-0.5 rounded-full">مهام</span>
            </button>

            <button
              onClick={() => setActiveSubTab('chat')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'chat'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={20} />
                <span>Google Chat</span>
              </div>
              <span className="text-[10px] opacity-80 bg-black/10 px-2 py-0.5 rounded-full">تنبيهات</span>
            </button>

            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 mt-6">
              <span className="text-[10px] font-bold text-emerald-600 leading-relaxed block">
                ⭐ جميع العمليات تتم وتتصل مباشرة بسيرفرات Google Workspace الآمنة باستخدام الحساب المتصل.
              </span>
            </div>
          </div>

          {/* Sub Panels Container */}
          <div className="lg:col-span-3 col-span-1">
            <AnimatePresence mode="wait">
              {/* 1. GOOGLE SHEETS */}
              {activeSubTab === 'sheets' && (
                <motion.div
                  key="sheets"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">جداول بيانات Google Sheets</h2>
                      <p className="text-xs text-gray-500 font-medium">مزامنة وتصدير العهد المالية وأرصدتها</p>
                    </div>
                    <button
                      onClick={loadAllServicesData}
                      className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all"
                    >
                      <RefreshCw size={16} className={sheetLoading ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {/* Create New Spreadsheet Form */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h3 className="text-sm font-black text-slate-800">إنشاء جدول بيانات جديد</h3>
                    <div className="flex flex-col md:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="أدخل عنوان جدول البيانات الجديد..."
                        value={newSheetTitle}
                        onChange={e => setNewSheetTitle(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                      />
                      <button
                        onClick={handleCreateSheet}
                        disabled={sheetLoading}
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 shrink-0"
                      >
                        <Plus size={16} />
                        إنشاء فارغ
                      </button>
                    </div>
                  </div>

                  {/* Select and Export Form */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800">تصدير العهد المالية لشيت جوجل</h3>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500">اختر جدول البيانات المستهدف من حسابك:</label>
                      <select
                        value={selectedSheetId}
                        onChange={e => setSelectedSheetId(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                      >
                        {spreadsheets.length === 0 ? (
                          <option value="">-- لا توجد جداول بيانات متاحة، يرجى إنشاء واحد أولاً --</option>
                        ) : (
                          spreadsheets.map(sheet => (
                            <option key={sheet.id} value={sheet.id}>{sheet.name} (آخر تعديل: {new Date(sheet.modifiedTime).toLocaleDateString('ar-KW')})</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 pt-3">
                      <button
                        onClick={handleExportToSheet}
                        disabled={sheetLoading || !selectedSheetId}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15"
                      >
                        <FileDown size={18} />
                        تصدير بيانات العهد والسيولة الحالية (KWD)
                      </button>

                      {selectedSheetId && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${selectedSheetId}/edit`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
                        >
                          <ExternalLink size={18} />
                          فتح جدول البيانات
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 2. GOOGLE DRIVE */}
              {activeSubTab === 'drive' && (
                <motion.div
                  key="drive"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">الملفات على Google Drive</h2>
                      <p className="text-xs text-gray-500 font-medium font-black">تصفح وأرشفة الملفات المالية سحابياً</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUploadDriveReport}
                        disabled={driveLoading}
                        className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-xl transition-all text-xs flex items-center gap-1.5"
                      >
                        <UploadCloud size={14} />
                        رفع تقرير مالي كـ JSON
                      </button>
                      <button
                        onClick={loadAllServicesData}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all"
                      >
                        <RefreshCw size={16} className={driveLoading ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Files List Table */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800">الملفات المتاحة في Drive:</h3>
                    {driveLoading ? (
                      <div className="py-12 text-center text-gray-400 font-bold flex flex-col items-center justify-center gap-3">
                        <RefreshCw size={24} className="animate-spin text-emerald-500" />
                        <span>جاري جلب الملفات من Google Drive...</span>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                        لا توجد ملفات حالية في حساب Drive الخاص بك.
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-slate-100 rounded-2xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-100 uppercase tracking-wider">
                              <tr>
                                <th className="p-4">اسم الملف</th>
                                <th className="p-4">النوع</th>
                                <th className="p-4">تاريخ التعديل</th>
                                <th className="p-4 text-center">الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {driveFiles.map(file => (
                                <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-4 font-black text-gray-900 flex items-center gap-2">
                                    <img src={file.iconLink} alt="icon" className="w-4 h-4" />
                                    <span className="truncate max-w-xs">{file.name}</span>
                                  </td>
                                  <td className="p-4 text-[10px] text-slate-400 font-bold">
                                    {file.mimeType.split('.').pop() || 'ملف سحابي'}
                                  </td>
                                  <td className="p-4 text-slate-500 font-bold">
                                    {new Date(file.modifiedTime).toLocaleDateString('ar-KW')}
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center justify-center gap-2">
                                      <a
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 bg-gray-50 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 rounded-lg transition-all"
                                        title="عرض الملف"
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                      <button
                                        onClick={() => handleDeleteFile(file.id, file.name)}
                                        className="p-1.5 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg transition-all"
                                        title="حذف الملف"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 3. GOOGLE DOCS */}
              {activeSubTab === 'docs' && (
                <motion.div
                  key="docs"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">مستندات Google Docs المطبوعة</h2>
                      <p className="text-xs text-gray-500 font-medium">إنشاء تقارير ومطابقات تصفية العهد المعتمدة</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Doc Settings Form */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500">عنوان المستند المستهدف:</label>
                        <input
                          type="text"
                          value={docTitle}
                          onChange={e => setDocTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500">اختر الموظف لتقرير التصفية والمطابقة:</label>
                        <select
                          value={selectedEmployeeForDoc}
                          onChange={e => setSelectedEmployeeForDoc(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                        >
                          {balances.map(emp => (
                            <option key={emp.name} value={emp.name}>{emp.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500">ملاحظات إضافية أو تقرير التدقيق:</label>
                        <textarea
                          placeholder="مثال: تم تدقيق الفواتير ومطابقتها مع السيولة المتبقية والمسلمة..."
                          value={docText}
                          onChange={e => setDocText(e.target.value)}
                          className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold resize-none"
                        />
                      </div>

                      <button
                        onClick={handleCreateDocReport}
                        disabled={docLoading}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl transition-all text-xs flex items-center justify-center gap-2"
                      >
                        {docLoading ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                        إنشاء المستند الرسمي في Google Docs
                      </button>
                    </div>

                    {/* Doc Preview Panel */}
                    <div className="p-6 bg-slate-900 text-slate-100 rounded-2xl flex flex-col justify-between border border-slate-800 shadow-inner relative overflow-hidden min-h-[300px]">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-xl"></div>
                      <div className="space-y-4 relative z-10">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                          نموذج المستند المنشأ
                        </span>
                        <h4 className="text-sm font-black text-white truncate">{docTitle}</h4>
                        <div className="text-[10px] text-slate-400 font-mono space-y-1 max-h-48 overflow-y-auto leading-relaxed p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                          <p className="font-bold text-white">محتوى المستند التلقائي:</p>
                          <p>كشف تصفية العهد المالية الرسمي للموظف: {selectedEmployeeForDoc || 'محدد'}</p>
                          <p>الرصيد الحالي المتبقي: (بيانات live بالكامل)</p>
                          <p>ملاحظة: {docText || 'تمت مطابقة الكشوفات والفواتير المرفقة وتبين صحة الأرصدة والسيولة المتبقية.'}</p>
                        </div>
                      </div>

                      {createdDocUrl && (
                        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between gap-3 relative z-10">
                          <span className="text-xs font-black text-emerald-400">تم إنشاء المستند بنجاح!</span>
                          <a
                            href={createdDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 shrink-0"
                          >
                            <ExternalLink size={12} />
                            عرض المستند الآن
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 4. GOOGLE TASKS */}
              {activeSubTab === 'tasks' && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">مهام التدقيق والعهد على Google Tasks</h2>
                      <p className="text-xs text-gray-500 font-medium font-black">جدولة مهام تسوية وصرف العهد المالي</p>
                    </div>
                    <button
                      onClick={loadAllServicesData}
                      className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all"
                    >
                      <RefreshCw size={16} className={tasksLoading ? "animate-spin" : ""} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    {/* Add Task Form */}
                    <form onSubmit={handleCreateTask} className="md:col-span-2 space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <h3 className="text-sm font-black text-slate-800">إضافة مهمة جديدة لـ Google Tasks</h3>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">قائمة المهام المستهدفة:</label>
                        <select
                          value={selectedTaskListId}
                          onChange={e => handleTaskListChange(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                        >
                          {taskLists.map(list => (
                            <option key={list.id} value={list.id}>{list.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">عنوان المهمة:</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: مطابقة عهدة الموظف أحمد"
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">تفاصيل أو ملاحظات المهمة:</label>
                        <textarea
                          placeholder="ملاحظات العهد والفواتير وموعد التصفية..."
                          value={newTaskNotes}
                          onChange={e => setNewTaskNotes(e.target.value)}
                          className="w-full h-20 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">تاريخ الاستحقاق:</label>
                        <input
                          type="date"
                          value={newTaskDue}
                          onChange={e => setNewTaskDue(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold text-slate-600"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={tasksLoading}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                      >
                        <Plus size={16} />
                        إرسال المهمة
                      </button>
                    </form>

                    {/* Task list view */}
                    <div className="md:col-span-3 space-y-4">
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <span>المهام المجدولة الحالية</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          {tasks.length} مهام
                        </span>
                      </h3>

                      {tasksLoading ? (
                        <div className="py-12 text-center text-gray-400 font-bold flex flex-col items-center justify-center gap-3">
                          <RefreshCw size={24} className="animate-spin text-emerald-500" />
                          <span>جاري جلب المهام...</span>
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                          لا توجد أي مهام معلقة في هذه القائمة على حساب Google Tasks الخاص بك.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                          {tasks.map(task => (
                            <div
                              key={task.id}
                              className="p-4 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl flex items-start justify-between gap-4 transition-all hover:translate-x-1"
                            >
                              <div className="space-y-1.5">
                                <h4 className="text-xs font-black text-gray-900 leading-snug">{task.title}</h4>
                                {task.notes && (
                                  <p className="text-[10px] text-gray-500 font-medium leading-relaxed max-w-sm">{task.notes}</p>
                                )}
                                {task.due && (
                                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                                    <Calendar size={10} />
                                    <span>تاريخ الاستحقاق: {new Date(task.due).toLocaleDateString('ar-KW')}</span>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => handleCompleteTask(task.id)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 shrink-0"
                              >
                                <Check size={12} />
                                إنجاز المهمة
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 5. GOOGLE CHAT */}
              {activeSubTab === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">تنبيهات وإشعارات Google Chat</h2>
                      <p className="text-xs text-gray-500 font-medium font-black">إرسال إشعارات العهد المالية فورياً للشركة وموظفيها</p>
                    </div>
                  </div>

                  {chatSuccessMessage && (
                    <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs font-bold leading-relaxed">
                      <CheckCircle className="shrink-0 text-emerald-600" size={18} />
                      <p>{chatSuccessMessage}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Alert Form */}
                    <form onSubmit={handleSendChatMessage} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500">اختر مساحة المحادثة أو القناة المستهدفة:</label>
                        <select
                          value={selectedSpace}
                          onChange={e => setSelectedSpace(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold"
                        >
                          {chatSpaces.map(space => (
                            <option key={space.name} value={space.name}>{space.displayName}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quick fill templates */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500">قوالب تعبئة سريعة للتنبيهات المعتمدة:</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => fillQuickAlert('general')}
                            className="px-3 py-1.5 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg text-[10px] font-black transition-all border border-slate-100"
                          >
                            📝 تقرير الأرصدة اليومي الكلي
                          </button>
                          <button
                            type="button"
                            onClick={() => fillQuickAlert('warning')}
                            className="px-3 py-1.5 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg text-[10px] font-black transition-all border border-slate-100"
                          >
                            ⚠️ تنبيه انخفاض عهد موظفين
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500">نص التنبيه المراد إرساله:</label>
                        <textarea
                          placeholder="مثال: تنبيه مالي بخصوص تحديث ميزانية العهد اليومية..."
                          required
                          value={chatMessage}
                          onChange={e => setChatMessage(e.target.value)}
                          className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs font-semibold resize-none font-mono leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={chatLoading || !chatMessage.trim()}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                      >
                        {chatLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                        إرسال الإشعار لـ Google Chat
                      </button>
                    </form>

                    {/* Simulation Info */}
                    <div className="p-6 bg-slate-900 text-slate-200 rounded-2xl flex flex-col justify-between border border-slate-800 shadow-inner relative overflow-hidden">
                      <div className="space-y-4">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                          معاينة شكل الإشعار المستلم
                        </span>
                        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-[10px] font-mono leading-relaxed space-y-2 whitespace-pre-wrap min-h-[160px]">
                          {chatMessage || 'سيظهر نص التنبيه المنسق والملون هنا قبل إرساله لقناة الشركة الرسمية...'}
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-slate-950/40 rounded-xl border border-slate-800/60 text-[9px] text-slate-400 leading-relaxed font-bold">
                        💡 يدعم هذا التكامل التنسيق الغني للمستندات (Markdown) كاستخدام النجوم (*) لتثخين الخطوط لإبراز الأرقام وتنبيهات الأرصدة المنخفضة للعهد.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
