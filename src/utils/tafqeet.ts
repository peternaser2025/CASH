/**
 * Arabic Tafqeet (Number to Words) Utility tailored for Kuwaiti Dinar (KWD)
 * Converts numbers with 3 decimal places (Fils) to formal Arabic text
 * e.g., 250.750 => "فقط مائتان وخمسون ديناراً كويتياً وسبعمائة وخمسون فلساً لا غير"
 */

const ones: string[] = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر',
  'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
];

const tens: string[] = [
  '', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'
];

const hundreds: string[] = [
  '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'
];

const thousandsGroups: { singular: string; dual: string; plural: string }[] = [
  { singular: '', dual: '', plural: '' },
  { singular: 'ألف', dual: 'ألفان', plural: 'آلاف' },
  { singular: 'مليون', dual: 'مليونان', plural: 'ملايين' },
  { singular: 'مليار', dual: 'ملياران', plural: 'مليارات' }
];

function convertThreeDigits(num: number): string {
  if (num === 0) return '';
  const h = Math.floor(num / 100);
  const rem = num % 100;
  const parts: string[] = [];

  if (h > 0) {
    parts.push(hundreds[h]);
  }

  if (rem > 0) {
    if (rem < 20) {
      parts.push(ones[rem]);
    } else {
      const o = rem % 10;
      const t = Math.floor(rem / 10);
      if (o > 0) {
        parts.push(ones[o] + ' و' + tens[t]);
      } else {
        parts.push(tens[t]);
      }
    }
  }

  return parts.join(' و');
}

export function numberToArabicWords(num: number): string {
  if (num === 0) return 'صفر';
  if (num < 0) return 'سالب ' + numberToArabicWords(Math.abs(num));

  const integerPart = Math.floor(num);
  if (integerPart === 0) return 'صفر';

  const parts: string[] = [];
  let temp = integerPart;
  let groupIndex = 0;

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      let chunkText = '';
      if (groupIndex === 0) {
        chunkText = convertThreeDigits(chunk);
      } else if (groupIndex === 1) {
        // Thousands
        if (chunk === 1) {
          chunkText = thousandsGroups[1].singular;
        } else if (chunk === 2) {
          chunkText = thousandsGroups[1].dual;
        } else if (chunk >= 3 && chunk <= 10) {
          chunkText = convertThreeDigits(chunk) + ' ' + thousandsGroups[1].plural;
        } else {
          chunkText = convertThreeDigits(chunk) + ' ' + thousandsGroups[1].singular;
        }
      } else if (groupIndex === 2) {
        // Millions
        if (chunk === 1) {
          chunkText = thousandsGroups[2].singular;
        } else if (chunk === 2) {
          chunkText = thousandsGroups[2].dual;
        } else if (chunk >= 3 && chunk <= 10) {
          chunkText = convertThreeDigits(chunk) + ' ' + thousandsGroups[2].plural;
        } else {
          chunkText = convertThreeDigits(chunk) + ' ' + thousandsGroups[2].singular;
        }
      } else {
        chunkText = convertThreeDigits(chunk) + ' ' + thousandsGroups[groupIndex]?.singular;
      }
      parts.unshift(chunkText);
    }
    temp = Math.floor(temp / 1000);
    groupIndex++;
  }

  return parts.join(' و');
}

/**
 * Converts KWD amount into complete formal financial wording with Fils
 */
export function tafqeetKWD(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) {
    return 'فقط صفر دينار كويتي لا غير';
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const dinars = Math.floor(absNum);
  const fils = Math.round((absNum - dinars) * 1000);

  let result = 'فقط ';
  if (isNegative) result += 'سالب ';

  if (dinars > 0) {
    const dinarWords = numberToArabicWords(dinars);
    if (dinars === 1) {
      result += 'دينار كويتي واحد';
    } else if (dinars === 2) {
      result += 'ديناران كويتيان';
    } else if (dinars >= 3 && dinars <= 10) {
      result += `${dinarWords} دنانير كويتية`;
    } else {
      result += `${dinarWords} ديناراً كويتياً`;
    }
  }

  if (fils > 0) {
    const filsWords = numberToArabicWords(fils);
    if (dinars > 0) result += ' و';
    if (fils === 1) {
      result += 'فلس واحد';
    } else if (fils === 2) {
      result += 'فلسان';
    } else if (fils >= 3 && fils <= 10) {
      result += `${filsWords} فلوس`;
    } else {
      result += `${filsWords} فلساً`;
    }
  }

  result += ' لا غير';
  return result;
}
