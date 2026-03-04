import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Plus, Trash2, Edit2, Save, X, Building2, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import { gasService } from '../services/gasService';

interface SettingsManagerProps {
  branches: string[];
  categories: string[];
  onRefresh: () => void;
}

export default function SettingsManager({ branches, categories, onRefresh }: SettingsManagerProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<{ type: 'branches' | 'categories', index: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = async (type: 'branches' | 'categories') => {
    if (!newItem.trim()) return;
    setLoading(type);
    const currentItems = type === 'branches' ? branches : categories;
    const updatedItems = [...currentItems, newItem.trim()];
    const res = await gasService.updateSettings(type, updatedItems);
    if (res.success) {
      setNewItem('');
      onRefresh();
    } else {
      alert('خطأ: ' + res.error);
    }
    setLoading(null);
  };

  const handleDelete = async (type: 'branches' | 'categories', index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا البند؟')) return;
    setLoading(type);
    const currentItems = type === 'branches' ? [...branches] : [...categories];
    currentItems.splice(index, 1);
    const res = await gasService.updateSettings(type, currentItems);
    if (res.success) {
      onRefresh();
    } else {
      alert('خطأ: ' + res.error);
    }
    setLoading(null);
  };

  const handleUpdate = async (type: 'branches' | 'categories', index: number) => {
    if (!editValue.trim()) return;
    setLoading(type);
    const currentItems = type === 'branches' ? [...branches] : [...categories];
    currentItems[index] = editValue.trim();
    const res = await gasService.updateSettings(type, currentItems);
    if (res.success) {
      setEditingIndex(null);
      onRefresh();
    } else {
      alert('خطأ: ' + res.error);
    }
    setLoading(null);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-12 text-center">
        <div className="inline-block p-4 bg-gray-900 text-white rounded-3xl mb-6 shadow-2xl">
          <Settings size={32} />
        </div>
        <h2 className="text-4xl font-black text-gray-900 tracking-tight">إعدادات النظام</h2>
        <p className="text-gray-500 mt-2 font-medium">إدارة الأفرع وتصنيفات العمليات المالية</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Branches Management */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">الأفرع</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">إدارة قائمة أفرع الشركة</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full">
              {branches.length} فرع
            </span>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="اسم الفرع الجديد..."
                value={loading === 'branches' ? '' : newItem}
                onChange={(e) => setNewItem(e.target.value)}
                className="flex-1 px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all"
              />
              <button
                onClick={() => handleAdd('branches')}
                disabled={!!loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading === 'branches' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                إضافة
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              <AnimatePresence mode="popLayout">
                {branches.map((branch, idx) => (
                  <motion.div
                    key={branch + idx}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-lg hover:border-gray-100 border border-transparent transition-all"
                  >
                    {editingIndex?.type === 'branches' && editingIndex.index === idx ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-1 bg-white border border-blue-200 rounded-lg outline-none font-bold"
                        />
                        <button onClick={() => handleUpdate('branches', idx)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Save size={18} />
                        </button>
                        <button onClick={() => setEditingIndex(null)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-gray-700">{branch}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => {
                              setEditingIndex({ type: 'branches', index: idx });
                              setEditValue(branch);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete('branches', idx)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Categories Management */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Tag size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">التصنيفات</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">إدارة بنود المصروفات والإيرادات</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">
              {categories.length} بند
            </span>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="اسم التصنيف الجديد..."
                value={loading === 'categories' ? '' : newItem}
                onChange={(e) => setNewItem(e.target.value)}
                className="flex-1 px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none font-bold transition-all"
              />
              <button
                onClick={() => handleAdd('categories')}
                disabled={!!loading}
                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading === 'categories' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                إضافة
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              <AnimatePresence mode="popLayout">
                {categories.map((category, idx) => (
                  <motion.div
                    key={category + idx}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-lg hover:border-gray-100 border border-transparent transition-all"
                  >
                    {editingIndex?.type === 'categories' && editingIndex.index === idx ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-1 bg-white border border-emerald-200 rounded-lg outline-none font-bold"
                        />
                        <button onClick={() => handleUpdate('categories', idx)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Save size={18} />
                        </button>
                        <button onClick={() => setEditingIndex(null)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-gray-700">{category}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => {
                              setEditingIndex({ type: 'categories', index: idx });
                              setEditValue(category);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete('categories', idx)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
