-- ============================================================================
-- KWD FINANCE ENGINE - REVISED ENTERPRISE SCHEMA (WITH MONTHLY CLOSINGS & RLS)
-- Currency: Kuwaiti Dinar (KWD) | Precision: NUMERIC(12, 3) -> 1 KWD = 1000 Fils
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('custodian', 'auditor', 'financial_manager', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type_enum AS ENUM ('expense', 'transfer_in', 'transfer_out', 'income', 'settlement', 'monthly_closing');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status_enum AS ENUM ('balanced', 'deficit', 'surplus');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM ('draft', 'approved', 'delivered', 'invoiced', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE approval_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. جدول الفروع ومراكز التكلفة
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL UNIQUE,
    name_en TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول أمناء العهد والمستخدمين
CREATE TABLE IF NOT EXISTS custodians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    phone TEXT,
    role user_role_enum NOT NULL DEFAULT 'custodian',
    is_central_treasury BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول حسابات ودورات العهدة
CREATE TABLE IF NOT EXISTS custody_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custodian_id UUID NOT NULL REFERENCES custodians(id) ON DELETE RESTRICT,
    cycle_name TEXT NOT NULL,
    opening_balance NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    total_received NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    total_spent NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    current_balance NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_custodian_cycle UNIQUE (custodian_id, cycle_name)
);

-- 4. جدول تصنيفات المصروفات
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name_ar TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. جدول المصروفات
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT UNIQUE NOT NULL,
    custody_account_id UUID NOT NULL REFERENCES custody_accounts(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES expense_categories(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount >= 0.000),
    transaction_date DATE NOT NULL,
    accrual_month VARCHAR(7) NOT NULL CHECK (accrual_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'نقد / عهدة',
    receipt_attachment_url TEXT,
    legacy_related_id TEXT,
    is_deferred BOOLEAN NOT NULL DEFAULT FALSE,
    settled_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول تحويلات العهد
CREATE TABLE IF NOT EXISTS custody_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT UNIQUE NOT NULL,
    source_custody_account_id UUID NOT NULL REFERENCES custody_accounts(id) ON DELETE RESTRICT,
    destination_custody_account_id UUID NOT NULL REFERENCES custody_accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0.000),
    transfer_date DATE NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    voucher_attachment_url TEXT,
    legacy_related_id TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_different_transfer_accounts CHECK (source_custody_account_id <> destination_custody_account_id)
);

-- 7. جدول الإيرادات الحقيقية والتعزيز المباشر (Direct Incomes)
CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    custody_account_id UUID NOT NULL REFERENCES custody_accounts(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0.000),
    income_date DATE NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_description TEXT NOT NULL,
    legacy_related_id TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. جدول قيود الإقفال والتصفية الشهرية العامة (Monthly Closings)
CREATE TABLE IF NOT EXISTS monthly_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_number TEXT UNIQUE NOT NULL,
    closing_month VARCHAR(7) NOT NULL CHECK (closing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    closing_date DATE NOT NULL,
    total_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    description TEXT NOT NULL,
    closing_type TEXT NOT NULL DEFAULT 'MONTHLY_SETTLEMENT',
    related_legacy_id TEXT,
    journal_entry_id UUID,
    approved_by UUID REFERENCES custodians(id),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. جدول شجرة الحسابات واليومية العامة
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code TEXT UNIQUE NOT NULL,
    account_name_ar TEXT NOT NULL UNIQUE,
    account_type TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number TEXT UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    memo TEXT NOT NULL,
    is_posted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (debit >= 0.000),
    credit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (credit >= 0.000),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    custodian_id UUID REFERENCES custodians(id) ON DELETE SET NULL,
    notes TEXT,
    CONSTRAINT chk_debit_or_credit CHECK ((debit > 0.000 AND credit = 0.000) OR (credit > 0.000 AND debit = 0.000))
);

-- 10. جداول دورة المشتريات
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    supplier_name TEXT NOT NULL,
    total_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_amount >= 0.000),
    status order_status_enum NOT NULL DEFAULT 'draft',
    order_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL CHECK (unit_price >= 0.000),
    total_price NUMERIC(12, 3) NOT NULL CHECK (total_price >= 0.000)
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    received_date DATE NOT NULL,
    receiver_custodian_id UUID REFERENCES custodians(id) ON DELETE RESTRICT,
    delivery_note_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. جداول الجرد والتسويات والاعتمادات والأرشيف
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number TEXT UNIQUE NOT NULL,
    custody_account_id UUID NOT NULL REFERENCES custody_accounts(id) ON DELETE RESTRICT,
    session_date DATE NOT NULL,
    book_balance NUMERIC(12, 3) NOT NULL,
    counted_cash_balance NUMERIC(12, 3) NOT NULL,
    difference_amount NUMERIC(12, 3) NOT NULL,
    status settlement_status_enum NOT NULL,
    settlement_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    notes TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    document_id UUID NOT NULL,
    prepared_by UUID REFERENCES custodians(id),
    prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    audited_by UUID REFERENCES custodians(id),
    audited_at TIMESTAMPTZ,
    audited_status approval_status_enum NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES custodians(id),
    approved_at TIMESTAMPTZ,
    approved_status approval_status_enum NOT NULL DEFAULT 'pending',
    received_by UUID REFERENCES custodians(id),
    received_at TIMESTAMPTZ,
    digital_signature_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS & Policies
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE custodians ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
