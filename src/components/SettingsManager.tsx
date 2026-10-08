import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Tag, 
  Users, 
  Briefcase, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Filter, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  Code, 
  Copy, 
  ExternalLink, 
  FileSpreadsheet, 
  CheckCircle2, 
  Layers, 
  Phone, 
  BadgeCheck, 
  Power,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { 
  BranchSetting, 
  CategorySetting, 
  VendorSetting, 
  EmployeeSetting, 
  SystemSettings 
} from '../types';
import { GOOGLE_APPS_SCRIPT_FULL_CODE } from '../utils/googleAppsScriptCode';
import { formatKWD } from '../utils/format';

interface SettingsManagerProps {
  onRefreshParentState?: () => void;
}

type ActiveSubTab = 'branches' | 'categories' | 'vendors' | 'employees' | 'scripts';

const PARENT_CATEGORIES = [
  'تشغيلي',
  'إداري',
  'ثابت',
  'إيرادات',
  'التزامات',
  'عمومية',
  'أخرى'
];

export default function SettingsManager({ onRefreshParentState }: SettingsManagerProps) {
  const [activeTab, setActiveTab] = useState<ActiveSubTab>('branches');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Core Data
  const [branches, setBranches] = useState<BranchSetting[]>([]);
  const [categories, setCategories] = useState<CategorySetting[]>([]);
  const [vendors, setVendors] = useState<VendorSetting[]>([]);
  const [employees, setEmployees] = useState<EmployeeSetting[]>([]);

  // Modals state
  const [editModalItem, setEditModalItem] = useState<{ type: ActiveSubTab; item?: any } | null>(null);
  const [integrityAlert, setIntegrityAlert] = useState<{
    isOpen: boolean;
    type: string;
    item: any;
    canDelete: boolean;
    linkedCount: number;
    sampleTransactions?: any[];
    reason?: string;
  } | null>(null);

  // Script execution feedback
  const [scriptFeedback, setScriptFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Settings
  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await gasService.getSettings();
      if (data && data.settings) {
        setBranches(data.settings.branches || []);
        setCategories(data.settings.categories || []);
        setVendors(data.settings.vendors || []);
        setEmployees(data.settings.employees || []);
      } else {
        // Fallback or derive from simple arrays
        if (Array.isArray(data?.branches)) {
          setBranches(data.branches.map((b, i) => ({
            id: `BR-${String(i + 1).padStart(3, '0')}`,
            branchId: `BR-${String(i + 1).padStart(3, '0')}`,
            name: typeof b === 'string' ? b : (b as any).name,
            isActive: true
          })));
        }
        if (Array.isArray(data?.categories)) {
          setCategories(data.categories.map((c, i) => ({
            id: `CAT-${String(i + 1).padStart(3, '0')}`,
            categoryId: `CAT-${String(i + 1).padStart(3, '0')}`,
            name: typeof c === 'string' ? c : (c as any).name,
            parentCategory: 'عام',
            isActive: true
          })));
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Save Settings
  const saveAllSettings = async (
    newBranches = branches,
    newCategories = categories,
    newVendors = vendors,
    newEmployees = employees
  ) => {
    setSaving(true);
    try {
      const payload: SystemSettings = {
        branches: newBranches,
        categories: newCategories,
        vendors: newVendors,
        employees: newEmployees,
        lastSync: new Date().toISOString()
      };
      await gasService.updateSettings(payload);
      setBranches(newBranches);
      setCategories(newCategories);
      setVendors(newVendors);
      setEmployees(newEmployees);
      if (onRefreshParentState) onRefreshParentState();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (type: ActiveSubTab, id: string) => {
    if (type === 'branches') {
      const updated = branches.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b);
      await saveAllSettings(updated, categories, vendors, employees);
    } else if (type === 'categories') {
      const updated = categories.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
      await saveAllSettings(branches, updated, vendors, employees);
    } else if (type === 'vendors') {
      const updated = vendors.map(v => v.id === id ? { ...v, isActive: !v.isActive } : v);
      await saveAllSettings(branches, categories, updated, employees);
    } else if (type === 'employees') {
      const updated = employees.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e);
      await saveAllSettings(branches, categories, vendors, updated);
    }
  };

  // Pre-flight check before deleting an item
  const handleDeleteRequest = async (type: ActiveSubTab, item: any) => {
    const singleType = type.slice(0, -1) as any; // e.g. branch, category, vendor, employee
    const check = await gasService.checkReferentialIntegrity(singleType, item.name, item.id);
    
    setIntegrityAlert({
      isOpen: true,
      type,
      item,
      canDelete: check.canDelete,
      linkedCount: check.linkedCount,
      sampleTransactions: check.sampleTransactions,
      reason: check.reason
    });
  };

  // Confirm deletion
  const confirmDeleteAction = async (forceSoftDelete: boolean = false) => {
    if (!integrityAlert) return;
    const { type, item } = integrityAlert;
    const singleType = type.slice(0, -1);

    try {
      const res = await gasService.deleteSettingItem(singleType, item.id, forceSoftDelete);
      if (res.success) {
        if (res.softDeleted) {
          // Update in local state to inactive
          handleToggleActive(type as ActiveSubTab, item.id);
        } else {
          // Remove from local state
          if (type === 'branches') {
            const updated = branches.filter(b => b.id !== item.id);
            await saveAllSettings(updated, categories, vendors, employees);
          } else if (type === 'categories') {
            const updated = categories.filter(c => c.id !== item.id);
            await saveAllSettings(branches, updated, vendors, employees);
          } else if (type === 'vendors') {
            const updated = vendors.filter(v => v.id !== item.id);
            await saveAllSettings(branches, categories, updated, employees);
          } else if (type === 'employees') {
            const updated = employees.filter(e => e.id !== item.id);
            await saveAllSettings(branches, categories, vendors, updated);
          }
        }
      }
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setIntegrityAlert(null);
    }
  };

  // Handle Save from Add/Edit Modal
  const handleModalSave = async (formData: any) => {
    if (!editModalItem) return;
    const { type, item } = editModalItem;
    const isNew = !item;

    if (type === 'branches') {
      let updated: BranchSetting[];
      if (isNew) {
        const nextNum = branches.length + 1;
        const newBranch: BranchSetting = {
          id: `BR-${String(nextNum).padStart(3, '0')}`,
          branchId: `BR-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          isActive: formData.isActive ?? true,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...branches, newBranch];
      } else {
        updated = branches.map(b => b.id === item.id ? { ...b, ...formData } : b);
      }
      await saveAllSettings(updated, categories, vendors, employees);
    } else if (type === 'categories') {
      let updated: CategorySetting[];
      if (isNew) {
        const nextNum = categories.length + 1;
        const newCat: CategorySetting = {
          id: `CAT-${String(nextNum).padStart(3, '0')}`,
          categoryId: `CAT-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          parentCategory: formData.parentCategory || 'تشغيلي',
          isActive: formData.isActive ?? true,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...categories, newCat];
      } else {
        updated = categories.map(c => c.id === item.id ? { ...c, ...formData } : c);
      }
      await saveAllSettings(branches, updated, vendors, employees);
    } else if (type === 'vendors') {
      let updated: VendorSetting[];
      if (isNew) {
        const nextNum = vendors.length + 1;
        const newVendor: VendorSetting = {
          id: `VEN-${String(nextNum).padStart(3, '0')}`,
          vendorId: `VEN-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          contactInfo: formData.contactInfo || '',
          isActive: formData.isActive ?? true,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...vendors, newVendor];
      } else {
        updated = vendors.map(v => v.id === item.id ? { ...v, ...formData } : v);
      }
      await saveAllSettings(branches, categories, updated, employees);
    } else if (type === 'employees') {
      let updated: EmployeeSetting[];
      if (isNew) {
        const nextNum = employees.length + 1;
        const newEmp: EmployeeSetting = {
          id: `EMP-${String(nextNum).padStart(3, '0')}`,
          employeeId: `EMP-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          role: formData.role || 'أمين عهدة / محاسب',
          isActive: formData.isActive ?? true,
          balance: 0,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...employees, newEmp];
      } else {
        updated = employees.map(e => e.id === item.id ? { ...e, ...formData } : e);
      }
      await saveAllSettings(branches, categories, vendors, updated);
    }

    setEditModalItem(null);
  };

  // Run Google Apps Script Automation
  const handleRunSetupScript = async () => {
    setScriptFeedback(null);
    setLoading(true);
    try {
      const res = await gasService.runSetupSettingsSheet();
      if (res.success) {
        setScriptFeedback({
          type: 'success',
          message: res.message || 'تم فحص وإنشاء شيت Settings بنجاح تام دون أي مساس بالبيانات السابقة!'
        });
        await loadSettings();
      } else {
        setScriptFeedback({
          type: 'error',
          message: res.error || 'تعذر تشغيل السكريبت تلقائياً. يمكنك نسخ الكود أدناه وتثبيته في شيت جوجل.'
        });
      }
    } catch (e: any) {
      setScriptFeedback({
        type: 'error',
        message: e.message || 'خطأ أثناء الاتصال بسكريبت جوجل'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunSchemaScript = async () => {
    setScriptFeedback(null);
    setLoading(true);
    try {
      const res = await gasService.runSafeSchemaUpdate();
      if (res.success) {
        setScriptFeedback({
          type: 'success',
          message: res.message || 'تم تحديث الأعمدة المحاسبية جهة اليمين بنجاح تام!'
        });
      } else {
        setScriptFeedback({
          type: 'error',
          message: res.error || 'تعذر إضافة الأعمدة تلقائياً.'
        });
      }
    } catch (e: any) {
      setScriptFeedback({
        type: 'error',
        message: e.message || 'خطأ أثناء فحص الأعمدة'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_FULL_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Filtered lists
  const filteredBranches = useMemo(() => {
    return branches.filter(b => {
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.branchId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? b.isActive : !b.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [branches, searchQuery, statusFilter]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.categoryId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.parentCategory && c.parentCategory.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? c.isActive : !c.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        v.vendorId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (v.contactInfo && v.contactInfo.includes(searchQuery));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? v.isActive : !v.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchQuery, statusFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (e.role && e.role.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? e.isActive : !e.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 lg:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black tracking-wide mb-3">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>ميثاق الحفظ التام وعدم المساس بالبيانات التاريخية</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>إدارة الإعدادات المركزية والجداول المرجعية</span>
              <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-xl font-bold">
                Settings Sheet
              </span>
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl font-medium leading-relaxed">
              تحكم مركزي كامل في فروع الشركة، شجرة التصنيفات والبنود، سجل الموردين المعتمدين، ومسؤولي العهد. مع تطبيق صارم لقواعد سلامة الربط المحاسبي (Referential Integrity) لمنع فقدان البيانات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadSettings()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-2xl text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={() => setActiveTab('scripts')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Code size={15} />
              <span>سكريبت Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Safety Guarantee Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-700/60 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span><strong>شيت Settings:</strong> هيكل مستقل</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span><strong>حفظ الحركات:</strong> 0% حذف تاريخي</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            <span><strong>سلامة الربط:</strong> فحص قبل الحذف</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span><strong>توسيع الأعمدة:</strong> لليمين فقط</span>
          </div>
        </div>
      </div>

      {/* Navigation SubTabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'branches'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Building2 size={16} />
          <span>فروع الشركة والمواقع</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'branches' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {branches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Tag size={16} />
          <span>شجرة التصنيفات والبنود</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'categories' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {categories.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vendors'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Briefcase size={16} />
          <span>الموردون والشركات</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'vendors' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {vendors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'employees'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Users size={16} />
          <span>الموظفون والمسؤولون</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'employees' ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'scripts'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Code size={16} />
          <span>أكواد التهيئة والترحيل (GAS)</span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
            جاهز
          </span>
        </button>
      </div>

      {/* Main Tab Contents */}
      {activeTab !== 'scripts' ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 max-w-lg">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو المعرف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نشط
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === 'inactive' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  معطل
                </button>
              </div>
            </div>

            <button
              onClick={() => setEditModalItem({ type: activeTab })}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>
                {activeTab === 'branches' && 'إضافة فرع جديد'}
                {activeTab === 'categories' && 'إضافة بند / تصنيف جديد'}
                {activeTab === 'vendors' && 'إضافة مورد معتمد'}
                {activeTab === 'employees' && 'إضافة موظف / مسؤول عهدة'}
              </span>
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            {activeTab === 'branches' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود الفرع (BranchID)</th>
                    <th className="py-3 px-4">اسم الفرع / الموقع (BranchName)</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredBranches.map(branch => (
                    <tr key={branch.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{branch.branchId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Building2 size={15} className="text-emerald-600" />
                        <span>{branch.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('branches', branch.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            branch.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {branch.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'branches', item: branch })}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('branches', branch)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن مع فحص السلامة"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        لا توجد فروع مطابقة لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'categories' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود البند (CategoryID)</th>
                    <th className="py-3 px-4">اسم البند / التصنيف (CategoryName)</th>
                    <th className="py-3 px-4">التصنيف الأب (ParentCategory)</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredCategories.map(cat => (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{cat.categoryId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Tag size={15} className="text-blue-600" />
                        <span>{cat.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px]">
                          {cat.parentCategory || 'عام'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('categories', cat.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            cat.isActive
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${cat.isActive ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                          {cat.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'categories', item: cat })}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('categories', cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        لا توجد تصنيفات مطابقة لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'vendors' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود المورد (VendorID)</th>
                    <th className="py-3 px-4">اسم المورد / الشركة (VendorName)</th>
                    <th className="py-3 px-4">بيانات التواصل (ContactInfo)</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredVendors.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{vendor.vendorId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase size={15} className="text-purple-600" />
                        <span>{vendor.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {vendor.contactInfo ? (
                          <span className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Phone size={13} className="text-slate-400" />
                            {vendor.contactInfo}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('vendors', vendor.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            vendor.isActive
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${vendor.isActive ? 'bg-purple-500' : 'bg-slate-400'}`}></span>
                          {vendor.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'vendors', item: vendor })}
                            className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('vendors', vendor)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVendors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        لا يوجد موردون مطابقون لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'employees' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود الموظف (EmployeeID)</th>
                    <th className="py-3 px-4">اسم الموظف / العهدة (EmployeeName)</th>
                    <th className="py-3 px-4">الدور / الوظيفة (Role)</th>
                    <th className="py-3 px-4">الرصيد المحسوب</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{emp.employeeId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Users size={15} className="text-amber-600" />
                        <span>{emp.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px]">
                          {emp.role || 'مسؤول عهدة'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {emp.balance !== undefined ? `${formatKWD(emp.balance)} د.ك` : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('employees', emp.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            emp.isActive
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${emp.isActive ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                          {emp.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'employees', item: emp })}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('employees', emp)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        لا يوجد موظفون مطابقون لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Google Apps Script & Safe Migration Tab */
        <div className="space-y-6">
          {/* Action triggers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <FileSpreadsheet size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">1. تهيئة شيت الإعدادات setupSettingsSheet()</h3>
                    <p className="text-xs text-slate-500 font-medium">إنشاء وفحص جداول Settings الأربعة دون حذف أي سجل سابق</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  يقوم بفحص ملف جوجل شيت الخاص بك؛ إذا كان شيت <strong>Settings</strong> غير موجود، ينشئه بجداوله الأربعة (الفروع، التصنيفات، الموردين، الموظفين). إذا كان موجوداً، يحافظ على بياناتك المسجلة 100% ويسجل العملية في شيت SetupLog.
                </p>
              </div>
              <button
                onClick={handleRunSetupScript}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} />
                <span>تشغيل الفحص والتهيئة في Google Sheets الآن</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-blue-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-100 text-blue-800 rounded-2xl">
                    <Database size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">2. التحديث الآمن للأعمدة safeSchemaUpdate()</h3>
                    <p className="text-xs text-slate-500 font-medium">إضافة الأعمدة المحاسبية الناقصة جهة اليمين فقط</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  يفحص شيت المعاملات ويتأكد من وجود الأعمدة: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">targetMonth</code>، <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">vendorName</code>، <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">linkedAccrualId</code>، <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">isSettlement</code>. يضيف الناقص منها جهة اليمين دون إزاحة أي عمود.
                </p>
              </div>
              <button
                onClick={handleRunSchemaScript}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Layers size={16} />
                <span>تشغيل التحديث الآمن للأعمدة الآن</span>
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {scriptFeedback && (
            <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
              scriptFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              {scriptFeedback.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              )}
              <span>{scriptFeedback.message}</span>
            </div>
          )}

          {/* Full Code Display */}
          <div className="bg-slate-950 text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Code size={18} className="text-emerald-400" />
                  <span>الكود البرمجي الكامل لسكريبت Google Apps Script (.gs)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  يتضمن دوال setupSettingsSheet و safeSchemaUpdate و onEdit(e) لحماية البيانات
                </p>
              </div>

              <button
                onClick={copyScriptToClipboard}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  copiedCode 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCode ? 'تم النسخ بنجاح!' : 'نسخ الكود بالكامل'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900/90 rounded-2xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96 leading-relaxed border border-slate-800/80">
              {GOOGLE_APPS_SCRIPT_FULL_CODE}
            </pre>
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      <AnimatePresence>
        {editModalItem && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  {editModalItem.item ? <Edit3 size={16} className="text-emerald-600" /> : <Plus size={16} className="text-emerald-600" />}
                  <span>
                    {editModalItem.item ? 'تعديل بيانات البند' : 'إضافة بند جديد'} (
                    {editModalItem.type === 'branches' && 'فرع'}
                    {editModalItem.type === 'categories' && 'تصنيف'}
                    {editModalItem.type === 'vendors' && 'مورد'}
                    {editModalItem.type === 'employees' && 'موظف'}
                    )
                  </span>
                </h3>
                <button
                  onClick={() => setEditModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as any;
                  const formData: any = {
                    name: target.name.value,
                    isActive: target.isActive.checked
                  };
                  if (target.parentCategory) formData.parentCategory = target.parentCategory.value;
                  if (target.contactInfo) formData.contactInfo = target.contactInfo.value;
                  if (target.role) formData.role = target.role.value;
                  handleModalSave(formData);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الاسم / البيان *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editModalItem.item?.name || ''}
                    placeholder="أدخل الاسم بوضوح..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {editModalItem.type === 'categories' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      التصنيف الرئيسي (Parent Category)
                    </label>
                    <select
                      name="parentCategory"
                      defaultValue={editModalItem.item?.parentCategory || 'تشغيلي'}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      {PARENT_CATEGORIES.map(pc => (
                        <option key={pc} value={pc}>{pc}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editModalItem.type === 'vendors' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      رقم الهاتف أو بيانات الاتصال
                    </label>
                    <input
                      type="text"
                      name="contactInfo"
                      defaultValue={editModalItem.item?.contactInfo || ''}
                      placeholder="هاتف المورد، البريد..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                )}

                {editModalItem.type === 'employees' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      المسمى الوظيفي / الدور
                    </label>
                    <input
                      type="text"
                      name="role"
                      defaultValue={editModalItem.item?.role || 'أمين عهدة / محاسب'}
                      placeholder="مثال: كاشير، أمين عهدة، مدير..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    defaultChecked={editModalItem.item?.isActive ?? true}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    متاح ونشط في القوائم المنسدلة للتطبيق
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditModalItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Referential Integrity Safety Modal */}
      <AnimatePresence>
        {integrityAlert && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-2xl shrink-0 ${integrityAlert.canDelete ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                  {integrityAlert.canDelete ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {integrityAlert.canDelete ? 'تأكيد الحذف الآمن للبند' : 'حماية الربط المحاسبي (Referential Integrity)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    البند: <strong className="text-slate-800">{integrityAlert.item.name}</strong>
                  </p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl text-xs leading-relaxed font-medium border ${
                integrityAlert.canDelete 
                  ? 'bg-amber-50 text-amber-900 border-amber-200' 
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}>
                {integrityAlert.reason}
              </div>

              {/* Sample transactions preview if linked */}
              {!integrityAlert.canDelete && integrityAlert.sampleTransactions && integrityAlert.sampleTransactions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-black text-slate-700">نماذج من الحركات المالية المرتبطة بهذا البند:</p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {integrityAlert.sampleTransactions.map(tx => (
                      <div key={tx.id} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] flex items-center justify-between">
                        <span className="font-mono text-slate-500">{tx.date}</span>
                        <span className="text-slate-700 font-bold truncate max-w-[200px]">{tx.description || tx.type}</span>
                        <span className="font-bold text-slate-900 font-mono">{formatKWD(tx.amount)} د.ك</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIntegrityAlert(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء التراجع
                </button>

                {!integrityAlert.canDelete ? (
                  <button
                    type="button"
                    onClick={() => confirmDeleteAction(true)}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Power size={14} />
                    <span>تعطيل البند (إلغاء تنشيطه لحفظ السجلات)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmDeleteAction(false)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>حذف نهائي (غير مرتبط بأي حركات)</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
