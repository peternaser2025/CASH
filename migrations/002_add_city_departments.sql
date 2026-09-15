-- ============================================================================
-- MIGRATION 002: Add Internal Departments for Branch "سيتي" Only
-- Departments: بهارات (spices) / غذائي (food) / استهلاكي (consumer)
-- Additive migration: Does not touch or modify existing legacy records (department_id is NULL)
-- ============================================================================

-- 1. جدول الأقسام الثلاثة
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- إدراج الأقسام الثلاثة المحددة
INSERT INTO departments (code, name_ar) VALUES
    ('spices', 'بهارات'),
    ('food', 'غذائي'),
    ('consumer', 'استهلاكي')
ON CONFLICT (name_ar) DO NOTHING;

-- 2. عمود إضافي قابل للـ NULL على مستوى المعاملة نفسها
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- 3. Trigger لمنع تسجيل قسم على أي فرع غير "سيتي"
CREATE OR REPLACE FUNCTION enforce_department_only_for_city_branch()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_name TEXT;
BEGIN
    IF NEW.department_id IS NOT NULL THEN
        SELECT name_ar INTO v_branch_name FROM branches WHERE id = NEW.branch_id;
        IF v_branch_name IS DISTINCT FROM 'سيتي' THEN
            RAISE EXCEPTION 'لا يمكن تحديد قسم إلا لحركات فرع "سيتي" فقط. الفرع الحالي: %', v_branch_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_department_city_only ON expenses;
CREATE TRIGGER trg_enforce_department_city_only
BEFORE INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION enforce_department_only_for_city_branch();

-- 4. سياسة RLS للقراءة فقط على جدول الأقسام
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_read" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write" ON departments FOR ALL TO authenticated USING (is_finance_manager_or_admin());
