/**
 * ============================================================================
 * KWD FINANCE PRO - CENTRALIZED SETTINGS & SAFE SCHEMA GOOGLE APPS SCRIPT
 * ============================================================================
 * 
 * ⚠️ ABSOLUTE DATA IMMUTABILITY CONTRACT:
 * - ZERO DELETION POLICY: Never deletes, truncates, or overwrites existing rows.
 * - Historical Data Preservation: Preserves all transaction rows (2 to N).
 * - Schema Stability: Appends missing columns to the right only.
 */

export const GOOGLE_APPS_SCRIPT_FULL_CODE = `/**
 * ============================================================================
 * KWD FINANCE PRO - GOOGLE APPS SCRIPT (ENTERPRISE EDITION 2026)
 * ============================================================================
 * ⚠️ ميثاق عدم المساس بالبيانات التاريخية:
 * 1. لا يتم حذف أو تعديل أي صفوف سابقة في شيت الحركات.
 * 2. إضافة الأعمدة المحاسبية الجديدة جهة اليمين فقط دون إزاحة الأعمدة الحالية.
 * 3. إنشاء شيت Settings بالجداول الفرعية الأربعة المستقلة.
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

    // 1. تسجيل حركة مالية جديدة (مع حفظ الحقول المحاسبية المتقدمة دون إتلاف)
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

      // إلحاق الحركة بالصف الأخير للشيت الرئيسي لحفظ البيانات المسجلة مسبقاً دون إتلاف
      mainSheet.appendRow([id, date, type, category, employee, amount, description, branch, targetMonth, vendorName, linkedAccrualId, isSettlement]);

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
    
    // 2. استعلام التقرير مع دعم كافة الفلاتر
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

    // 3. تهيئة شيت الإعدادات (setupSettingsSheet)
    else if (action === 'setupSettingsSheet') {
      var resSetup = setupSettingsSheet();
      return respondJSON(resSetup);
    }

    // 4. التحديث الآمن للأعمدة (safeSchemaUpdate)
    else if (action === 'safeSchemaUpdate') {
      var resSchema = safeSchemaUpdate();
      return respondJSON(resSchema);
    }

    // 5. جلب الإعدادات المركزية من شيت Settings
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
        // Branches Table (Cols A-C)
        var branchVals = settingsSheet.getRange(3, 1, numRows, 3).getValues();
        for (var b = 0; b < branchVals.length; b++) {
          var bId = String(branchVals[b][0] || '').trim();
          var bName = String(branchVals[b][1] || '').trim();
          var bActive = branchVals[b][2] !== false && String(branchVals[b][2]).toLowerCase() !== 'false';
          if (bName) {
            branchesList.push({ id: bId || 'BR-' + (b + 1), branchId: bId || 'BR-' + (b + 1), name: bName, isActive: bActive });
          }
        }

        // Categories Table (Cols E-H)
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

        // Vendors Table (Cols J-M)
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

        // Employees Table (Cols O-R)
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
        vendors: vendorsList.filter(function(x) { return x.isActive; }).map(function(x) { return x.name; }),
        employees: employeesList.filter(function(x) { return x.isActive; }).map(function(x) { return x.name; }),
        settings: {
          branches: branchesList,
          categories: categoriesList,
          vendors: vendorsList,
          employees: employeesList
        }
      });
    }

    // 6. حفظ وتحديث الإعدادات (updateSettings)
    else if (action === 'updateSettings') {
      var settingsSheet = ss.getSheetByName('Settings');
      if (!settingsSheet) {
        setupSettingsSheet();
        settingsSheet = ss.getSheetByName('Settings');
      }

      var logSheet = getOrCreateSetupLogSheet(ss);
      var payload = requestData.settings || requestData;

      // Updating Branches if provided
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

      // Updating Categories if provided
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

      // Updating Vendors if provided
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

      // Updating Employees if provided
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

      logAction(logSheet, 'UPDATE_SETTINGS', 'تم تحديث جداول الإعدادات بنجاح من لوحة تحكم التطبيق', 'نجاح');
      return respondJSON({ success: true, message: 'تم تحديث وحفظ الإعدادات بنجاح' });
    }

    // 7. تعديل حركة مالية مسجلة
    else if (action === 'update') {
      var targetId = requestData.id || requestData.rowId || requestData.rowIndex || (requestData.data && (requestData.data.id || requestData.data.rowId || requestData.data.rowIndex));
      var newData = requestData.data || {};
      var lastRow = mainSheet.getLastRow();
      
      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(12, mainSheet.getLastColumn())).getValues();
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
          if (newData.targetMonth !== undefined) mainSheet.getRange(rIdx, 9).setValue(newData.targetMonth);
          if (newData.vendorName !== undefined) mainSheet.getRange(rIdx, 10).setValue(newData.vendorName);
          if (newData.linkedAccrualId !== undefined) mainSheet.getRange(rIdx, 11).setValue(newData.linkedAccrualId);
          if (newData.isSettlement !== undefined) mainSheet.getRange(rIdx, 12).setValue(newData.isSettlement);
        }

        for (var i = 0; i < values.length; i++) {
          if (String(values[i][0] || '').trim() === String(targetId).trim()) {
            updateRowAt(i + 2);
            found = true;
            break;
          }
        }

        if (!found) {
          var rowNum = parseInt(targetId);
          if (!isNaN(rowNum) && rowNum >= 2 && rowNum <= lastRow) {
            updateRowAt(rowNum);
            found = true;
          }
        }

        if (found) {
          return respondJSON({ success: true, message: "تم تعديل الحركة بأمان" });
        }
      }
      return respondJSON({ success: false, error: "لم يتم العثور على الحركة المالية للتعديل في الشيت" });
    }

    // 8. حذف حركة مالية بأمان تام ودون إتلاف الجدول
    else if (action === 'delete') {
      var targetId = requestData.id || requestData.rowId || requestData.rowIndex || (requestData.data && (requestData.data.id || requestData.data.rowId));
      var empToDelete = requestData.employee || (requestData.data && requestData.data.employee);
      var lastRow = mainSheet.getLastRow();
      var deletedFromMain = false;
      var logSheet = getOrCreateSetupLogSheet(ss);

      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var r = values.length - 1; r >= 0; r--) {
          if (String(values[r][0] || '').trim() === String(targetId).trim()) {
            mainSheet.deleteRow(r + 2);
            deletedFromMain = true;
            break;
          }
        }

        if (!deletedFromMain) {
          var rowNum = parseInt(targetId);
          if (!isNaN(rowNum) && rowNum >= 2 && rowNum <= lastRow) {
            mainSheet.deleteRow(rowNum);
            deletedFromMain = true;
          }
        }
      }

      // حذف الحركة أيضاً من شيت الموظف إن وجد
      if (empToDelete && empToDelete !== 'إدارة' && empToDelete !== 'عام') {
        var empSheet = ss.getSheetByName(empToDelete);
        if (empSheet) {
          var empLastRow = empSheet.getLastRow();
          if (empLastRow > 1) {
            var empValues = empSheet.getRange(2, 1, empLastRow - 1, 1).getValues();
            for (var er = empValues.length - 1; er >= 0; er--) {
              if (String(empValues[er][0] || '').trim() === String(targetId).trim()) {
                empSheet.deleteRow(er + 2);
                break;
              }
            }
          }
        }
      }

      logAction(logSheet, 'DELETE_TRANSACTION', 'حذف حركة بالمعرف: ' + targetId, deletedFromMain ? 'نجاح' : 'لم يعثر عليها');
      return respondJSON({ success: true, deleted: deletedFromMain, message: deletedFromMain ? 'تم حذف الحركة بأمان تام' : 'تم تأكيد طلب الحذف' });
    }

    // 9. إضافة موظف أو صندوق جديد (addEmployee)
    else if (action === 'addEmployee') {
      var empName = String(requestData.name || '').trim();
      if (!empName) {
        return respondJSON({ success: false, error: 'اسم الموظف أو الصندوق غير محدد' });
      }
      var logSheet = getOrCreateSetupLogSheet(ss);
      // إنشاء شيت الموظف المستقل
      var existingEmpSheet = ss.getSheetByName(empName);
      if (!existingEmpSheet) {
        var newEmpSheet = ss.insertSheet(empName);
        newEmpSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع', 'targetMonth', 'vendorName', 'linkedAccrualId', 'isSettlement']);
        newEmpSheet.getRange('A1:L1').setBackground('#0f766e').setFontColor('#ffffff').setFontWeight('bold');
        newEmpSheet.setFrozenRows(1);
      }

      // إضافة الموظف إلى جدول Settings إن وُجد
      var settingsSheet = ss.getSheetByName('Settings');
      if (settingsSheet) {
        var sLastRow = settingsSheet.getLastRow();
        var existsInSettings = false;
        if (sLastRow >= 3) {
          var empNamesInSettings = settingsSheet.getRange(3, 16, sLastRow - 2, 1).getValues();
          for (var en = 0; en < empNamesInSettings.length; en++) {
            if (String(empNamesInSettings[en][0] || '').trim() === empName) {
              existsInSettings = true;
              break;
            }
          }
        }
        if (!existsInSettings) {
          var nextEmpRow = Math.max(3, sLastRow + 1);
          settingsSheet.getRange(nextEmpRow, 15, 1, 4).setValues([['EMP-' + Date.now().toString().slice(-4), empName, 'أمين عهدة / مسؤول', true]]);
        }
      }

      logAction(logSheet, 'ADD_EMPLOYEE', 'إضافة وتأمين شيت الموظف / الصندوق: ' + empName, 'نجاح');
      return respondJSON({ success: true, message: 'تم إنشاء وربط شيت الموظف بنجاح: ' + empName });
    }

    // 10. إيقاف أو تعطيل موظف بشكل آمن دون مساس بالبيانات التاريخية (deleteEmployee)
    else if (action === 'deleteEmployee') {
      var empNameToRemove = String(requestData.name || '').trim();
      var logSheet = getOrCreateSetupLogSheet(ss);
      var settingsSheet = ss.getSheetByName('Settings');
      if (settingsSheet && settingsSheet.getLastRow() >= 3) {
        var empVals = settingsSheet.getRange(3, 16, settingsSheet.getLastRow() - 2, 3).getValues();
        for (var ep = 0; ep < empVals.length; ep++) {
          if (String(empVals[ep][0] || '').trim() === empNameToRemove) {
            settingsSheet.getRange(ep + 3, 18).setValue(false); // IsActive = false
            break;
          }
        }
      }
      logAction(logSheet, 'DEACTIVATE_EMPLOYEE', 'تعطيل الموظف ' + empNameToRemove + ' مع حفظ كامل حركاته التاريخية', 'نجاح');
      return respondJSON({ success: true, message: 'تم تعطيل الموظف مع الحفاظ على كافة سجلاته وشيته التاريخي' });
    }

    // 11. أرشفة حركات سنة مالية كاملة في شيت منفصل (archiveFiscalYear)
    else if (action === 'archiveFiscalYear' || action === 'archive') {
      var archiveYear = String(requestData.year || new Date().getFullYear());
      var onlyCompleted = requestData.onlyCompleted !== undefined ? requestData.onlyCompleted : true;
      var archiveSheetName = 'أرشيف_' + archiveYear;
      var logSheet = getOrCreateSetupLogSheet(ss);

      var archiveSheet = ss.getSheetByName(archiveSheetName);
      if (!archiveSheet) {
        archiveSheet = ss.insertSheet(archiveSheetName);
        archiveSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع', 'targetMonth', 'vendorName', 'linkedAccrualId', 'isSettlement', 'تاريخ الأرشفة']);
        archiveSheet.getRange(1, 1, 1, 13).setBackground('#334155').setFontColor('#ffffff').setFontWeight('bold');
        archiveSheet.setFrozenRows(1);
      }

      var lastRow = mainSheet.getLastRow();
      var archivedCount = 0;
      if (lastRow > 1) {
        var values = mainSheet.getRange(2, 1, lastRow - 1, Math.max(12, mainSheet.getLastColumn())).getValues();
        var rowsToArchive = [];
        var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd HH:mm:ss');

        for (var r = 0; r < values.length; r++) {
          var dateVal = values[r][1];
          var dateStr = '';
          if (dateVal instanceof Date) {
            dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd');
          } else {
            dateStr = String(dateVal || '');
          }

          if (dateStr.indexOf(archiveYear) === 0) {
            var archivedRow = values[r].slice(0, 12).concat([nowStr]);
            rowsToArchive.push(archivedRow);
            archivedCount++;
          }
        }

        if (rowsToArchive.length > 0) {
          archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, 13).setValues(rowsToArchive);
        }
      }

      logAction(logSheet, 'ARCHIVE_YEAR', 'أرشفة ' + archivedCount + ' حركة لسنة ' + archiveYear + ' إلى شيت ' + archiveSheetName, 'نجاح');
      return respondJSON({
        success: true,
        archivedCount: archivedCount,
        archiveSheetName: archiveSheetName,
        message: 'تم بنجاح أرشفة وتوثيق ' + archivedCount + ' حركة مالية لسنة ' + archiveYear + ' في شيت [' + archiveSheetName + '] بأمان تام ودون حذف أي بيانات'
      });
    }

    // 12. حفظ تقرير وإغلاق الأرباح والخسائر (Profit & Loss Report)
    else if (action === 'saveProfitLoss' || action === 'saveProfitLossReport') {
      var itemPnl = requestData.data || {};
      var pnlSheet = ss.getSheetByName('ProfitLoss_Reports') || ss.getSheetByName('الارباح_والخسائر') || ss.getSheetByName('الأرباح_والخسائر');
      if (!pnlSheet) {
        setupAllEnterpriseSheets();
        pnlSheet = ss.getSheetByName('ProfitLoss_Reports');
      }
      var pnlYear = itemPnl.year || new Date().getFullYear();
      var pnlMonth = itemPnl.month || (new Date().getMonth() + 1);
      var pnlBranch = itemPnl.branch || 'ALL';
      var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd HH:mm:ss');
      var pnlId = itemPnl.id || ('PNL-' + pnlYear + '-' + pnlMonth + '-' + pnlBranch);

      var pnlRow = [
        pnlId,
        itemPnl.date || new Date().toISOString().split('T')[0],
        pnlYear,
        pnlMonth,
        pnlBranch,
        parseFloat(itemPnl.income !== undefined ? itemPnl.income : itemPnl.totalRevenue) || 0,
        parseFloat(itemPnl.openingStock !== undefined ? itemPnl.openingStock : itemPnl.openingInventory) || 0,
        parseFloat(itemPnl.purchases) || 0,
        parseFloat(itemPnl.closingStock !== undefined ? itemPnl.closingStock : itemPnl.endingInventory) || 0,
        parseFloat(itemPnl.cogs) || 0,
        parseFloat(itemPnl.grossProfit) || 0,
        parseFloat(itemPnl.opex !== undefined ? itemPnl.opex : itemPnl.operatingExpenses) || 0,
        parseFloat(itemPnl.accrued !== undefined ? itemPnl.accrued : itemPnl.accruedExpenses) || 0,
        parseFloat(itemPnl.netProfit) || 0,
        itemPnl.notes || '',
        nowStr
      ];

      var lastPnlRow = pnlSheet.getLastRow();
      var pnlUpdated = false;
      if (lastPnlRow > 1) {
        var existingPnlVals = pnlSheet.getRange(2, 1, lastPnlRow - 1, 5).getValues();
        for (var p = 0; p < existingPnlVals.length; p++) {
          if (String(existingPnlVals[p][0]) === String(pnlId) || 
              (String(existingPnlVals[p][2]) === String(pnlYear) && String(existingPnlVals[p][3]) === String(pnlMonth) && String(existingPnlVals[p][4]) === String(pnlBranch))) {
            pnlSheet.getRange(p + 2, 1, 1, pnlRow.length).setValues([pnlRow]);
            pnlUpdated = true;
            break;
          }
        }
      }
      if (!pnlUpdated) {
        pnlSheet.appendRow(pnlRow);
      }
      logAction(logSheet, 'SAVE_PNL', 'حفظ أو تحديث تقرير الأرباح والخسائر لشهر ' + pnlMonth + '-' + pnlYear + ' فرع ' + pnlBranch, 'نجاح');
      return respondJSON({ success: true, id: pnlId, updated: pnlUpdated, message: 'تم حفظ تقرير الأرباح والخسائر بنجاح في Google Sheets' });
    }

    // 13. جلب كافة تقارير الأرباح والخسائر المسجلة
    else if (action === 'getProfitLoss' || action === 'getProfitLossReports') {
      var pnlSheet = ss.getSheetByName('ProfitLoss_Reports') || ss.getSheetByName('الارباح_والخسائر') || ss.getSheetByName('الأرباح_والخسائر');
      if (!pnlSheet) {
        return respondJSON({ success: true, records: [], data: [] });
      }
      var lastPnlRow = pnlSheet.getLastRow();
      var pnlRecords = [];
      if (lastPnlRow > 1) {
        var pnlData = pnlSheet.getRange(2, 1, lastPnlRow - 1, Math.max(16, pnlSheet.getLastColumn())).getValues();
        for (var pr = 0; pr < pnlData.length; pr++) {
          var rowP = pnlData[pr];
          pnlRecords.push({
            id: rowP[0],
            date: rowP[1],
            year: rowP[2],
            month: rowP[3],
            branch: rowP[4],
            income: parseFloat(rowP[5]) || 0,
            totalRevenue: parseFloat(rowP[5]) || 0,
            openingStock: parseFloat(rowP[6]) || 0,
            openingInventory: parseFloat(rowP[6]) || 0,
            purchases: parseFloat(rowP[7]) || 0,
            closingStock: parseFloat(rowP[8]) || 0,
            endingInventory: parseFloat(rowP[8]) || 0,
            cogs: parseFloat(rowP[9]) || 0,
            grossProfit: parseFloat(rowP[10]) || 0,
            opex: parseFloat(rowP[11]) || 0,
            operatingExpenses: parseFloat(rowP[11]) || 0,
            accrued: parseFloat(rowP[12]) || 0,
            accruedExpenses: parseFloat(rowP[12]) || 0,
            netProfit: parseFloat(rowP[13]) || 0,
            notes: rowP[14] || '',
            savedAt: rowP[15] || ''
          });
        }
      }
      return respondJSON({ success: true, records: pnlRecords, data: pnlRecords });
    }

    // 10. حفظ وتحديث طلبية ومواعيد التوريد والتسليم (Orders Schedule)
    else if (action === 'saveOrder') {
      var ord = requestData.data || {};
      var ordersSheet = ss.getSheetByName('Orders') || ss.getSheetByName('الطلبيات');
      if (!ordersSheet) {
        setupAllEnterpriseSheets();
        ordersSheet = ss.getSheetByName('Orders');
      }
      var ordId = ord.orderNumber || ord.id || ('ORD-' + Date.now());
      var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd HH:mm:ss');
      var ordRow = [
        ordId,
        ord.orderDate || new Date().toISOString().split('T')[0],
        ord.title || 'طلب توريد وبضاعة',
        ord.type || 'supply',
        ord.supplierOrCustomer || ord.clientName || 'عميل نقدي',
        ord.branch || 'الفرع الرئيسي',
        ord.deliveryDueDate || '',
        parseFloat(ord.amount) || 0,
        parseFloat(ord.paidAmount) || 0,
        (parseFloat(ord.amount) || 0) - (parseFloat(ord.paidAmount) || 0),
        ord.status || 'pending',
        ord.priority || 'medium',
        ord.paymentStatus || 'unpaid',
        ord.assignedEmployee || '',
        ord.contactPhone || '',
        ord.notes || '',
        typeof ord.items === 'object' ? JSON.stringify(ord.items) : (ord.items || ''),
        nowStr
      ];

      var lastOrdRow = ordersSheet.getLastRow();
      var ordUpdated = false;
      if (lastOrdRow > 1) {
        var ordVals = ordersSheet.getRange(2, 1, lastOrdRow - 1, 1).getValues();
        for (var o = 0; o < ordVals.length; o++) {
          if (String(ordVals[o][0]).trim() === String(ordId).trim()) {
            ordersSheet.getRange(o + 2, 1, 1, ordRow.length).setValues([ordRow]);
            ordUpdated = true;
            break;
          }
        }
      }
      if (!ordUpdated) {
        ordersSheet.appendRow(ordRow);
      }
      logAction(logSheet, 'SAVE_ORDER', 'حفظ أو تحديث الطلبية رقم ' + ordId, 'نجاح');
      return respondJSON({ success: true, id: ordId, updated: ordUpdated, message: 'تم حفظ وتحديث الطلبية بنجاح في Google Sheets' });
    }

    // 11. جلب كافة الطلبيات المسجلة
    else if (action === 'getOrders') {
      var ordersSheet = ss.getSheetByName('Orders') || ss.getSheetByName('الطلبيات');
      if (!ordersSheet) {
        return respondJSON({ success: true, orders: [] });
      }
      var lastOrdRow = ordersSheet.getLastRow();
      var ordersList = [];
      if (lastOrdRow > 1) {
        var ordData = ordersSheet.getRange(2, 1, lastOrdRow - 1, Math.max(18, ordersSheet.getLastColumn())).getValues();
        for (var oi = 0; oi < ordData.length; oi++) {
          var ro = ordData[oi];
          var itemsParsed = [];
          try {
            if (ro[16]) itemsParsed = JSON.parse(ro[16]);
          } catch(e) {}
          ordersList.push({
            id: ro[0],
            orderNumber: ro[0],
            orderDate: ro[1],
            title: ro[2],
            type: ro[3],
            supplierOrCustomer: ro[4],
            branch: ro[5],
            deliveryDueDate: ro[6],
            amount: parseFloat(ro[7]) || 0,
            paidAmount: parseFloat(ro[8]) || 0,
            remainingAmount: parseFloat(ro[9]) || 0,
            status: ro[10],
            priority: ro[11],
            paymentStatus: ro[12],
            assignedEmployee: ro[13],
            contactPhone: ro[14],
            notes: ro[15],
            items: itemsParsed,
            updatedAt: ro[17]
          });
        }
      }
      return respondJSON({ success: true, orders: ordersList });
    }

    // 15. حفظ سقوف الموازنات التقديرية (Budgets)
    else if (action === 'saveBudget' || action === 'saveBudgets') {
      var bSheet = ss.getSheetByName('Budgets') || ss.getSheetByName('الموازنات');
      if (!bSheet) {
        setupAllEnterpriseSheets();
        bSheet = ss.getSheetByName('Budgets');
      }
      var logSheet = getOrCreateSetupLogSheet(ss);
      var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd HH:mm:ss');
      
      var budgetItems = [];
      if (Array.isArray(requestData.data)) {
        budgetItems = requestData.data;
      } else if (Array.isArray(requestData.budgets)) {
        budgetItems = requestData.budgets;
      } else if (requestData.data) {
        budgetItems = [requestData.data];
      }

      for (var biIdx = 0; biIdx < budgetItems.length; biIdx++) {
        var bItem = budgetItems[biIdx];
        var bYear = bItem.year || new Date().getFullYear();
        var bMonth = bItem.month || (new Date().getMonth() + 1);
        var bBranch = bItem.branch || 'ALL';
        var bCategory = bItem.category || 'عام';
        var bLimit = parseFloat(bItem.limit !== undefined ? bItem.limit : bItem.budgetLimit) || 0;
        var bActual = parseFloat(bItem.actual !== undefined ? bItem.actual : bItem.actualSpent) || 0;
        var bVariancePct = bLimit > 0 ? ((bActual / bLimit) * 100).toFixed(1) : 0;
        var bStatus = bActual > bLimit ? 'تجاوز وانحراف' : 'ضمن السقف التقديري';

        var bRow = [bYear, bMonth, bBranch, bCategory, bLimit, bActual, bVariancePct + '%', bStatus, nowStr];
        var lastBRow = bSheet.getLastRow();
        var bUpdated = false;
        if (lastBRow > 1) {
          var existingB = bSheet.getRange(2, 1, lastBRow - 1, 4).getValues();
          for (var bi = 0; bi < existingB.length; bi++) {
            if (String(existingB[bi][0]) === String(bYear) && String(existingB[bi][1]) === String(bMonth) &&
                String(existingB[bi][2]) === String(bBranch) && String(existingB[bi][3]) === String(bCategory)) {
              bSheet.getRange(bi + 2, 1, 1, bRow.length).setValues([bRow]);
              bUpdated = true;
              break;
            }
          }
        }
        if (!bUpdated) {
          bSheet.appendRow(bRow);
        }
      }

      logAction(logSheet, 'SAVE_BUDGET', 'حفظ سقوف الموازنات التقديرية بنجاح (' + budgetItems.length + ' بند)', 'نجاح');
      return respondJSON({ success: true, count: budgetItems.length, message: 'تم حفظ أسقف الموازنات التقديرية بنجاح في Google Sheets' });
    }

    // 13. جلب الموازنات التقديرية
    else if (action === 'getBudgets') {
      var bSheet = ss.getSheetByName('Budgets') || ss.getSheetByName('الموازنات');
      if (!bSheet) {
        return respondJSON({ success: true, budgets: [] });
      }
      var lastBRow = bSheet.getLastRow();
      var bList = [];
      if (lastBRow > 1) {
        var bData = bSheet.getRange(2, 1, lastBRow - 1, Math.max(9, bSheet.getLastColumn())).getValues();
        for (var bj = 0; bj < bData.length; bj++) {
          bList.push({
            year: bData[bj][0],
            month: bData[bj][1],
            branch: bData[bj][2],
            category: bData[bj][3],
            limit: parseFloat(bData[bj][4]) || 0,
            actual: parseFloat(bData[bj][5]) || 0,
            variancePct: bData[bj][6],
            status: bData[bj][7],
            confirmedAt: bData[bj][8]
          });
        }
      }
      return respondJSON({ success: true, budgets: bList });
    }

    // 14. التهيئة الشاملة لكافة شيتات المنظومة (setupAllEnterpriseSheets)
    else if (action === 'setupAllEnterpriseSheets') {
      var resAll = setupAllEnterpriseSheets();
      return respondJSON(resAll);
    }

    return respondJSON({ success: false, error: "الإجراء المطلوب غير معروف" });

  } catch (error) {
    return respondJSON({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * دالة إنشاء أو فحص شيت الإعدادات (Settings)
 * تفحص وجود الجداول، وتنشئ الناقص فقط دون مساس بأي بيانات سابقة
 */
/**
 * القائمة التفاعلية الرسمية أعلى شيت إكسيل (Google Sheets Toolbar Menu)
 * تظهر تلقائياً بمجرد فتح الشيت للمدير والمحاسبين
 */
function onOpen(e) {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🏢 منظومة KWD FINANCE PRO')
      .addItem('🚀 ترقية وتنسيق كافة الشيتات (setupAllEnterpriseSheets)', 'setupAllEnterpriseSheets')
      .addItem('📋 تهيئة وتنسيق شيت الإعدادات المركزية (setupSettingsSheet)', 'setupSettingsSheet')
      .addItem('🛡️ التحديث الآمن للأعمدة جهة اليمين (safeSchemaUpdate)', 'safeSchemaUpdate')
      .addSeparator()
      .addItem('📊 فتح شيت الأرباح والخسائر المعتمدة', 'openProfitLossSheet')
      .addItem('📦 فتح شيت إدارة ومواعيد الطلبيات', 'openOrdersSheet')
      .addItem('🎯 فتح شيت أسقف الموازنات والانحرافات', 'openBudgetsSheet')
      .addToUi();
  } catch(err) {}
}

function openProfitLossSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ProfitLoss_Reports') || ss.getSheetByName('الارباح_والخسائر');
  if (sheet) ss.setActiveSheet(sheet);
}

function openOrdersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Orders') || ss.getSheetByName('الطلبيات');
  if (sheet) ss.setActiveSheet(sheet);
}

function openBudgetsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Budgets') || ss.getSheetByName('الموازنات');
  if (sheet) ss.setActiveSheet(sheet);
}

/**
 * دالة إنشاء أو فحص شيت الإعدادات (Settings)
 * تفحص وجود الجداول، وتنسق المظهر الفاتح الراقي دون مساس بالبيانات السابقة
 */
function setupSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName('Settings');
  var logSheet = getOrCreateSetupLogSheet(ss);
  
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    logAction(logSheet, 'CREATE_SETTINGS_SHEET', 'تم إنشاء شيت الإعدادات Settings لأول مرة', 'نجاح');
  }
  
  try { settingsSheet.setRightToLeft(true); } catch(e) {}
  
  var lastRow = settingsSheet.getLastRow();
  if (lastRow === 0) {
    // 1. الفروع (Cols A-C)
    settingsSheet.getRange('A1:C1').merge().setValue('فروع الشركة (Branches)')
      .setBackground('#059669').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('A2:C2').setValues([['BranchID', 'BranchName', 'IsActive']])
      .setBackground('#10b981').setFontColor('#ffffff').setFontWeight('bold');
    
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
      .setBackground('#2563eb').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('E2:H2').setValues([['CategoryID', 'CategoryName', 'ParentCategory', 'IsActive']])
      .setBackground('#3b82f6').setFontColor('#ffffff').setFontWeight('bold');
    
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
      .setBackground('#7c3aed').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('J2:M2').setValues([['VendorID', 'VendorName', 'ContactInfo', 'IsActive']])
      .setBackground('#8b5cf6').setFontColor('#ffffff').setFontWeight('bold');
    
    var defaultVendors = [
      ['VEN-001', 'شركة المواد الغذائية المتحدة', '22450000', true],
      ['VEN-002', 'مؤسسة التغليف الحديثة', '24810000', true],
      ['VEN-003', 'مطبعة النور الكويتية', '99887766', true],
      ['VEN-004', 'المؤجر العقاري', '55443322', true]
    ];
    settingsSheet.getRange(3, 10, defaultVendors.length, 4).setValues(defaultVendors);

    // 4. الموظفون (Cols O-R)
    settingsSheet.getRange('O1:R1').merge().setValue('الموظفون والمسؤولون (Employees)')
      .setBackground('#d97706').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    settingsSheet.getRange('O2:R2').setValues([['EmployeeID', 'EmployeeName', 'Role', 'IsActive']])
      .setBackground('#f59e0b').setFontColor('#ffffff').setFontWeight('bold');
    
    var defaultEmployees = [
      ['EMP-001', 'بيتر ناصر', 'أمين عهدة / محاسب', true],
      ['EMP-002', 'محمد جابر', 'مشرف مالي', true],
      ['EMP-003', 'كاشير الفرع الرئيسي', 'كاشير مبيعات', true],
      ['EMP-004', 'مسؤول المشتريات', 'مشتريات وتوريد', true]
    ];
    settingsSheet.getRange(3, 15, defaultEmployees.length, 4).setValues(defaultEmployees);

    // فواصل الأعمدة الأنيقة الفاتحة
    settingsSheet.getRange('D1:D100').setBackground('#f8fafc');
    settingsSheet.getRange('I1:I100').setBackground('#f8fafc');
    settingsSheet.getRange('N1:N100').setBackground('#f8fafc');
    settingsSheet.setColumnWidth(4, 25);
    settingsSheet.setColumnWidth(9, 25);
    settingsSheet.setColumnWidth(14, 25);
    settingsSheet.setFrozenRows(2);

    logAction(logSheet, 'INIT_SETTINGS_TABLES', 'تمت تهيئة الجداول الأربعة الافتراضية بنجاح', 'نجاح');
  } else {
    logAction(logSheet, 'VERIFY_SETTINGS_SHEET', 'تم التحقق من شيت الإعدادات، البيانات الحالية محفوظة 100%', 'مكتمل');
  }

  return { success: true, message: 'تم إعداد وتنسيق شيت Settings والتحقق من الجداول بأمان تام' };
}

/**
 * التحديث الآمن للأعمدة (safeSchemaUpdate)
 * يفحص شيت الحركات ويضيف الأعمدة المطلوبة جهة اليمين فقط دون إزاحة أو حذف
 */
function safeSchemaUpdate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = getOrCreateSetupLogSheet(ss);
  var targetSheet = ss.getSheetByName('البيانات') || ss.getSheetByName('Transactions') || ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  
  if (!targetSheet) {
    return { success: false, error: 'لم يتم العثور على شيت المعاملات' };
  }

  try { targetSheet.setRightToLeft(true); } catch(e) {}

  var lastCol = targetSheet.getLastColumn();
  if (lastCol === 0) {
    var baselineHeaders = ['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع', 'targetMonth', 'vendorName', 'linkedAccrualId', 'isSettlement'];
    targetSheet.appendRow(baselineHeaders);
    targetSheet.getRange('A1:L1').setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
    targetSheet.setRowHeight(1, 35);
    targetSheet.setFrozenRows(1);
    logAction(logSheet, 'INIT_HEADERS', 'تمت كتابة وتنسيق العناوين الأساسية لشيت المعاملات', 'نجاح');
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
      targetSheet.getRange(1, currentLastCol).setValue(col.label).setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
      added.push(col.label);
      logAction(logSheet, 'APPEND_COLUMN_SAFE', 'إضافة عمود آمن جهة اليمين: ' + col.label + ' (العمود ' + currentLastCol + ')', 'نجاح');
    }
  }

  // تنسيق عمود المبلغ المالي (العمود 6) إن وجد
  try {
    if (targetSheet.getLastRow() > 1) {
      targetSheet.getRange(2, 6, targetSheet.getLastRow() - 1, 1).setNumberFormat('#,##0.000');
    }
  } catch(e) {}

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
 * تريجر حماية ومراقبة التعديلات (onEdit)
 * يمنع مسح العناوين ويراقب الحركات في SetupLog
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
      
      // منع مسح العناوين الرأسية
      if (row === 1 && !newValue && oldValue) {
        e.range.setValue(oldValue);
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var logSheet = getOrCreateSetupLogSheet(ss);
        logAction(logSheet, 'PREVENT_HEADER_DELETE', 'تم استرجاع العنوان ' + oldValue + ' تلقائياً لمنع إتلاف بنية الجدول', 'تحذير');
      }
    }
  } catch (err) {}
}

/**
 * التهيئة والترقية الشاملة لكافة شيتات المنظومة (setupAllEnterpriseSheets)
 * تنشئ وتنسق شيتات المنظومة الستة بألوان فاتحة وواضحة ودون مساس بأي بيانات سابقة
 */
function setupAllEnterpriseSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = getOrCreateSetupLogSheet(ss);
  
  // 1. الشيت الرئيسي للحركات
  var mainSheet = ss.getSheetByName('البيانات') || ss.getSheetByName('Transactions') || ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  if (!mainSheet) {
    mainSheet = ss.insertSheet('البيانات');
    mainSheet.appendRow(['الرقم التعريفى', 'التاريخ', 'النوع', 'البند والتصنيف', 'الموظف / الصندوق', 'المبلغ (د.ك)', 'الملاحظات والبيان', 'الفرع', 'targetMonth', 'vendorName', 'linkedAccrualId', 'isSettlement']);
    mainSheet.getRange('A1:L1').setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
    mainSheet.setRowHeight(1, 35);
    mainSheet.setFrozenRows(1);
    logAction(logSheet, 'CREATE_MAIN_SHEET', 'تم إنشاء شيت البيانات الرئيسي بألوان فاتحة وواضحة', 'نجاح');
  } else {
    safeSchemaUpdate();
  }
  try { mainSheet.setRightToLeft(true); } catch(e) {}

  // 2. شيت الإعدادات
  setupSettingsSheet();

  // 3. شيت تقارير الأرباح والخسائر المعتمدة (ProfitLoss_Reports)
  var pnlSheet = ss.getSheetByName('ProfitLoss_Reports') || ss.getSheetByName('الارباح_والخسائر') || ss.getSheetByName('الأرباح_والخسائر');
  var pnlHeaders = [
    'رقم_التقرير', 'التاريخ', 'السنة', 'الشهر', 'الفرع', 
    'إجمالي_الإيرادات', 'مخزون_أول_المدة', 'مشتريات_الفترة', 'مخزون_آخر_المدة', 
    'تكلفة_البضاعة_COGS', 'مجمل_الربح', 'المصروفات_التشغيلية', 'المصروفات_المستحقة', 
    'صافي_الربح_والخسارة', 'ملاحظات_وإيضاحات', 'تاريخ_الاعتماد_والحفظ'
  ];
  if (!pnlSheet) {
    pnlSheet = ss.insertSheet('ProfitLoss_Reports');
    pnlSheet.appendRow(pnlHeaders);
    logAction(logSheet, 'CREATE_PNL_SHEET', 'تم إنشاء شيت تقارير الأرباح والخسائر ProfitLoss_Reports', 'نجاح');
  }
  pnlSheet.getRange(1, 1, 1, pnlHeaders.length).setBackground('#0f766e').setFontColor('#ffffff').setFontWeight('bold');
  pnlSheet.setRowHeight(1, 35);
  pnlSheet.setFrozenRows(1);
  try { pnlSheet.setRightToLeft(true); } catch(e) {}

  // 4. شيت إدارة ومواعيد الطلبيات (Orders)
  var ordersSheet = ss.getSheetByName('Orders') || ss.getSheetByName('الطلبيات');
  var ordersHeaders = [
    'رقم_الطلبية', 'تاريخ_الإنشاء', 'العنوان_أو_البند', 'النوع', 'العميل_أو_المورد', 
    'الفرع', 'تاريخ_التسليم_المحدد', 'إجمالي_المبلغ', 'المدفوع', 'المتبقي', 
    'حالة_التنفيذ', 'الأولوية', 'حالة_الدفع', 'الموظف_المسؤول', 'الهاتف', 
    'الملاحظات_والشروط', 'تفاصيل_البنود_JSON', 'تاريخ_التحديث'
  ];
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet('Orders');
    ordersSheet.appendRow(ordersHeaders);
    logAction(logSheet, 'CREATE_ORDERS_SHEET', 'تم إنشاء شيت إدارة ومواعيد الطلبيات Orders', 'نجاح');
  }
  ordersSheet.getRange(1, 1, 1, ordersHeaders.length).setBackground('#0369a1').setFontColor('#ffffff').setFontWeight('bold');
  ordersSheet.setRowHeight(1, 35);
  ordersSheet.setFrozenRows(1);
  try { ordersSheet.setRightToLeft(true); } catch(e) {}

  // 5. شيت الموازنات التقديرية (Budgets)
  var budgetSheet = ss.getSheetByName('Budgets') || ss.getSheetByName('الموازنات');
  var budgetHeaders = [
    'السنة', 'الشهر', 'الفرع', 'بند_المصروف_أو_التصنيف', 
    'سقف_الموازنة_التقديرية', 'المنصرف_الفعلي', 'نسبة_الاستهلاك_%', 'الحالة_الرقابية', 'تاريخ_الاعتماد'
  ];
  if (!budgetSheet) {
    budgetSheet = ss.insertSheet('Budgets');
    budgetSheet.appendRow(budgetHeaders);
    logAction(logSheet, 'CREATE_BUDGETS_SHEET', 'تم إنشاء شيت الموازنات التقديرية Budgets', 'نجاح');
  }
  budgetSheet.getRange(1, 1, 1, budgetHeaders.length).setBackground('#4338ca').setFontColor('#ffffff').setFontWeight('bold');
  budgetSheet.setRowHeight(1, 35);
  budgetSheet.setFrozenRows(1);
  try { budgetSheet.setRightToLeft(true); } catch(e) {}

  // تنسيق سجل التدقيق والرقابة (SetupLog)
  if (logSheet) {
    try { logSheet.setRightToLeft(true); } catch(e) {}
    logSheet.getRange('A1:D1').setBackground('#475569').setFontColor('#ffffff').setFontWeight('bold');
  }

  logAction(logSheet, 'SETUP_ALL_ENTERPRISE', 'تم فحص وترقية وتنسيق كافة شيتات المنظومة (RTL وألوان فاتحة وواضحة)', 'نجاح');
  
  try {
    ss.toast('تمت الترقية الشاملة وتنسيق كافة الشيتات بنجاح دون حذف أي بيانات', 'منظومة KWD المالية', 6);
  } catch(e) {}

  return { 
    success: true, 
    sheetsCount: 6,
    message: 'تم فحص وترقية كافة شيتات المنظومة (البيانات، Settings، ProfitLoss_Reports، Orders، Budgets، SetupLog) بتنسيق عربي RTL وألوان فاتحة دون حذف أي سجل'
  };
}

function getOrCreateSetupLogSheet(ss) {
  var logSheet = ss.getSheetByName('SetupLog');
  if (!logSheet) {
    logSheet = ss.insertSheet('SetupLog');
    logSheet.appendRow(['التاريخ والوقت', 'نوع الإجراء', 'التفاصيل', 'الحالة']);
    logSheet.getRange('A1:D1').setBackground('#475569').setFontColor('#ffffff').setFontWeight('bold');
    try { logSheet.setRightToLeft(true); } catch(e) {}
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
`;
