import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Building, 
  User, 
  Tag, 
  ArrowDownRight, 
  ArrowUpRight, 
  Printer, 
  Download, 
  RefreshCw, 
  FileSpreadsheet, 
  Hash, 
  Coins, 
  CheckCircle2, 
  X, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  ArrowRightLeft
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { formatKWD, isTransferType, isExpenseType, isIncomeType } from '../utils/format';

interface SearchResultRow {
  index: number;
  date: string;
  time?: string;
  branch: string;
  type: string;
  category: string;
  income: number;
  expense: number;
  employee: string;
  description: string;
  rawRow: any;
}

interface GlobalSearchProps {
  branches: string[];
  categories: string[];
  employees: string[];
}

export default function GlobalSearch({ branches, categories, employees }: GlobalSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [allRows, setAllRows] = useState<SearchResultRow[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Selected Transaction for Detail Modal / Receipt
  const [selectedTx, setSelectedTx] = useState<SearchResultRow | null>(null);

  // Initial load or execute search
  const performSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const reportData = await gasService.getReport({
        branch: 'All',
        startDate: startDate || '2020-01-01',
        endDate: endDate || '2030-12-31'
      });

      if (reportData && reportData.rows) {
        const parsed: SearchResultRow[] = reportData.rows.map((row: any, idx: number) => {
          const date = String(row[0] || '');
          const time = row.length > 1 ? String(row[1] || '') : '';
          const branch = String(row[2] || 'عام');
          const type = String(row[3] || '');
          const category = String(row[4] || '');
          const income = parseFloat(String(row[5])) || 0;
          const expense = parseFloat(String(row[6])) || 0;
          const employee = String(row[7] || '');
          const description = row.length > 8 ? String(row[8] || '') : '';

          return {
            index: idx + 1,
            date,
            time,
            branch,
            type,
            category,
            income,
            expense,
            employee,
            description,
            rawRow: row
          };
        });

        setAllRows(parsed);
      }
    } catch (err) {
      console.error('Error in global search:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, []);

  // Filter matching rows with high-performance memoization
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      // 1. Branch
      if (selectedBranch !== 'All' && row.branch !== selectedBranch) return false;

      // 2. Category
      if (selectedCategory !== 'All' && !row.category.toLowerCase().includes(selectedCategory.toLowerCase())) return false;

      // 3. Employee
      if (selectedEmployee !== 'All' && row.employee !== selectedEmployee) return false;

      // 4. Type
      if (selectedType === 'Expense' && (!isExpenseType(row.type, row.category) || row.expense <= 0)) return false;
      if (selectedType === 'Income' && (!isIncomeType(row.type, row.category) || row.income <= 0)) return false;
      if (selectedType === 'Transfer' && !isTransferType(row.type, row.category)) return false;

      // 5. Amount Range
      const val = row.expense > 0 ? row.expense : row.income;
      if (minAmount && parseFloat(minAmount) > 0 && val < parseFloat(minAmount)) return false;
      if (maxAmount && parseFloat(maxAmount) > 0 && val > parseFloat(maxAmount)) return false;

      // 6. Free text query
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const matchDesc = row.description.toLowerCase().includes(q);
        const matchCat = row.category.toLowerCase().includes(q);
        const matchEmp = row.employee.toLowerCase().includes(q);
        const matchBranch = row.branch.toLowerCase().includes(q);
        const matchDate = row.date.toLowerCase().includes(q);
        const matchAmount = val.toString().includes(q);
        const matchIndex = row.index.toString().includes(q);

        return matchDesc || matchCat || matchEmp || matchBranch || matchDate || matchAmount || matchIndex;
      }

      return true;
    });
  }, [allRows, selectedBranch, selectedCategory, selectedEmployee, selectedType, minAmount, maxAmount, searchTerm]);

  // Calculate search result KPIs with memoization
  const { totalInflow, totalOutflow, netCashflow } = useMemo(() => {
    const inflow = filteredRows.reduce((acc, r) => acc + (isTransferType(r.type, r.category) ? 0 : r.income), 0);
    const outflow = filteredRows.reduce((acc, r) => acc + (isTransferType(r.type, r.category) ? 0 : r.expense), 0);
    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netCashflow: inflow - outflow
    };
  }, [filteredRows]);

  // Export search results to CSV
  const handleExportCSV = () => {
    const headers = ['المسلسل', 'التاريخ', 'الوقت', 'الفرع', 'نوع العملية', 'التصنيف', 'الوارد (د.ك)', 'المنصرف (د.ك)', 'الموظف المسؤول', 'البيان'];
    const rows = filteredRows.map(r => [
      r.index,
      `"${r.date}"`,
      `"${r.time}"`,
      `"${r.branch}"`,
      `"${r.type}"`,
      `"${r.category}"`,
      r.income,
      r.expense,
      `"${r.employee}"`,
      `"${r.description.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financial_search_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedBranch('All');
    setSelectedCategory('All');
    setSelectedEmployee('All');
    setSelectedType('All');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200 pb-8 no-print">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-[2px] bg-blue-600"></div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Universal Financial Audit & Search</span>
          </div>
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter">
            محرك البحث والتدقيق <span className="text-blue-600 italic font-serif font-light">الشامل لكافة العمليات</span>
          </h2>
          <p className="text-gray-500 max-w-2xl font-medium text-base leading-relaxed">
            البحث اللحظي الذكي بدلالة أي نص، رقم فاتورة، قيمة مالية، أو نطاق زمني مع ربط البيانات التاريخية وتطبيق الفلاتر المتعددة بدقة مالية متكاملة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            تصدير نتائج البحث (Excel/CSV)
          </button>

          <button
            onClick={performSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-full font-black text-xs transition-all hover:bg-gray-800 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            إعادة البحث
          </button>
        </div>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm no-print">
        
        {/* Search input field */}
        <div className="relative">
          <Search size={22} className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-600" />
          <input
            type="text"
            placeholder="ابحث بدلالة أي كلمة (رقم الفاتورة، اسم الشركة، اسم المورد، البيان، المبلغ، اسم الموظف)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-16 pl-6 py-5 bg-blue-50/40 border-2 border-gray-900 rounded-2xl font-bold text-base text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Multi-Criteria Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          
          {/* Branch */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building size={14} className="text-blue-600" /> الفرع
            </label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة الفروع</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={14} className="text-blue-600" /> التصنيف
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة التصنيفات</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Employee */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} className="text-blue-600" /> الموظف
            </label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة الموظفين</option>
              {employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Transaction Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={14} className="text-blue-600" /> نوع العملية
            </label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">الكل (مصروف/إيراد/تحويل)</option>
              <option value="Expense">مصروفات فقط 🔴</option>
              <option value="Income">إيرادات ومبيعات فقط 🟢</option>
              <option value="Transfer">تحويل حركة عهدة 🔵</option>
            </select>
          </div>

        </div>

        {/* Amount & Date Range Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">الحد الأدنى للمبلغ (د.ك)</label>
            <input
              type="number"
              placeholder="0.000"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">الحد الأقصى للمبلغ (د.ك)</label>
            <input
              type="number"
              placeholder="0.000"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

        </div>

        {/* Clear Filters */}
        <div className="flex justify-end">
          <button
            onClick={resetFilters}
            className="text-xs font-black text-rose-600 hover:text-rose-700 underline cursor-pointer"
          >
            إعادة ضبط كافة الفلاتر والقيود
          </button>
        </div>

      </div>

      {/* Results KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">عدد نتائج البحث</span>
          <div className="text-3xl font-black font-mono text-gray-900 mt-1">
            {filteredRows.length} <span className="text-xs font-sans text-gray-400">عملية</span>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي الوارد بالبحث</span>
          <div className="text-3xl font-black font-mono text-emerald-600 mt-1">
            {formatKWD(totalInflow)} <span className="text-xs font-sans text-emerald-400">KWD</span>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إجمالي المنصرف بالبحث</span>
          <div className="text-3xl font-black font-mono text-rose-600 mt-1">
            {formatKWD(totalOutflow)} <span className="text-xs font-sans text-rose-400">KWD</span>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">صافي محصلة نتائج البحث</span>
          <div className={`text-3xl font-black font-mono mt-1 ${netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatKWD(netCashflow)} <span className="text-xs font-sans text-gray-400">KWD</span>
          </div>
        </div>

      </div>

      {/* Results Table */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900">سجل نتائج البحث التفصيلي ({filteredRows.length})</h3>
            <p className="text-xs font-bold text-gray-400 mt-1">مرتبة بحسب السلسلة والترتيب الزمني مع إمكانية المعاينة والطباعة</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black flex items-center gap-2 no-print cursor-pointer"
          >
            <Printer size={14} />
            طباعة الكشف
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto" />
            <p className="font-black text-sm text-gray-500">جاري البحث المطابق في قواعد البيانات و Google Sheets...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Search size={40} className="text-gray-300 mx-auto" />
            <p className="font-black text-gray-600 text-base">لا توجد عمليات تطابق كلمات وفلاتر البحث التي أدخلتها</p>
            <button
              onClick={resetFilters}
              className="text-xs font-black text-blue-600 underline cursor-pointer"
            >
              إلغاء قيود البحث والبدء من جديد
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border-2 border-gray-900">
              <thead>
                <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-5 py-4 border-l border-white/10 text-center">#</th>
                  <th className="px-5 py-4 border-l border-white/10">التاريخ والوقت</th>
                  <th className="px-5 py-4 border-l border-white/10">الفرع</th>
                  <th className="px-5 py-4 border-l border-white/10">التصنيف</th>
                  <th className="px-5 py-4 border-l border-white/10">الموظف المسؤول</th>
                  <th className="px-5 py-4 border-l border-white/10">البيان والتفاصيل</th>
                  <th className="px-5 py-4 border-l border-white/10 text-center">الوارد (إيراد)</th>
                  <th className="px-5 py-4 border-l border-white/10 text-center">المنصرف (مصروف)</th>
                  <th className="px-5 py-4 text-center no-print">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-900 font-bold text-xs text-gray-800">
                {filteredRows.map((row) => {
                  const isTransfer = isTransferType(row.type, row.category);
                  return (
                    <tr key={row.index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-4 border-l border-gray-900 font-mono text-center text-gray-400 font-black">
                        {row.index}
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 font-mono text-gray-600 whitespace-nowrap">
                        <div>{row.date}</div>
                        {row.time && <div className="text-[10px] text-gray-400">{row.time}</div>}
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 font-black whitespace-nowrap">
                        {row.branch}
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black inline-block ${
                          isTransfer ? 'bg-blue-100 text-blue-900' : 
                          row.expense > 0 ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          {row.category}
                        </span>
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 whitespace-nowrap font-black">
                        {row.employee || '-'}
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 max-w-md font-medium text-gray-700 leading-snug">
                        {row.description}
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 text-center font-mono font-black text-emerald-600 whitespace-nowrap">
                        {row.income > 0 ? formatKWD(row.income) : '-'}
                      </td>

                      <td className="px-5 py-4 border-l border-gray-900 text-center font-mono font-black text-rose-600 whitespace-nowrap">
                        {row.expense > 0 ? formatKWD(row.expense) : '-'}
                      </td>

                      <td className="px-5 py-4 text-center no-print whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTx(row)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-[11px] font-black cursor-pointer transition-all inline-flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> معاينة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-gray-900 rounded-[2.5rem] max-w-lg w-full p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl">
                    <Hash size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">سند العملية المالية #{selectedTx.index}</h3>
                    <p className="text-xs font-bold text-gray-400">تاريخ القيد: {selectedTx.date}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="text-gray-400 hover:text-gray-600 font-black text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 font-bold text-xs text-gray-800">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-400">الفرع:</span>
                  <span className="font-black text-gray-900">{selectedTx.branch}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-400">التصنيف الرئيسي:</span>
                  <span className="font-black text-blue-600">{selectedTx.category}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-400">الموظف المسؤول:</span>
                  <span className="font-black text-gray-900">{selectedTx.employee || 'عام'}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-400">المبلغ الإجمالي:</span>
                  <span className="font-mono text-base font-black text-gray-900">
                    {formatKWD(selectedTx.expense > 0 ? selectedTx.expense : selectedTx.income)} KWD
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-gray-400">البيان والتفاصيل:</span>
                  <p className="p-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-900 leading-relaxed">
                    {selectedTx.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={16} /> طباعة السند
                </button>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-black text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
