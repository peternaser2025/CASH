/**
 * وحدة حماية الأداء وسلامة البيانات (Data Integrity & Safety Service)
 * -------------------------------------------------------------
 * توفر هذه الوحدة جميع الآليات والوظائف البرمجية المطلوبة لحماية بيانات تطبيق المحاسبة والكاشير:
 * 1. معالجة الآمنة للتخزين المحلي (Safe LocalStorage) مع التعامل مع الأخطاء Try-Catch.
 * 2. الحفظ الاحتياطي التلقائي (Auto-Backup) وإدارة النسخ الاحتياطية المتعاقبة.
 * 3. دمج البيانات والبنود بأمان (Safe Merging CRUD) استناداً إلى المعرف الفريد ID.
 * 4. منع الحذف النهائي العشوائي عبر التأكيد الثنائي (Double Confirmation Dialog).
 * 5. تحسين الأداء والتفاعل (Debouncing & Throttling & Custom React Hooks).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ==========================================
// 1. تقنيات تحسين الأداء (Performance Utilities)
// ==========================================

/**
 * دالة Debounce لتأخير تنفيذ العمليات المتكررة (مثل البحث والإدخال السريع)
 * تمنع تعليق المتصفح أو بطء الواجهة أثناء الكتابة.
 */
export function debounce<T extends (...args: any[]) => any>(func: T, delay: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debouncedFunc = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };

  debouncedFunc.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  return debouncedFunc;
}

/**
 * دالة Throttle للحد من معدل تنفيذ الأحداث المتكررة بكثرة (مثل التمرير Scroll أو إعادة الحجم Resize)
 */
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number = 200) {
  let inThrottle: boolean = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ==========================================
// 2. إدارة التخزين المحلي والنسخ الاحتياطي (Safe LocalStorage & Auto-Backup)
// ==========================================

export interface BackupSnapshot<T = any> {
  id: string;
  timestamp: string;
  data: T;
  note?: string;
  itemCount?: number;
}

export class SafeStorage {
  /**
   * قراءة آمنة من LocalStorage مع معالجة الأخطاء والـ Fallback
   */
  static getItem<T>(key: string, defaultValue: T): T {
    try {
      if (typeof window === 'undefined') return defaultValue;
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[DataIntegrity Error] فشل قراءة البيانات من المفتاح "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * كتابة آمنة في LocalStorage مع Try-Catch وتفادي تجاوز المساحة المتاحة (QuotaExceeded)
   */
  static setItem<T>(key: string, value: T): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`[DataIntegrity Error] فشل حفظ البيانات للمفتاح "${key}":`, error);
      // في حالة امتلاء الذاكرة LocalStorage Quota Exceeded
      if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
        alert('تنبيه: المساحة المتاحة للتخزين المحلي متخمة. يرجى تصدير نسخة احتياطية وتنظيف البيانات القديمة.');
      }
      return false;
    }
  }

  /**
   * حذف عنصر من LocalStorage بأمان
   */
  static removeItem(key: string): boolean {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[DataIntegrity Error] فشل حذف المفتاح "${key}":`, error);
      return false;
    }
  }

  /**
   * حفظ نسخة احتياطية تلقائية (Auto-Backup) مع الاحتفاظ بأحدث N نسخة متعاقبة
   */
  static createAutoBackup<T>(backupPrefixKey: string, data: T, maxBackups: number = 5): boolean {
    try {
      const backupIndexKey = `${backupPrefixKey}_snapshots_meta`;
      const snapshots = this.getItem<BackupSnapshot<T>[]>(backupIndexKey, []);

      const newSnapshot: BackupSnapshot<T> = {
        id: `backup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        data: data,
        itemCount: Array.isArray(data) ? data.length : 1,
        note: 'نسخة احتياطية تلقائية'
      };

      // إضافة النسخة الجديدة في بداية القائمة
      const updatedSnapshots = [newSnapshot, ...snapshots].slice(0, maxBackups);
      
      // حفظ القائمة المحدثة
      return this.setItem(backupIndexKey, updatedSnapshots);
    } catch (error) {
      console.error('[DataIntegrity Error] فشل إنشاء النسخة الاحتياطية التلقائية:', error);
      return false;
    }
  }

  /**
   * استرجاع قائمة النسخ الاحتياطية المحفوظة
   */
  static getBackupsList<T>(backupPrefixKey: string): BackupSnapshot<T>[] {
    const backupIndexKey = `${backupPrefixKey}_snapshots_meta`;
    return this.getItem<BackupSnapshot<T>[]>(backupIndexKey, []);
  }

  /**
   * تصدير بيانات النظام إلى ملف JSON خارجي للتحميل
   */
  static exportDataToFile(data: any, fileName: string = `backup_${new Date().toISOString().slice(0, 10)}.json`) {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('[DataIntegrity Error] فشل تصدير الملف:', error);
      return false;
    }
  }

  /**
   * استيراد بيانات من ملف JSON وتدقيق صحتها قبل الاعتماد
   */
  static importDataFromFile<T>(file: File): Promise<T> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content) as T;
          if (!parsed) {
            throw new Error('الملف فارغ أو صيغته غير صحيحة');
          }
          resolve(parsed);
        } catch (err) {
          reject(new Error('صيغة ملف JSON غير صالحة'));
        }
      };
      reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الملف'));
      reader.readAsText(file);
    });
  }
}

// ==========================================
// 3. دمج البنود بأمان (Safe Merging & CRUD)
// ==========================================

export interface IdentifiableItem {
  id: string | number;
  updatedAt?: string;
  [key: string]: any;
}

/**
 * دالة دمج وتحديث البنود بأمان (Safe Merging)
 * - تبحث عن البنود حسب المعرف الفريد ID
 * - تقوم بتحديث البنود المعدلة دون مسح أي من البنود القائمة
 * - تضيف البنود الجديدة التي لا تملك معرفات سابقة
 */
export function safeMergeItems<T extends IdentifiableItem>(
  existingItems: T[],
  incomingItems: T[],
  conflictStrategy: 'merge' | 'overwrite' = 'merge'
): T[] {
  if (!Array.isArray(existingItems)) existingItems = [];
  if (!Array.isArray(incomingItems)) incomingItems = [];

  const itemsMap = new Map<string | number, T>();

  // 1. تعبئة البنود الحالية في الخريطة
  existingItems.forEach(item => {
    if (item && item.id !== undefined && item.id !== null) {
      itemsMap.set(item.id, { ...item });
    }
  });

  // 2. دمج أو إدراج البنود الواردة
  incomingItems.forEach(incomingItem => {
    if (!incomingItem || incomingItem.id === undefined || incomingItem.id === null) return;

    const existing = itemsMap.get(incomingItem.id);

    if (existing) {
      if (conflictStrategy === 'merge') {
        // دمج الخصائص مع عدم طمس الخصائص غير الموجودة في العنصر الجديد
        itemsMap.set(incomingItem.id, {
          ...existing,
          ...incomingItem,
          updatedAt: new Date().toISOString()
        });
      } else {
        // استبدال كامل
        itemsMap.set(incomingItem.id, {
          ...incomingItem,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      // عنصر جديد كلياً
      itemsMap.set(incomingItem.id, {
        ...incomingItem,
        updatedAt: incomingItem.updatedAt || new Date().toISOString()
      });
    }
  });

  return Array.from(itemsMap.values());
}

// ==========================================
// 4. حماية وتأكيد الحذف النهائي (Double Confirmation)
// ==========================================

export interface DoubleConfirmationOptions {
  title?: string;
  itemName?: string;
  requireTypedWord?: boolean; // خيار إجبار كتابة كلمة تأكيد مثل "تأكيد" للحذف الحساس
  wordToType?: string;
}

/**
 * دالة إجراء تأكيد ثنائي لمنع الحذف النهائي العشوائي للبيانات والبنود
 */
export async function confirmHardDelete(options: DoubleConfirmationOptions = {}): Promise<boolean> {
  const {
    title = 'تأكيد الحذف النهائي',
    itemName = 'هذا العنصر',
    requireTypedWord = false,
    wordToType = 'حذف'
  } = options;

  // المرحلة الأولى من التأكيد
  const step1 = window.confirm(`⚠️ ${title}\n\nهل أنت متأكد تماماً من رغبتك في حذف (${itemName}) نهائياً؟\nهذا الإجراء غير قابل للاسترداد!`);
  if (!step1) return false;

  // المرحلة الثانية من التأكيد
  if (requireTypedWord) {
    const userInput = window.prompt(`🔒 تأكيد ثنائي للأمان:\n\nيرجى كتابة كلمة "${wordToType}" في الصندوق أدناه لإتمام عملية الحذف النهائي:`);
    if (userInput !== wordToType) {
      alert('❌ تم إلغاء عملية الحذف: كلمة التأكيد غير مطابقة.');
      return false;
    }
  } else {
    const step2 = window.confirm(`🛑 تأكيد إضافي لأمان البيانات:\n\nتأكيد أخير: اضغط (موافق) للتأكيد النهائي أو (إلغاء) للتراجع.`);
    if (!step2) return false;
  }

  return true;
}

// ==========================================
// 5. Custom React Hooks (التكامل مع واجهة المستخدم)
// ==========================================

/**
 * Hook للـ Debounce على مستوى مدخلات القيمة في React
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook للتخزين المحلي التفاعلي المباشر (Reactive LocalStorage)
 */
export function useSafeLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return SafeStorage.getItem<T>(key, initialValue);
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const nextValue = value instanceof Function ? value(prev) : value;
      SafeStorage.setItem(key, nextValue);
      return nextValue;
    });
  }, [key]);

  const removeValue = useCallback(() => {
    SafeStorage.removeItem(key);
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook الحفظ الاحتياطي التلقائي الدوري (Auto-Backup Hook)
 */
export function useAutoBackup<T>(backupKey: string, data: T, intervalMinutes: number = 10) {
  const lastBackupRef = useRef<string>('');

  useEffect(() => {
    if (!data) return;

    const dataString = JSON.stringify(data);
    
    // عدم حفظ النسخة إذا لم تتغير البيانات
    if (dataString === lastBackupRef.current) return;

    const backupInterval = setInterval(() => {
      const success = SafeStorage.createAutoBackup(backupKey, data);
      if (success) {
        lastBackupRef.current = dataString;
        console.log(`[AutoBackup Success] تم حفظ نسخة احتياطية تلقائية لـ (${backupKey}) بتاريخ ${new Date().toLocaleTimeString('ar-KW')}`);
      }
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(backupInterval);
  }, [backupKey, data, intervalMinutes]);
}
