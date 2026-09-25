import { toFils, toKWD, addMoney, subMoney, sumMoney, isMoneyEqual, normalizeEntityId } from '../src/utils/money';
import { performReconciliation } from '../server/reconciliation';
import { transactionSchema, orderSchema } from '../server/validation';

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

console.log('----------------------------------------------------');
console.log(`🎯 COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('----------------------------------------------------');
