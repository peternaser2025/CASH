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

console.log('----------------------------------------------------');
console.log(`🎯 COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('----------------------------------------------------');
