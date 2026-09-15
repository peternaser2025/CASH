-- ============================================================================
-- 003_excel_import_tables.sql
-- جدول استيراد وتخزين شيت الإكسيل بالترتيب الأصلي 1:1
-- ============================================================================

CREATE TABLE IF NOT EXISTS excel_raw_ledger (
    row_index BIGINT PRIMARY KEY,                      -- رقم السطر الفعلي في الإكسيل (2, 3, 4...)
    raw_id TEXT,                                      -- رقم المعاملة أو المعرف في الإكسيل
    raw_date TEXT,                                    -- التاريخ كما هو مسجل
    raw_employee TEXT,                                -- اسم الموظف / العهدة
    raw_branch TEXT,                                  -- اسم الفرع
    raw_department TEXT,                              -- القسم الداخلي (خاص بفرع سيتي أو عام)
    raw_type TEXT,                                    -- نوع الحركة (مصروف / إيراد / تحويل / إغلاق شهر / تصفير)
    raw_category TEXT,                                -- بند المصروف والتصنيف
    raw_amount NUMERIC(12, 3) DEFAULT 0.000,          -- المبلغ بالدينار الكويتي بدقة 3 خانات عشرية (فلس)
    raw_description TEXT,                             -- البيان والملاحظات
    raw_related_id TEXT,                              -- رقم السند / المعاملة المرتبطة / قيد اليومية
    raw_timestamp TEXT,                               -- الطابع الزمني في الشيت
    raw_computer_number TEXT,                         -- رقم الكمبيوتر أو المعرف التقني
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()     -- وقت الرفع للقاعدة
);

-- فهرس لضمان سرعة الاستعلام والفرز بنفس الترتيب
CREATE INDEX IF NOT EXISTS idx_excel_raw_ledger_row_index ON excel_raw_ledger(row_index ASC);

-- تفعيل سياسات الأمان
ALTER TABLE excel_raw_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "excel_raw_ledger_select" ON excel_raw_ledger 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "excel_raw_ledger_all" ON excel_raw_ledger 
FOR ALL TO authenticated USING (true);
