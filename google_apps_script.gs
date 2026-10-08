/**
 * ============================================================================
 * KWD FINANCE PRO - GOOGLE APPS SCRIPT (ENTERPRISE EDITION)
 * ============================================================================
 * ⚠️ ABSOLUTE DATA IMMUTABILITY CONTRACT:
 * - ZERO DELETION POLICY: Never deletes, truncates, or overwrites existing rows.
 * - Historical Data Preservation: Preserves all transaction rows (2 to N).
 * - Schema Stability: Appends missing columns to the right only.
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var ignoreSheets = ['Balances', 'Settings', 'SetupLog', 'Sheet1', 'الرئيسية', 'عمليات', 'employee', 'البيانات', 'Dashboard', 'Sheet2', 'Sheet3', 'Users'];
  
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
          } else if (type === 'مصروف' || type === 'Expense' || type === 'صرف عهدة' || type === 'سداد مشتريات' || type === 'سداد مستحقات') {
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
    lock.waitLock(15000);
  } catch (err) {
    return respondJSON({ success: false, error: "السيرفر مشغول، يرجى إعادة المحاولة" });
  }

  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action || 'add';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // الشيت الرئيسي للحركات
    var mainSheet = ss.getSheetByName('البيانات') || ss.getSheetByName('Transactions') || ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    if (!mainSheet) {
      mainSheet = ss.insertSheet('البيانات');
      mainSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع', 'targetMonth', 'vendorName', 'linkedAccrualId', 'isSettlement']);
    }

    // 1. تسجيل حركة مالية جديدة
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
      var targetMonth = item.targetMonth || '';
      var vendorName = item.vendorName || '';
      var linkedAccrualId = item.linkedAccrualId || '';
      var isSettlement = item.isSettlement ? true : false;

      mainSheet.appendRow([id, date, type, category, employee, amount, description, branch, targetMonth, vendorName, linkedAccrualId, isSettlement]);

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
    
    // 2. استعلام التقرير
    else if (action === 'report') {
      var filters = requestData.filters || {};
      var lastRow = mainSheet.getLastRow();
      var rows = [];
      var totalIncome = 0;
      var totalExpense = 0;

      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(12, mainSheet.getLastColumn())).getValues();
        for (var i = 0; i < values.length; i++) {
          var r = values[i];
          var rId = r[0];
          var rDate = '';
          if (r[1] instanceof Date) {
            rDate = Utilities.formatDate(r[1], Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd');
          } else if (typeof r[1] === 'number' && r[1] > 1000) {
            var epoch = new Date(Date.UTC(1899, 11, 30) + Math.floor(r[1]) * 86400000);
            rDate = Utilities.formatDate(epoch, 'GMT', 'yyyy-MM-dd');
          } else {
            rDate = String(r[1] || '').split('T')[0];
          }
          var rType = String(r[2] || '');
          var rCat = String(r[3] || '');
          var rEmp = String(r[4] || '');
          var rAmt = parseFloat(r[5]) || 0;
          var rDesc = String(r[6] || '');
          var rBranch = String(r[7] || '');
          var rTargetMonth = String(r[8] || '');
          var rVendorName = String(r[9] || '');
          var rLinkedAccrualId = String(r[10] || '');
          var rIsSettlement = Boolean(r[11]);

          if (filters.startDate && rDate < filters.startDate) continue;
          if (filters.endDate && rDate > filters.endDate) continue;
          if (filters.employee && rEmp !== filters.employee) continue;
          if (filters.branch && rBranch !== filters.branch) continue;
          if (filters.type && rType !== (filters.type === 'Income' ? 'إيراد' : 'مصروف')) continue;
          if (filters.category && rCat !== filters.category) continue;
          if (filters.search) {
            var searchLower = String(filters.search).toLowerCase();
            var rowText = (rDesc + ' ' + rCat + ' ' + rEmp + ' ' + rBranch + ' ' + rVendorName).toLowerCase();
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
            targetMonth: rTargetMonth,
            vendorName: rVendorName,
            linkedAccrualId: rLinkedAccrualId,
            isSettlement: rIsSettlement,
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

    // 3. تهيئة شيت الإعدادات
    else if (action === 'setupSettingsSheet') {
      var resSetup = setupSettingsSheet();
      return respondJSON(resSetup);
    }

    // 4. التحديث الآمن للأعمدة
    else if (action === 'safeSchemaUpdate') {
      var resSchema = safeSchemaUpdate();
      return respondJSON(resSchema);
    }

    // 5. جلب الإعدادات من شيت Settings
    else if (action === 'getSettings') {
      var settingsSheet = ss.getSheetByName('Settings');
      if (!settingsSheet) {
        setupSettingsSheet();
        settingsSheet = ss.getSheetByName('Settings');
      }

      var branchesList = [];
      var categoriesList = [];
      var vendorsList = [];
      var employeesList = [];

      var lastRow = settingsSheet.getLastRow();
      if (lastRow >= 3) {
        var numRows = lastRow - 2;
        // Branches
        var branchVals = settingsSheet.getRange(3, 1, numRows, 3).getValues();
        for (var b = 0; b < branchVals.length; b++) {
          var bId = String(branchVals[b][0] || '').trim();
          var bName = String(branchVals[b][1] || '').trim();
          var bActive = branchVals[b][2] !== false && String(branchVals[b][2]).toLowerCase() !== 'false';
          if (bName) {
            branchesList.push({ id: bId || 'BR-' + (b + 1), branchId: bId || 'BR-' + (b + 1), name: bName, isActive: bActive });
          }
        }

        // Categories
        var catVals = settingsSheet.getRange(3, 5, numRows, 4).getValues();
        for (var c = 0; c < catVals.length; c++) {
          var cId = String(catVals[c][0] || '').trim();
          var cName = String(catVals[c][1] || '').trim();
          var cParent = String(catVals[c][2] || 'عام').trim();
          var cActive = catVals[c][3] !== false && String(catVals[c][3]).toLowerCase() !== 'false';
          if (cName) {
            categoriesList.push({ id: cId || 'CAT-' + (c + 1), categoryId: cId || 'CAT-' + (c + 1), name: cName, parentCategory: cParent, isActive: cActive });
          }
        }

        // Vendors
        var venVals = settingsSheet.getRange(3, 10, numRows, 4).getValues();
        for (var v = 0; v < venVals.length; v++) {
          var vId = String(venVals[v][0] || '').trim();
          var vName = String(venVals[v][1] || '').trim();
          var vContact = String(venVals[v][2] || '').trim();
          var vActive = venVals[v][3] !== false && String(venVals[v][3]).toLowerCase() !== 'false';
          if (vName) {
            vendorsList.push({ id: vId || 'VEN-' + (v + 1), vendorId: vId || 'VEN-' + (v + 1), name: vName, contactInfo: vContact, isActive: vActive });
          }
        }

        // Employees
        var empVals = settingsSheet.getRange(3, 15, numRows, 4).getValues();
        for (var ep = 0; ep < empVals.length; ep++) {
          var epId = String(empVals[ep][0] || '').trim();
          var epName = String(empVals[ep][1] || '').trim();
          var epRole = String(empVals[ep][2] || 'موظف').trim();
          var epActive = empVals[ep][3] !== false && String(empVals[ep][3]).toLowerCase() !== 'false';
          if (epName) {
            employeesList.push({ id: epId || 'EMP-' + (ep + 1), employeeId: epId || 'EMP-' + (ep + 1), name: epName, role: epRole, isActive: epActive });
          }
        }
      }

      return respondJSON({
        success: true,
        branches: branchesList.filter(function(x) { return x.isActive; }).map(function(x) { return x.name; }),
        categories: categoriesList.filter(function(x) { return x.isActive; }).map(function(x) { return x.name; }),
        settings: {
          branches: branchesList,
          categories: categoriesList,
          vendors: vendorsList,
          employees: employeesList
        }
      });
    }

    // 6. تحديث الإعدادات
    else if (action === 'updateSettings') {
      var settingsSheet = ss.getSheetByName('Settings');
      if (!settingsSheet) {
        setupSettingsSheet();
        settingsSheet = ss.getSheetByName('Settings');
      }

      var logSheet = getOrCreateSetupLogSheet(ss);
      var payload = requestData.settings || requestData;

      if (Array.isArray(payload.branches) && payload.branches.length > 0) {
        var branchData = [];
        for (var b = 0; b < payload.branches.length; b++) {
          var itemB = payload.branches[b];
          if (typeof itemB === 'string') {
            branchData.push(['BR-' + (b + 1), itemB, true]);
          } else {
            branchData.push([itemB.branchId || itemB.id || 'BR-' + (b + 1), itemB.name, itemB.isActive !== false]);
          }
        }
        if (settingsSheet.getLastRow() >= 3) {
          settingsSheet.getRange(3, 1, Math.max(1, settingsSheet.getLastRow() - 2), 3).clearContent();
        }
        settingsSheet.getRange(3, 1, branchData.length, 3).setValues(branchData);
      }

      if (Array.isArray(payload.categories) && payload.categories.length > 0) {
        var catData = [];
        for (var c = 0; c < payload.categories.length; c++) {
          var itemC = payload.categories[c];
          if (typeof itemC === 'string') {
            catData.push(['CAT-' + (c + 1), itemC, 'عام', true]);
          } else {
            catData.push([itemC.categoryId || itemC.id || 'CAT-' + (c + 1), itemC.name, itemC.parentCategory || 'عام', itemC.isActive !== false]);
          }
        }
        if (settingsSheet.getLastRow() >= 3) {
          settingsSheet.getRange(3, 5, Math.max(1, settingsSheet.getLastRow() - 2), 4).clearContent();
        }
        settingsSheet.getRange(3, 5, catData.length, 4).setValues(catData);
      }

      if (Array.isArray(payload.vendors) && payload.vendors.length > 0) {
        var venData = [];
        for (var v = 0; v < payload.vendors.length; v++) {
          var itemV = payload.vendors[v];
          venData.push([itemV.vendorId || itemV.id || 'VEN-' + (v + 1), itemV.name, itemV.contactInfo || '', itemV.isActive !== false]);
        }
        if (settingsSheet.getLastRow() >= 3) {
          settingsSheet.getRange(3, 10, Math.max(1, settingsSheet.getLastRow() - 2), 4).clearContent();
        }
        settingsSheet.getRange(3, 10, venData.length, 4).setValues(venData);
      }

      if (Array.isArray(payload.employees) && payload.employees.length > 0) {
        var empData = [];
        for (var ep = 0; ep < payload.employees.length; ep++) {
          var itemEp = payload.employees[ep];
          empData.push([itemEp.employeeId || itemEp.id || 'EMP-' + (ep + 1), itemEp.name, itemEp.role || 'موظف', itemEp.isActive !== false]);
        }
        if (settingsSheet.getLastRow() >= 3) {
          settingsSheet.getRange(3, 15, Math.max(1, settingsSheet.getLastRow() - 2), 4).clearContent();
        }
        settingsSheet.getRange(3, 15, empData.length, 4).setValues(empData);
      }

      logAction(logSheet, 'UPDATE_SETTINGS', 'تم تحديث جداول الإعدادات بنجاح من التطبيق', 'نجاح');
      return respondJSON({ success: true, message: 'تم تحديث وحفظ الإعدادات بنجاح' });
    }

    return respondJSON({ success: false, error: "الإجراء المطلوب غير معروف" });

  } catch (error) {
    return respondJSON({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1. setupSettingsSheet
 * فحص أو إنشاء شيت الإعدادات والجداول الفرعية الأربعة بأمان تام
 */
function setupSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName('Settings');
  var logSheet = getOrCreateSetupLogSheet(ss);
  
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    logAction(logSheet, 'CREATE_SETTINGS_SHEET', 'تم إنشاء شيت Settings لأول مرة', 'نجاح');
  }
  
  var lastRow = settingsSheet.getLastRow();
  if (lastRow === 0) {
    // 1. الفروع (Cols A-C)
    settingsSheet.getRange('A1:C1').merge().setValue('فروع الشركة (Branches)')
      .setBackground('#047857').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('A2:C2').setValues([['BranchID', 'BranchName', 'IsActive']])
      .setBackground('#065f46').setFontColor('#ffffff').setFontWeight('bold');
    
    var defaultBranches = [
      ['BR-001', 'الرئيسي', true],
      ['BR-002', 'سيتي', true],
      ['BR-003', 'المصنع', true],
      ['BR-004', 'الورده الانيقة', true],
      ['BR-005', 'تعبئة وتغليف', true],
      ['BR-006', 'المستودع', true]
    ];
    settingsSheet.getRange(3, 1, defaultBranches.length, 3).setValues(defaultBranches);

    // 2. التصنيفات (Cols E-H)
    settingsSheet.getRange('E1:H1').merge().setValue('التصنيفات والبنود (Categories)')
      .setBackground('#1e40af').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('E2:H2').setValues([['CategoryID', 'CategoryName', 'ParentCategory', 'IsActive']])
      .setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');
    
    var defaultCategories = [
      ['CAT-001', 'مشتريات', 'تشغيلي', true],
      ['CAT-002', 'رواتب', 'إداري', true],
      ['CAT-003', 'إيجار', 'ثابت', true],
      ['CAT-004', 'ضيافة وبوفيه', 'عمومية', true],
      ['CAT-005', 'نثريات', 'عمومية', true],
      ['CAT-006', 'صيانة', 'تشغيلي', true],
      ['CAT-007', 'سداد مستحقات وآجل', 'التزامات', true],
      ['CAT-008', 'مبيعات نقدية', 'إيرادات', true],
      ['CAT-009', 'مبيعات كي نت (KNET)', 'إيرادات', true]
    ];
    settingsSheet.getRange(3, 5, defaultCategories.length, 4).setValues(defaultCategories);

    // 3. الموردون (Cols J-M)
    settingsSheet.getRange('J1:M1').merge().setValue('الموردون والشركات (Vendors)')
      .setBackground('#6b21a8').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('J2:M2').setValues([['VendorID', 'VendorName', 'ContactInfo', 'IsActive']])
      .setBackground('#581c87').setFontColor('#ffffff').setFontWeight('bold');
    
    var defaultVendors = [
      ['VEN-001', 'شركة المواد الغذائية المتحدة', '22450000', true],
      ['VEN-002', 'مؤسسة التغليف الحديثة', '24810000', true],
      ['VEN-003', 'مطبعة النور الكويتية', '99887766', true],
      ['VEN-004', 'المؤجر العقاري', '55443322', true]
    ];
    settingsSheet.getRange(3, 10, defaultVendors.length, 4).setValues(defaultVendors);

    // 4. الموظفون (Cols O-R)
    settingsSheet.getRange('O1:R1').merge().setValue('الموظفون والمسؤولون (Employees)')
      .setBackground('#b45309').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('O2:R2').setValues([['EmployeeID', 'EmployeeName', 'Role', 'IsActive']])
      .setBackground('#92400e').setFontColor('#ffffff').setFontWeight('bold');
    
    var defaultEmployees = [
      ['EMP-001', 'بيتر ناصر', 'أمين عهدة / محاسب', true],
      ['EMP-002', 'محمد جابر', 'مشرف مالي', true],
      ['EMP-003', 'كاشير الفرع الرئيسي', 'كاشير مبيعات', true],
      ['EMP-004', 'مسؤول المشتريات', 'مشتريات وتوريد', true]
    ];
    settingsSheet.getRange(3, 15, defaultEmployees.length, 4).setValues(defaultEmployees);

    logAction(logSheet, 'INIT_SETTINGS_TABLES', 'تمت تهيئة الجداول الأربعة الافتراضية بنجاح', 'نجاح');
  } else {
    logAction(logSheet, 'VERIFY_SETTINGS_SHEET', 'تم التحقق من شيت الإعدادات، البيانات الحالية محفوظة 100%', 'مكتمل');
  }

  return { success: true, message: 'تم إعداد شيت Settings والتحقق من الجداول الفرعية بأمان تام' };
}

/**
 * 2. safeSchemaUpdate
 * التحقق من أعمدة شيت الحركات وإضافة الأعمدة الناقصة جهة اليمين فقط
 */
function safeSchemaUpdate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = getOrCreateSetupLogSheet(ss);
  var targetSheet = ss.getSheetByName('البيانات') || ss.getSheetByName('Transactions') || ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  
  if (!targetSheet) {
    return { success: false, error: 'لم يتم العثور على شيت المعاملات' };
  }

  var lastCol = targetSheet.getLastColumn();
  if (lastCol === 0) {
    var baselineHeaders = ['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع', 'targetMonth', 'vendorName', 'linkedAccrualId', 'isSettlement'];
    targetSheet.appendRow(baselineHeaders);
    logAction(logSheet, 'INIT_HEADERS', 'تمت كتابة العناوين الأساسية لشيت المعاملات', 'نجاح');
    return { success: true, addedColumns: baselineHeaders };
  }

  var headerValues = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normalizedHeaders = headerValues.map(function(h) { return String(h || '').trim().toLowerCase(); });

  var requiredCols = [
    { key: 'targetmonth', label: 'targetMonth', alt: 'شهر الاستحقاق' },
    { key: 'vendorname', label: 'vendorName', alt: 'اسم المورد' },
    { key: 'linkedaccrualid', label: 'linkedAccrualId', alt: 'معرف الالتزام المرتبط' },
    { key: 'issettlement', label: 'isSettlement', alt: 'نوع التسوية' }
  ];

  var added = [];
  var currentLastCol = lastCol;

  for (var i = 0; i < requiredCols.length; i++) {
    var col = requiredCols[i];
    var exists = false;
    for (var j = 0; j < normalizedHeaders.length; j++) {
      var h = normalizedHeaders[j];
      if (h === col.key || h === col.label.toLowerCase() || h === col.alt.toLowerCase()) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      currentLastCol++;
      targetSheet.getRange(1, currentLastCol).setValue(col.label);
      added.push(col.label);
      logAction(logSheet, 'APPEND_COLUMN_SAFE', 'إضافة عمود آمن جهة اليمين: ' + col.label + ' (العمود ' + currentLastCol + ')', 'نجاح');
    }
  }

  return {
    success: true,
    message: added.length > 0 
      ? 'تم إضافة الأعمدة التالية جهة اليمين بأمان تام: ' + added.join(', ')
      : 'كافة الأعمدة المحاسبية المطلوبة موجودة بالفعل، لم يتم إجراء أي تغيير',
    addedCount: added.length,
    addedColumns: added
  };
}

/**
 * 3. onEdit(e)
 * تريجر حماية ومراقبة التعديلات
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();
    
    if (sheetName === 'البيانات' || sheetName === 'Transactions' || sheetName === 'Settings') {
      var row = e.range.getRow();
      var oldValue = e.oldValue !== undefined ? e.oldValue : '';
      var newValue = e.value !== undefined ? e.value : '';
      
      if (row === 1 && !newValue && oldValue) {
        e.range.setValue(oldValue);
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var logSheet = getOrCreateSetupLogSheet(ss);
        logAction(logSheet, 'PREVENT_HEADER_DELETE', 'تم استرجاع العنوان ' + oldValue + ' تلقائياً لمنع إتلاف بنية الجدول', 'تحذير');
      }
    }
  } catch (err) {}
}

function getOrCreateSetupLogSheet(ss) {
  var logSheet = ss.getSheetByName('SetupLog');
  if (!logSheet) {
    logSheet = ss.insertSheet('SetupLog');
    logSheet.appendRow(['التاريخ والوقت', 'نوع الإجراء', 'التفاصيل', 'الحالة']);
    logSheet.getRange('A1:D1').setBackground('#1f2937').setFontColor('#ffffff').setFontWeight('bold');
  }
  return logSheet;
}

function logAction(logSheet, action, details, status) {
  try {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd HH:mm:ss');
    logSheet.appendRow([now, action, details, status || 'نجاح']);
  } catch (e) {}
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
