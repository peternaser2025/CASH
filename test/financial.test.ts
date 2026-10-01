import { toFils, toKWD, addMoney, subMoney, sumMoney, isMoneyEqual, normalizeEntityId } from '../src/utils/money';
import { performReconciliation } from '../server/reconciliation';
import { transactionSchema, orderSchema } from '../server/validation';
import { normalizeMonthKey, extractTargetMonth, getEffectiveDueMonth, parseReportRow, isArabicSearchMatch, isAccrualType } from '../src/utils/format';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING FINANCIAL & RECONCILIATION TEST SUITE');
console.log('----------------------------------------------------');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

// 1. Precise Fils Math Tests
console.log('\n[1] Testing Integer Fils & IEEE-754 Precision...');
assert(toFils(0.1) === 100, '0.100 KWD converts to exact 100 fils');
assert(toFils(0.2) === 200, '0.200 KWD converts to exact 200 fils');

// The classic JavaScript 0.1 + 0.2 === 0.30000000000000004 bug
const floatSum = 0.1 + 0.2;
const filsSum = addMoney(0.1, 0.2);
assert(filsSum === 0.3, `addMoney(0.1, 0.2) equals exactly 0.300 KWD (not ${floatSum})`);
assert(isMoneyEqual(addMoney('15.250', '4.750'), 20.000), '15.250 + 4.750 = 20.000 KWD');
assert(isMoneyEqual(subMoney('100.000', '33.333'), '66.667'), '100.000 - 33.333 = 66.667 KWD');
assert(sumMoney([10.100, 20.200, 30.300]) === 60.6, 'Summing array [10.1, 20.2, 30.3] = 60.600 KWD');

// 2. Entity ID Normalization Tests
console.log('\n[2] Testing Entity Normalization...');
const id1 = normalizeEntityId('بيتر ناصر');
const id2 = normalizeEntityId('  بيتر  ناصر  ');
assert(id1 === id2, `Normalized ID matches regardless of spacing: "${id1}" === "${id2}"`);
assert(normalizeEntityId('فرع حَوَلّي') === normalizeEntityId('فرع حولي'), 'Normalizer ignores Arabic diacritics');

// 3. Validation Schema Tests
console.log('\n[3] Testing Backend Zod Validation Schemas...');
const validTx = transactionSchema.safeParse({
  amount: 45.500,
  employee: 'بيتر ناصر',
  type: 'Expense',
  branch: 'الرئيسي'
});
assert(validTx.success, 'Valid transaction passes validation');

const invalidNegativeTx = transactionSchema.safeParse({
  amount: -50,
  employee: 'بيتر ناصر',
  type: 'Expense'
});
assert(!invalidNegativeTx.success, 'Negative transaction amount is strictly rejected');

const invalidZeroTx = transactionSchema.safeParse({
  amount: 0,
  employee: 'بيتر ناصر',
  type: 'Expense'
});
assert(!invalidZeroTx.success, 'Zero transaction amount is strictly rejected');

// City department validation rule tests
const validCityTxWithDept = transactionSchema.safeParse({
  amount: 25.000,
  employee: 'بيتر ناصر',
  type: 'Expense',
  branch: 'سيتي',
  department: 'بهارات'
});
assert(validCityTxWithDept.success, 'City branch transaction with department is valid');

const invalidOtherBranchWithDept = transactionSchema.safeParse({
  amount: 25.000,
  employee: 'بيتر ناصر',
  type: 'Expense',
  branch: 'الرئيسي',
  department: 'بهارات'
});
assert(!invalidOtherBranchWithDept.success, 'Department assigned to non-City branch is strictly rejected');

const validOtherBranchWithoutDept = transactionSchema.safeParse({
  amount: 25.000,
  employee: 'بيتر ناصر',
  type: 'Expense',
  branch: 'الرئيسي',
  department: null
});
assert(validOtherBranchWithoutDept.success, 'Non-City branch without department is valid');

const invalidOrder = orderSchema.safeParse({
  title: 'X', // too short
  amount: -100
});
assert(!invalidOrder.success, 'Invalid order with negative price is rejected');

// 4. Financial Reconciliation Engine Tests
console.log('\n[4] Testing Server-Authoritative Reconciliation Engine...');
const sampleEmployees = [
  { name: 'محمد جابر', balance: 150.000 }
];
const balancedTransactions = [
  { employee: 'محمد جابر', amount: 200.000, type: 'Income' },
  { employee: 'محمد جابر', amount: 50.000, type: 'Expense' }
];

const report1 = performReconciliation(balancedTransactions, sampleEmployees, ['الرئيسي']);
assert(report1.isSystemBalanced === true, 'Balanced account produces isSystemBalanced = true');
assert(report1.items[0].discrepancyFils === 0, 'Discrepancy in fils is 0 for balanced account');

// Imbalance test
const imbalancedEmployees = [
  { name: 'محمد جابر', balance: 300.000 } // Says 300, but transactions sum to 150!
];
const report2 = performReconciliation(balancedTransactions, imbalancedEmployees, ['الرئيسي']);
assert(report2.isSystemBalanced === false, 'Imbalance is immediately detected');
assert(report2.items[0].discrepancyKWD === 150, 'Discrepancy correctly calculated as 150.000 KWD');
assert(report2.items[0].status === 'discrepancy_detected', 'Status flagged as discrepancy_detected');

// 5. Cashier Daily Closing & Dual Column Journal Integrity Tests
console.log('\n[5] Testing Cashier Daily Closing & Dual Column Math...');
const openingBalance = 120.500;
const cashierReceipts = [
  { amount: 50.000, branch: 'فرع السالمية' },
  { amount: 80.250, branch: 'فرع حولي' }
];
const cashierExpenses = [
  { amount: 30.000, branch: 'فرع السالمية' },
  { amount: 45.500, branch: 'فرع حولي' },
  { amount: 15.250, branch: 'فرع الشويخ' }
];

const sumReceipts = cashierReceipts.reduce((acc, r) => addMoney(acc, r.amount), 0);
const sumExpenses = cashierExpenses.reduce((acc, e) => addMoney(acc, e.amount), 0);
const expectedClosing = addMoney(subMoney(openingBalance, sumExpenses), sumReceipts);

assert(sumReceipts === 130.25, `Sum of receipts = 130.250 KWD (got ${sumReceipts})`);
assert(sumExpenses === 90.75, `Sum of expenses = 90.750 KWD (got ${sumExpenses})`);
assert(expectedClosing === 160.0, `Cashier closing balance = 160.000 KWD (got ${expectedClosing})`);

// Drawer count & discrepancy test
const actualCountExact = 160.000;
const diffExact = Math.round((actualCountExact - expectedClosing) * 1000) / 1000;
assert(diffExact === 0, 'Exact count produces 0 discrepancy');

const actualCountShort = 155.000;
const diffShort = Math.round((actualCountShort - expectedClosing) * 1000) / 1000;
assert(diffShort === -5.0, `Shortage of 5.000 KWD detected (got ${diffShort})`);

// Branch aggregation test
const branchSums: Record<string, number> = {};
cashierExpenses.forEach(e => {
  branchSums[e.branch] = addMoney(branchSums[e.branch] || 0, e.amount);
});
assert(branchSums['فرع السالمية'] === 30.000, 'Salmiya branch expenses total 30.000 KWD');
assert(branchSums['فرع حولي'] === 45.500, 'Hawally branch expenses total 45.500 KWD');
assert(branchSums['فرع الشويخ'] === 15.250, 'Shuwaikh branch expenses total 15.250 KWD');
const totalBranchSums = Object.values(branchSums).reduce((a, b) => addMoney(a, b), 0);
assert(totalBranchSums === sumExpenses, 'Sum of branch expenses exactly matches total expenses');

// 6. Report Ledger Column Sum & Running Balance Mathematical Identity Tests
console.log('\n[6] Testing Report Table Mathematical Identity...');
const reportOpening = 100.000;
const testRows = [
  { income: 50.000, expense: 0, isAccrued: false },
  { income: 22.000, expense: 0, isAccrued: false }, // Custody transfer in
  { income: 0, expense: 30.000, isAccrued: false }, // Cash expense
  { income: 0, expense: 15.000, isAccrued: true },  // Accrued/credit purchase (not paid yet)
  { income: 0, expense: 12.000, isAccrued: false }  // Cash expense
];

let runningFils = toFils(reportOpening);
let sumColInFils = 0;
let sumColCashOutFils = 0;
let sumColAccrualFils = 0;

testRows.forEach(r => {
  sumColInFils += toFils(r.income);
  if (!r.isAccrued) {
    runningFils += toFils(r.income) - toFils(r.expense);
    sumColCashOutFils += toFils(r.expense);
  } else {
    sumColAccrualFils += toFils(r.expense);
  }
});

const calculatedEndingBalance = toKWD(toFils(reportOpening) + sumColInFils - sumColCashOutFils);
const finalRowBalance = toKWD(runningFils);

assert(toKWD(sumColInFils) === 72.000, 'Income column sum equals exactly 72.000 KWD (50 + 22)');
assert(toKWD(sumColCashOutFils) === 42.000, 'Cash out column sum equals exactly 42.000 KWD (30 + 12)');
assert(toKWD(sumColAccrualFils) === 15.000, 'Accruals isolated as 15.000 KWD without deducting from cash');
assert(calculatedEndingBalance === 130.000, 'Final balance = 100 + 72 - 42 = 130.000 KWD');
assert(finalRowBalance === calculatedEndingBalance, 'Last row running balance strictly matches calculated ending balance');

// 7. Due Months (شهور الاستحقاق) Mathematical and Parsing Integrity Tests
console.log('\n[7] Testing Due Months (شهور الاستحقاق) Full Coverage Without Omission...');

// Month key normalization
assert(normalizeMonthKey('2026-05') === '2026-05', 'normalizeMonthKey: ISO format 2026-05');
assert(normalizeMonthKey('2026/05') === '2026-05', 'normalizeMonthKey: Slash format 2026/05');
assert(normalizeMonthKey('05/2026') === '2026-05', 'normalizeMonthKey: Month/Year 05/2026');
assert(normalizeMonthKey('٢٠٢٦-٠٥') === '2026-05', 'normalizeMonthKey: Arabic digits ٢٠٢٦-٠٥');

// Target month extraction from text & description
assert(extractTargetMonth('', 'فاتورة كهرباء [تخص شهر 2026-04]') === '2026-04', 'extractTargetMonth: [تخص شهر 2026-04]');
assert(extractTargetMonth('', 'إيجار فرع حولي تخص شهر 05/2026') === '2026-05', 'extractTargetMonth: تخص شهر 05/2026');
assert(extractTargetMonth('', 'تاريخ الاستحقاق: 2026-07-15') === '2026-07', 'extractTargetMonth: تاريخ الاستحقاق: 2026-07-15');
assert(extractTargetMonth('', 'دفعة مورد عن شهر مايو 2026') === '2026-05', 'extractTargetMonth: Arabic month name مايو 2026');

// Effective Due Month allocation (Guarantees zero omission / دون حذف)
const sampleExpenses = [
  { date: '2026-05-02', expense: 100.250, description: 'مشتريات خامات عاجلة', targetMonth: '' },
  { date: '2026-05-15', expense: 250.000, description: 'سداد إيجار متأخر [تخص شهر 2026-04]', targetMonth: '' },
  { date: '2026-05-20', expense: 80.500, description: 'صيانة دورية للمعدات', targetMonth: '' },
  { date: '2026-06-01', expense: 150.000, description: 'دفعة مقدمة [تخص شهر 2026-05]', targetMonth: '2026-05' },
  { date: '2026-06-10', expense: 95.250, description: 'أدوات مكتبية', targetMonth: '' }
];

// Check due month assignments
assert(getEffectiveDueMonth(sampleExpenses[0]) === '2026-05', 'Expense 1 allocated to occurrence month 2026-05');
assert(getEffectiveDueMonth(sampleExpenses[1]) === '2026-04', 'Expense 2 extracted tag allocated to prior due month 2026-04');
assert(getEffectiveDueMonth(sampleExpenses[2]) === '2026-05', 'Expense 3 allocated to occurrence month 2026-05');
assert(getEffectiveDueMonth(sampleExpenses[3]) === '2026-05', 'Expense 4 allocated to explicit target month 2026-05');
assert(getEffectiveDueMonth(sampleExpenses[4]) === '2026-06', 'Expense 5 allocated to occurrence month 2026-06');

// Mathematical reconciliation of Due Months: Total sum must equal 100% of all expenses without omitting 1 fil
const dueMonthTotals: Record<string, number> = {};
let totalCalculatedExpensesFils = 0;

sampleExpenses.forEach(exp => {
  const m = getEffectiveDueMonth(exp);
  const expFils = toFils(exp.expense);
  totalCalculatedExpensesFils += expFils;
  dueMonthTotals[m] = (dueMonthTotals[m] || 0) + expFils;
});

const sumOfAllDueMonthsFils = Object.values(dueMonthTotals).reduce((a, b) => a + b, 0);
assert(sumOfAllDueMonthsFils === totalCalculatedExpensesFils, 'Sum of all due month expenses strictly equals total expenses (zero fil difference)');
assert(toKWD(dueMonthTotals['2026-04']) === 250.000, 'Month 2026-04 total is exactly 250.000 KWD');
assert(toKWD(dueMonthTotals['2026-05']) === 330.750, 'Month 2026-05 total is exactly 330.750 KWD (100.250 + 80.500 + 150.000)');
assert(toKWD(dueMonthTotals['2026-06']) === 95.250, 'Month 2026-06 total is exactly 95.250 KWD');
assert(toKWD(sumOfAllDueMonthsFils) === 676.000, 'Total distributed expenses = 676.000 KWD (100% complete without deletion or truncation)');

// 8. Search Any Word Across Recorded Transactions Tests (دون حذف أو اختصار)
console.log('\n[8] Testing Search on Any Word in Recorded Transactions...');

const recordedTransactions = [
  { id: 'TX-101', date: '2026-05-02', employee: 'محمد الأحمد', branch: 'فرع حولي', category: 'إيجارات', description: 'سداد إيجار المعرض عن شهر مايو', expense: 450.000, income: 0 },
  { id: 'TX-102', date: '2026-05-05', employee: 'خالد الدوسري', branch: 'فرع السالمية', category: 'كهرباء ومياه', description: 'فاتورة وزارة الكهرباء والماء الدورية', expense: 85.500, income: 0 },
  { id: 'TX-103', date: '2026-05-10', employee: 'علي القحطاني', branch: 'المركز الرئيسي', category: 'صيانة ونظافة', description: 'شراء أدوات نظافة ومطهرات للمقر', expense: 32.250, income: 0 },
  { id: 'TX-104', date: '2026-05-12', employee: 'محمد الأحمد', branch: 'فرع حولي', category: 'مبيعات نقدية', description: 'توريد إيرادات مبيعات نقدية للخزينة', expense: 0, income: 620.000 },
  { id: 'TX-105', date: '2026-05-15', employee: 'سالم الشمري', branch: 'فرع الشويخ', category: 'بضائع ومشتريات', description: 'شراء قطع غيار ومستلزمات صيانة للمستودع', expense: 190.000, income: 0 }
];

// Single word search across descriptions
const resElectricity = recordedTransactions.filter(t => isArabicSearchMatch('كهرباء', t.description, t.category, t.employee, t.branch, t.id, t.expense, t.income));
assert(resElectricity.length === 1 && resElectricity[0].id === 'TX-102', 'Search "كهرباء" matches TX-102');

// Multi-word search in any order
const resRentHawally = recordedTransactions.filter(t => isArabicSearchMatch('حولي إيجار', t.description, t.category, t.employee, t.branch, t.id, t.expense, t.income));
assert(resRentHawally.length === 1 && resRentHawally[0].id === 'TX-101', 'Multi-token search "حولي إيجار" matches TX-101 regardless of token order');

// Normalization: Alef with Hamza / without Hamza
const resAhmadWithoutHamza = recordedTransactions.filter(t => isArabicSearchMatch('احمد', t.description, t.category, t.employee, t.branch, t.id, t.expense, t.income));
assert(resAhmadWithoutHamza.length === 2, 'Search "احمد" (without hamza) matches both transactions of "الأحمد"');

// Search by amount / number
const resAmountSearch = recordedTransactions.filter(t => isArabicSearchMatch('450', t.description, t.category, t.employee, t.branch, t.id, t.expense, t.income));
assert(resAmountSearch.length === 1 && resAmountSearch[0].id === 'TX-101', 'Search by amount "450" matches TX-101');

// Search by Transaction ID / Code
const resIdSearch = recordedTransactions.filter(t => isArabicSearchMatch('TX-105', t.description, t.category, t.employee, t.branch, t.id, t.expense, t.income));
assert(resIdSearch.length === 1 && resIdSearch[0].id === 'TX-105', 'Search by ID "TX-105" matches TX-105');

// Verification of "دون حذف أو اختصار": When search query is empty, 100% of recorded transactions are preserved
const resEmptySearch = recordedTransactions.filter(t => isArabicSearchMatch('', t.description, t.category, t.employee, t.branch, t.id, t.expense, t.income));
assert(resEmptySearch.length === recordedTransactions.length, 'Empty search returns 100% of recorded transactions without deletion or abbreviation');

// 9. Transaction Edit Execution Tests (تنفيذ التعديل على الحركات دون حذف أو اختصار)
console.log('\n[9] Testing Transaction Edit Execution Without Deletion or Abbreviation...');

interface TestTransaction {
  id: string;
  rowId: string;
  date: string;
  employee: string;
  branch: string;
  department?: string | null;
  category: string;
  description: string;
  amount: number;
  amountFils: number;
  type: string;
  targetMonth?: string;
}

const transactionDatabase: TestTransaction[] = [
  {
    id: 'TX-201',
    rowId: 'TX-201',
    date: '2026-05-01',
    employee: 'بيتر ناصر',
    branch: 'الرئيسي',
    department: null,
    category: 'نثريات',
    description: 'شراء ورق طباعة وأقلام',
    amount: 15.250,
    amountFils: 15250,
    type: 'Expense',
    targetMonth: '2026-05'
  },
  {
    id: 'TX-202',
    rowId: 'TX-202',
    date: '2026-05-04',
    employee: 'بيتر ناصر',
    branch: 'فرع حولي',
    department: null,
    category: 'ضيافة',
    description: 'مشروبات وضيافة عملاء',
    amount: 8.500,
    amountFils: 8500,
    type: 'Expense',
    targetMonth: '2026-05'
  }
];

function updateTransactionInDb(id: string, updateData: Partial<TestTransaction>): { success: boolean; transaction: TestTransaction } {
  const idx = transactionDatabase.findIndex(t => t.id === id || t.rowId === id);
  if (idx === -1) {
    const newTx: TestTransaction = {
      id,
      rowId: id,
      date: updateData.date || '2026-05-01',
      employee: updateData.employee || 'بيتر ناصر',
      branch: updateData.branch || 'الرئيسي',
      category: updateData.category || 'عام',
      description: updateData.description || '',
      amount: updateData.amount || 0,
      amountFils: toFils(updateData.amount || 0),
      type: updateData.type || 'Expense',
      targetMonth: updateData.targetMonth
    };
    transactionDatabase.push(newTx);
    return { success: true, transaction: newTx };
  }

  const prev = transactionDatabase[idx];
  const newAmount = updateData.amount !== undefined ? updateData.amount : prev.amount;
  const updated: TestTransaction = {
    ...prev,
    ...updateData,
    amount: newAmount,
    amountFils: toFils(newAmount)
  };
  transactionDatabase[idx] = updated;
  return { success: true, transaction: updated };
}

// Test 1: Editing amount, description, and target month
const editRes = updateTransactionInDb('TX-201', {
  amount: 22.750,
  description: 'شراء ورق طباعة فاخر وأحبار ملونة',
  targetMonth: '2026-06',
  branch: 'سيتي',
  department: 'المطبخ والإنتاج'
});

assert(editRes.success === true, 'Edit executed successfully on transaction TX-201');
assert(transactionDatabase[0].amount === 22.750, 'Updated transaction amount is exact 22.750 KWD');
assert(transactionDatabase[0].amountFils === 22750, 'Updated transaction fils is exact 22750 fils');
assert(transactionDatabase[0].description === 'شراء ورق طباعة فاخر وأحبار ملونة', 'Updated description preserved completely');
assert(transactionDatabase[0].targetMonth === '2026-06', 'Updated targetMonth preserved without truncation');
assert(transactionDatabase[0].branch === 'سيتي' && transactionDatabase[0].department === 'المطبخ والإنتاج', 'Branch and department updated properly');

// Test 2: Database integrity check - all transactions preserved without loss
assert(transactionDatabase.length === 2, 'Transaction count strictly preserved at 2 (no deletion or abbreviation)');

// Test 3: Upsert capability when editing transaction with composite id
const upsertRes = updateTransactionInDb('2026-05-10_3', {
  date: '2026-05-10',
  employee: 'محمد جابر',
  amount: 45.000,
  description: 'إصلاح تكييف فرع السالمية'
});
assert(upsertRes.success === true, 'Editing transaction with generated ID executes and upserts seamlessly');
assert(transactionDatabase.length === 3, 'Total records now 3 after safe upsert');

// 10. Precision Balance Accounting Model & Accrual Classification Accuracy Tests
console.log('\n[10] Testing Precision Balance Accounting Model & Accrual Classification...');

// Test 1: Real cash expenses with words like "مورد", "مستحقات", "دينمو" MUST NOT be treated as accruals
assert(isAccrualType('Expense', 'مشتريات', 'شراء كراتين من المورد شركة الأحمد') === false, 'Expense mentioning "المورد" is cash and deducts from balance');
assert(isAccrualType('Expense', 'رواتب', 'صرف مستحقات إجازة للموظف') === false, 'Expense mentioning "مستحقات" is cash and deducts from balance');
assert(isAccrualType('Expense', 'صيانة', 'إصلاح وتبديل دينمو المكيف') === false, 'Expense mentioning "دينمو" is cash and deducts from balance');
assert(isAccrualType('Expense', 'فواتير', 'سداد فاتورة هاتف مستحقة') === false, 'Cash settlement of bill is cash and deducts from balance');

// Test 2: Explicit accrual credit commitments MUST be treated as non-cash accrual
assert(isAccrualType('Expense', 'مشتريات آجلة', '[مستحق/آجل] توريد بضاعة لم تسدد') === true, 'Explicit [مستحق/آجل] is identified as accrual');
assert(isAccrualType('Accrual', 'التزامات', 'فاتورة على الحساب لم تسدد') === true, 'Explicit type "Accrual" is identified as accrual');

// Test 3: Prior period opening balance roll-up and statement balance identity
const historicalTransactions = [
  { date: '2026-01-10', income: 200.000, expense: 0, isAccrued: false },
  { date: '2026-01-20', income: 0, expense: 50.000, isAccrued: false },
  // Boundary: Start date 2026-02-01. Balance at start of Feb must be 150.000 KWD
  { date: '2026-02-05', income: 100.000, expense: 0, isAccrued: false },
  { date: '2026-02-15', income: 0, expense: 30.000, isAccrued: false },
  { date: '2026-02-20', income: 0, expense: 20.000, isAccrued: true } // Accrual (not deducted from cash)
];

const startDate = '2026-02-01';
const priorTxs = historicalTransactions.filter(t => t.date < startDate);
const periodTxs = historicalTransactions.filter(t => t.date >= startDate);

let priorFils = 0;
priorTxs.forEach(t => {
  priorFils += toFils(t.income) - (t.isAccrued ? 0 : toFils(t.expense));
});
const calculatedOpeningKWD = toKWD(priorFils);
assert(calculatedOpeningKWD === 150.000, 'Prior period transactions roll up into exact 150.000 KWD opening balance');

let runningBalanceFils = priorFils;
const computedPeriodTxs = periodTxs.map(t => {
  const inc = toFils(t.income);
  const exp = t.isAccrued ? 0 : toFils(t.expense);
  runningBalanceFils += inc - exp;
  return { ...t, computedBalance: toKWD(runningBalanceFils) };
});

assert(computedPeriodTxs[0].computedBalance === 250.000, 'Feb 5 income brings balance to exact 250.000 KWD (150 + 100)');
assert(computedPeriodTxs[1].computedBalance === 220.000, 'Feb 15 expense brings balance to exact 220.000 KWD (250 - 30)');
assert(computedPeriodTxs[2].computedBalance === 220.000, 'Feb 20 accrual does not change cash balance (remains 220.000 KWD)');

// Search filter test: filtering MUST NOT alter historical row balance
const searchFiltered = computedPeriodTxs.filter(t => t.expense === 30.000);
assert(searchFiltered.length === 1, 'Search filter matches 1 row');
assert(searchFiltered[0].computedBalance === 220.000, 'Filtered row strictly preserves its true historical running balance 220.000 KWD');

console.log('----------------------------------------------------');
console.log(`🎯 COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('----------------------------------------------------');
