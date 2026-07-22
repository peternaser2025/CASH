import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Users, CheckCircle2, AlertCircle, Loader2, ShieldCheck, UserCheck, Search, Trash2, Key, Copy, Check } from 'lucide-react';
import { gasService } from '../services/gasService';
import { EmployeeBalance } from '../types';

interface EmployeeManagerProps {
  balances: EmployeeBalance[];
  onRefresh: () => void;
}

export default function EmployeeManager({ balances, onRefresh }: EmployeeManagerProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const gasScriptCode = `/*
  ========================================================================
  كود الـ Google Apps Script الكامل والحديث للنظام المالي (إصدار متكامل تلقائي)
  ========================================================================
  1. افتح ملف Google Sheet (الاكسيل الخاص بك)
  2. اضغط على "Extensions" (الإضافات) ثم اختر "Apps Script"
  3. احذف أي كود قديم موجود هناك تماماً
  4. الصق هذا الكود بالكامل ومباشرة
  5. اضغط على زر الحفظ (أيقونة الديسك)
  6. اضغط على زر "Deploy" ثم "New Deployment"
  7. اختر نوع التثبيت "Web app"
  8. اضبط الخيارات التالية:
     - Execute as: "Me (بريدك الإلكتروني)"
     - Who has access: "Anyone"
  9. اضغط "Deploy" ووافق على الصلاحيات، ثم انسخ رابط الـ Web App وضعه في إعدادات النظام!
*/

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // تهيئة الجداول الرئيسية تلقائياً إن لم تكن موجودة
    getOrCreateBalancesSheet(ss);
    getOrCreateUsersSheet(ss);
    getOrCreateSettingsSheet(ss);
    
    if (method === "GET") {
      // إرجاع أرصدة الموظفين
      var balances = fetchBalances(ss);
      return ContentService.createTextOutput(JSON.stringify(balances))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers);
    }
    
    // POST request
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var result = { success: false, error: "عملية غير معروفة" };
    
    if (action === "login") {
      result = checkUserLogin(ss, requestData.email, requestData.password);
    } else if (action === "addUser") {
      result = addUser(ss, requestData.email, requestData.password, requestData.displayName, requestData.role);
    } else if (action === "addEmployee") {
      result = addEmployee(ss, requestData.name);
    } else if (action === "deleteEmployee") {
      result = deleteEmployee(ss, requestData.name);
    } else if (action === "add") {
      result = addTransaction(ss, requestData.data);
    } else if (action === "update") {
      result = updateTransaction(ss, requestData.id, requestData.data);
    } else if (action === "delete") {
      result = deleteTransaction(ss, requestData.id);
    } else if (action === "report") {
      result = generateReport(ss, requestData.filters);
    } else if (action === "getSettings") {
      result = getSettings(ss);
    } else if (action === "updateSettings") {
      result = updateSettings(ss, requestData.branches, requestData.categories);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  }
}

// إنشاء وتجهيز جدول المستخدمين تلقائياً
function getOrCreateUsersSheet(ss) {
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["Email", "Password", "DisplayName", "Role"]);
    sheet.appendRow(["peter_naser@yahoo.com", "P0182671648n$", "المدير العام (مسؤول)", "admin"]);
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#D5E8D4");
    sheet.setGridlinesActive(true);
  }
  return sheet;
}

// إنشاء وتجهيز جدول الأرصدة تلقائياً
function getOrCreateBalancesSheet(ss) {
  var sheet = ss.getSheetByName("Balances");
  if (!sheet) {
    sheet = ss.insertSheet("Balances");
    sheet.appendRow(["Employee", "Balance"]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#D5E8D4");
    sheet.setGridlinesActive(true);
  }
  return sheet;
}

// إنشاء وتجهيز جدول الإعدادات تلقائياً
function getOrCreateSettingsSheet(ss) {
  var sheet = ss.getSheetByName("Settings");
  if (!sheet) {
    sheet = ss.insertSheet("Settings");
    sheet.appendRow(["Key", "Value"]);
    sheet.appendRow(["Branches", "المكتب الرئيسي,فرع السالمية,فرع حولي,فرع الفروانية,فرع الأحمدي"]);
    sheet.appendRow(["Categories", "سلفة عهدة,تسوية مصروفات,تغذية نقدية,مشتريات مكتبية,صيانة,أخرى"]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#D5E8D4");
    sheet.setGridlinesActive(true);
  }
  return sheet;
}

// دالة التحقق من تسجيل الدخول
function checkUserLogin(ss, email, password) {
  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var dbEmail = String(data[i][0]).trim().toLowerCase();
    var dbPassword = String(data[i][1]).trim();
    var dbDisplayName = data[i][2] || "مسؤول النظام";
    var dbRole = data[i][3] || "user";
    
    if (dbEmail === String(email).trim().toLowerCase() && dbPassword === String(password).trim()) {
      return { success: true, displayName: dbDisplayName, role: dbRole };
    }
  }
  return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
}

// إضافة مستخدم جديد للنظام من لوحة التحكم تلقائياً
function addUser(ss, email, password, displayName, role) {
  var sheet = ss.getSheetByName("Users");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(email).trim().toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue(password);
      sheet.getRange(i + 1, 3).setValue(displayName);
      sheet.getRange(i + 1, 4).setValue(role);
      return { success: true, updated: true };
    }
  }
  sheet.appendRow([email, password, displayName, role]);
  return { success: true };
}

// دالة جلب الأرصدة وقائمة الموظفين
function fetchBalances(ss) {
  var sheet = ss.getSheetByName("Balances");
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0]).trim();
    var bal = parseFloat(data[i][1]) || 0;
    if (name) {
      list.push([name, bal]);
    }
  }
  return list;
}

// دالة جلب الإعدادات (الفروع والتصنيفات)
function getSettings(ss) {
  var sheet = ss.getSheetByName("Settings");
  var data = sheet.getDataRange().getValues();
  var branches = [];
  var categories = [];
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var val = String(data[i][1]).trim();
    if (key === "Branches") {
      branches = val.split(",").map(function(s) { return s.trim(); });
    } else if (key === "Categories") {
      categories = val.split(",").map(function(s) { return s.trim(); });
    }
  }
  return { branches: branches, categories: categories };
}

// تحديث الإعدادات
function updateSettings(ss, branches, categories) {
  var sheet = ss.getSheetByName("Settings");
  var data = sheet.getDataRange().getValues();
  var branchesStr = branches.join(",");
  var categoriesStr = categories.join(",");
  
  var branchFound = false;
  var catFound = false;
  
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    if (key === "Branches") {
      sheet.getRange(i + 1, 2).setValue(branchesStr);
      branchFound = true;
    } else if (key === "Categories") {
      sheet.getRange(i + 1, 2).setValue(categoriesStr);
      catFound = true;
    }
  }
  
  if (!branchFound) sheet.appendRow(["Branches", branchesStr]);
  if (!catFound) sheet.appendRow(["Categories", categoriesStr]);
  
  return { success: true };
}

// دالة إضافة موظف جديد وإنشاء التب الخاص به تلقائياً في ثوانٍ!
function addEmployee(ss, name) {
  name = String(name).trim();
  if (!name) return { success: false, error: "الاسم فارغ" };
  
  // إنشاء التب الخاص بالموظف تلقائياً
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // إضافة ترويسة الجدول المتوافقة تماماً مع الكشوفات والتقارير
    sheet.appendRow(["ID", "التاريخ", "الفرع", "البند", "البيان", "دائن (وارد)", "مدين (مصروف)", "الرصيد", "يخص شهر", "اسم الموظف"]);
    sheet.getRange("A1:J1").setFontWeight("bold").setBackground("#D5E8D4").setHorizontalAlignment("center");
    sheet.setGridlinesActive(true);
  }
  
  // إضافة الموظف إلى جدول الأرصدة بقيمة 0 إن لم يكن موجوداً
  var balancesSheet = ss.getSheetByName("Balances");
  var data = balancesSheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      found = true;
      break;
    }
  }
  if (!found) {
    balancesSheet.appendRow([name, 0]);
  }
  
  return { success: true };
}

// دالة حذف الموظف وتبويبه
function deleteEmployee(ss, name) {
  name = String(name).trim();
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  
  var balancesSheet = ss.getSheetByName("Balances");
  var data = balancesSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      balancesSheet.deleteRow(i + 1);
      break;
    }
  }
  return { success: true };
}

// دالة إضافة حركة مالية وتحديث رصيد الموظف
function addTransaction(ss, data) {
  var name = String(data.employee).trim();
  var sheet = ss.getSheetByName(name);
  
  // إذا لم يكن تب الموظف موجوداً، نقوم بإنشائه فوراً وتلقائياً!
  if (!sheet) {
    addEmployee(ss, name);
    sheet = ss.getSheetByName(name);
  }
  
  var id = new Date().getTime(); // رقم العملية الفريد
  var date = data.date || new Date().toISOString().split('T')[0];
  var branch = data.branch || "";
  var category = data.category || "";
  var description = data.description || "";
  var type = data.type || "Expense";
  var amount = parseFloat(data.amount) || 0;
  var targetMonth = data.targetMonth || "";
  
  var income = (type === "Income") ? amount : 0;
  var expense = (type === "Expense") ? amount : 0;
  
  // حساب الرصيد الجديد التراكمي للموظف
  var currentBalance = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    currentBalance = parseFloat(sheet.getRange(lastRow, 8).getValue()) || 0;
  }
  
  var newBalance = currentBalance + income - expense;
  
  // إضافة الحركة في سطر جديد
  sheet.appendRow([id, date, branch, category, description, income, expense, newBalance, targetMonth, name]);
  sheet.setGridlinesActive(true);
  
  // تحديث جدول الأرصدة الرئيسي
  updateEmployeeBalanceInSheet(ss, name, newBalance);
  
  return { success: true, id: id };
}

// دالة تحديث الرصيد للموظف في جدول Balances
function updateEmployeeBalanceInSheet(ss, name, balance) {
  var balancesSheet = ss.getSheetByName("Balances");
  var data = balancesSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      balancesSheet.getRange(i + 1, 2).setValue(balance);
      return;
    }
  }
  // إن لم يكن بالجدول نلحقه
  balancesSheet.appendRow([name, balance]);
}

// دالة تعديل حركة مالية مسجلة مسبقاً
function updateTransaction(ss, id, data) {
  var name = String(data.employee).trim();
  var sheet = ss.getSheetByName(name);
  if (!sheet) return { success: false, error: "ورقة العمل غير موجودة" };
  
  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      targetRow = i + 1;
      break;
    }
  }
  
  if (targetRow === -1) return { success: false, error: "لم يتم العثور على العملية للتحديث" };
  
  var type = data.type || "Expense";
  var amount = parseFloat(data.amount) || 0;
  var income = (type === "Income") ? amount : 0;
  var expense = (type === "Expense") ? amount : 0;
  
  // تعديل السطر المحدد
  sheet.getRange(targetRow, 2).setValue(data.date);
  sheet.getRange(targetRow, 3).setValue(data.branch);
  sheet.getRange(targetRow, 4).setValue(data.category);
  sheet.getRange(targetRow, 5).setValue(data.description);
  sheet.getRange(targetRow, 6).setValue(income);
  sheet.getRange(targetRow, 7).setValue(expense);
  sheet.getRange(targetRow, 9).setValue(data.targetMonth || "");
  
  // إعادة حساب كافة الأرصدة التراكمية في التب من البداية للنهاية لضمان سلامة الحسابات!
  recalculateSheetBalances(ss, name);
  
  return { success: true };
}

// دالة حذف حركة مالية
function deleteTransaction(ss, id) {
  // نبحث في جميع أوراق العمل عن الحركة بهذا الـ ID
  var sheets = ss.getSheets();
  var found = false;
  var empName = "";
  
  for (var k = 0; k < sheets.length; k++) {
    var sheet = sheets[k];
    var name = sheet.getName();
    if (["Users", "Balances", "Settings", "Dashboard"].indexOf(name) !== -1) continue;
    
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        empName = name;
        found = true;
        break;
      }
    }
    if (found) break;
  }
  
  if (found && empName) {
    // إعادة حساب الأرصدة
    recalculateSheetBalances(ss, empName);
    return { success: true };
  }
  
  return { success: false, error: "العملية غير موجودة" };
}

// دالة إعادة حساب الرصيد التراكمي لكافة العمليات وتحديث الرصيد الإجمالي
function recalculateSheetBalances(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return;
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    updateEmployeeBalanceInSheet(ss, name, 0);
    return;
  }
  
  var range = sheet.getRange(2, 6, lastRow - 1, 3); // دائن، مدين، الرصيد
  var values = range.getValues();
  var balance = 0;
  
  for (var i = 0; i < values.length; i++) {
    var inc = parseFloat(values[i][0]) || 0;
    var exp = parseFloat(values[i][1]) || 0;
    balance = balance + inc - exp;
    sheet.getRange(i + 2, 8).setValue(balance); // حفظ الرصيد في العمود الثامن
  }
  
  updateEmployeeBalanceInSheet(ss, name, balance);
}

// دالة توليد كشف الحساب والتقارير المالية
function generateReport(ss, filters) {
  var name = String(filters.employee || "").trim();
  var branch = String(filters.branch || "").trim();
  
  var rowsList = [];
  var totalIncome = 0;
  var totalExpense = 0;
  
  var targetSheets = [];
  if (name) {
    var s = ss.getSheetByName(name);
    if (s) targetSheets.push(s);
  } else {
    // إذا لم يحدد موظف، نبحث في كافة صفحات الموظفين
    var allSheets = ss.getSheets();
    for (var k = 0; k < allSheets.length; k++) {
      var n = allSheets[k].getName();
      if (["Users", "Balances", "Settings", "Dashboard"].indexOf(n) === -1) {
        targetSheets.push(allSheets[k]);
      }
    }
  }
  
  var filterStart = filters.startDate ? new Date(filters.startDate) : null;
  var filterEnd = filters.endDate ? new Date(filters.endDate) : null;
  if (filterEnd) filterEnd.setHours(23, 59, 59, 999);
  
  for (var sIdx = 0; sIdx < targetSheets.length; sIdx++) {
    var curSheet = targetSheets[sIdx];
    var data = curSheet.getDataRange().getValues();
    var empName = curSheet.getName();
    
    for (var i = 1; i < data.length; i++) {
      var rowId = data[i][0];
      var rowDateStr = data[i][1];
      var rowBranch = String(data[i][2]).trim();
      var rowCategory = String(data[i][3]).trim();
      var rowDesc = String(data[i][4]).trim();
      var rowInc = parseFloat(data[i][5]) || 0;
      var rowExp = parseFloat(data[i][6]) || 0;
      var rowBal = parseFloat(data[i][7]) || 0;
      var rowMonth = data[i][8] || "";
      
      var rowDate = new Date(rowDateStr);
      
      // تطبيق الفلاتر
      if (filterStart && rowDate < filterStart) continue;
      if (filterEnd && rowDate > filterEnd) continue;
      if (branch && rowBranch.toLowerCase() !== branch.toLowerCase()) continue;
      if (filters.type === "Income" && rowInc === 0) continue;
      if (filters.type === "Expense" && rowExp === 0) continue;
      
      totalIncome += rowInc;
      totalExpense += rowExp;
      
      rowsList.push({
        id: rowId,
        date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        branch: rowBranch,
        category: rowCategory,
        description: rowDesc,
        income: rowInc,
        expense: rowExp,
        balance: rowBal,
        targetMonth: rowMonth,
        employee: empName
      });
    }
  }
  
  // ترتيب العمليات حسب التاريخ تصاعدياً
  rowsList.sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  });
  
  return {
    rows: rowsList,
    summary: {
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      netBalance: totalIncome - totalExpense
    }
  };
}
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const filteredBalances = balances.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setStatus(null);
    
    const result = await gasService.addEmployee(name.trim());
    
    if (result.success) {
      setStatus({ type: 'success', message: 'تم إضافة الموظف بنجاح إلى قاعدة البيانات' });
      setName('');
      onRefresh();
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ type: 'error', message: result.error || 'حدث خطأ أثناء الإضافة' });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">إدارة الموظفين والعهد</h2>
          <p className="text-gray-500 mt-2 font-medium">إضافة موظفين جدد، متابعة صلاحياتهم، ومراقبة أرصدة العهد النشطة</p>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي المسجلين</p>
            <p className="text-xl font-black text-gray-900">{balances.length} موظف</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Add Employee Form - Hero Style */}
        <div className="lg:col-span-1">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 space-y-8 sticky top-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">إضافة موظف</h3>
                <p className="text-xs font-bold text-gray-400">تسجيل عهدة جديدة</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">الاسم الكامل للموظف</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد علي..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                />
              </div>

              <AnimatePresence>
                {status && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl flex items-center gap-3 border ${
                      status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-800 border-red-100'
                    }`}
                  >
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-xs font-black">{status.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gray-900 text-white rounded-[2rem] font-black text-lg hover:bg-emerald-600 transition-all disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-3 shadow-xl shadow-gray-900/20 active:scale-95"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <UserPlus size={24} />}
                تأكيد الإضافة
              </button>
            </form>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex gap-3 items-start">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
                  تنبيه: سيتم إنشاء ورقة عمل (Sheet) جديدة لهذا الموظف تلقائياً في النظام لمتابعة حركته المالية.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Excel Users Database Instruction Guide */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 bg-slate-900 text-slate-100 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">إدارة الدخول عبر Excel</h3>
                <p className="text-xs font-bold text-slate-400">إعداد صفحة الايميلات والباسورد</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              لقد قمنا بربط نظام تسجيل الدخول بقاعدة البيانات الخاصة بك في جوجل شيت (Excel). 
              سيقوم النظام بإنشاء ورقة عمل باسم <code className="bg-slate-950 px-2 py-1 rounded text-emerald-400 font-bold">Users</code> تلقائياً وتجهيز حساب الأدمن <code className="bg-slate-950 px-2 py-1 rounded text-emerald-400 font-bold">peter_naser@yahoo.com</code>.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-400 px-1">
                <span>الكود المطلوب إضافته في Google Apps Script:</span>
                <button 
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all active:scale-95"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "تم النسخ!" : "نسخ الكود البرمجي"}
                </button>
              </div>

              <div className="relative">
                <pre className="bg-slate-950 p-4 rounded-2xl text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                  {gasScriptCode}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
              <span className="text-[10px] font-bold text-emerald-400 leading-relaxed block">
                💡 بمجرد حفظ هذا الكود ونشره كـ (Web App)، يمكنك فتح ملف Excel وستجد ورقة عمل جديدة تسمى "Users" تتيح لك إضافة أي إيميل وباسورد وتحديد صلاحياته ليعمل في النظام فوراً!
              </span>
            </div>
          </motion.div>
        </div>

        {/* Employee List - Hero Style */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-gray-50 text-gray-400 rounded-xl">
              <Search size={20} />
            </div>
            <input 
              type="text"
              placeholder="ابحث عن موظف بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-bold text-gray-900 placeholder:text-gray-300"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                <h3 className="text-xl font-black text-gray-900">قائمة الموظفين المعتمدين</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-50">
                    <th className="px-8 py-6">الموظف</th>
                    <th className="px-8 py-6">حالة الحساب</th>
                    <th className="px-8 py-6">الرصيد التراكمي</th>
                    <th className="px-8 py-6 text-left">إدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBalances.map((emp, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg group-hover:bg-emerald-500 group-hover:text-white transition-all">
                            {emp.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-gray-900 text-lg">{emp.name}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                              <UserCheck size={10} />
                              هوية مالية نشطة
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                          <CheckCircle2 size={12} />
                          حساب نشط
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className={`text-xl font-black font-mono ${emp.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {emp.balance.toFixed(3)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">د.ك</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-left">
                        <button 
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من حذف الموظف ${emp.name}؟ سيتم حذف كافة بياناته!`)) {
                              setLoading(true);
                              const res = await gasService.deleteEmployee(emp.name);
                              if (res.success) {
                                onRefresh();
                              } else {
                                alert('خطأ في الحذف: ' + res.error);
                              }
                              setLoading(false);
                            }
                          }}
                          className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredBalances.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-4">
                          <Search size={48} className="opacity-10" />
                          <p className="font-bold text-lg italic">لا توجد نتائج مطابقة للبحث</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
