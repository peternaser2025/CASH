/**
 * Exact Financial Precision Engine for Kuwaiti Dinar (KWD)
 * 1 KWD = 1,000 Fils (Exact integer arithmetic prevents floating-point precision errors)
 */

/**
 * Converts any KWD amount (number or string) to exact integer Fils.
 * E.g., 12.345 KWD -> 12345 fils
 * Avoids IEEE 754 floating-point drift by rounding to nearest integer after scaling.
 */
export function toFils(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, '').trim());
  if (isNaN(num)) return 0;
  return Math.round(num * 1000);
}

/**
 * Converts exact integer Fils to KWD floating value with maximum safety.
 * E.g., 12345 fils -> 12.345 KWD
 */
export function toKWD(fils: number): number {
  if (isNaN(fils)) return 0;
  return fils / 1000;
}

/**
 * Exact addition of two KWD amounts in integer Fils.
 */
export function addMoney(a: number | string, b: number | string): number {
  return toKWD(toFils(a) + toFils(b));
}

/**
 * Exact subtraction of two KWD amounts in integer Fils.
 */
export function subMoney(a: number | string, b: number | string): number {
  return toKWD(toFils(a) - toFils(b));
}

/**
 * Exact multiplication of KWD amount by quantity/multiplier.
 */
export function mulMoney(amount: number | string, multiplier: number): number {
  const fils = toFils(amount);
  return toKWD(Math.round(fils * multiplier));
}

/**
 * Sums an array of KWD amounts using integer Fils accumulation.
 */
export function sumMoney(amounts: (number | string | null | undefined)[]): number {
  const totalFils = amounts.reduce<number>((acc, cur) => acc + toFils(cur), 0);
  return toKWD(totalFils);
}

/**
 * Formats integer Fils or KWD amount into exact Kuwaiti Dinar currency format (3 decimal places).
 * E.g., 1250 fils -> "1.250 د.ك"
 */
export function formatKWDFromFils(fils: number, showSymbol = true): string {
  const kwd = toKWD(fils);
  const formatted = kwd.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
  return showSymbol ? `${formatted} د.ك` : formatted;
}

/**
 * Checks if two amounts are mathematically equal to the exact fil.
 */
export function isMoneyEqual(a: number | string, b: number | string): boolean {
  return toFils(a) === toFils(b);
}

/**
 * Stable ID normalizer for names, branches, and categories.
 * Strips diacritics, extra whitespaces, and normalizes Arabic characters
 * to ensure bulletproof .find() and .filter() without string divergence.
 */
export function normalizeEntityId(name: string | null | undefined): string {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // Remove tashkeel/diacritics
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0621-\u064A_]/g, '');
}
