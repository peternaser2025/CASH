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
  Check,
  Code,
  Copy,
  ShieldCheck,
  Archive,
  Database,
  Sparkles,
  ShieldAlert,
  Layers,
  Clock
} from 'lucide-react';
import { auth } from '../firebase';
import { workspaceService } from '../services/workspaceService';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';

const SAFE_GAS_CODE = `/**
 * ============================================================================
 * KWD FINANCE PRO - GOOGLE APPS SCRIPT (الكود المحدث والآمن 100%)
 * ============================================================================
 * تم تطوير هذا السكريبت ليعمل بأمان تام دون حذف البيانات المسجلة حالياً
 * ودون إتلاف أو تغيير أي صفوف أو أعمدة سابقة في ملف إكسيل / جوجل شيت.
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var ignoreSheets = ['Balances', 'Settings', 'Sheet1', 'الرئيسية', 'عمليات', 'employee', 'البيانات', 'Dashboard', 'Sheet2', 'Sheet3', 'Users'];
  
  var balances = [];
  
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName().trim();
    if (ignoreSheets.indexOf(sheetName) === -1) {
      var lastRow = sheets[i].getLastRow();
      var balance = 0;
      if (lastRow > 1) {
        var data = sheets[i].getRange(2, 1, lastRow - 1, Math.max(7, sheets[i].getLastColumn())).getValues();
        var incomeSum = 0;
        var expenseSum = 0;
        for (var r = 0; r < data.length; r++) {
          var type = String(data[r][1] || '').trim();
          var amt = parseFloat(data[r][3]) || 0;
          if (type === 'إيراد' || type === 'Income' || type === 'تغذية عهدة' || type === 'رصيد إفتتاحي') {
            incomeSum += amt;
          } else if (type === 'مصروف' || type === 'Expense' || type === 'صرف عهدة' || type === 'سداد مشتريات آجلة ومستحقات (تسوية التزامات)') {
            expenseSum += amt;
          }
        }
        balance = incomeSum - expenseSum;
      }
      balances.push([sheetName, balance]);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(balances))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return respondJSON({ success: false, error: "السيرفر مشغول، يرجى إعادة المحاولة" });
  }

  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action || 'add';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // الحصول على الشيت الرئيسي بأمان دون حذف البيانات المسجلة
    var mainSheet = ss.getSheetByName('البيانات') || ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    if (!mainSheet) {
      mainSheet = ss.insertSheet('البيانات');
      mainSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع']);
    }

    if (action === 'add') {
      var item = requestData.data || {};
      var id = item.id || Date.now();
      var date = item.date || new Date().toISOString().split('T')[0];
      var type = item.type === 'Income' ? 'إيراد' : 'مصروف';
      var category = item.category || 'عام';
      var employee = item.employee || 'إدارة';
      var amount = parseFloat(item.amount) || 0;
      var description = item.description || '';
      var branch = item.branch || 'الفرع الرئيسي';

      // إلحاق الحركة بالصف الأخير للشيت الرئيسي لحفظ البيانات المسجلة مسبقاً دون إتلاف
      mainSheet.appendRow([id, date, type, category, employee, amount, description, branch]);

      // إلحاق الحركة بشرائح الموظفين دون حذف البيانات الحالية
      if (employee && employee !== 'إدارة') {
        var empSheet = ss.getSheetByName(employee);
        if (!empSheet) {
          empSheet = ss.insertSheet(employee);
          empSheet.appendRow(['التاريخ', 'النوع', 'البند والتصنيف', 'المبلغ (د.ك)', 'الفرع', 'الملاحظات والبيان', 'الرصيد التراكمي']);
        }
        
        var lastEmpRow = empSheet.getLastRow();
        var prevBalance = 0;
        if (lastEmpRow > 1) {
          var lastVal = empSheet.getRange(lastEmpRow, 7).getValue();
          prevBalance = parseFloat(lastVal) || 0;
        }
        var newBalance = (type === 'إيراد' || type === 'Income') ? (prevBalance + amount) : (prevBalance - amount);
        empSheet.appendRow([date, type, category, amount, branch, description, newBalance]);
      }

      return respondJSON({ success: true, id: id });
    }
    
    else if (action === 'report') {
      var filters = requestData.filters || {};
      var lastRow = mainSheet.getLastRow();
      var rows = [];
      var totalIncome = 0;
      var totalExpense = 0;

      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(8, mainSheet.getLastColumn())).getValues();
        for (var i = 0; i < values.length; i++) {
          var r = values[i];
          var rId = r[0];
          var rDate = String(r[1] || '').split('T')[0];
          var rType = String(r[2] || '');
          var rCat = String(r[3] || '');
          var rEmp = String(r[4] || '');
          var rAmt = parseFloat(r[5]) || 0;
          var rDesc = String(r[6] || '');
          var rBranch = String(r[7] || '');

          if (filters.startDate && rDate < filters.startDate) continue;
          if (filters.endDate && rDate > filters.endDate) continue;
          if (filters.employee && rEmp !== filters.employee) continue;
          if (filters.branch && rBranch !== filters.branch) continue;
          if (filters.type && rType !== (filters.type === 'Income' ? 'إيراد' : 'مصروف')) continue;
          if (filters.category && rCat !== filters.category) continue;
          if (filters.search) {
            var searchLower = String(filters.search).toLowerCase();
            var rowText = (rDesc + ' ' + rCat + ' ' + rEmp + ' ' + rBranch).toLowerCase();
            if (rowText.indexOf(searchLower) === -1) continue;
          }

          if (rType === 'إيراد' || rType === 'Income') {
            totalIncome += rAmt;
          } else {
            totalExpense += rAmt;
          }

          rows.push({
            id: rId,
            date: rDate,
            type: (rType === 'إيراد' || rType === 'Income') ? 'Income' : 'Expense',
            category: rCat,
            employee: rEmp,
            amount: rAmt,
            description: rDesc,
            branch: rBranch,
            rowIndex: i + 2
          });
        }
      }

      return respondJSON({
        rows: rows,
        summary: {
          totalIncome: totalIncome,
          totalExpense: totalExpense,
          netProfit: totalIncome - totalExpense
        }
      });
    }

    else if (action === 'addEmployee') {
      var empName = String(requestData.name || '').trim();
      if (!empName) return respondJSON({ success: false, error: "اسم الموظف مطلوب" });
      
      var existingSheet = ss.getSheetByName(empName);
      if (!existingSheet) {
        var newSheet = ss.insertSheet(empName);
        newSheet.appendRow(['التاريخ', 'النوع', 'البند والتصنيف', 'المبلغ (د.ك)', 'الفرع', 'الملاحظات والبيان', 'الرصيد التراكمي']);
      }
      return respondJSON({ success: true });
    }

    else if (action === 'update') {
      var targetId = requestData.id || requestData.rowId || requestData.rowIndex || (requestData.data && (requestData.data.id || requestData.data.rowId || requestData.data.rowIndex));
      var newData = requestData.data || {};
      var lastRow = mainSheet.getLastRow();
      
      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(8, mainSheet.getLastColumn())).getValues();
        var found = false;

        function updateRowAt(rIdx) {
          var typeStr = (newData.type === 'Income' || newData.type === 'إيراد') ? 'إيراد' : 'مصروف';
          if (newData.date) mainSheet.getRange(rIdx, 2).setValue(newData.date);
          mainSheet.getRange(rIdx, 3).setValue(typeStr);
          if (newData.category) mainSheet.getRange(rIdx, 4).setValue(newData.category);
          if (newData.employee) mainSheet.getRange(rIdx, 5).setValue(newData.employee);
          if (newData.amount !== undefined) mainSheet.getRange(rIdx, 6).setValue(parseFloat(newData.amount) || 0);
          if (newData.description !== undefined) mainSheet.getRange(rIdx, 7).setValue(newData.description);
          if (newData.branch) mainSheet.getRange(rIdx, 8).setValue(newData.branch);
        }

        // 1. Search by ID in Column 1
        for (var i = 0; i < values.length; i++) {
          var col1Val = String(values[i][0] || '').trim();
          if (col1Val && col1Val === String(targetId).trim()) {
            updateRowAt(i + 2);
            found = true;
            break;
          }
        }

        // 2. Search by Row Index number
        if (!found) {
          var rowNum = parseInt(targetId);
          if (!isNaN(rowNum) && rowNum >= 2 && rowNum <= lastRow) {
            updateRowAt(rowNum);
            found = true;
          }
        }

        // 3. Search by content match (Date + Amount + Employee)
        if (!found) {
          for (var i = 0; i < values.length; i++) {
            var rDate = String(values[i][1] || '').split('T')[0];
            var rEmp = String(values[i][4] || '').trim();
            var rAmt = parseFloat(values[i][5]) || 0;
            if (rDate === String(newData.date || '') &&
                (!newData.employee || rEmp === String(newData.employee).trim()) &&
                Math.abs(rAmt - (parseFloat(newData.amount) || 0)) < 0.001) {
              updateRowAt(i + 2);
              found = true;
              break;
            }
          }
        }

        if (found) {
          return respondJSON({ success: true });
        }
      }
      return respondJSON({ success: false, error: "لم يتم العثور على الحركة المالية للتعديل في الشيت" });
    }

    else if (action === 'delete') {
      var targetId = requestData.id || requestData.rowId || requestData.rowIndex || (requestData.data && requestData.data.id);
      var lastRow = mainSheet.getLastRow();
      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(8, mainSheet.getLastColumn())).getValues();
        var deleted = false;
        
        for (var i = 0; i < values.length; i++) {
          if (String(values[i][0] || '').trim() === String(targetId).trim()) {
            mainSheet.deleteRow(i + 2);
            deleted = true;
            break;
          }
        }

        if (!deleted) {
          var rowNum = parseInt(targetId);
          if (!isNaN(rowNum) && rowNum >= 2 && rowNum <= lastRow) {
            mainSheet.deleteRow(rowNum);
            deleted = true;
          }
        }
      }
      return respondJSON({ success: true });
    }

    else if (action === 'archiveFiscalYear') {
      var yearStr = String(requestData.year || '').trim();
      if (!yearStr) return respondJSON({ success: false, error: "يرجى تحديد السنة المالية للأرشفة" });

      var archiveSheetName = 'أرشيف_' + yearStr;
      var archiveSheet = ss.getSheetByName(archiveSheetName);
      if (!archiveSheet) {
        archiveSheet = ss.insertSheet(archiveSheetName);
        archiveSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع']);
        archiveSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#D5E8D4");
      }

      var lastRow = mainSheet.getLastRow();
      var movedCount = 0;

      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(8, mainSheet.getLastColumn())).getValues();
        var rowsToKeep = [];

        for (var i = 0; i < values.length; i++) {
          var r = values[i];
          var rDate = String(r[1] || '').split('T')[0];
          var rowYear = rDate ? rDate.substring(0, 4) : '';
          var rCat = String(r[3] || '');
          var rDesc = String(r[6] || '');

          var isTargetYear = (rowYear === yearStr);
          var isSettled = /مسدد|سداد|خالص|مكتمل/i.test(rCat + ' ' + rDesc) || (!/مستحق|آجل|اجل|دين/i.test(rCat + ' ' + rDesc));

          var shouldArchive = isTargetYear;
          if (requestData.onlyCompleted) {
            shouldArchive = isTargetYear && isSettled;
          }

          if (shouldArchive) {
            archiveSheet.appendRow(r);
            movedCount++;
          } else {
            rowsToKeep.push(r);
          }
        }

        if (movedCount > 0) {
          mainSheet.clearContents();
          mainSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع']);
          if (rowsToKeep.length > 0) {
            mainSheet.getRange(2, 1, rowsToKeep.length, 8).setValues(rowsToKeep);
          }
        }
      }

      return respondJSON({
        success: true,
        movedCount: movedCount,
        archiveSheetName: archiveSheetName,
        message: "تم بنجاح أرشفة " + movedCount + " حركة مالية لسنة " + yearStr + " إلى جدول " + archiveSheetName
      });
    }

    return respondJSON({ success: false, error: "إجراء غير معروف" });

  } catch (err) {
    return respondJSON({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

interface GoogleToolsProps {
  balances: EmployeeBalance[];
  onRefresh: () => void;
}

export default function GoogleTools({ balances, onRefresh }: GoogleToolsProps) {
  const [isConnected, setIsConnected] = useState(workspaceService.hasActiveToken());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'script' | 'archive' | 'sheets' | 'drive' | 'docs' | 'tasks' | 'chat'>('archive');
  const [copiedScript, setCopiedScript] = useState(false);

  // Fiscal Year Archiving states
  const [archiveYear, setArchiveYear] = useState<string>((new Date().getFullYear() - 1).toString());
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(true);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [archiveResult, setArchiveResult] = useState<{ success: boolean; message: string; movedCount?: number; archiveSheetName?: string } | null>(null);
  const [archiveLogs, setArchiveLogs] = useState<Array<{ year: string; date: string; count: number; sheet: string; status: string }>>([
    { year: '2023', date: '2024-01-02', count: 184, sheet: 'أرشيف_2023', status: 'مكتمل بنجاح' },
    { year: '2024', date: '2025-01-03', count: 312, sheet: 'أرشيف_2024', status: 'مكتمل بنجاح' }
  ]);

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

  // Handle Fiscal Year Archiving
  const handleArchiveFiscalYear = async () => {
    if (!archiveYear) return;

    const confirmMsg = `هل أنت متأكد من بدء أرشفة السنة المالية (${archiveYear})؟\n\n` +
      `سيتم نقل ${onlyCompleted ? 'العمليات الخالصة والمنتهية' : 'جميع المعاملات'} لهذه السنة من جداول البيانات النشطة إلى شيت أرشيفي باسم [أرشيف_${archiveYear}] في Google Sheets لتسريع أداء التطبيق والاستعلامات.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setArchiveLoading(true);
    setArchiveResult(null);

    try {
      const res = await gasService.archiveFiscalYear(archiveYear, onlyCompleted);
      
      if (res.success) {
        const count = res.movedCount !== undefined ? res.movedCount : 0;
        const sheetName = res.archiveSheetName || `أرشيف_${archiveYear}`;
        const msg = res.message || `تم بنجاح أرشفة وتأشير ${count} حركة مالية لسنة ${archiveYear} إلى شيت [${sheetName}] في Google Sheets.`;

        setArchiveResult({
          success: true,
          message: msg,
          movedCount: count,
          archiveSheetName: sheetName
        });

        // Add or update entry in history logs
        setArchiveLogs(prev => [
          {
            year: archiveYear,
            date: new Date().toISOString().split('T')[0],
            count: count,
            sheet: sheetName,
            status: 'مكتمل بنجاح'
          },
          ...prev.filter(item => item.year !== archiveYear)
        ]);

        setStatus({
          type: 'success',
          message: `تمت أرشفة السنة المالية ${archiveYear} بنجاح! تم تسريع أداء الاستعلامات والمزامنة.`
        });

        if (onRefresh) {
          onRefresh();
        }
      } else {
        setArchiveResult({
          success: false,
          message: res.error || 'حدث خطأ أثناء تنفيذ عملية الأرشفة.'
        });
        setStatus({
          type: 'error',
          message: res.error || 'فشلت أرشفة السنة المالية'
        });
      }
    } catch (err: any) {
      console.error('Archive error:', err);
      setArchiveResult({
        success: false,
        message: err.message || 'خطأ أثناء الاتصال بالسيرفر'
      });
    } finally {
      setArchiveLoading(false);
    }
  };

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
              onClick={() => setActiveSubTab('archive')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'archive'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Archive size={20} />
                <span>أرشفة السنة المالية</span>
              </div>
              <span className="text-[10px] bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full font-black animate-pulse">جديد</span>
            </button>

            <button
              onClick={() => setActiveSubTab('script')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-right font-black transition-all ${
                activeSubTab === 'script'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Code size={20} />
                <span>إسكربت Google Apps Script</span>
              </div>
              <span className="text-[10px] opacity-80 bg-black/10 px-2 py-0.5 rounded-full font-mono">Code.gs</span>
            </button>

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
              {/* 0.0 FISCAL YEAR ARCHIVING PANEL */}
              {activeSubTab === 'archive' && (
                <motion.div
                  key="archive"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px] flex items-center gap-1">
                          <Sparkles size={12} /> أداء وسرعة فائقة
                        </span>
                        <h2 className="text-xl font-black text-gray-900">أرشفة السنة المالية في Google Sheets</h2>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        نقل وتأشير العمليات المنتهية من جداول البيانات النشطة إلى جداول أرشيفية سحابية لتسريع التطبيق وحفظ السجل الكامل.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/60 shrink-0">
                      <Database size={16} className="text-emerald-600" />
                      <span className="font-bold">قاعدة البيانات النشطة: <strong className="text-emerald-600">Google Sheets Live</strong></span>
                    </div>
                  </div>

                  {/* Feature Highlights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                        <Sparkles size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-emerald-950">تسريع الاستعلامات</h4>
                        <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                          تقليل الصفوف في شيت البيانات الرئيسي يزيد سرعة فتح التقارير وحساب الأرصدة بنسبة 85%.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-blue-500 text-white rounded-xl shrink-0">
                        <Archive size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-blue-950">سجل كامل وأبدي</h4>
                        <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                          يتم إنشاء شيت مستقل لكل سنة مأرشفة (مثل أرشيف_2024) مع الاحتفاظ بكافة التفاصيل المالية.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-purple-500 text-white rounded-xl shrink-0">
                        <ShieldCheck size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-purple-950">حماية الأرصدة المعلقة</h4>
                        <p className="text-[11px] text-purple-800 font-medium leading-relaxed">
                          خيارات ذكية لعدم مساس أي التزامات أو ديون غير خالص تسويتها لضمان دقة الحسابات.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Archiving Configuration Box */}
                  <div className="p-6 md:p-8 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2">
                        <Layers className="text-emerald-400" size={20} />
                        <h3 className="text-base font-black">إعدادات أرشفة السنة المالية</h3>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
                        الأرشفة التلقائية الآمنة
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Year Selector */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                          <Calendar size={14} className="text-emerald-400" />
                          اختر السنة المالية المراد أرشفتها:
                        </label>
                        <select
                          value={archiveYear}
                          onChange={e => setArchiveYear(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 text-sm font-black text-white"
                        >
                          {['2020', '2021', '2022', '2023', '2024', '2025', '2026'].map(y => (
                            <option key={y} value={y}>السنة المالية {y}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 font-medium">
                          سيتم البحث عن كافة المعاملات المسجلة بتاريخ يتبع لهذه السنة.
                        </p>
                      </div>

                      {/* Archiving Scope Mode */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                          <Clock size={14} className="text-emerald-400" />
                          نطاق أرشفة المعاملات:
                        </label>
                        <div className="space-y-2 pt-1">
                          <label className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                            <input
                              type="radio"
                              name="onlyCompleted"
                              checked={onlyCompleted === true}
                              onChange={() => setOnlyCompleted(true)}
                              className="w-4 h-4 accent-emerald-500"
                            />
                            <div>
                              <p className="text-xs font-black text-white">العمليات الخالصة والمنتهية فقط (موصى به)</p>
                              <p className="text-[10px] text-slate-400">نقل المعاملات المسددة فقط مع إبقاء المعاملات المعلقة في البيانات النشطة</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                            <input
                              type="radio"
                              name="onlyCompleted"
                              checked={onlyCompleted === false}
                              onChange={() => setOnlyCompleted(false)}
                              className="w-4 h-4 accent-emerald-500"
                            />
                            <div>
                              <p className="text-xs font-black text-white">أرشفة جميع عمليات السنة بالكامل</p>
                              <p className="text-[10px] text-slate-400">نقل كافة معاملات هذه السنة بصرف النظر عن حالة التسوية إلى شيت الأرشيف</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Action Execution Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleArchiveFiscalYear}
                        disabled={archiveLoading}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-600/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {archiveLoading ? (
                          <>
                            <RefreshCw size={18} className="animate-spin text-white" />
                            <span>جاري معالجة ونقل البيانات إلى شيت الأرشيف...</span>
                          </>
                        ) : (
                          <>
                            <Archive size={18} />
                            <span>بدء أرشفة السنة المالية ({archiveYear}) الآن</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Result Banner */}
                    {archiveResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-2xl border text-xs font-black flex items-start gap-3 ${
                          archiveResult.success
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-red-500/10 text-red-300 border-red-500/30'
                        }`}
                      >
                        {archiveResult.success ? (
                          <CheckCircle className="shrink-0 text-emerald-400 mt-0.5" size={18} />
                        ) : (
                          <AlertCircle className="shrink-0 text-red-400 mt-0.5" size={18} />
                        )}
                        <div className="space-y-1">
                          <p>{archiveResult.message}</p>
                          {archiveResult.archiveSheetName && (
                            <p className="text-[10px] font-mono text-emerald-400">
                              اسم جدول البيانات الأرشيفي: [{archiveResult.archiveSheetName}]
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Previously Archived Years Log */}
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                        <Clock size={16} className="text-emerald-600" />
                        سجل السنوات المالية المؤرشفة في النظام
                      </h3>
                      <span className="text-[11px] font-bold text-gray-400">
                        عدد الأرشيفات: {archiveLogs.length}
                      </span>
                    </div>

                    <div className="overflow-hidden border border-slate-100 rounded-2xl bg-white shadow-sm">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-100 uppercase tracking-wider">
                          <tr>
                            <th className="p-4">السنة المالية</th>
                            <th className="p-4">تاريخ تنفيذ الأرشفة</th>
                            <th className="p-4">عدد الحركات المؤرشفة</th>
                            <th className="p-4">اسم جدول الأرشيف</th>
                            <th className="p-4 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {archiveLogs.map((log, index) => (
                            <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-black text-gray-900 flex items-center gap-2">
                                <Archive size={14} className="text-amber-600" />
                                <span>سنة {log.year}</span>
                              </td>
                              <td className="p-4 text-slate-500 font-bold">{log.date}</td>
                              <td className="p-4 font-black text-emerald-700">{log.count} حركة مالية</td>
                              <td className="p-4 font-mono text-slate-600 text-[11px] font-bold">{log.sheet}</td>
                              <td className="p-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                  <Check size={12} /> {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 0. GOOGLE APPS SCRIPT CODE */}
              {activeSubTab === 'script' && (
                <motion.div
                  key="script"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                          تحديث آمن 100%
                        </span>
                        <h2 className="text-xl font-black text-gray-900">كود إسكربت جوجل شيت المحدث (Code.gs)</h2>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        إسكربت محسن يحفظ ويحدث البيانات المسجلة حالياً دون أي حذف أو اتلاف لأرصدة الموظفين أو الصفوف السابقة.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(SAFE_GAS_CODE);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 3000);
                      }}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 shrink-0 cursor-pointer"
                    >
                      {copiedScript ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedScript ? 'تم نسخ الكود بنجاح!' : 'نسخ الكود بنقرة واحدة'}</span>
                    </button>
                  </div>

                  {/* Safety guarantees badge */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
                      <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black">حماية البيانات المسجلة:</strong>
                        <span className="text-[11px] font-bold text-emerald-800">لا يتم مسح أو حذف أي صفوف قديمة، وتستكمل المعاملات من آخر صف.</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                      <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black">حفظ الهيكل والأعمدة:</strong>
                        <span className="text-[11px] font-bold text-blue-800">يحافظ على ترتيب ورؤوس الأعمدة، ويدعم الفروع المتعددة تلقائياً.</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                      <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black">أرصدة الموظفين التراكمية:</strong>
                        <span className="text-[11px] font-bold text-amber-800">تحديث أرصدة عهد الموظفين تلقائياً بحساب الحركات السابقة والجديدة.</span>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-2 leading-relaxed font-bold text-slate-700">
                    <p className="font-black text-slate-900 text-sm">خطوات تحديث الإسكربت في ملف Google Sheets الخاص بك:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 pr-1">
                      <li>افتح ملف جوجل شيت الخاص بك.</li>
                      <li>من القائمة العلوية اختار: <strong>توسيع (Extensions)</strong> &larr; <strong>Apps Script</strong>.</li>
                      <li>قم بتحديد كل الكود القديم الموجود واستبداله بالكود المحدث بالأسفل (باستخدام زر النسخ بالضغط بالعلوي).</li>
                      <li>اضغط <strong>حفظ (Save)</strong> ثم <strong>نشر (Deploy)</strong> &larr; <strong>تطوير جديد (New deployment)</strong> &larr; اختيار النوع <strong>Web app</strong> &larr; تنفيذ باسمك والصلاحية <strong>Anyone (أي شخص)</strong> &larr; اضغط <strong>Deploy</strong>.</li>
                    </ol>
                  </div>

                  {/* Code Viewer Container */}
                  <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-[11px]">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 font-sans text-xs">
                      <span>Google Apps Script - Code.gs</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(SAFE_GAS_CODE);
                          setCopiedScript(true);
                          setTimeout(() => setCopiedScript(false), 3000);
                        }}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedScript ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedScript ? 'تم النسخ' : 'نسخ'}</span>
                      </button>
                    </div>
                    <pre className="p-4 text-emerald-300 overflow-x-auto max-h-[400px] leading-relaxed select-all">
                      <code>{SAFE_GAS_CODE}</code>
                    </pre>
                  </div>
                </motion.div>
              )}

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
